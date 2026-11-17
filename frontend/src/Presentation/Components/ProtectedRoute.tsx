import { Navigate, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "@/Presentation/Components/AuthProvider";

type ProtectedRouteProps = {
  children: ReactNode;
  adminOnly?: boolean;
};

export function ProtectedRoute({ children, adminOnly }: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <p role="status" className="p-8 text-center text-sm text-[#58698a]">Verificando sesión…</p>;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (adminOnly && !user.roles.includes("Administrador")) return <Navigate to="/dashboard" replace />;
  return children;
}
