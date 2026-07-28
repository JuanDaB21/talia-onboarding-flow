import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import { BellRing } from "lucide-react";
import {
  isAudioUnlocked,
  startVoiceAlerts,
  stopVoiceAlerts,
  unlockAudio,
} from "@/components/servicio/alerta-sound";

export type AlertaTipo =
  "LLAMADO" | "CUENTA" | "PEDIR_MAS" | "TOMAR_PEDIDO" | "LISTO" | "ASIGNACION";

export type AlertaItem = {
  key: string;
  tipo: AlertaTipo;
  idMesa: string;
  /** Número/identificador visible de la mesa, para el mensaje hablado. */
  identificador?: string;
  titulo?: string;
};

/** Mensaje hablado según el tipo de alerta. */
function mensajeDeAlerta(a: AlertaItem): string {
  const mesa = a.identificador ?? "";
  switch (a.tipo) {
    case "CUENTA":
      return `La mesa ${mesa} pide la cuenta`;
    case "PEDIR_MAS":
      return `La mesa ${mesa} quiere pedir más`;
    case "TOMAR_PEDIDO":
      return `La mesa ${mesa} está lista para ordenar`;
    case "LISTO":
      return `Ya puedes ir a recoger el pedido de la mesa ${mesa}`;
    case "ASIGNACION":
      return `Te asignaron la mesa ${mesa}`;
    case "LLAMADO":
    default:
      return `La mesa ${mesa} te necesita`;
  }
}

type BusContext = {
  push: (a: AlertaItem) => void;
  /** "Me hago cargo": la acción que la resuelve ya se disparó contra el backend. */
  ack: (key: string) => void;
  /**
   * "No me interesa": oculta la alerta solo para este usuario, sin tocar el backend.
   * Un admin ve las alertas de TODAS las mesas y no puede atenderlas él; sin esto se
   * le acumulaban sin forma de quitarlas. A diferencia de `ack`, persiste entre
   * sesiones (localStorage por usuario) — pero `sync` lo poda igual, así que la
   * alerta reaparece si su causa se resuelve y vuelve a ocurrir.
   */
  dismiss: (key: string) => void;
  /**
   * Reconcilia el bus con las alertas realmente vigentes: poda del `Map` (y de los
   * reconocimientos persistidos) toda key que ya no esté en `liveKeys`. Esto para la voz
   * cuando el backend resuelve la alerta desde cualquier pantalla, y permite que una misma
   * key (p. ej. `listo:<idMesa>:<listo_at>`) vuelva a sonar si su origen reaparece.
   */
  sync: (liveKeys: string[]) => void;
  /** Identifica al dueño de los descartes persistidos. Sin esto se compartían entre usuarios del mismo celular. */
  setUsuario: (userId: string | null) => void;
  activas: AlertaItem[];
  /** Keys reconocidas (atendidas) por el usuario. Las tarjetas visibles las ocultan. */
  acked: Set<string>;
  /** Keys descartadas ("no me interesa"). Las tarjetas visibles también las ocultan. */
  dismissed: Set<string>;
};

const Ctx = createContext<BusContext | null>(null);

const ACK_STORAGE_KEY = "alerta-bus:ack";
/** Namespaced por usuario: varios meseros usan el mismo celular por turno. */
const dismissStorageKey = (userId: string | null) =>
  `alerta-bus:dismiss:${userId ?? "anon"}`;

function readSet(storage: "session" | "local", key: string): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = (storage === "session" ? window.sessionStorage : window.localStorage).getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeSet(storage: "session" | "local", key: string, s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    (storage === "session" ? window.sessionStorage : window.localStorage).setItem(
      key,
      JSON.stringify(Array.from(s)),
    );
  } catch {
    // ignorar
  }
}

const readAcked = () => readSet("session", ACK_STORAGE_KEY);
const writeAcked = (s: Set<string>) => writeSet("session", ACK_STORAGE_KEY, s);

export function AlertaBusProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Map<string, AlertaItem>>(() => new Map());
  // `acked` es estado reactivo para que las tarjetas visibles (derivadas de la
  // query en el banner) se oculten al instante al confirmar. `ackedRef` refleja
  // el último valor para las lecturas síncronas de `push`.
  const [acked, setAcked] = useState<Set<string>>(() => readAcked());
  const ackedRef = useRef<Set<string>>(acked);
  ackedRef.current = acked;
  // Descartes: persistidos por usuario (varios meseros comparten el celular). El
  // id llega del banner —viene en GET /servicio/mesas—; hasta entonces, bucket
  // "anon". Solo se guarda en un ref: nada lo renderiza, y así no se pisa entre
  // el `setUsuario` y el render siguiente.
  const [dismissed, setDismissed] = useState<Set<string>>(() =>
    readSet("local", dismissStorageKey(null)),
  );
  const dismissedRef = useRef<Set<string>>(dismissed);
  dismissedRef.current = dismissed;
  const userIdRef = useRef<string | null>(null);
  const [needsUnlock, setNeedsUnlock] = useState(false);

  const setUsuario = useCallback((id: string | null) => {
    if (userIdRef.current === id) return;
    // Cambió el usuario del dispositivo: cargar SUS descartes, no los del anterior.
    userIdRef.current = id;
    setDismissed(readSet("local", dismissStorageKey(id)));
  }, []);

  const push = useCallback((a: AlertaItem) => {
    if (ackedRef.current.has(a.key) || dismissedRef.current.has(a.key)) return;
    setItems((prev) => {
      if (prev.has(a.key)) return prev;
      const next = new Map(prev);
      next.set(a.key, a);
      return next;
    });
  }, []);

  const ack = useCallback((key: string) => {
    setAcked((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      writeAcked(next);
      return next;
    });
    setItems((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const dismiss = useCallback((key: string) => {
    setDismissed((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      writeSet("local", dismissStorageKey(userIdRef.current), next);
      return next;
    });
    // Sacarla de las activas para que además se calle la voz.
    setItems((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const sync = useCallback((liveKeys: string[]) => {
    const live = new Set(liveKeys);
    // Limpiar reconocimientos cuyo origen ya no existe, para permitir recurrencia futura.
    setAcked((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const k of prev) {
        if (!live.has(k)) {
          next.delete(k);
          changed = true;
        }
      }
      if (changed) writeAcked(next);
      return changed ? next : prev;
    });
    // Misma poda para los descartes: si la causa se resolvió, un rebrote futuro
    // de la misma key vuelve a avisar en vez de quedar silenciado para siempre.
    setDismissed((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const k of prev) {
        if (!live.has(k)) {
          next.delete(k);
          changed = true;
        }
      }
      if (changed) writeSet("local", dismissStorageKey(userIdRef.current), next);
      return changed ? next : prev;
    });
    // Podar alertas activas cuyo origen ya fue resuelto por el backend.
    setItems((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const k of prev.keys()) {
        if (!live.has(k)) {
          next.delete(k);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const activas = useMemo(() => Array.from(items.values()), [items]);

  // Mensajes hablados de las alertas vigentes. Se recalcula cuando cambian.
  const mensajes = useMemo(() => activas.map(mensajeDeAlerta), [activas]);
  // Ref al último valor para que el listener de gesto (montado una sola vez)
  // hable los mensajes vigentes sin capturar un valor obsoleto.
  const mensajesRef = useRef<string[]>(mensajes);
  mensajesRef.current = mensajes;

  // Desbloqueo proactivo en móvil: iOS/Android exigen un gesto del usuario para
  // habilitar audio/voz. En vez de depender solo del botón "Activar alertas",
  // el PRIMER toque/tecla en cualquier parte de la app desbloquea el audio, de
  // modo que cuando llegue una alerta la voz ya puede sonar. Se auto-desengancha
  // al lograrlo.
  useEffect(() => {
    if (typeof window === "undefined" || isAudioUnlocked()) return;
    let done = false;
    const onGesture = () => {
      if (done) return;
      void unlockAudio().then((ok) => {
        if (!ok) return; // reintentará en el siguiente gesto
        done = true;
        setNeedsUnlock(false);
        if (mensajesRef.current.length > 0) {
          startVoiceAlerts(() => mensajesRef.current);
        }
        cleanup();
      });
    };
    const cleanup = () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("touchstart", onGesture);
      window.removeEventListener("keydown", onGesture);
    };
    window.addEventListener("pointerdown", onGesture, { passive: true });
    window.addEventListener("touchstart", onGesture, { passive: true });
    window.addEventListener("keydown", onGesture);
    return cleanup;
  }, []);

  // Iniciar/parar la voz según haya alertas. Re-ejecuta cuando cambian los
  // mensajes (nueva mesa, tipo distinto, o al confirmar/atender).
  useEffect(() => {
    if (mensajes.length > 0) {
      const speak = () => startVoiceAlerts(() => mensajes);
      if (!isAudioUnlocked()) {
        // Intentar sin gesto (probablemente falle en móviles → mostrar botón)
        void unlockAudio().then((ok) => {
          if (ok) {
            setNeedsUnlock(false);
            speak();
          } else {
            setNeedsUnlock(true);
          }
        });
      } else {
        setNeedsUnlock(false);
        speak();
      }
    } else {
      stopVoiceAlerts();
      setNeedsUnlock(false);
    }
  }, [mensajes]);

  useEffect(() => {
    return () => stopVoiceAlerts();
  }, []);

  const value = useMemo(
    () => ({ push, ack, dismiss, sync, setUsuario, activas, acked, dismissed }),
    [push, ack, dismiss, sync, setUsuario, activas, acked, dismissed],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {needsUnlock && (
        <div className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4 pointer-events-none">
          <Button
            size="lg"
            className="gap-2 shadow-lg pointer-events-auto animate-pulse"
            onClick={async () => {
              const ok = await unlockAudio();
              if (ok) {
                setNeedsUnlock(false);
                startVoiceAlerts(() => mensajes);
              }
            }}
          >
            <BellRing className="h-5 w-5" />
            Activar alertas
          </Button>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useAlertaBus(): BusContext {
  const c = useContext(Ctx);
  if (!c) {
    // Fallback silencioso: si no hay provider, no romper
    return {
      push: () => {},
      ack: () => {},
      dismiss: () => {},
      sync: () => {},
      setUsuario: () => {},
      activas: [],
      acked: new Set<string>(),
      dismissed: new Set<string>(),
    };
  }
  return c;
}
