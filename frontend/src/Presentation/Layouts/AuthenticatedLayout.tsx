import { useState, type ReactNode } from "react";
import {
  Headphones,
  House,
  LogOut,
  Map,
  Search,
  UsersRound,
  Crosshair,
  ChevronRight,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "@/Presentation/Components/Brand";
import { useAuth } from "@/Presentation/Components/AuthProvider";

type NavigationKey = "Inicio" | "Visor de mapa" | "Consultas" | "Identificación" | "Administración" | "Migración";
type AuthenticatedLayoutProps = { children: ReactNode; activeItem: NavigationKey };

const navigation = [
  { label: "Inicio", icon: House, href: "/dashboard" },
  { label: "Visor de mapa", icon: Map, href: "/map" },
  { label: "Consultas", icon: Search, href: "/queries" },
  { label: "Identificación", icon: Crosshair, href: "#" },
  { label: "Administración", icon: UsersRound, href: "#" },
  { label: "Migración", icon: Map, href: "/migration" },
] as const;

export function AuthenticatedLayout({ children, activeItem }: AuthenticatedLayoutProps) {
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const displayName = user?.name || "Lucía Castro";
  const userInitials = displayName
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  const visibleNavigation = navigation.filter(
    ({ label }) =>
      (label !== "Administración" || user?.roles.includes("Administrador")) &&
      (label !== "Migración" || user?.roles.includes("Administrador"))
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A] md:flex">
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Mobile drawer + Desktop responsive/collapsible */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col bg-[#0F172A] text-slate-300 transition-all duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:shrink-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } ${isCollapsed ? "md:w-20" : "md:w-64"} w-72`}
      >
        {/* Sidebar Header / Brand */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-4">
          <div className={`flex items-center overflow-hidden transition-all duration-200 ${isCollapsed ? "md:justify-center md:w-full" : ""}`}>
            {isCollapsed ? (
              <span className="grid size-9 rotate-[-7deg] place-items-center rounded-lg bg-white shadow-sm" aria-hidden="true">
                <span className="size-3.5 rotate-[7deg] rounded-[3px] border-2 border-[#0F172A]" />
              </span>
            ) : (
              <Brand light />
            )}
          </div>

          {/* Close button inside mobile drawer */}
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white md:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Cerrar menú lateral"
          >
            <X size={20} />
          </button>
        </div>

        {/* Workspace Title & Section Header */}
        {!isCollapsed && (
          <div className="px-5 pt-5 pb-2">
            <p className="text-[10px] font-bold tracking-[.14em] text-slate-500 uppercase">Sistema de Información</p>
            <p className="m-0 text-sm font-semibold text-slate-100">Gestión territorial</p>
          </div>
        )}

        <div className="px-4 py-2">
          {!isCollapsed && (
            <p className="px-2 pb-1 text-[10px] font-bold tracking-[.14em] text-slate-500 uppercase">
              Espacios de trabajo
            </p>
          )}
        </div>

        {/* Navigation list */}
        <nav aria-label="Navegación principal" className="flex-1 space-y-1.5 overflow-y-auto px-3">
          {visibleNavigation.map(({ label, icon: Icon, href }) => {
            const active = label === activeItem;
            return (
              <Link
                key={label}
                to={href}
                title={isCollapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsMobileOpen(false)}
                className={`group flex items-center gap-3.5 rounded-lg px-3 py-2.5 text-sm font-medium no-underline transition-all ${
                  isCollapsed ? "justify-center px-0" : ""
                } ${
                  active
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold"
                    : "text-slate-300 hover:bg-slate-800/90 hover:text-white"
                }`}
              >
                <Icon size={18} className={`shrink-0 transition-transform ${active ? "scale-105" : "text-slate-400 group-hover:text-white"}`} aria-hidden="true" />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer: Support link */}
        <div className="border-t border-slate-800/80 p-3">
          <a
            href="mailto:soporte@example.com"
            title={isCollapsed ? "Soporte y ayuda" : undefined}
            className={`flex items-center gap-2.5 rounded-lg p-2 text-xs text-slate-400 no-underline transition-colors hover:bg-slate-800/70 hover:text-white ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <Headphones size={16} className="shrink-0" aria-hidden="true" />
            {!isCollapsed && (
              <>
                <span className="truncate">Soporte y ayuda</span>
                <ChevronRight size={13} className="ml-auto text-slate-500" aria-hidden="true" />
              </>
            )}
          </a>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/95 pl-2 pr-4 backdrop-blur-md sm:pr-6 sm:pl-4 shadow-xs">
          {/* Left section: Desktop collapse toggle & Mobile hamburger menu */}
          <div className="flex items-center gap-3">
            {/* Desktop collapse toggle button */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden size-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 md:grid md:-ml-0.5"
              aria-label={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
              title={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            >
              {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>

            {/* Mobile menu trigger */}
            <button
              type="button"
              className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:hidden"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Abrir menú de navegación"
            >
              <Menu size={20} />
            </button>

            <span className="text-sm font-semibold text-slate-700 md:hidden">
              {activeItem}
            </span>
          </div>

          {/* Right actions: Profile & Logout */}
          <div className="flex items-center gap-2 sm:gap-4 ml-auto">
            <Link
              to="/profile"
              className="hidden text-right text-inherit no-underline transition-opacity hover:opacity-85 sm:block"
              aria-label={`Perfil de ${displayName}`}
            >
              <p className="m-0 text-sm font-semibold text-slate-800">{displayName}</p>
              <p className="m-0 text-xs text-slate-500">{user?.roles?.join(" · ") || "Usuario"}</p>
            </Link>

            <Link
              to="/profile"
              className="grid size-9 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700 ring-2 ring-blue-100 no-underline transition-all hover:bg-blue-100"
              aria-label={`Perfil de ${displayName}`}
            >
              {userInitials}
            </Link>

            <button
              type="button"
              className="flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => void logout()}
            >
              <LogOut size={15} aria-hidden="true" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <div className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  );
}
