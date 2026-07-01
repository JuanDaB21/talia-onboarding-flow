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
  startAlarm,
  stopAlarm,
  unlockAudio,
} from "@/components/servicio/alerta-sound";

export type AlertaTipo =
  | "LLAMADO"
  | "CUENTA"
  | "PEDIR_MAS"
  | "TOMAR_PEDIDO"
  | "LISTO"
  | "ASIGNACION";

export type AlertaItem = {
  key: string;
  tipo: AlertaTipo;
  idMesa: string;
  titulo?: string;
};

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
    window.sessionStorage.setItem(
      ACK_STORAGE_KEY,
      JSON.stringify(Array.from(s)),
    );
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

  // Iniciar/parar alarma según haya alertas
  useEffect(() => {
    if (activas.length > 0) {
      if (!isAudioUnlocked()) {
        // Intentar sin gesto (probablemente falle en móviles)
        void unlockAudio().then((ok) => {
          if (ok) startAlarm();
          else setNeedsUnlock(true);
        });
      } else {
        setNeedsUnlock(false);
        startAlarm();
      }
    } else {
      stopAlarm();
      setNeedsUnlock(false);
    }
    return () => {
      // No detener aquí; el efecto se re-ejecuta ante cambios
    };
  }, [activas.length]);

  useEffect(() => {
    return () => stopAlarm();
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
                startAlarm();
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
