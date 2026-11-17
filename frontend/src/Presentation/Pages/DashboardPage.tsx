import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import { Skeleton } from "@/Presentation/Components/ui/skeleton";
import { useAuth } from "@/Presentation/Components/AuthProvider";
import {
  getDashboardSummary,
  getFixedStateColor,
  getLayerColor,
  type DashboardSummary,
} from "@/Application/Services/layers";

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

  const totalCodes = summary?.totales.codigosFijos || 6271;
  const estados = (summary?.estados ?? [
    { valor: 1, label: "Normal", cantidad: 3136 },
    { valor: 2, label: "Para corte", cantidad: 941 },
    { valor: 3, label: "Cortado", cantidad: 1254 },
    { valor: 4, label: "Baja parcial", cantidad: 627 },
    { valor: 5, label: "Baja total", cantidad: 313 },
  ]).map((item) => ({
    ...item,
    color: getFixedStateColor(item.valor),
  }));

  const getCountByState = (valor: number) =>
    estados.find((item) => item.valor === valor)?.cantidad ?? 0;

  const completadosHoy = summary?.progresoDiario?.completados ?? 0;
  const pendientesHoy = summary?.progresoDiario?.pendientes ?? getCountByState(2);
  const observadosHoy = summary?.progresoDiario?.observados ?? 0;
  const totalOrdenesHoy = Math.max(1, completadosHoy + pendientesHoy + observadosHoy);
  const pctCompletadosHoy = Math.round((completadosHoy / totalOrdenesHoy) * 100);
  const pctPendientesHoy = Math.round((pendientesHoy / totalOrdenesHoy) * 100);
  const pctObservadosHoy = Math.max(0, 100 - pctCompletadosHoy - pctPendientesHoy);

  // SVG Donut geometry
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  const layerCards = [
    {
      label: "Manzanas",
      detail: "Censales",
      value: summary?.totales.manzanas ?? 863,
      color: getLayerColor("Manzanas"),
    },
    {
      label: "Lotes",
      detail: "Urbanos",
      value: summary?.totales.lotes ?? 15281,
      color: getLayerColor("Lotes"),
    },
    {
      label: "Códigos fijos",
      detail: "Suministros",
      value: summary?.totales.codigosFijos ?? 6271,
      color: getLayerColor("CodigosFijos"),
    },
    {
      label: "Vías",
      detail: "Red vial",
      value: summary?.totales.vias ?? 578,
      color: getLayerColor("Vias"),
    },
  ];

  return (
    <AuthenticatedLayout activeItem="Inicio">
      <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5 lg:px-8">
        {/* Top Header Bar - Metricas unicamente, sin botones */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="m-0 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Panel de control
            </h1>
            <p className="m-0 mt-0.5 text-xs text-slate-500">
              Hola, {firstName} · Resumen del padrón catastral y órdenes de servicio
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3.5 py-1.5 shadow-2xs">
              <span className="text-xs text-slate-500">Operadores activos:</span>
              {loading ? (
                <Skeleton className="h-4 w-6 rounded-xs" />
              ) : (
                <span className="font-mono text-xs font-bold text-slate-900">
                  {summary?.totales.operadoresActivos ?? 3}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3.5 py-1.5 shadow-2xs">
              <span className="text-xs text-slate-500">Pendientes hoy:</span>
              {loading ? (
                <Skeleton className="h-4 w-6 rounded-xs" />
              ) : (
                <span className="font-mono text-xs font-bold text-orange-600">
                  {pendientesHoy.toLocaleString("es-AR")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-slate-200/90 bg-white px-3.5 py-1.5 shadow-2xs">
              <span className="text-xs text-slate-500">Completadas hoy:</span>
              {loading ? (
                <Skeleton className="h-4 w-6 rounded-xs" />
              ) : (
                <span className="font-mono text-xs font-bold text-emerald-600">
                  {completadosHoy.toLocaleString("es-AR")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 4 Capas Territoriales Metric Cards */}
        <section
          aria-label="Capas territoriales del sistema"
          className="grid grid-cols-2 gap-3.5 lg:grid-cols-4"
        >
          {layerCards.map((card) => (
            <div
              key={card.label}
              className="flex flex-col justify-between rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700">{card.label}</span>
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: card.color }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2">
                {loading ? (
                  <Skeleton className="h-7 w-20" />
                ) : (
                  <span className="font-mono text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                    {card.value.toLocaleString("es-AR")}
                  </span>
                )}
                <span
                  className="rounded-md px-2 py-0.5 font-medium text-[11px]"
                  style={{
                    backgroundColor: `${card.color}18`,
                    color: card.color,
                  }}
                >
                  {card.detail}
                </span>
              </div>
            </div>
          ))}
        </section>

        {/* Charts & Operations Grid */}
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-12">
          {/* Left: Donut Chart + Status Breakdown Bars (7 cols) */}
          <div className="flex min-h-0 flex-col rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs xl:col-span-7">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-3.5">
              <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-900">
                Distribución de códigos fijos por estado
              </h2>

              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                {totalCodes.toLocaleString("es-AR")} suministros
              </span>
            </div>

            <div className="mt-4 grid flex-1 grid-cols-1 items-center gap-6 md:grid-cols-12">
              {/* SVG Donut Chart */}
              <div className="flex flex-col items-center justify-center md:col-span-5">
                <div className="relative flex items-center justify-center">
                  <svg
                    width="160"
                    height="160"
                    viewBox="0 0 160 160"
                    role="img"
                    aria-label="Gráfico de anillo de estados de conexión"
                    className="-rotate-90 transform"
                  >
                    <circle
                      cx="80"
                      cy="80"
                      r={radius}
                      fill="transparent"
                      stroke="#f1f5f9"
                      strokeWidth="20"
                    />
                    {estados.map((st) => {
                      const fraction = st.cantidad / Math.max(1, totalCodes);
                      const strokeDasharray = `${fraction * circumference} ${circumference}`;
                      const strokeDashoffset = -cumulativeFraction * circumference;
                      cumulativeFraction += fraction;
                      const strokeColor = getFixedStateColor(st.valor);
                      return (
                        <circle
                          key={st.valor}
                          cx="80"
                          cy="80"
                          r={radius}
                          fill="transparent"
                          stroke={strokeColor}
                          strokeWidth="20"
                          strokeDasharray={strokeDasharray}
                          strokeDashoffset={strokeDashoffset}
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-mono text-lg font-bold text-slate-900">
                      {totalCodes.toLocaleString("es-AR")}
                    </span>
                    <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">
                      Conexiones
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Bars */}
              <div className="flex flex-col justify-center space-y-3 md:col-span-7">
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
                  : estados.map((st) => {
                      const pct = ((st.cantidad / Math.max(1, totalCodes)) * 100).toFixed(1);
                      const currentColor = getFixedStateColor(st.valor);
                      return (
                        <div key={st.valor} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2 font-medium text-slate-700">
                              <span
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: currentColor }}
                              />
                              <span className="font-medium text-slate-800">{st.label}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-slate-900">
                                {st.cantidad.toLocaleString("es-AR")}
                              </span>
                              <span className="w-12 text-right font-mono text-[11px] text-slate-400">
                                {pct}%
                              </span>
                            </div>
                          </div>

                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
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
          </div>

          {/* Right: Progreso diario + Accesos directos juntos + Capas (5 cols) */}
          <div className="flex min-h-0 flex-col gap-4 xl:col-span-5">
            {/* Progreso diario */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="m-0 text-sm font-semibold tracking-tight text-slate-900">
                  Progreso diario
                </h2>
                <Link
                  to="/monitoring"
                  className="text-xs font-semibold text-blue-600 no-underline hover:underline"
                >
                  Ver monitoreo →
                </Link>
              </div>

              <div className="mt-4 space-y-3">
                {/* Stacked horizontal bar */}
                <div
                  className="flex h-3.5 w-full overflow-hidden rounded-full bg-slate-100"
                  role="img"
                  aria-label="Barra de progreso diario entre órdenes completadas y pendientes"
                >
                  <div
                    className="h-full bg-emerald-600 transition-all duration-500"
                    style={{ width: `${pctCompletadosHoy}%` }}
                    title={`Completados: ${completadosHoy}`}
                  />
                  <div
                    className="h-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${pctObservadosHoy}%` }}
                    title={`Observados: ${observadosHoy}`}
                  />
                  <div
                    className="h-full bg-orange-500 transition-all duration-500"
                    style={{ width: `${pctPendientesHoy}%` }}
                    title={`Pendientes: ${pendientesHoy}`}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-1 text-xs">
                  <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
                    <span className="font-semibold text-emerald-800">Completados</span>
                    <p className="m-0 mt-1 font-mono text-base font-bold text-emerald-900">
                      {completadosHoy.toLocaleString("es-AR")}
                    </p>
                  </div>

                  <div className="rounded-lg border border-orange-100 bg-orange-50/60 p-2.5">
                    <span className="font-semibold text-orange-800">Pendientes</span>
                    <p className="m-0 mt-1 font-mono text-base font-bold text-orange-900">
                      {pendientesHoy.toLocaleString("es-AR")}
                    </p>
                  </div>

                  <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5">
                    <span className="font-semibold text-amber-800">Observados</span>
                    <p className="m-0 mt-1 font-mono text-base font-bold text-amber-900">
                      {observadosHoy.toLocaleString("es-AR")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Accesos directos - Todos juntos en un solo bloque */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs">
              <h2 className="m-0 border-b border-slate-100 pb-3 text-sm font-semibold tracking-tight text-slate-900">
                Accesos directos
              </h2>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <Link
                  to="/assignments/cuts"
                  className="flex items-center justify-between rounded-lg border border-orange-200/80 bg-orange-50/40 px-3.5 py-2.5 text-xs font-semibold text-orange-950 no-underline transition hover:border-orange-300 hover:bg-orange-50"
                >
                  <span>Asignar cortes</span>
                  <span className="font-bold text-orange-600">→</span>
                </Link>

                <Link
                  to="/assignments/reconnections"
                  className="flex items-center justify-between rounded-lg border border-emerald-200/80 bg-emerald-50/40 px-3.5 py-2.5 text-xs font-semibold text-emerald-950 no-underline transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <span>Asignar reconexiones</span>
                  <span className="font-bold text-emerald-600">→</span>
                </Link>

                <Link
                  to="/map"
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-slate-800 no-underline transition hover:border-slate-300 hover:bg-slate-100/70"
                >
                  <span>Visor de mapa</span>
                  <span className="text-slate-500">→</span>
                </Link>

                <Link
                  to="/monitoring"
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-slate-800 no-underline transition hover:border-slate-300 hover:bg-slate-100/70"
                >
                  <span>Monitoreo</span>
                  <span className="text-slate-500">→</span>
                </Link>

                <Link
                  to="/queries"
                  className="col-span-2 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs font-semibold text-slate-800 no-underline transition hover:border-slate-300 hover:bg-slate-100/70"
                >
                  <span>Consultas espaciales</span>
                  <span className="text-slate-500">→</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </AuthenticatedLayout>
  );
}
