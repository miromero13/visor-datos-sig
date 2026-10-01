import type { ReactNode } from "react";
import { Headphones, House, LogOut, Map, Search, UsersRound, Crosshair, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "@/components/Brand";
import { useAuth } from "@/components/AuthProvider";

type NavigationKey = "Inicio" | "Visor de mapa" | "Consultas" | "Identificación" | "Administración" | "Migración";
type AuthenticatedLayoutProps = { children: ReactNode; activeItem: NavigationKey };

const navigation = [
  { label: "Inicio", icon: House, href: "/dashboard" },
  { label: "Visor de mapa", icon: Map, href: "#" },
  { label: "Consultas", icon: Search, href: "#" },
  { label: "Identificación", icon: Crosshair, href: "#" },
  { label: "Administración", icon: UsersRound, href: "#" },
  { label: "Migración", icon: Map, href: "/migration" },
] as const;

export function AuthenticatedLayout({ children, activeItem }: AuthenticatedLayoutProps) {
  const { user, logout } = useAuth();
  const displayName = user?.name || "Lucía Castro";
  const visibleNavigation = navigation.filter(({ label }) =>
    (label !== "Administración" || user?.roles.includes("Administrador")) &&
    (label !== "Migración" || user?.roles.includes("Administrador"))
  );
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <header className="flex h-[68px] items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <Brand />
          <span className="hidden text-sm text-slate-300 sm:inline" aria-hidden="true">
            /
          </span>
          <span className="hidden text-sm font-medium text-slate-600 sm:inline">Operación territorial</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link to="/profile" className="hidden text-right text-inherit no-underline sm:block" aria-label={`Perfil de ${displayName}`}>
            <p className="m-0 text-sm font-semibold">{displayName}</p>
            <p className="m-0 text-xs text-slate-500">{user?.roles?.join(" · ") || "Usuario"}</p>
          </Link>
          <Link to="/profile" className="grid size-9 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700 no-underline" aria-label={`Perfil de ${displayName}`}>
            {displayName
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </Link>
          <button type="button" className="flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 cursor-pointer" onClick={() => void logout()}>
            <LogOut size={16} aria-hidden="true" />
            <span className="hidden sm:inline">Cerrar sesión</span>
          </button>
        </div>
      </header>
      <div className="md:flex">
        <aside className="bg-[#0F172A] px-4 py-4 text-slate-300 md:flex md:min-h-[calc(100vh-68px)] md:w-[248px] md:shrink-0 md:flex-col md:px-4 md:py-7">
          <div className="mb-6 hidden px-3 md:block">
            <p className="mb-1 text-[10px] font-semibold tracking-[.14em] text-slate-400">SISTEMA DE INFORMACIÓN</p>
            <p className="m-0 text-sm font-medium text-white">Gestión territorial</p>
          </div>
          <p className="mb-3 px-3 text-[10px] font-semibold tracking-[.14em] text-slate-500">ESPACIOS DE TRABAJO</p>
          <nav aria-label="Navegación principal" className="flex gap-2 overflow-x-auto md:grid md:gap-1">
            {visibleNavigation.map(({ label, icon: Icon, href }) => {
              const active = label === activeItem;
              return (
                <Link key={label} to={href} aria-current={active ? "page" : undefined} className={`flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm no-underline transition-colors ${active ? "bg-blue-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
                  <Icon size={17} aria-hidden="true" />
                  {label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto hidden border-t border-slate-700 px-3 pt-5 md:block">
            <a href="mailto:soporte@example.com" className="flex items-center gap-2 text-xs text-slate-400 no-underline hover:text-white">
              <Headphones size={15} aria-hidden="true" />
              Soporte y ayuda
              <ChevronRight size={14} className="ml-auto" aria-hidden="true" />
            </a>
          </div>
          <div className="border-t border-slate-700 pt-3 md:hidden">
            <a href="mailto:soporte@example.com" aria-label="Soporte y ayuda" className="flex items-center gap-2 rounded-md px-2 py-2 text-xs text-slate-300 no-underline">
              <Headphones size={16} aria-hidden="true" />
              Soporte y ayuda
            </a>
          </div>
        </aside>
        {children}
      </div>
    </div>
  );
}
