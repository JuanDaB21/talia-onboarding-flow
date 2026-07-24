/**
 * Cliente de realtime propio (WebSocket) con una API tipo Supabase para que la
 * migración de los componentes sea un cambio de import, no de lógica:
 *
 *   const ch = realtime.channel("servicio")
 *     .on("postgres_changes", { table: "mesas", event: "UPDATE" }, (p) => { p.new ... })
 *     .subscribe();
 *   realtime.removeChannel(ch);
 *
 * Bajo el capó: una sola conexión WS por sesión, suscrita a la unión de topics
 * (= tablas). El backend empuja eventos incrementales scopeados por negocio
 * (CONTRATO P3). Reconecta con backoff.
 */
import { toast } from "sonner";
import { getTokens, setTokens, onAuthExpired, tryRefresh } from "./api-client";

const WS_URL = import.meta.env.VITE_WS_URL ?? "ws://localhost:3000/realtime";

export interface ChangePayload {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

type Handler = (payload: ChangePayload) => void;

interface Listener {
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  handler: Handler;
}

interface ServerEvent {
  topic: string;
  table: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  row: Record<string, unknown>;
}

/** Cada cuánto le pedimos eco al servidor para saber que el socket sigue vivo. */
const PING_MS = 25_000;
/** Sin nada del servidor por más de esto, damos el socket por muerto. */
const SILENCIO_MAX_MS = 60_000;
const VIGILANCIA_MS = 15_000;
/** Un handshake que no abre en este plazo se aborta y se reintenta. */
const HANDSHAKE_MAX_MS = 12_000;

class RealtimeManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private backoff = 1000;
  private closed = false;
  private conectando = false;
  /** El handshake anterior falló con 1008: hay que refrescar antes de reintentar. */
  private necesitaRefresh = false;
  private ultimoMensaje = 0;
  private vigilante: ReturnType<typeof setInterval> | null = null;
  private pinger: ReturnType<typeof setInterval> | null = null;

  constructor() {
    if (typeof window === "undefined") return;
    // El caso real: el mesero bloquea el celular, el NAT descarta la sesión TCP y
    // al volver la pantalla está muerta porque `onclose` nunca llegó a dispararse.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.revisarAhora();
    });
    window.addEventListener("online", () => this.revisarAhora());
    // Si la sesión murió de verdad, dejamos de reintentar.
    onAuthExpired.addEventListener("expired", () => {
      this.closed = true;
      this.cerrarSocket();
    });
  }

  private topics(): string[] {
    return Array.from(new Set(Array.from(this.listeners, (l) => l.table)));
  }

  /** Reconexión inmediata (sin esperar el backoff) tras volver de background/red. */
  private revisarAhora(): void {
    if (this.closed || this.listeners.size === 0) return;
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Puede estar medio-abierto: que el vigilante lo compruebe con un ping.
      this.enviarPing();
      return;
    }
    this.backoff = 1000;
    void this.ensure();
  }

  private async ensure(): Promise<void> {
    if (this.closed || this.listeners.size === 0) return;
    if (this.conectando) return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.sendSubscribe();
      return;
    }
    this.conectando = true;
    try {
      // Sin esto, un access token vencido reconectaba en bucle infinito: el backend
      // cierra con 1008 y el cliente reintentaba con el MISMO token para siempre.
      if (this.necesitaRefresh) {
        this.necesitaRefresh = false;
        const r = await tryRefresh();
        if (r === "rechazado") {
          this.closed = true;
          return;
        }
      }
      const token = getTokens()?.access;
      if (!token) return; // sin sesión no hay realtime
      const url = `${WS_URL}?token=${encodeURIComponent(token)}&topics=${encodeURIComponent(this.topics().join(","))}`;
      const ws = new WebSocket(url);
      this.ws = ws;
      this.ultimoMensaje = Date.now();
      ws.onopen = () => {
        this.backoff = 1000;
        this.ultimoMensaje = Date.now();
        this.sendSubscribe();
      };
      ws.onmessage = (ev) => this.onMessage(ev);
      ws.onclose = (ev) => {
        if (this.ws !== ws) return; // ya lo reemplazamos: ignorar su cierre tardío
        this.ws = null;
        if (ev.code === 1008) this.necesitaRefresh = true;
        this.programarReconexion();
      };
      ws.onerror = () => ws.close();
      // El handshake también se puede colgar: en los logs se vieron conexiones en
      // CONNECTING durante 56 s. El navegador tarda demasiado en rendirse solo.
      setTimeout(() => {
        if (this.ws === ws && ws.readyState === WebSocket.CONNECTING) ws.close();
      }, HANDSHAKE_MAX_MS);
      this.vigilar();
    } finally {
      this.conectando = false;
    }
  }

  private programarReconexion(): void {
    if (this.closed || this.listeners.size === 0) return;
    // Jitter: sin él todos los dispositivos del local (que se caen juntos en un
    // redeploy o un cambio de WiFi) reconectan en el mismo milisegundo.
    const espera = this.backoff * (0.5 + Math.random());
    this.backoff = Math.min(this.backoff * 2, 15000);
    setTimeout(() => void this.ensure(), espera);
  }

  private enviarPing(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        /* si falla, el vigilante lo detecta por silencio */
      }
    }
  }

  /** Detecta el socket medio-abierto que el navegador nunca reporta como cerrado. */
  private vigilar(): void {
    if (this.vigilante !== null) return;
    this.pinger = setInterval(() => this.enviarPing(), PING_MS);
    this.vigilante = setInterval(() => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.ultimoMensaje < SILENCIO_MAX_MS) return;
      // Lo desacoplamos ANTES de cerrar para que su `onclose` tardío no programe
      // una segunda reconexión.
      const muerto = this.ws;
      this.ws = null;
      try {
        muerto.close();
      } catch {
        /* ignore */
      }
      this.backoff = 1000;
      void this.ensure();
    }, VIGILANCIA_MS);
  }

  private dejarDeVigilar(): void {
    if (this.vigilante !== null) clearInterval(this.vigilante);
    if (this.pinger !== null) clearInterval(this.pinger);
    this.vigilante = null;
    this.pinger = null;
  }

  private cerrarSocket(): void {
    this.dejarDeVigilar();
    const ws = this.ws;
    this.ws = null;
    try {
      ws?.close();
    } catch {
      /* ignore */
    }
  }

  private sendSubscribe(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "subscribe", topics: this.topics() }));
    }
  }

  private onMessage(ev: MessageEvent): void {
    // Cualquier mensaje (incluido el `pong`) prueba que el socket sigue vivo.
    this.ultimoMensaje = Date.now();
    let msg: { type: string; events?: ServerEvent[] };
    try {
      msg = JSON.parse(ev.data as string);
    } catch {
      return;
    }
    if (msg.type === "pong" || msg.type === "ready") return;
    // Sesión única: el backend nos expulsó porque este usuario abrió sesión en otro
    // dispositivo. Cerramos la sesión local y avisamos (mismo flujo que onAuthExpired).
    if (msg.type === "session_revoked") {
      this.closed = true;
      this.cerrarSocket();
      setTokens(null);
      toast.error("Sesión cerrada", {
        description: "Tu usuario inició sesión en otro dispositivo.",
      });
      onAuthExpired.dispatchEvent(new Event("expired"));
      return;
    }
    if (msg.type !== "events" || !msg.events) return;
    for (const e of msg.events) {
      const payload: ChangePayload = {
        eventType: e.op,
        table: e.table,
        new: e.op === "DELETE" ? null : e.row,
        old: e.op === "DELETE" ? e.row : null,
      };
      for (const l of this.listeners) {
        if (l.table === e.topic && (l.event === "*" || l.event === e.op)) {
          try {
            l.handler(payload);
          } catch {
            /* handler error: no romper el bucle */
          }
        }
      }
    }
  }

  add(listeners: Listener[]): void {
    listeners.forEach((l) => this.listeners.add(l));
    // Volver a suscribirse tras un `remove` que dejó todo vacío debe reactivar el
    // manager; si no, `closed` se quedaba en true y no reconectaba nunca más.
    if (getTokens()) this.closed = false;
    void this.ensure();
  }

  remove(listeners: Listener[]): void {
    listeners.forEach((l) => this.listeners.delete(l));
    if (this.listeners.size === 0) {
      this.closed = true;
      this.cerrarSocket();
    } else {
      this.sendSubscribe();
    }
  }
}

const manager = new RealtimeManager();

export interface Channel {
  on(
    kind: "postgres_changes",
    opts: { table: string; event?: "INSERT" | "UPDATE" | "DELETE" | "*"; schema?: string },
    handler: Handler,
  ): Channel;
  subscribe(): Channel;
  _listeners: Listener[];
}

export const realtime = {
  channel(_name: string): Channel {
    const listeners: Listener[] = [];
    const ch: Channel = {
      _listeners: listeners,
      on(_kind, opts, handler) {
        listeners.push({ table: opts.table, event: opts.event ?? "*", handler });
        return ch;
      },
      subscribe() {
        manager.add(listeners);
        return ch;
      },
    };
    return ch;
  },
  removeChannel(ch: Channel): void {
    manager.remove(ch._listeners);
  },
};
