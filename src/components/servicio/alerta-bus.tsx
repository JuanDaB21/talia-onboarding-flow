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
  ack: (key: string) => void;
  /**
   * Reconcilia el bus con las alertas realmente vigentes: poda del `Map` (y de los
   * reconocimientos persistidos) toda key que ya no esté en `liveKeys`. Esto para la voz
   * cuando el backend resuelve la alerta desde cualquier pantalla, y permite que una misma
   * key (p. ej. `listo:<idMesa>`) vuelva a sonar si su origen reaparece.
   */
  sync: (liveKeys: string[]) => void;
  activas: AlertaItem[];
  /** Keys reconocidas (atendidas) por el usuario. Las tarjetas visibles las ocultan. */
  acked: Set<string>;
};

const Ctx = createContext<BusContext | null>(null);

const ACK_STORAGE_KEY = "alerta-bus:ack";

function readAcked(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(ACK_STORAGE_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function writeAcked(s: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ACK_STORAGE_KEY, JSON.stringify(Array.from(s)));
  } catch {
    // ignorar
  }
}

export function AlertaBusProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Map<string, AlertaItem>>(() => new Map());
  // `acked` es estado reactivo para que las tarjetas visibles (derivadas de la
  // query en el banner) se oculten al instante al confirmar. `ackedRef` refleja
  // el último valor para las lecturas síncronas de `push`.
  const [acked, setAcked] = useState<Set<string>>(() => readAcked());
  const ackedRef = useRef<Set<string>>(acked);
  ackedRef.current = acked;
  const [needsUnlock, setNeedsUnlock] = useState(false);

  const push = useCallback((a: AlertaItem) => {
    if (ackedRef.current.has(a.key)) return;
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
    () => ({ push, ack, sync, activas, acked }),
    [push, ack, sync, activas, acked],
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
      sync: () => {},
      activas: [],
      acked: new Set<string>(),
    };
  }
  return c;
}
