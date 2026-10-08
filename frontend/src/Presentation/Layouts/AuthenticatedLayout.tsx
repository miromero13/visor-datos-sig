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
import { ReportJobsNotice } from "@/Presentation/Components/Reports/ReportJobsNotice";

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
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar: Clean modern Shadcn style with border-r */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/90 bg-white text-slate-700 transition-all duration-300 ease-in-out md:sticky md:top-0 md:h-screen md:shrink-0 ${
          isMobileOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
        } ${isCollapsed ? "md:w-20" : "md:w-72"} w-80`}
      >
        {/* Sidebar Header / Brand - Exactly aligned with main header h-14 */}
        <div className={`flex h-14 shrink-0 items-center border-b border-slate-200/80 px-5 ${isCollapsed ? "md:justify-center" : "justify-between"}`}>
          <div className="flex items-center overflow-hidden">
            {isCollapsed ? (
              <span className="grid size-8 rotate-[-7deg] place-items-center rounded-lg bg-slate-900 shadow-xs" aria-hidden="true">
                <span className="size-3 rotate-[7deg] rounded-[2px] border-2 border-sky-400" />
              </span>
            ) : (
              <Brand size="lg" />
            )}
          </div>

          {/* Close button inside mobile drawer */}
          <button
            type="button"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 md:hidden"
            onClick={() => setIsMobileOpen(false)}
            aria-label="Cerrar menú lateral"
          >
            <X size={18} />
          </button>
        </div>

        {/* Section title (when expanded) */}
        {!isCollapsed && (
          <div className="px-5.5 pt-5 pb-2">
            <p className="m-0 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Espacios de trabajo
            </p>
          </div>
        )}

        {/* Navigation list */}
        <nav aria-label="Navegación principal" className={`flex-1 space-y-1 overflow-y-auto ${isCollapsed ? "px-2 py-3" : "px-4 py-2"}`}>
          {visibleNavigation.map(({ label, icon: Icon, href }) => {
            const active = label === activeItem;
            return (
              <Link
                key={label}
                to={href}
                title={isCollapsed ? label : undefined}
                aria-current={active ? "page" : undefined}
                onClick={() => setIsMobileOpen(false)}
                className={`group flex items-center gap-3.5 no-underline transition-all ${
                  isCollapsed
                    ? "mx-auto size-9 place-content-center rounded-lg p-0"
                    : "rounded-lg px-4 py-2.5 text-sm font-medium"
                } ${
                  active
                    ? "bg-slate-900 text-white shadow-2xs font-semibold"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon
                  size={isCollapsed ? 16 : 18}
                  className={`shrink-0 transition-transform ${
                    active ? "text-white" : "text-slate-400 group-hover:text-slate-700"
                  }`}
                  aria-hidden="true"
                />
                {!isCollapsed && <span className="truncate">{label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer: Support link */}
        <div className="border-t border-slate-100 p-4">
          <a
            href="mailto:soporte@example.com"
            title={isCollapsed ? "Soporte y ayuda" : undefined}
            className={`flex items-center gap-3 no-underline transition-colors hover:bg-slate-100 hover:text-slate-900 ${
              isCollapsed
                ? "mx-auto size-9 place-content-center rounded-lg p-0 text-slate-500"
                : "rounded-lg p-2.5 text-xs font-medium text-slate-500"
            }`}
          >
            <Headphones size={isCollapsed ? 16 : 16} className="shrink-0 text-slate-400" aria-hidden="true" />
            {!isCollapsed && (
              <>
                <span className="truncate">Soporte y ayuda</span>
                <ChevronRight size={14} className="ml-auto text-slate-400" aria-hidden="true" />
              </>
            )}
          </a>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200/80 bg-white/95 pl-2 pr-4 backdrop-blur-md sm:pr-6 sm:pl-3.5 shadow-2xs">
          {/* Left section: Desktop collapse toggle & Mobile hamburger menu */}
          <div className="flex items-center gap-3">
            {/* Desktop collapse toggle button */}
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden size-8 cursor-pointer place-items-center rounded-md border border-slate-200 text-slate-500 shadow-2xs transition-colors hover:bg-slate-100 hover:text-slate-800 md:grid md:-ml-0.5"
              aria-label={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
              title={isCollapsed ? "Expandir menú lateral" : "Colapsar menú lateral"}
            >
              {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>

            {/* Mobile menu trigger */}
            <button
              type="button"
              className="cursor-pointer rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 md:hidden"
              onClick={() => setIsMobileOpen(true)}
              aria-label="Abrir menú de navegación"
            >
              <Menu size={18} />
            </button>

            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 md:hidden">
              {activeItem}
            </span>
          </div>

          {/* Right actions: Profile & Logout */}
          <div className="flex items-center gap-2 sm:gap-3 ml-auto">
            <Link
              to="/profile"
              className="hidden text-right text-inherit no-underline transition-opacity hover:opacity-85 sm:block"
              aria-label={`Perfil de ${displayName}`}
            >
              <p className="m-0 text-xs font-semibold text-slate-800">{displayName}</p>
              <p className="m-0 text-[10px] text-slate-400 font-medium">{user?.roles?.join(" · ") || "Usuario"}</p>
            </Link>

            <Link
              to="/profile"
              className="grid size-8 place-items-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 no-underline transition-all hover:bg-slate-200"
              aria-label={`Perfil de ${displayName}`}
            >
              {userInitials}
            </Link>

            <button
              type="button"
              className="flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
              onClick={() => void logout()}
            >
              <LogOut size={14} aria-hidden="true" />
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </header>

        {/* Page Content: Scrollable or Full-height depending on child */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
      <ReportJobsNotice />
    </div>
  );
}
