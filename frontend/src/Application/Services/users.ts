import { apiFetch } from "@/Application/Services/auth";

export interface UserItem {
  id: number;
  login: string;
  nombre: string;
  activo: boolean;
  fechaRegistro: string;
  roles: string[];
}

export interface RoleItem {
  id: number;
  nombreRol: string;
  descripcion: string | null;
  estado: boolean;
  usuariosCount: number;
}

export interface CreateUserData {
  login: string;
  nombre: string;
  password: string;
  roles: string[];
}

export interface UpdateUserData {
  nombre: string;
  roles: string[];
}

export interface CreateRoleData {
  nombreRol: string;
  descripcion: string;
}

export interface UpdateRoleData {
  descripcion: string;
  estado: boolean;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = `Error (${res.status})`;
    try {
      const err = await res.json();
      detail = err.detail || err.title || detail;
    } catch {
      // ignore
    }
    throw new Error(detail);
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export async function getUsers(signal?: AbortSignal): Promise<UserItem[]> {
  const res = await apiFetch("/api/users", { signal });
  return handleResponse<UserItem[]>(res);
}

export async function createUser(data: CreateUserData): Promise<UserItem> {
  const res = await apiFetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<UserItem>(res);
}

export async function updateUser(id: number, data: UpdateUserData): Promise<void> {
  const res = await apiFetch(`/api/users/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}

export async function updateUserStatus(id: number, activo: boolean): Promise<void> {
  const res = await apiFetch(`/api/users/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activo }),
  });
  return handleResponse<void>(res);
}

export async function getRoles(signal?: AbortSignal): Promise<RoleItem[]> {
  const res = await apiFetch("/api/roles", { signal });
  return handleResponse<RoleItem[]>(res);
}

export async function createRole(data: CreateRoleData): Promise<RoleItem> {
  const res = await apiFetch("/api/roles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<RoleItem>(res);
}

export async function updateRole(id: number, data: UpdateRoleData): Promise<void> {
  const res = await apiFetch(`/api/roles/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<void>(res);
}
