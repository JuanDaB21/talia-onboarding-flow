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
import { getTokens } from "./api-client";

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

class RealtimeManager {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private backoff = 1000;
  private closed = false;

  private topics(): string[] {
    return Array.from(new Set(Array.from(this.listeners, (l) => l.table)));
  }

  private ensure(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      this.sendSubscribe();
      return;
    }
    const token = getTokens()?.access;
    if (!token) return; // sin sesión no hay realtime
    this.closed = false;
    const url = `${WS_URL}?token=${encodeURIComponent(token)}&topics=${encodeURIComponent(this.topics().join(","))}`;
    const ws = new WebSocket(url);
    this.ws = ws;
    ws.onopen = () => {
      this.backoff = 1000;
      this.sendSubscribe();
    };
    ws.onmessage = (ev) => this.onMessage(ev);
    ws.onclose = () => {
      this.ws = null;
      if (!this.closed && this.listeners.size > 0) {
        setTimeout(() => this.ensure(), this.backoff);
        this.backoff = Math.min(this.backoff * 2, 15000);
      }
    };
    ws.onerror = () => ws.close();
  }

  private sendSubscribe(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "subscribe", topics: this.topics() }));
    }
  }

  private onMessage(ev: MessageEvent): void {
    let msg: { type: string; events?: ServerEvent[] };
    try {
      msg = JSON.parse(ev.data as string);
    } catch {
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
    this.ensure();
  }

  remove(listeners: Listener[]): void {
    listeners.forEach((l) => this.listeners.delete(l));
    if (this.listeners.size === 0) {
      this.closed = true;
      this.ws?.close();
      this.ws = null;
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
