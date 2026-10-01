import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { changePassword as changePasswordRequest, getSession, login as loginRequest, logout as logoutRequest, type AuthUser } from "@/lib/auth";

interface AuthContextValue { user: AuthUser | null; loading: boolean; error: string; login(login: string, password: string, rememberMe: boolean): Promise<void>; logout(): Promise<void>; changePassword(currentPassword: string, newPassword: string): Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => { getSession().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  async function login(login: string, password: string, rememberMe: boolean) { setError(""); try { setUser(await loginRequest(login, password, rememberMe)); } catch { setError("No pudimos validar tus credenciales."); throw new Error("Login failed"); } }
  async function logout() { await logoutRequest(); setUser(null); }
  async function changePassword(currentPassword: string, newPassword: string) { await changePasswordRequest(currentPassword, newPassword); }
  return <AuthContext.Provider value={{ user, loading, error, login, logout, changePassword }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
