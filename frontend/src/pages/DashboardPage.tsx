import { Brand } from "@/components/Brand";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const navigation = ["Inicio", "Visor de mapa", "Consultas", "Identificación", "Administración"];
const indicators = [
  { label: "Manzanas", value: "863", unit: "Polígonos", color: "bg-violet-100 text-violet-700", mark: "▦" },
  { label: "Lotes", value: "15.281", unit: "Polígonos", color: "bg-blue-100 text-blue-700", mark: "⌗" },
  { label: "Códigos fijos", value: "6.271", unit: "Puntos", color: "bg-amber-100 text-amber-700", mark: "⌖" },
  { label: "Vías", value: "578", unit: "Líneas", color: "bg-emerald-100 text-emerald-700", mark: "⌁" },
];

export function DashboardPage() {
  const { user, logout } = useAuth();
  const firstName = user?.name?.trim().split(/\s+/)[0] || "Lucía";
  const displayName = user?.name || "Lucía Castro";
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
          <div className="hidden text-right sm:block">
            <p className="m-0 text-sm font-semibold">{displayName}</p>
            <p className="m-0 text-xs text-slate-500">{user?.roles?.join(" · ") || "Administradora"}</p>
          </div>
          <div className="grid size-9 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700" aria-label={`Avatar de ${displayName}`}>
            {displayName
              .split(/\s+/)
              .map((part) => part[0])
              .slice(0, 2)
              .join("")}
          </div>
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
            {navigation.map((item, index) => (
              <a key={item} href={index === 0 ? "/dashboard" : "#"} aria-current={index === 0 ? "page" : undefined} className={`shrink-0 rounded-md px-3 py-2.5 text-sm no-underline transition-colors ${index === 0 ? "bg-blue-600 font-semibold text-white" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}>
                {item}
              </a>
            ))}
          </nav>
          <div className="mt-auto hidden border-t border-slate-700 px-3 pt-5 md:block">
            <Button variant="outline" className="w-full px-2 text-xs sm:ml-1 sm:px-3 cursor-pointer" onClick={() => void logout()}>
              Salir
            </Button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 px-5 py-7 md:px-8 md:py-6 lg:px-10">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="m-0 text-2xl font-semibold tracking-tight md:text-[28px]">Buen día, {firstName}</h1>
              <p className="mb-0 mt-2 text-sm text-slate-500">Este es el resumen de la información territorial de tu municipio.</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600">◷ &nbsp; Hoy, 24 de junio de 2026</div>
          </div>
          <div className="mb-2 text-[10px] font-semibold tracking-[.12em] text-slate-400">RESUMEN DE DATOS · DEMOSTRACIÓN</div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {indicators.map((item) => (
              <Card key={item.label} className="gap-3 rounded-xl border-slate-200 bg-white p-4 shadow-none sm:p-5">
                <div className="flex items-center justify-between">
                  <p className="m-0 text-sm font-medium text-slate-600">{item.label}</p>
                  <span className={`grid size-8 place-items-center rounded-lg text-sm ${item.color}`} aria-hidden="true">
                    {item.mark}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="m-0 text-[28px] font-semibold tracking-tight">{item.value}</p>
                  <p className="m-0 text-xs text-slate-500">{item.unit}</p>
                </div>
              </Card>
            ))}
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.85fr)]">
            <Card className="min-h-[410px] gap-4 rounded-xl border-slate-200 bg-white p-5 shadow-none md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="m-0 text-base font-semibold">Cobertura territorial</h2>
                  <p className="mb-0 mt-1 text-sm text-slate-500">Vista general · WGS 84</p>
                </div>
                <a className="text-sm font-medium text-blue-600 no-underline hover:text-blue-800" href="#">
                  Abrir visor →
                </a>
              </div>
              <div className="relative min-h-[300px] flex-1 overflow-hidden rounded-lg border border-slate-200 bg-[#eaf1ed]" aria-label="Ilustración de cobertura territorial de demostración">
                <div className="absolute inset-0 opacity-60" style={{ backgroundImage: "linear-gradient(30deg, transparent 48%, #cfddd2 49%, #cfddd2 50%, transparent 51%), linear-gradient(150deg, transparent 48%, #d4dfd7 49%, #d4dfd7 50%, transparent 51%), linear-gradient(#dce6df 1px, transparent 1px), linear-gradient(90deg, #dce6df 1px, transparent 1px)", backgroundSize: "100px 82px, 130px 105px, 34px 34px, 34px 34px" }} />
                <div className="absolute left-[20%] top-[17%] h-[58%] w-[27%] rotate-[-12deg] border-2 border-blue-400/80 bg-blue-400/10" />
                <div className="absolute left-[48%] top-[26%] h-[48%] w-[32%] rotate-[14deg] border-2 border-violet-400/80 bg-violet-400/10" />
                <div className="absolute left-[39%] top-[47%] size-4 rounded-full border-[3px] border-white bg-amber-500 shadow-md" />
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-3 rounded-md border border-slate-200 bg-white/95 px-3 py-2 text-[11px] text-slate-600 shadow-sm">
                  <span>
                    <i className="mr-1.5 inline-block size-2 rounded-sm bg-blue-400" />
                    Manzanas y lotes
                  </span>
                  <span>
                    <i className="mr-1.5 inline-block size-2 rounded-full bg-amber-500" />
                    Códigos fijos
                  </span>
                  <span>
                    <i className="mr-1.5 inline-block h-0.5 w-3 bg-emerald-600" />
                    Vías
                  </span>
                </div>
              </div>
            </Card>
            <div className="grid content-start gap-5">
              <Card className="gap-4 rounded-xl border-slate-200 bg-white p-5 shadow-none">
                <div>
                  <h2 className="m-0 text-base font-semibold">Acciones rápidas</h2>
                  <p className="mb-0 mt-1 text-sm text-slate-500">Accedé a las herramientas principales.</p>
                </div>
                <a href="#" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">
                  <span>
                    <span className="mr-2 text-blue-600">⌖</span>Abrir visor de mapa
                  </span>
                  <span className="text-slate-400">→</span>
                </a>
                <a href="#" className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">
                  <span>
                    <span className="mr-2 text-violet-600">⌕</span>Realizar una consulta
                  </span>
                  <span className="text-slate-400">→</span>
                </a>
              </Card>
              <Card className="gap-4 rounded-xl border-slate-200 bg-white p-5 shadow-none">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="m-0 text-base font-semibold">Estado de los datos</h2>
                    <p className="mb-0 mt-1 text-sm text-slate-500">Indicadores de demostración</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                    <i className="mr-1 inline-block size-1.5 rounded-full bg-emerald-500" />
                    Estable
                  </span>
                </div>
                <p className="m-0 border-b border-slate-100 pb-3 text-xs text-slate-500">Actualizado hoy · 09:42</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="m-0 text-2xl font-semibold">4</p>
                    <p className="m-0 mt-1 text-xs text-slate-500">Capas activas</p>
                  </div>
                  <div>
                    <p className="m-0 text-2xl font-semibold">22.993</p>
                    <p className="m-0 mt-1 text-xs text-slate-500">Entidades registradas</p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
          <p className="mt-5 text-center text-[11px] text-slate-400">Resumen de diseño · Los datos pueden no reflejar información en tiempo real.</p>
        </main>
      </div>
    </div>
  );
}
