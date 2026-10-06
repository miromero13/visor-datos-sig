import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import { ExportMenu } from "@/Presentation/Components/ExportMenu";
import { getLayers, getViaTypes, layerFields, searchAllLayers, searchLayer, type Layer, type LayerId, type SearchResult } from "@/Application/Services/layers";

const allLayers = "all" as const;
type LayerChoice = LayerId | typeof allLayers;
const layerLabels: Record<LayerId, string> = { CodigosFijos: "Códigos fijos", Lotes: "Lotes", Manzanas: "Manzanas", Vias: "Vías" };
const layerFilters: Record<LayerId, string[]> = {
  CodigosFijos: ["Estado", "IdLote"], Lotes: ["NroLote", "IdManzana"],
  Manzanas: ["UV", "MZA"], Vias: ["Nombre", "TipoVia"]
};
const idColumns: Record<LayerId, string> = { CodigosFijos: "IdCodigo", Lotes: "IdLote", Manzanas: "IdManzana", Vias: "IdVia" };
const PAGE_SIZE = 25;
const filterLabels: Record<string, string> = { Estado: "Estado", IdLote: "Filtrar por número de lote", NroLote: "Filtrar por número de lote", IdManzana: "Filtrar por manzana", UV: "Filtrar por UV", MZA: "Filtrar por manzana", Nombre: "Filtrar por nombre de vía", TipoVia: "Tipo de vía" };

export function QueriesPage() {
  const [layers, setLayers] = useState<Layer[]>([]);
  const [layerId, setLayerId] = useState<LayerChoice>(allLayers);
  const [viaTypes, setViaTypes] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [items, setItems] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportError, setExportError] = useState("");
  const requestId = useRef(0);
  const navigate = useNavigate();
  const fields = layerId === allLayers ? [] : layerFields[layerId];
  const filtersForLayer = layerId === allLayers ? [] : layerFilters[layerId];
  const exportRequest = layerId === allLayers || total === 0 ? null : { layer: layerId, q: query, filters, columns: [idColumns[layerId], ...fields], page, pageSize: PAGE_SIZE };

  useEffect(() => {
    getLayers().then(setLayers).catch(e => setError(e instanceof Error ? e.message : "No se pudieron cargar las capas."));
    getViaTypes().then(setViaTypes).catch(e => setError(e instanceof Error ? e.message : "No se pudieron cargar los tipos de vía."));
  }, []);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const result = layerId === allLayers
          ? await searchAllLayers(query, page)
          : await searchLayer(layerId, query, filters, page);
        if (currentRequest !== requestId.current) return;
        setItems(result.data.items);
        setTotal(result.data.total);
        setSearched(true);
      } catch (e) {
        if (currentRequest === requestId.current) setError(e instanceof Error ? e.message : "No se pudo realizar la búsqueda.");
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [layerId, query, filters, page]);

  const chooseLayer = (value: LayerChoice) => { setLayerId(value); setQuery(""); setFilters({}); setItems([]); setPage(1); setSearched(false); };
  const updateFilter = (field: string, value: string) => { setFilters(previous => ({ ...previous, [field]: value })); setPage(1); };
  const openOnMap = (item: SearchResult) => {
    const targetLayer = item.layer ?? (layerId === allLayers ? undefined : layerId);
    if (targetLayer) navigate(`/map?layer=${encodeURIComponent(targetLayer)}&id=${encodeURIComponent(String(item.id))}`);
  };

  return <AuthenticatedLayout activeItem="Consultas"><main className="queries-page">
    <header className="queries-heading"><p className="map-eyebrow">INFORMACIÓN TERRITORIAL</p><h1>Consultas y filtros</h1><p>Buscá entidades y consultá sus atributos.</p></header>
    <section className="search-panel" aria-label="Búsqueda de elementos"><h2>Buscar en las capas</h2>
      <div className="search-controls">
        <label>Capa<span className="relative block">
          <select className="block h-11 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 [&>option]:cursor-pointer" value={layerId} onChange={e => chooseLayer(e.target.value as LayerChoice)} aria-label="Capa de búsqueda">
            <option value={allLayers}>Todas las capas</option>{layers.map(layer => <option key={layer.id} value={layer.id}>{layer.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
        </span></label>
        <label className="search-query">Buscar por código, nombre, lote o vía<input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Ingresá texto para buscar" /></label>
        {filtersForLayer.map(field => <label key={field}>{filterLabels[field] ?? field}
          {field === "Estado" ? <span className="relative block">
            <select className="block h-11 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 [&>option]:cursor-pointer" value={filters[field] ?? ""} onChange={e => updateFilter(field, e.target.value)}><option value="">Todos</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value}</option>)}</select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
          </span>
            : field === "TipoVia" ? <span className="relative block">
              <select className="block h-11 w-full cursor-pointer appearance-none rounded-md border border-slate-300 bg-white px-3 pr-10 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 [&>option]:cursor-pointer" value={filters[field] ?? ""} onChange={e => updateFilter(field, e.target.value)}><option value="">Todos</option>{viaTypes.map(value => <option key={value} value={value}>{value}</option>)}</select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" size={17} aria-hidden="true" />
            </span>
              : <input inputMode={field === "IdLote" || field === "IdManzana" || field === "NroLote" ? "numeric" : "text"} value={filters[field] ?? ""} onChange={e => updateFilter(field, e.target.value)} />}
        </label>)}
      </div>
      {error && <p className="map-alert" role="alert">{error}</p>}{loading && <p role="status">Buscando…</p>}
      {searched && !loading && !error && <><div className="flex flex-wrap items-center justify-between gap-3"><p className="search-total">{total} resultados</p><ExportMenu request={exportRequest} disabledReason={layerId === allLayers ? "Elegí una capa para exportar sus resultados." : "No hay resultados para exportar."} onError={setExportError} /></div>{exportError && <p className="map-alert" role="alert">{exportError}</p>}{items.length === 0 ? <p className="map-muted">No se encontraron resultados.</p> : <><div className="search-table-wrap"><table className="search-table"><thead><tr>{layerId === allLayers && <th>Capa</th>}<th>ID</th>{layerId === allLayers ? <th>Atributos</th> : fields.map(field => <th key={field}>{field}</th>)}<th>Acción</th></tr></thead><tbody>{items.map((item, index) => { const itemLayer = item.layer ?? (layerId === allLayers ? undefined : layerId); const displayFields = fields.length ? fields : itemLayer === "Manzanas" ? ["UV", "MZA"] : Object.keys(item.properties).filter(key => !key.startsWith("Id") && key !== "OBJECTID").slice(0, 3); return <tr key={`${itemLayer}-${item.id}-${index}`}>
          {layerId === allLayers && <td>{itemLayer ? layerLabels[itemLayer] : "—"}</td>}<td>{item.id}</td>{layerId === allLayers ? <td>{displayFields.map(field => item.properties[field] == null ? "" : `${field}: ${String(item.properties[field])}`).filter(Boolean).join(" · ") || "—"}</td> : displayFields.map(field => <td key={field}>{item.properties[field] == null ? "—" : String(item.properties[field])}</td>)}<td><button className="query-map-link" type="button" onClick={() => openOnMap(item)}><MapPin size={14} aria-hidden="true" />Ver en mapa</button></td></tr>; })}</tbody></table></div><nav className="search-pagination" aria-label="Paginación"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage(value => value - 1)}>Anterior</button><span>Página {page} de {Math.max(1, Math.ceil(total / 25))}</span><button type="button" disabled={page * 25 >= total || loading} onClick={() => setPage(value => value + 1)}>Siguiente</button></nav></>}</>}
    </section>
  </main></AuthenticatedLayout>;
}
