/**
 * Cliente HTTP del backend Talia. Base = VITE_API_URL. Añade Authorization,
 * refresca el access token automáticamente ante un 401 y reintenta una vez.
 * TODO el data-access del front pasa por aquí (o por los lib/*.functions.ts).
 */
import { toast } from "sonner";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const TOKENS_KEY = "talia.tokens";

/**
 * Sin timeout, un `fetch` sobre una red móvil que se cae NO rechaza: queda pendiente
 * para siempre. Como el refresh es single-flight y compartido, un refresh colgado
 * dejaba esperando a TODA petición autenticada posterior — la app "congelada".
 */
const TIMEOUT_MS = 10_000;
const TIMEOUT_REFRESH_MS = 8_000;

export interface Tokens {
  access: string;
  refresh: string;
  userId: string;
}

export function getTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch {
    return null;
  }
}

/**
 * En Safari en modo privado (y con el almacenamiento lleno en iOS) `setItem` lanza
 * QuotaExceededError. Sin este try/catch la excepción sube sin capturar y el login
 * revienta: es el caso de "en ciertos navegadores no funciona".
 */
export function setTokens(t: Tokens | null): void {
  try {
    if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
    else localStorage.removeItem(TOKENS_KEY);
  } catch {
    toast.error("No se pudo guardar la sesión", {
      description:
        "Tu navegador bloquea el almacenamiento local. Si estás en una ventana privada, abre la app en una normal.",
    });
  }
}

/** Se dispara cuando el refresh falla; la UI debe redirigir a /login. */
export const onAuthExpired = new EventTarget();

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface Options {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // default true
  signal?: AbortSignal;
}

/**
 * `fetch` + lectura del body con UN solo timeout, combinado con el `signal` que pueda
 * traer el llamador. El timer sigue vivo hasta que `leer` termina: si se limpiara al
 * llegar los headers, un body que se estanca en red móvil dejaba `res.json()`
 * pendiente para siempre (el `isPending` de "Confirmar pago" no volvía a false).
 * Se usa AbortController manual en vez de `AbortSignal.timeout`/`any` porque esos
 * solo existen desde Safari 17 y aquí hay iPhones viejos en el salón.
 */
export async function fetchYLeer<T>(
  url: string,
  init: RequestInit,
  ms: number,
  leer: (res: Response) => Promise<T>,
  externo?: AbortSignal,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Tiempo de espera agotado", "TimeoutError")), ms);
  const alAbortar = () => ctrl.abort(externo?.reason);
  if (externo) {
    if (externo.aborted) ctrl.abort(externo.reason);
    else externo.addEventListener("abort", alAbortar);
  }
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    return await leer(res);
  } finally {
    clearTimeout(timer);
    externo?.removeEventListener("abort", alAbortar);
  }
}

interface RespuestaLeida {
  status: number;
  ok: boolean;
  statusText: string;
  text: string;
}

const leerTexto = async (r: Response): Promise<RespuestaLeida> => ({
  status: r.status,
  ok: r.ok,
  statusText: r.statusText,
  text: await r.text(),
});

/**
 * `red` (timeout/offline) NO es lo mismo que `rechazado` (el backend dijo 401):
 * tratarlos igual hacía que un bache de red borrara la sesión y sacara al mesero
 * de la app en plena operación. Solo `rechazado` cierra la sesión.
 */
export type ResultadoRefresh = "ok" | "rechazado" | "red";

let refreshing: Promise<ResultadoRefresh> | null = null;

export async function tryRefresh(): Promise<ResultadoRefresh> {
  const t = getTokens();
  if (!t) return "rechazado";
  if (!refreshing) {
    refreshing = fetchYLeer(
      `${API_URL}/auth/refresh`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: t.userId, refresh: t.refresh }),
      },
      TIMEOUT_REFRESH_MS,
      leerTexto,
    )
      .then((r) => {
        // 401/403 = el backend rechazó el refresh de verdad. Otro error (5xx) es
        // un problema del servidor, no de la sesión: no desloguea.
        if (r.status === 401 || r.status === 403) return "rechazado" as const;
        if (!r.ok) return "red" as const;
        const data = JSON.parse(r.text) as { access: string; refresh: string; user: { id: string } };
        setTokens({ access: data.access, refresh: data.refresh, userId: data.user.id });
        return "ok" as const;
      })
      .catch(() => "red" as const)
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

async function request<T>(path: string, opts: Options = {}, retry = true): Promise<T> {
  const { method = "GET", body, auth = true, signal } = opts;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  const tokens = getTokens();
  if (auth && tokens) headers["authorization"] = `Bearer ${tokens.access}`;

  const res = await fetchYLeer(
    `${API_URL}${path}`,
    {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    },
    TIMEOUT_MS,
    leerTexto,
    signal,
  );

  if (res.status === 401 && auth && retry) {
    const r = await tryRefresh();
    if (r === "ok") return request<T>(path, opts, false);
    // Si fue "red" NO se toca la sesión: la red vuelve y el usuario sigue dentro.
    if (r === "rechazado") {
      setTokens(null);
      onAuthExpired.dispatchEvent(new Event("expired"));
    }
  }

  if (!res.ok) {
    let code = "ERROR";
    let message = res.statusText;
    try {
      const j = JSON.parse(res.text) as { error?: { code?: string; message?: string } };
      code = j.error?.code ?? code;
      message = j.error?.message ?? message;
    } catch {
      /* respuesta no-JSON */
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (res.text ? JSON.parse(res.text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<Options, "method" | "body">) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<Options, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<Options, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<Options, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  del: <T>(path: string, opts?: Omit<Options, "method" | "body">) =>
    request<T>(path, { ...opts, method: "DELETE" }),
  url: API_URL,
};
