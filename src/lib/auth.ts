import { api, setTokens, getTokens, type Tokens } from "./api-client";

export interface AuthUser {
  id: string;
  nombre: string;
  correo: string;
  rol: string;
  negocioId: string;
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export async function login(correo: string, password: string): Promise<AuthUser> {
  const data = await api.post<LoginResponse>("/auth/login", { correo, password }, { auth: false });
  setTokens({ access: data.access, refresh: data.refresh, userId: data.user.id });
  return data.user;
}

export interface RegisterInput {
  nombre: string;
  correo: string;
  password: string;
  nombreComercial: string;
  razonSocial: string;
  documentoTributario: string;
  telefono: string;
  direccion: string;
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const data = await api.post<LoginResponse>("/auth/register", input, { auth: false });
  setTokens({ access: data.access, refresh: data.refresh, userId: data.user.id });
  return data.user;
}

export async function logout(): Promise<void> {
  try {
    await api.post("/auth/logout");
  } finally {
    setTokens(null);
  }
}

export async function getMe(): Promise<AuthUser> {
  return api.get<AuthUser>("/auth/me");
}

export function isAuthenticated(): boolean {
  return getTokens() !== null;
}

export function currentTokens(): Tokens | null {
  return getTokens();
}
