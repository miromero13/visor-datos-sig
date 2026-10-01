export interface AuthUser { id: number; login: string; name: string; roles: string[] }

export const apiUrl = (path: string) => `${import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? ""}${path}`;
interface Envelope { data: { user: AuthUser } }
type RequestOptions = RequestInit & { retryAfterRefresh?: boolean };

async function send(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (!(init?.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(apiUrl(path), { ...init, credentials: "include", headers });
}

export async function refresh(): Promise<boolean> {
  const response = await send("/api/auth/refresh", { method: "POST" });
  return response.ok;
}

export async function apiFetch(path: string, init?: RequestOptions): Promise<Response> {
  const { retryAfterRefresh = true, ...requestInit } = init ?? {};
  let response = await send(path, requestInit);
  if (response.status === 401 && retryAfterRefresh && path !== "/api/auth/login" && await refresh()) {
    response = await send(path, requestInit);
  }
  return response;
}

async function request(path: string, init?: RequestInit): Promise<Envelope | undefined> {
  const response = await send(path, init);
  if (!response.ok) throw new Error(response.status === 401 ? "No pudimos validar tus credenciales." : "No se pudo completar la solicitud. Intentá nuevamente.");
  if (response.status === 204) return undefined;
  return response.json() as Promise<Envelope>;
}

export async function getSession() {
  let response = await send("/api/auth/session");
  if (response.status === 401 && await refresh()) response = await send("/api/auth/session");
  if (!response.ok) throw new Error("No pudimos validar tus credenciales.");
  return (await response.json() as Envelope).data.user;
}
export async function login(login: string, password: string, rememberMe: boolean) { return (await request("/api/auth/login", { method: "POST", body: JSON.stringify({ login, password, rememberMe }) }))!.data.user; }
export async function logout() { await request("/api/auth/logout", { method: "POST", body: "{}" }); }
export async function changePassword(currentPassword: string, newPassword: string) {
  const response = await apiFetch("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
  if (response.ok) return;
  if (response.status === 401) throw new Error("La contraseña actual no es correcta.");
  if (response.status === 400) throw new Error("La nueva contraseña debe tener al menos 8 caracteres.");
  if (response.status === 503) throw new Error("El servicio no está disponible. Intentá nuevamente más tarde.");
  throw new Error("No se pudo cambiar la contraseña. Intentá nuevamente.");
}
