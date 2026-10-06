import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import { Card } from "@/Presentation/Components/ui/card";
import { useAuth } from "@/Presentation/Components/AuthProvider";
const indicators = [
  { label: "Manzanas", value: "863", unit: "Polígonos", color: "bg-violet-100 text-violet-700", mark: "▦" },
  { label: "Lotes", value: "15.281", unit: "Polígonos", color: "bg-blue-100 text-blue-700", mark: "⌗" },
  { label: "Códigos fijos", value: "6.271", unit: "Puntos", color: "bg-amber-100 text-amber-700", mark: "⌖" },
  { label: "Vías", value: "578", unit: "Líneas", color: "bg-emerald-100 text-emerald-700", mark: "⌁" },
];

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Lucía";
  return (
    <AuthenticatedLayout activeItem="Inicio">
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden px-5 py-4 md:px-8 md:py-5 lg:px-10">
        <div className="mb-4 flex shrink-0 flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="m-0 text-2xl font-semibold tracking-tight md:text-[26px]">Buen día, {firstName}</h1>
            <p className="mb-0 mt-1 text-sm text-slate-500">Este es el resumen de la información territorial de tu municipio.</p>
          </div>
          <div className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-2xs">
            ◷ &nbsp; Hoy, 24 de junio de 2026
          </div>
        </div>

        <div className="mb-2 shrink-0 text-[10px] font-bold tracking-[.14em] text-slate-400 uppercase">
          Resumen de datos · Demostración
        </div>

        {/* Metric indicator cards */}
        <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {indicators.map((item) => (
            <Card key={item.label} className="gap-2 rounded-xl border-slate-200/90 bg-white p-3.5 shadow-xs transition-shadow hover:shadow-sm sm:p-4">
              <div className="flex items-center justify-between">
                <p className="m-0 text-xs font-semibold text-slate-500 uppercase tracking-wide">{item.label}</p>
                <span className={`grid size-7 place-items-center rounded-lg text-xs font-bold ${item.color}`} aria-hidden="true">
                  {item.mark}
                </span>
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <p className="m-0 text-2xl font-bold tracking-tight text-slate-900">{item.value}</p>
                <p className="m-0 text-xs text-slate-400 font-medium">{item.unit}</p>
              </div>
            </Card>
          ))}
        </div>

        {/* Content columns */}
        <div className="mt-4 grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.85fr)]">
          <Card className="flex min-h-0 flex-col gap-3 rounded-xl border-slate-200/90 bg-white p-4 shadow-xs md:p-5">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="m-0 text-sm font-semibold text-slate-900">Cobertura territorial</h2>
                <p className="mb-0 mt-0.5 text-xs text-slate-500">Vista general · WGS 84</p>
              </div>
              <a className="text-xs font-semibold text-blue-600 no-underline hover:text-blue-800 transition-colors" href="/map">
                Abrir visor →
              </a>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-[#eaf1ed]" aria-label="Ilustración de cobertura territorial de demostración">
              <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(30deg, transparent 48%, #cfddd2 49%, #cfddd2 50%, transparent 51%), linear-gradient(150deg, transparent 48%, #d4dfd7 49%, #d4dfd7 50%, transparent 51%), linear-gradient(#dce6df 1px, transparent 1px), linear-gradient(90deg, #dce6df 1px, transparent 1px)", backgroundSize: "100px 82px, 130px 105px, 34px 34px, 34px 34px" }} />
              <div className="absolute left-[20%] top-[17%] h-[58%] w-[27%] rotate-[-12deg] border-2 border-blue-400/80 bg-blue-400/10" />
              <div className="absolute left-[48%] top-[26%] h-[48%] w-[32%] rotate-[14deg] border-2 border-violet-400/80 bg-violet-400/10" />
              <div className="absolute left-[39%] top-[47%] size-3.5 rounded-full border-[3px] border-white bg-amber-500 shadow-md" />
              <div className="absolute bottom-2.5 left-2.5 flex flex-wrap gap-2.5 rounded-md border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-[10px] font-medium text-slate-600 shadow-xs">
                <span>
                  <i className="mr-1 inline-block size-2 rounded-xs bg-blue-400" />
                  Manzanas y lotes
                </span>
                <span>
                  <i className="mr-1 inline-block size-2 rounded-full bg-amber-500" />
                  Códigos fijos
                </span>
                <span>
                  <i className="mr-1 inline-block h-0.5 w-2.5 bg-emerald-600" />
                  Vías
                </span>
              </div>
            </div>
          </Card>

          <div className="grid min-h-0 content-between gap-3">
            <Card className="gap-3 rounded-xl border-slate-200/90 bg-white p-4 shadow-xs">
              <div>
                <h2 className="m-0 text-sm font-semibold text-slate-900">Acciones rápidas</h2>
                <p className="mb-0 mt-0.5 text-xs text-slate-500">Accedé a las herramientas principales.</p>
              </div>
              <a href="/map" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-50 hover:border-slate-300">
                <span>
                  <span className="mr-2 text-blue-600 font-bold">⌖</span>Abrir visor de mapa
                </span>
                <span className="text-slate-400">→</span>
              </a>
              <a href="/queries" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 no-underline transition-colors hover:bg-slate-50 hover:border-slate-300">
                <span>
                  <span className="mr-2 text-violet-600 font-bold">⌕</span>Realizar una consulta
                </span>
                <span className="text-slate-400">→</span>
              </a>
            </Card>

            <Card className="gap-2.5 rounded-xl border-slate-200/90 bg-white p-4 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="m-0 text-sm font-semibold text-slate-900">Estado de los datos</h2>
                  <p className="mb-0 mt-0.5 text-xs text-slate-500">Indicadores de demostración</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/20">
                  <i className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
                  Estable
                </span>
              </div>
              <p className="m-0 border-b border-slate-100 pb-2 text-[11px] text-slate-400">Actualizado hoy · 09:42</p>
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div>
                  <p className="m-0 text-xl font-bold text-slate-900">4</p>
                  <p className="m-0 mt-0.5 text-[11px] text-slate-500">Capas activas</p>
                </div>
                <div>
                  <p className="m-0 text-xl font-bold text-slate-900">22.993</p>
                  <p className="m-0 mt-0.5 text-[11px] text-slate-500">Entidades registradas</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        <p className="mt-2 shrink-0 text-center text-[10px] text-slate-400">
          Resumen de diseño · Los datos pueden no reflejar información en tiempo real.
        </p>
      </main>
    </AuthenticatedLayout>
  );
}
