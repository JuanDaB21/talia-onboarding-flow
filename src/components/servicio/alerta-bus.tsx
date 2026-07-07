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
      return `Mesa ${mesa}, pedido listo`;
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
  activas: AlertaItem[];
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
  const ackedRef = useRef<Set<string>>(readAcked());
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
    ackedRef.current.add(key);
    writeAcked(ackedRef.current);
    setItems((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const activas = useMemo(() => Array.from(items.values()), [items]);

  // Mensajes hablados de las alertas vigentes. Se recalcula cuando cambian.
  const mensajes = useMemo(() => activas.map(mensajeDeAlerta), [activas]);

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

  const value = useMemo(() => ({ push, ack, activas }), [push, ack, activas]);

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
      activas: [],
    };
  }
  return c;
}
