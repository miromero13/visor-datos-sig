import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { changePassword as changePasswordRequest, configureSessionExpiry, getSession, login as loginRequest, logout as logoutRequest, type AuthUser } from "@/Application/Services/auth";

interface AuthContextValue { user: AuthUser | null; loading: boolean; error: string; login(login: string, password: string, rememberMe: boolean): Promise<void>; logout(): Promise<void>; changePassword(currentPassword: string, newPassword: string): Promise<void> }
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    configureSessionExpiry(() => setUser(null));
    getSession().then(setUser).catch(() => setUser(null)).finally(() => setLoading(false));
  }, []);
  async function login(login: string, password: string, rememberMe: boolean) {
    setError("");
    try {
      setUser(await loginRequest(login, password, rememberMe));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Usuario o contraseña incorrectos, o la cuenta se encuentra inactiva.";
      setError(message);
      throw cause;
    }
  }
  async function logout() { await logoutRequest(); setUser(null); }
  async function changePassword(currentPassword: string, newPassword: string) { await changePasswordRequest(currentPassword, newPassword); }
  return <AuthContext.Provider value={{ user, loading, error, login, logout, changePassword }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error("useAuth must be used within AuthProvider"); return context; }
