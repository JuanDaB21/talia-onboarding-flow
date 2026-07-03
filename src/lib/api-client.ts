/**
 * Cliente HTTP del backend Talia. Base = VITE_API_URL. Añade Authorization,
 * refresca el access token automáticamente ante un 401 y reintenta una vez.
 * TODO el data-access del front pasa por aquí (o por los lib/*.functions.ts).
 */
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api";

const TOKENS_KEY = "talia.tokens";

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

export function setTokens(t: Tokens | null): void {
  if (t) localStorage.setItem(TOKENS_KEY, JSON.stringify(t));
  else localStorage.removeItem(TOKENS_KEY);
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
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean; // default true
  signal?: AbortSignal;
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const t = getTokens();
  if (!t) return false;
  if (!refreshing) {
    refreshing = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: t.userId, refresh: t.refresh }),
    })
      .then(async (r) => {
        if (!r.ok) return false;
        const data = (await r.json()) as { access: string; refresh: string; user: { id: string } };
        setTokens({ access: data.access, refresh: data.refresh, userId: data.user.id });
        return true;
      })
      .catch(() => false)
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

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  if (res.status === 401 && auth && retry) {
    const ok = await tryRefresh();
    if (ok) return request<T>(path, opts, false);
    setTokens(null);
    onAuthExpired.dispatchEvent(new Event("expired"));
  }

  if (!res.ok) {
    let code = "ERROR";
    let message = res.statusText;
    try {
      const j = (await res.json()) as { error?: { code?: string; message?: string } };
      code = j.error?.code ?? code;
      message = j.error?.message ?? message;
    } catch {
      /* respuesta no-JSON */
    }
    throw new ApiError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<Options, "method" | "body">) => request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<Options, "method" | "body">) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: Omit<Options, "method" | "body">) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  del: <T>(path: string, opts?: Omit<Options, "method" | "body">) => request<T>(path, { ...opts, method: "DELETE" }),
  url: API_URL,
};
