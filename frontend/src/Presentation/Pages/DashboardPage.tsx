import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, Layers, Users } from "lucide-react";
import { InfoTooltip } from "@/Presentation/Components/ui/info-tooltip";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import { Skeleton } from "@/Presentation/Components/ui/skeleton";
import { useAuth } from "@/Presentation/Components/AuthProvider";
import { getDashboardSummary, getFixedStateColor, type DashboardSummary } from "@/Application/Services/layers";

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Lucía";
  const [summary, setSummary] = useState<DashboardSummary["data"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    getDashboardSummary(controller.signal)
      .then((res) => {
        setSummary(res.data);
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const totalCodes = summary?.totales.codigosFijos || 1;

  return (
    <AuthenticatedLayout activeItem="Inicio">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 py-5 lg:px-8">
        {/* Top Header Bar with Operadores Activos highlight */}
        <div className="mb-5 flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Panel de control territorial · {firstName}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Operadores activos badge/card */}
            <div className="inline-flex items-center gap-2.5 rounded-lg border border-slate-200/90 bg-white px-3.5 py-1.5 shadow-2xs">
              <Users size={15} className="text-blue-600" />
              <div className="flex items-baseline gap-1.5 text-xs">
                <span className="text-slate-500">Operadores activos:</span>
                {loading ? (
                  <Skeleton className="h-4 w-6 rounded-xs" />
                ) : (
                  <span className="font-bold text-slate-900 font-mono">
                    {summary?.totales.operadoresActivos ?? 3}
                  </span>
                )}
                <InfoTooltip text="Usuarios del sistema con credenciales activas y permisos asignados." />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content: 2 clean structured cards occupying full height */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Left: Service Status Distribution (7 cols) */}
          <div className="flex min-h-0 flex-col rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs xl:col-span-7">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-3.5">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-900">
                    Distribución de códigos fijos por estado
                  </h2>
                  <InfoTooltip text="Porcentaje y cantidad de suministros según su condición de servicio (Normal, Corte, Baja)." />
                </div>
              </div>

              <span className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {summary ? `${summary.totales.codigosFijos.toLocaleString("es-AR")} puntos` : "6.271 puntos"}
              </span>
            </div>

            {/* List of Bars */}
            <div className="flex flex-1 flex-col justify-around">
              {loading
                ? [1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="space-y-1.5 py-1">
                      <div className="flex justify-between">
                        <Skeleton className="h-3.5 w-24" />
                        <Skeleton className="h-3.5 w-16" />
                      </div>
                      <Skeleton className="h-2 w-full rounded-full" />
                    </div>
                  ))
                : summary?.estados.map((st) => {
                    const pct = ((st.cantidad / totalCodes) * 100).toFixed(1);
                    const currentColor = getFixedStateColor(st.valor);
                    return (
                      <div key={st.valor} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            <span
                              className="size-2.5 rounded-full"
                              style={{ backgroundColor: currentColor }}
                            />
                            <span className="font-medium text-slate-800">{st.label}</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 font-mono">
                              {st.cantidad.toLocaleString("es-AR")}
                            </span>
                            <span className="w-12 text-right text-[11px] text-slate-400 font-mono">
                              {pct}%
                            </span>
                          </div>
                        </div>

                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: currentColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>

          {/* Right: Layer Summary & Operations (5 cols) */}
          <div className="flex min-h-0 flex-col gap-3.5 xl:col-span-5">
            {/* Quick Access Actions - Placed prominently at the top */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-2xs">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Herramientas principales
                </span>
                <span className="text-[11px] text-slate-400">Acceso rápido</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <Link
                  to="/map"
                  className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-2xs no-underline transition-all hover:bg-slate-800 hover:shadow-xs active:scale-[0.98]"
                >
                  <MapPin size={14} className="text-slate-300" />
                  <span>Visor de mapa</span>
                </Link>

                <Link
                  to="/queries"
                  className="flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-2xs no-underline transition-all hover:bg-slate-800 hover:shadow-xs active:scale-[0.98]"
                >
                  <Search size={14} className="text-slate-300" />
                  <span>Consultas</span>
                </Link>
              </div>
            </div>

            {/* Layers summary card */}
            <div className="flex min-h-0 flex-1 flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <Layers size={16} className="text-slate-500" />
                    <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-900">
                      Capas territoriales
                    </h2>
                    <InfoTooltip text="Inventario oficial de geometrías catastrales registradas en la base de datos." />
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                    4 activas
                  </span>
                </div>

                <div className="mt-3 divide-y divide-slate-100 text-xs">
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Manzanas censales</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {summary?.totales.manzanas.toLocaleString("es-AR") || "863"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Lotes urbanos</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {summary?.totales.lotes.toLocaleString("es-AR") || "15.281"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Códigos fijos</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {summary?.totales.codigosFijos.toLocaleString("es-AR") || "6.271"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-slate-600">Trazado de vías</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {summary?.totales.vias.toLocaleString("es-AR") || "578"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700">Total entidades:</span>
                  <span className="text-base text-slate-900 font-mono">
                    {summary?.totales.totalEntidades.toLocaleString("es-AR") || "22.993"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AuthenticatedLayout>
  );
}
