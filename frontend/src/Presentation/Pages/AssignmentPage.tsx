import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import {
  calculateOptimalRoute,
  getAssignments,
  getOperators,
  parseMapLinkOrCoordinates,
  saveAssignment,
  type AssignmentSummaryDto,
  type CalculateRouteResult,
  type DeparturePointDto,
  type OperatorWorkloadDto,
} from "@/Application/Services/operations";
import { getFixedStateColor, getLayerExtent } from "@/Application/Services/layers";

type AssignmentPageProps = {
  mode: "Corte" | "Reconexion";
};

const CIRCLED_NUMBERS = [
  "①",
  "②",
  "③",
  "④",
  "⑤",
  "⑥",
  "⑦",
  "⑧",
  "⑨",
  "⑩",
  "⑪",
  "⑫",
  "⑬",
  "⑭",
  "⑮",
  "⑯",
  "⑰",
  "⑱",
  "⑲",
  "⑳",
];

function formatCircledOrder(order: number): string {
  return CIRCLED_NUMBERS[order - 1] ?? `(${order})`;
}

const DEFAULT_OFFICE_POINT: DeparturePointDto = {
  lat: -16.39,
  lon: -60.97,
};

export function AssignmentPage({ mode }: AssignmentPageProps) {
  const isCut = mode === "Corte";
  const activeNav = isCut ? "Asignación de cortes" : "Asignación de reconexiones";

  const [activeTab, setActiveTab] = useState<"config" | "paradas" | "historial">("config");
  const [operators, setOperators] = useState<OperatorWorkloadDto[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number>(0);
  const [quantity, setQuantity] = useState<number | "">(15);
  const [departurePoint, setDeparturePoint] = useState<DeparturePointDto | null>(null);
  const [previewPoint, setPreviewPoint] = useState<DeparturePointDto | null>(null);
  const [mapLinkInput, setMapLinkInput] = useState<string>("");
  const [linkError, setLinkError] = useState<string>("");
  const [routeResult, setRouteResult] = useState<CalculateRouteResult | null>(null);
  const [recentAssignments, setRecentAssignments] = useState<AssignmentSummaryDto[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [hasSavedAssignment, setHasSavedAssignment] = useState(false);
  const canCreateAssignment = activeTab === "historial" && hasSavedAssignment && !routeResult;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const overlayGroupRef = useRef<L.LayerGroup | null>(null);
  const markersByStopRef = useRef<Map<number, L.Marker>>(new Map());

  // Filter operators matching role or show all field operators if none specifically tagged
  const filteredOperators = useMemo(() => {
    const targetRole = isCut ? "Cortador" : "Reconexion";
    const exact = operators.filter(
      (op) => op.rol.toLowerCase() === targetRole.toLowerCase(),
    );
    return exact.length > 0 ? exact : operators;
  }, [operators, isCut]);

  const selectedOperator = useMemo(
    () =>
      filteredOperators.find((op) => op.idUsuario === selectedOperatorId) ?? null,
    [filteredOperators, selectedOperatorId],
  );

  // Load operators and recent assignments when mode changes
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    setSuccessMsg("");
    setHasSavedAssignment(false);
    setRouteResult(null);

    Promise.all([
      getOperators(controller.signal),
      getAssignments(mode, controller.signal),
    ])
      .then(([ops, assigns]) => {
        setOperators(ops);
        setRecentAssignments(assigns);
        const targetRole = mode === "Corte" ? "Cortador" : "Reconexion";
        const preferred =
          ops.find((o) => o.rol.toLowerCase() === targetRole.toLowerCase()) ?? ops[0];
        if (preferred) setSelectedOperatorId(preferred.idUsuario);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setError(
            err instanceof Error
              ? err.message
              : "No se pudieron cargar los operadores.",
          );
        }
      });

    return () => controller.abort();
  }, [mode]);

  // Initialize Leaflet map and click handler
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || leafletMapRef.current) return;

    const map = L.map(container, {
      center: [-16.39, -60.97],
      zoom: 15,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    const group = L.layerGroup().addTo(map);
    overlayGroupRef.current = group;
    leafletMapRef.current = map;

    map.on("click", (ev: L.LeafletMouseEvent) => {
      const pt = {
        lat: Number(ev.latlng.lat.toFixed(6)),
        lon: Number(ev.latlng.lng.toFixed(6)),
      };
      setPreviewPoint(pt);
      setDeparturePoint(null);
      setRouteResult(null);
      setError("");
      setLinkError("");
      setSuccessMsg("");
    });

    getLayerExtent("CodigosFijos")
      .then((ext) => {
        if (
          ext &&
          Number.isFinite(ext.south) &&
          Number.isFinite(ext.west) &&
          Number.isFinite(ext.north) &&
          Number.isFinite(ext.east)
        ) {
          map.fitBounds(
            [
              [ext.south, ext.west],
              [ext.north, ext.east],
            ],
            { padding: [32, 32], maxZoom: 16 },
          );
        }
      })
      .catch(() => {});

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      leafletMapRef.current = null;
      overlayGroupRef.current = null;
    };
  }, []);

  // Render departure point, route polyline, and numbered stop pins
  useEffect(() => {
    const group = overlayGroupRef.current;
    const map = leafletMapRef.current;
    if (!group || !map) return;

    group.clearLayers();
    markersByStopRef.current.clear();

    if (departurePoint) {
      const startIcon = L.divIcon({
        className: "geoit-start-marker",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:9999px;background:#0f172a;color:#fff;font-weight:700;font-size:12px;border:3px solid #38bdf8;box-shadow:0 3px 10px rgba(15,23,42,0.4);">P0</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([departurePoint.lat, departurePoint.lon], { icon: startIcon })
        .bindPopup(
          `<strong>Punto de Partida (P0)</strong><br/><span style="color:#0284c7;font-weight:600;">Confirmado</span><br/>Lat: ${departurePoint.lat.toFixed(6)}<br/>Lon: ${departurePoint.lon.toFixed(6)}`,
        )
        .addTo(group);
    } else if (previewPoint) {
      const previewIcon = L.divIcon({
        className: "geoit-preview-marker",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:#2563eb;color:#fff;font-weight:700;font-size:11px;border:3px solid #93c5fd;box-shadow:0 0 0 5px rgba(37,99,235,0.25);">P0</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      const previewMarker = L.marker([previewPoint.lat, previewPoint.lon], { icon: previewIcon })
        .bindPopup(
          `<strong>Punto Ubicado (Previsualización)</strong><br/>Lat: ${previewPoint.lat.toFixed(6)}<br/>Lon: ${previewPoint.lon.toFixed(6)}<br/><span style="color:#2563eb;font-weight:600;">Presioná 'Confirmar P0' en el panel</span>`,
        );
      previewMarker.addTo(group);
      if (typeof previewMarker.openPopup === "function") {
        previewMarker.openPopup();
      }
    }

    if (routeResult?.rutaGeoJson) {
      const geoLayer = L.geoJSON(routeResult.rutaGeoJson, {
        filter: (feature) => feature.properties?.featureKind === "RoutePath",
        style: () => ({
          color: "#2563eb",
          weight: 5,
          opacity: 0.9,
          lineJoin: "round",
        }),
      }).addTo(group);

      for (const stop of routeResult.paradas) {
        const pinColor = isCut ? getFixedStateColor(2) : getFixedStateColor(3);
        const stopIcon = L.divIcon({
          className: "geoit-stop-marker",
          html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:${pinColor};color:#fff;font-weight:700;font-size:12px;border:2px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,0.35);">${stop.orden}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([stop.lat, stop.lon], { icon: stopIcon })
          .bindPopup(
            `<strong>Parada #${stop.orden}</strong><br/>Código Fijo: ${stop.codFijo ?? stop.idCodigo}<br/>Cliente: ${stop.nombre ?? "Sin nombre"}<br/>Distancia: +${Math.round(stop.distanciaDesdeAnteriorMeters)} m (Acum: ${(stop.distanciaAcumuladaMeters / 1000).toFixed(2)} km)`,
          )
          .addTo(group);

        markersByStopRef.current.set(stop.idCodigo, marker);
      }

      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
      }
    }
  }, [departurePoint, previewPoint, routeResult, isCut]);

  const handleLocateFromLink = () => {
    setLinkError("");
    setError("");
    const trimmed = mapLinkInput.trim();
    if (!trimmed) {
      setLinkError("Pegá un enlace de Google Maps o coordenadas.");
      return;
    }

    const parsed = parseMapLinkOrCoordinates(trimmed);
    if (!parsed) {
      setLinkError(
        "No se encontraron coordenadas válidas. Asegurate de que el enlace incluya latitud y longitud, o ingresá directamente (ej: -16.3905, -60.9712).",
      );
      return;
    }

    setPreviewPoint(parsed);
    setDeparturePoint(null);
    setRouteResult(null);
    if (leafletMapRef.current) {
      leafletMapRef.current.setView([parsed.lat, parsed.lon], 16, { animate: true });
    }
  };

  const handleConfirmDeparture = () => {
    if (!previewPoint) return;
    setDeparturePoint(previewPoint);
    setPreviewPoint(null);
    setRouteResult(null);
    setError("");
    setLinkError("");
    setSuccessMsg("Punto de partida (P0) confirmado.");
  };

  const handleUseCentralOffice = () => {
    setPreviewPoint(DEFAULT_OFFICE_POINT);
    setDeparturePoint(null);
    setRouteResult(null);
    setError("");
    setLinkError("");
    leafletMapRef.current?.setView([DEFAULT_OFFICE_POINT.lat, DEFAULT_OFFICE_POINT.lon], 15, {
      animate: true,
    });
  };

  const handleCalculateRoute = async () => {
    setError("");
    setSuccessMsg("");
    const activeOrigin = departurePoint ?? previewPoint;
    if (!activeOrigin) {
      setError("Marcá el punto de partida en el mapa o pegá un enlace de Google Maps.");
      return;
    }
    if (!departurePoint && previewPoint) {
      setDeparturePoint(previewPoint);
      setPreviewPoint(null);
    }
    if (quantity === "" || quantity <= 0) {
      setError("Ingresá una cantidad válida de órdenes.");
      return;
    }

    setCalculating(true);
    try {
      const result = await calculateOptimalRoute({
        tipo: mode,
        cantidad: quantity,
        puntoPartida: activeOrigin,
      });
      setRouteResult(result);
      if (result.totalParadas === 0) {
        setError(
          `No se encontraron suministros en estado '${isCut ? "Para corte" : "Cortado"}' disponibles para asignar.`,
        );
      } else {
        setActiveTab("paradas");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo calcular la ruta óptima.",
      );
    } finally {
      setCalculating(false);
    }
  };

  const handleSaveAssignment = async () => {
    setError("");
    setSuccessMsg("");
    if (!selectedOperator) {
      setError("Seleccioná un operador antes de guardar.");
      return;
    }
    if (!departurePoint || !routeResult || routeResult.paradas.length === 0) {
      setError("Calculá primero una ruta antes de guardar la asignación.");
      return;
    }

    setSaving(true);
    try {
      const saved = await saveAssignment({
        idUsuario: selectedOperator.idUsuario,
        tipo: mode,
        puntoPartida: departurePoint,
        idsCodigosFijos: routeResult.paradas.map((p) => p.idCodigo),
      });
      const stopCount = routeResult.paradas.length;
      setSuccessMsg(
        `Asignación #${saved.idAsignacion} guardada. ${stopCount === 1 ? "Se asignó 1 parada" : `Se asignaron ${stopCount} paradas`} a ${selectedOperator.nombre}. Podés consultar el detalle en el historial.`,
      );
      setHasSavedAssignment(true);
      // Consume the saved proposal before refreshing auxiliary data.
      setRouteResult(null);
      setSelectedOperatorId(0);
      setQuantity("");
      setDeparturePoint(null);
      setPreviewPoint(null);
      setMapLinkInput("");
      setLinkError("");
      setActiveTab("historial");

      try {
        const [updatedOps, updatedAssigns] = await Promise.all([
          getOperators(),
          getAssignments(mode),
        ]);
        setOperators(updatedOps);
        setRecentAssignments(updatedAssigns);
      } catch {
        setError("La asignación se guardó, pero no se pudo actualizar el historial o la carga de operadores. No vuelvas a guardarla; actualizá la página para consultar los datos.");
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message.trim()
          ? `No se pudo guardar la asignación. ${err.message}`
          : "No se pudo guardar la asignación.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFocusStop = (stop: { idCodigo: number; lat: number; lon: number }) => {
    const map = leafletMapRef.current;
    if (!map) return;
    map.setView([stop.lat, stop.lon], 18);
    const marker = markersByStopRef.current.get(stop.idCodigo);
    if (marker) {
      marker.openPopup();
    }
  };

  return (
    <AuthenticatedLayout activeItem={activeNav}>
      <main className="h-[calc(100vh-56px)] overflow-hidden flex flex-col p-4 lg:px-6 box-border">
        {/* Header aligned with QueriesPage */}
        <header className="queries-heading flex items-center justify-between gap-4 mb-3 shrink-0">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              {isCut
                ? "Asignación de Cortes de Servicio"
                : "Asignación de Reconexiones por Corte"}
            </h1>
            <p className="m-0 text-xs text-slate-500">
              {isCut
                ? "Generá la hoja de ruta diaria para cuadrillas de corte de suministros en mora."
                : "Generá la hoja de ruta diaria para cuadrillas de reconexión de suministros regularizados."}
            </p>
          </div>

          <div className="shrink-0">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs shadow-2xs">
              <span className="text-slate-500">Estado objetivo:</span>
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: isCut ? getFixedStateColor(2) : getFixedStateColor(3) }}
                aria-hidden="true"
              />
              <strong className="text-slate-800">
                {isCut ? "Para corte (Estado 2)" : "Cortado (Estado 3)"}
              </strong>
            </div>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            className="shrink-0 mb-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs font-medium text-red-700"
          >
            {error}
          </div>
        )}

        {successMsg && (
          <div
            role="status"
            className="shrink-0 mb-2 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800"
          >
            <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 2-Column Responsive Workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-1 gap-3 lg:grid-cols-12 overflow-hidden">
          {/* Left Panel: Tabs & Form (4 cols) */}
          <section
            aria-label="Mapa de trazado de ruta óptima"
            className="relative flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs lg:col-span-8 h-full min-h-0"
          >
            {/* Floating Instructional Pill Overlay on the Map */}
            <div className="pointer-events-none absolute right-4 top-3 z-[1000] flex max-w-[calc(100%-32px)] items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-3.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm backdrop-blur-xs">
              <span
                className="size-2 rounded-full"
                style={{
                  backgroundColor: !departurePoint && !previewPoint
                    ? "#f97316"
                    : previewPoint && !departurePoint
                      ? "#3b82f6"
                      : routeResult
                        ? "#16a34a"
                        : "#2563eb",
                }}
                aria-hidden="true"
              />
              <span className="truncate">
                {!departurePoint && !previewPoint
                  ? "Pegá un enlace de mapa o hacé clic en el mapa para ubicar P0"
                  : previewPoint && !departurePoint
                    ? `Punto ubicado (${previewPoint.lat.toFixed(4)}, ${previewPoint.lon.toFixed(4)}). Presioná 'Confirmar P0'`
                    : !routeResult
                      ? `Punto de inicio fijado (${departurePoint!.lat.toFixed(4)}, ${departurePoint!.lon.toFixed(4)}). Presioná 'Calcular ruta óptima'`
                      : `Ruta lista: ${routeResult.totalParadas} paradas · ${(routeResult.distanciaTotalMeters / 1000).toFixed(2)} km`}
              </span>
            </div>

            <div ref={mapContainerRef} className="h-full min-h-0 w-full flex-1" />
          </section>
          <section
            aria-label="Panel de despacho"
            className="flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs lg:col-span-4 h-full min-h-0 overflow-hidden"
          >
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {/* Navigation Tabs */}
              <div
                role="tablist"
                aria-label="Pestañas de asignación"
                className="grid grid-cols-3 gap-1 rounded-lg border border-slate-200/80 bg-slate-100/90 p-1 shrink-0 mb-3"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "config"}
                  onClick={() => setActiveTab("config")}
                  className={`flex h-8 cursor-pointer items-center justify-center rounded-md text-xs font-medium transition ${
                    activeTab === "config"
                      ? "bg-white text-slate-900 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Configuración
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "paradas"}
                  onClick={() => setActiveTab("paradas")}
                  className={`flex h-8 cursor-pointer items-center justify-center gap-1 rounded-md text-xs font-medium transition ${
                    activeTab === "paradas"
                      ? "bg-white text-slate-900 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <span>Paradas</span>
                  {routeResult && (
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-800">
                      {routeResult.totalParadas}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "historial"}
                  onClick={() => setActiveTab("historial")}
                  className={`flex h-8 cursor-pointer items-center justify-center rounded-md text-xs font-medium transition ${
                    activeTab === "historial"
                      ? "bg-white text-slate-900 font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Historial
                </button>
              </div>

              {/* Tab 1: Configuration Form */}
              {activeTab === "config" && (
                <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3.5">
                  {/* Step 1: Operator Selection */}
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="grid size-5 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                        1
                      </span>
                      <label
                        htmlFor="operator-select"
                        className="text-xs font-semibold text-slate-800"
                      >
                        Operador asignado
                      </label>
                    </div>

                    <span className="relative block">
                      <select
                        id="operator-select"
                        value={selectedOperator?.idUsuario ?? ""}
                        onChange={(e) => setSelectedOperatorId(Number(e.target.value))}
                        className="block h-10 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-3 pr-10 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 [&>option]:cursor-pointer"
                      >
                        <option value="">Seleccioná un operador</option>
                        {filteredOperators.map((op) => (
                          <option key={op.idUsuario} value={op.idUsuario}>
                            {op.nombre} ({op.rol})
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                        size={16}
                        aria-hidden="true"
                      />
                    </span>

                    {selectedOperator && (
                      <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                        <span>Carga de hoy:</span>
                        <span className="rounded bg-amber-50 px-2 py-0.5 font-mono font-semibold text-amber-800 border border-amber-200/60">
                          {selectedOperator.tareasPendientesHoy} pendientes ·{" "}
                          {selectedOperator.tareasCompletadasHoy} hechas
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Quantity Selection */}
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="grid size-5 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                          2
                        </span>
                        <label
                          htmlFor="orders-quantity"
                          className="text-xs font-semibold text-slate-800"
                        >
                          Cantidad de órdenes
                        </label>
                      </div>
                      <span className="text-[11px] text-slate-500">Máx. 100</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        id="orders-quantity"
                        type="number"
                        min={1}
                        max={100}
                        value={quantity}
                        onChange={(e) =>
                          setQuantity(e.target.value === "" ? "" : Math.max(1, Math.min(100, Number(e.target.value) || 1)))
                        }
                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 font-mono text-sm font-semibold text-slate-900 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                      />
                      {[10, 15, 20, 30].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setQuantity(preset)}
                          className={`h-10 cursor-pointer rounded-lg border px-2.5 font-mono text-xs font-semibold transition ${
                            quantity === preset
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step 3: Departure Point Selection */}
                  <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="grid size-5 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                          3
                        </span>
                        <span className="text-xs font-semibold text-slate-800">
                          Punto de partida (P0)
                        </span>
                      </div>
                      {!departurePoint && !previewPoint && (
                        <button
                          type="button"
                          onClick={handleUseCentralOffice}
                          className="cursor-pointer text-[11px] font-semibold text-blue-600 hover:underline"
                        >
                          Usar oficina central
                        </button>
                      )}
                    </div>

                    {/* Confirmed State */}
                    {departurePoint ? (
                      <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 text-xs">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="size-2 rounded-full bg-emerald-600" />
                            <p className="m-0 font-semibold text-emerald-900">Origen P0 confirmado</p>
                          </div>
                          <p className="m-0 mt-0.5 font-mono text-[11px] text-emerald-700">
                            {departurePoint.lat.toFixed(6)}, {departurePoint.lon.toFixed(6)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPoint(departurePoint);
                            setDeparturePoint(null);
                            setRouteResult(null);
                          }}
                          className="cursor-pointer text-xs font-medium text-slate-500 hover:text-red-600 underline"
                        >
                          Cambiar
                        </button>
                      </div>
                    ) : previewPoint ? (
                      /* Preview / Confirmation State */
                      <div className="rounded-lg border border-blue-200 bg-blue-50/80 p-2.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-blue-950">
                            Ubicación detectada en mapa
                          </span>
                          <span className="rounded bg-blue-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-blue-800">
                            Previsualización
                          </span>
                        </div>
                        <p className="m-0 font-mono text-[11px] text-blue-800">
                          {previewPoint.lat.toFixed(6)}, {previewPoint.lon.toFixed(6)}
                        </p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <button
                            type="button"
                            onClick={handleConfirmDeparture}
                            className="flex-1 cursor-pointer rounded-md bg-blue-600 py-1.5 px-3 text-center text-xs font-semibold text-white shadow-2xs hover:bg-blue-700 transition"
                          >
                            Confirmar P0
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPreviewPoint(null);
                              setLinkError("");
                            }}
                            className="cursor-pointer rounded-md border border-slate-300 bg-white py-1.5 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                          >
                            Descartar
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Link Input and Manual Click Option */
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label
                            htmlFor="map-link-input"
                            className="block text-[11px] font-medium text-slate-600"
                          >
                            Pegar enlace de Google Maps o coordenadas
                          </label>
                          <div className="flex items-center gap-1.5">
                            <input
                              id="map-link-input"
                              type="text"
                              value={mapLinkInput}
                              onChange={(e) => {
                                setMapLinkInput(e.target.value);
                                if (linkError) setLinkError("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleLocateFromLink();
                                }
                              }}
                              placeholder="Ej: https://maps.google.com/... o -16.39, -60.97"
                              className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                            />
                            <button
                              type="button"
                              onClick={handleLocateFromLink}
                              className="h-9 cursor-pointer rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 transition shrink-0"
                            >
                              Ubicar
                            </button>
                          </div>
                          {linkError && (
                            <p className="m-0 text-[11px] font-medium text-red-600">
                              {linkError}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 pt-0.5">
                          <div className="h-px flex-1 bg-slate-200" />
                          <span className="text-[10px] uppercase font-semibold text-slate-400">o</span>
                          <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        <p className="m-0 text-center text-xs text-slate-500">
                          Hacé clic en cualquier lugar del mapa para marcar P0.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Route Summary if Calculated */}
                  {routeResult && routeResult.paradas.length > 0 && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs">
                      <div className="flex items-center justify-between font-semibold text-blue-950">
                        <span>Ruta calculada con éxito</span>
                        <button
                          type="button"
                          onClick={() => setActiveTab("paradas")}
                          className="cursor-pointer text-blue-600 underline"
                        >
                          Ver {routeResult.totalParadas} paradas →
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between text-[11px] text-blue-800">
                        <span>Distancia total:</span>
                        <span className="font-mono font-bold">
                          {(routeResult.distanciaTotalMeters / 1000).toFixed(2)} km
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Sequenced Stops List */}
              {activeTab === "paradas" && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-2">
                  <div className="flex shrink-0 items-center justify-between text-xs pb-1 border-b border-slate-100">
                    <span className="font-semibold text-slate-800">
                      Paradas ordenadas (1..N)
                    </span>
                    {routeResult && (
                      <span className="font-mono text-slate-500">
                        {(routeResult.distanciaTotalMeters / 1000).toFixed(2)} km total
                      </span>
                    )}
                  </div>

                  {!routeResult || routeResult.paradas.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      <p className="m-0">
                        Completá los pasos de la pestaña <strong>Configuración</strong> y presioná <strong>Calcular ruta óptima</strong>.
                      </p>
                    </div>
                  ) : (
                    <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
                      {routeResult.paradas.map((stop) => (
                        <div
                          key={stop.idCodigo}
                          onClick={() => handleFocusStop(stop)}
                          className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50/70 p-2 text-xs transition hover:border-blue-300 hover:bg-blue-50/40"
                        >
                          <span
                            className="mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold text-white"
                            style={{
                              backgroundColor: isCut ? getFixedStateColor(2) : getFixedStateColor(3),
                            }}
                          >
                            {stop.orden}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-1">
                              <span className="truncate font-semibold text-slate-900">
                                {formatCircledOrder(stop.orden)} CF-{stop.codFijo ?? stop.idCodigo}
                              </span>
                              <span className="shrink-0 font-mono text-[10px] font-semibold text-blue-700">
                                +{Math.round(stop.distanciaDesdeAnteriorMeters)} m
                              </span>
                            </div>
                            <p className="m-0 truncate text-[11px] text-slate-600">
                              {stop.nombre ?? "Sin nombre registrado"}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Recent Dispatches History */}
              {activeTab === "historial" && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden space-y-2">
                  <div className="text-xs pb-1 border-b border-slate-100 font-semibold text-slate-800 shrink-0">
                    Últimas asignaciones ({mode})
                  </div>

                  {recentAssignments.length === 0 ? (
                    <p className="py-8 text-center text-xs text-slate-400">
                      No hay asignaciones registradas para este tipo de orden hoy.
                    </p>
                  ) : (
                    <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1">
                      {recentAssignments.map((a) => (
                        <div
                          key={a.idAsignacion}
                          className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">
                              #{a.idAsignacion} · {a.operador}
                            </span>
                            <span className="rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                              {a.estado}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                            <span>Órdenes: {a.cantidadCodigos}</span>
                            <span>{a.completados} completadas · {a.pendientes} pendientes</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Actions Buttons (Always Accessible) */}
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3.5">
              <button
                type="button"
                disabled={calculating}
                onClick={() => void handleCalculateRoute()}
                className="flex h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-blue-600 px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {calculating ? "Calculando ruta óptima…" : "Calcular ruta óptima"}
              </button>

              <button
                type="button"
                disabled={saving || (!canCreateAssignment && (!routeResult || routeResult.paradas.length === 0))}
                onClick={() => {
                  if (canCreateAssignment) {
                    setActiveTab("config");
                    setHasSavedAssignment(false);
                    setSuccessMsg("");
                    setError("");
                  } else {
                    void handleSaveAssignment();
                  }
                }}
                className="flex h-10 w-full cursor-pointer items-center justify-center rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {saving ? "Guardando asignación…" : canCreateAssignment ? "Preparar otra asignación" : "Guardar asignación"}
              </button>
            </div>
          </section>

          {/* Right Area: Interactive Map (8 cols) */}
        </div>
      </main>
    </AuthenticatedLayout>
  );
}
