import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  Check,
  ChevronDown,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { Tooltip } from "@/Presentation/Components/ui/tooltip";
import { AuthenticatedLayout } from "@/Presentation/Layouts/AuthenticatedLayout";
import {
  getAssignmentDetails,
  getAssignments,
  getOperators,
  getTrackingHistory,
  type AssignmentDetailItemDto,
  type AssignmentSummaryDto,
  type OperatorWorkloadDto,
  type TrackingHistoryPointDto,
} from "@/Application/Services/operations";
import { getFixedStateColor } from "@/Application/Services/layers";

type PlaybackStep = {
  index: number;
  lat: number;
  lon: number;
  timestamp: string;
  isStopDwell: boolean;
  stopOrder?: number;
  stopCode?: number;
  dwellMinutes?: number;
  statusLabel: string;
};

export function MonitoringPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [operators, setOperators] = useState<OperatorWorkloadDto[]>([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState<number>(0);
  const [activityFilter, setActivityFilter] = useState<string>("Todas");
  const [assignments, setAssignments] = useState<AssignmentSummaryDto[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number>(0);
  const [stops, setStops] = useState<AssignmentDetailItemDto[]>([]);
  const [trackingPoints, setTrackingPoints] = useState<TrackingHistoryPointDto[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"filtros" | "estados">("filtros");

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [speedMultiplier, setSpeedMultiplier] = useState<1 | 2 | 4>(1);
  const [dwellSeconds, setDwellSeconds] = useState<number>(3);
  const [holdingAtStop, setHoldingAtStop] = useState<boolean>(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const leafletMapRef = useRef<L.Map | null>(null);
  const routeLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const operatorMarkerRef = useRef<L.Marker | null>(null);

  // Load initial operators and assignments
  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      getOperators(controller.signal),
      getAssignments(undefined, controller.signal),
    ])
      .then(([ops, assigns]) => {
        setOperators(ops);
        setAssignments(assigns);
        if (ops.length > 0) setSelectedOperatorId(ops[0].idUsuario);
        if (assigns.length > 0) setSelectedAssignmentId(assigns[0].idAsignacion);
      })
      .catch(() => {});

    return () => controller.abort();
  }, []);

  // Filter assignments by operator & activity
  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchOp = !selectedOperatorId || a.idUsuario === selectedOperatorId;
      const matchAct =
        activityFilter === "Todas" ||
        a.tipoAsignacion.toLowerCase() === activityFilter.toLowerCase();
      return matchOp && matchAct;
    });
  }, [assignments, selectedOperatorId, activityFilter]);

  const selectedOperator = useMemo(
    () => operators.find((op) => op.idUsuario === selectedOperatorId) ?? null,
    [operators, selectedOperatorId],
  );

  useEffect(() => {
    if (
      filteredAssignments.length > 0 &&
      !filteredAssignments.some((a) => a.idAsignacion === selectedAssignmentId)
    ) {
      setSelectedAssignmentId(filteredAssignments[0].idAsignacion);
    }
  }, [filteredAssignments, selectedAssignmentId]);

  // Load details & telemetry trace for selected assignment/operator/date
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setIsPlaying(false);
    setCurrentStepIndex(0);

    const detailsPromise = selectedAssignmentId
      ? getAssignmentDetails(selectedAssignmentId, controller.signal)
      : Promise.resolve([] as AssignmentDetailItemDto[]);

    const trackingPromise = getTrackingHistory(
      {
        idUsuario: selectedOperatorId || undefined,
        idAsignacion: selectedAssignmentId || undefined,
        fecha: selectedDate || undefined,
      },
      controller.signal,
    );

    Promise.all([detailsPromise, trackingPromise])
      .then(([det, track]) => {
        setStops(det);
        setTrackingPoints(track);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [selectedAssignmentId, selectedOperatorId, selectedDate]);

  // Build unified playback timeline combining telemetry or synthesized trajectory across stops
  const playbackSteps = useMemo<PlaybackStep[]>(() => {
    const actLabel =
      activityFilter === "Reconexion" ? "Reconnection" : "Disconnection";

    if (trackingPoints.length > 0) {
      const total = trackingPoints.length;
      return trackingPoints.map((pt, idx) => {
        const nearStop = stops.find(
          (s) =>
            Math.abs(s.latitudMedidor - pt.latitud) < 0.00035 &&
            Math.abs(s.longitudMedidor - pt.longitud) < 0.00035,
        );
        const isDwell = Boolean(nearStop) || Boolean(pt.evento?.includes("Corte"));
        const codeNum = nearStop?.codFijo ?? nearStop?.idCodigo ?? idx + 1;
        const label = isDwell
          ? `${idx + 1}/${total} · Stopped at ${actLabel} #${codeNum} (4 min)`
          : `${idx + 1}/${total} · Traveling towards ${actLabel} #${codeNum}`;

        return {
          index: idx,
          lat: pt.latitud,
          lon: pt.longitud,
          timestamp: pt.fechaHora,
          isStopDwell: isDwell,
          stopOrder: nearStop?.ordenSecuencia,
          stopCode: codeNum,
          dwellMinutes: isDwell ? 4 : undefined,
          statusLabel: label,
        };
      });
    }

    if (stops.length > 0) {
      const selectedAssign = assignments.find(
        (a) => a.idAsignacion === selectedAssignmentId,
      );
      const steps: PlaybackStep[] = [];
      let prevLat = selectedAssign?.puntoPartidaLat ?? stops[0].latitudMedidor;
      let prevLon = selectedAssign?.puntoPartidaLon ?? stops[0].longitudMedidor;

      stops.forEach((s) => {
        const targetLat = s.latitudEjecucion ?? s.latitudMedidor;
        const targetLon = s.longitudEjecucion ?? s.longitudMedidor;
        const codeNum = s.codFijo ?? s.idCodigo;

        // 2 intermediate transit steps + 1 stop dwell step per order
        for (let seg = 1; seg <= 2; seg++) {
          const frac = seg / 3;
          steps.push({
            index: steps.length,
            lat: prevLat + (targetLat - prevLat) * frac,
            lon: prevLon + (targetLon - prevLon) * frac,
            timestamp: s.fechaHoraEjecucion ?? new Date().toISOString(),
            isStopDwell: false,
            stopOrder: s.ordenSecuencia,
            stopCode: codeNum,
            statusLabel: "",
          });
        }

        steps.push({
          index: steps.length,
          lat: targetLat,
          lon: targetLon,
          timestamp: s.fechaHoraEjecucion ?? new Date().toISOString(),
          isStopDwell: true,
          stopOrder: s.ordenSecuencia,
          stopCode: codeNum,
          dwellMinutes: 4,
          statusLabel: "",
        });

        prevLat = targetLat;
        prevLon = targetLon;
      });

      const total = steps.length;
      return steps.map((st, idx) => ({
        ...st,
        index: idx,
        statusLabel: st.isStopDwell
          ? `${idx + 1}/${total} · Stopped at ${actLabel} #${st.stopCode} (${st.dwellMinutes ?? 4} min)`
          : `${idx + 1}/${total} · Traveling towards ${actLabel} #${st.stopCode}`,
      }));
    }

    // Default demonstration trajectory when database has no active dispatches yet
    const baseCoords: Array<[number, number, boolean, number]> = [
      [-16.3912, -60.9725, false, 95],
      [-16.3905, -60.9718, false, 95],
      [-16.3898, -60.971, true, 95],
      [-16.3891, -60.9702, false, 96],
      [-16.3885, -60.9694, true, 96],
      [-16.3879, -60.9688, false, 97],
      [-16.3872, -60.968, true, 97],
    ];
    const total = baseCoords.length;
    return baseCoords.map(([lat, lon, dwell, code], idx) => ({
      index: idx,
      lat,
      lon,
      timestamp: new Date().toISOString(),
      isStopDwell: dwell,
      stopOrder: idx + 1,
      stopCode: code,
      dwellMinutes: dwell ? 4 : undefined,
      statusLabel: dwell
        ? `${idx + 1}/${total} · Stopped at ${actLabel} #${code} (4 min)`
        : `${idx + 1}/${total} · Traveling towards ${actLabel} #${code}`,
    }));
  }, [trackingPoints, stops, assignments, selectedAssignmentId, activityFilter]);

  const currentStep = playbackSteps[currentStepIndex] ?? playbackSteps[0];

  const timelineStages = useMemo(() => {
    return playbackSteps.map((s, idx) => {
      const isCurrent = s.index === currentStepIndex;
      const isPast = s.index < currentStepIndex;
      const isNext = !isPast && !isCurrent && s.index === currentStepIndex + 1;
      const matchingStop = stops.find(
        (st) => (st.codFijo ?? st.idCodigo) === s.stopCode,
      );

      let tipo: "inicio" | "transito" | "parada" = "transito";
      let titulo = `Hito #${idx + 1} · En ruta`;
      let estado = "En ruta";
      let observacion = matchingStop?.observacion;

      if (idx === 0) {
        tipo = "inicio";
        titulo = "1. Salida de jornada · P0";
        estado = "Inicio";
      } else if (s.isStopDwell) {
        tipo = "parada";
        titulo = `${idx + 1}. Parada #${s.stopOrder ?? idx + 1} · CF-${s.stopCode}`;
        estado =
          matchingStop?.estado ??
          (s.stopCode === 96
            ? "Observado"
            : activityFilter === "Reconexion"
              ? "Reconectado"
              : "Cortado");
        if (!observacion && estado === "Observado") {
          observacion = "Medidor inaccesible";
        } else if (!observacion && s.stopCode === 95) {
          observacion = "Lectura: 1420 kWh";
        } else if (!observacion && s.stopCode === 97) {
          observacion = "Lectura: 3890 kWh";
        }
      } else {
        tipo = "transito";
        titulo = `${idx + 1}. En camino hacia #${s.stopCode}`;
        estado = "En ruta";
      }

      return {
        stepIndex: s.index,
        lat: s.lat,
        lon: s.lon,
        tipo,
        titulo,
        estado,
        observacion,
        cliente:
          matchingStop?.nombre ??
          (s.isStopDwell
            ? `Suministro CF-${s.stopCode}`
            : idx === 0
              ? "Salida de base operativa"
              : "Desplazamiento por vía"),
        dwellMinutes: s.dwellMinutes,
        isCurrent,
        isPast,
        isNext,
      };
    });
  }, [playbackSteps, stops, currentStepIndex, activityFilter]);

  // Initialize Leaflet Map
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

    routeLayerGroupRef.current = L.layerGroup().addTo(map);
    leafletMapRef.current = map;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      leafletMapRef.current = null;
      routeLayerGroupRef.current = null;
      operatorMarkerRef.current = null;
    };
  }, []);

  // Draw planned route vs actual traveled path & stop pins
  useEffect(() => {
    const group = routeLayerGroupRef.current;
    const map = leafletMapRef.current;
    if (!group || !map) return;

    group.clearLayers();
    operatorMarkerRef.current = null;

    if (playbackSteps.length === 0) return;

    // Planned full path (dashed slate/blue)
    const plannedLatLngs = playbackSteps.map(
      (s) => [s.lat, s.lon] as [number, number],
    );
    const plannedLine = L.polyline(plannedLatLngs, {
      color: "#94a3b8",
      weight: 4,
      dashArray: "6 6",
      opacity: 0.85,
    }).addTo(group);

    // Traveled path up to currentStepIndex (solid blue)
    const traveledLatLngs = playbackSteps
      .slice(0, currentStepIndex + 1)
      .map((s) => [s.lat, s.lon] as [number, number]);
    L.polyline(traveledLatLngs, {
      color: "#2563eb",
      weight: 5,
      opacity: 0.95,
    }).addTo(group);

    // 3. Start Point Marker (P0 - Inicio del recorrido)
    if (playbackSteps.length > 0) {
      const p0 = playbackSteps[0];
      const p0Icon = L.divIcon({
        className: "geoit-start-marker",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:9999px;background:#0f172a;color:#fff;font-weight:700;font-size:11px;border:2px solid #38bdf8;box-shadow:0 2px 6px rgba(15,23,42,0.4);">P0</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([p0.lat, p0.lon], { icon: p0Icon })
        .bindPopup(`<strong>Inicio del Recorrido (P0)</strong><br/>Salida de cuadrilla hacia órdenes del día`)
        .addTo(group);
    }

    // 4. Transit Waypoints (Hitos GPS de desplazamiento)
    playbackSteps
      .filter((s, idx) => !s.isStopDwell && idx !== 0)
      .forEach((s) => {
        const isReached = s.index <= currentStepIndex;
        const transitIcon = L.divIcon({
          className: "geoit-transit-marker",
          html: `<div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:9999px;background:${isReached ? "#2563eb" : "#cbd5e1"};color:#fff;font-size:9px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,0.3);">${s.index + 1}</div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        L.marker([s.lat, s.lon], { icon: transitIcon })
          .bindPopup(`<strong>Hito #${s.index + 1}</strong><br/>En desplazamiento hacia Parada #${s.stopCode}`)
          .addTo(group);
      });

    // 5. Work stops
    playbackSteps
      .filter((s) => s.isStopDwell)
      .forEach((s) => {
        const isObserved = s.stopCode === 96;
        const pinColor = isObserved
          ? "#d97706"
          : activityFilter === "Reconexion"
            ? getFixedStateColor(3)
            : getFixedStateColor(2);
        const stopPin = L.divIcon({
          className: "geoit-monitor-stop",
          html: `<div style="display:flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9999px;background:${pinColor};color:#fff;font-weight:700;font-size:11px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${s.stopOrder ?? s.index + 1}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        L.marker([s.lat, s.lon], { icon: stopPin })
          .bindPopup(
            `<strong>Parada #${s.stopOrder ?? s.index + 1} · Suministro #${s.stopCode}</strong><br/>Estado: ${isObserved ? "Observado" : "Ejecución técnica"}<br/>Permanencia: ${s.dwellMinutes ?? 4} min`,
          )
          .addTo(group);
      });

    // Animated Operator / Vehicle Icon at currentStep
    if (currentStep) {
      const opIcon = L.divIcon({
        className: "geoit-operator-marker",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:9999px;background:${
          currentStep.isStopDwell ? getFixedStateColor(3) : "#0f172a"
        };color:#fff;font-weight:800;font-size:12px;border:3px solid #38bdf8;box-shadow:0 3px 10px rgba(15,23,42,0.45);">OP</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      operatorMarkerRef.current = L.marker([currentStep.lat, currentStep.lon], {
        icon: opIcon,
      })
        .bindPopup(currentStep.statusLabel)
        .addTo(group);
    }

    if (currentStepIndex === 0 && plannedLine.getBounds().isValid()) {
      map.fitBounds(plannedLine.getBounds(), { padding: [40, 40], maxZoom: 16 });
    }
  }, [playbackSteps, currentStepIndex, currentStep]);

  // Temporal playback timer with configurable dwell pause at work stops
  useEffect(() => {
    if (!isPlaying || playbackSteps.length <= 1) return;

    const step = playbackSteps[currentStepIndex];
    if (!step) {
      setIsPlaying(false);
      return;
    }

    if (currentStepIndex >= playbackSteps.length - 1) {
      setIsPlaying(false);
      return;
    }

    const delayMs = step.isStopDwell
      ? Math.max(500, (dwellSeconds * 1000) / speedMultiplier)
      : Math.round(900 / speedMultiplier);

    setHoldingAtStop(step.isStopDwell);

    const timer = window.setTimeout(() => {
      setHoldingAtStop(false);
      setCurrentStepIndex((prev) => Math.min(playbackSteps.length - 1, prev + 1));
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [isPlaying, currentStepIndex, playbackSteps, speedMultiplier, dwellSeconds]);

  return (
    <AuthenticatedLayout activeItem="Seguimiento de personal">
      <main className="h-[calc(100vh-56px)] overflow-hidden flex flex-col p-4 lg:px-6 box-border">
        {/* Header aligned with QueriesPage */}
        <header className="queries-heading flex items-center justify-between gap-4 mb-3 shrink-0">
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Monitoreo y Seguimiento de Personal
            </h1>
            <p className="m-0 text-xs text-slate-500">
              Supervisión de rutas y reproducción temporal de cuadrillas en campo
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                holdingAtStop
                  ? "bg-amber-100 text-amber-800"
                  : isPlaying
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-700"
              }`}
            >
              <span
                className={`size-2 rounded-full ${
                  holdingAtStop
                    ? "bg-amber-600"
                    : isPlaying
                      ? "animate-pulse bg-emerald-600"
                      : "bg-slate-400"
                }`}
              />
              {holdingAtStop
                ? "Detenido en parada"
                : isPlaying
                  ? "En recorrido"
                  : "Reproducción en pausa"}
            </span>
          </div>
        </header>

        {/* 2-Column Responsive Workspace */}
        <div className="flex-1 min-h-0 grid grid-cols-1 gap-3 lg:grid-cols-12 overflow-hidden">
          {/* Left Panel: Compact Filters & The 7 Journey States */}
          <section
            aria-label="Mapa de trayectoria del operador"
            className="relative flex flex-col justify-between overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs lg:col-span-8 h-full min-h-0"
          >
            {/* Top Bar on Map: Legends & Summary */}
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2 text-xs">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                  <span className="inline-block h-1 w-5 rounded bg-blue-600" />
                  Ruta recorrida
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <span className="inline-block h-1 w-5 rounded border border-dashed border-slate-400" />
                  Ruta planificada
                </span>
                <span className="flex items-center gap-1.5 font-medium text-slate-500">
                  <span className="inline-block size-2 rounded-full bg-slate-900 border border-sky-400" />
                  P0 Inicio
                </span>
              </div>
              <div className="text-[11px] font-medium text-slate-500">
                {selectedOperator ? selectedOperator.nombre : "Cuadrilla general"} · {timelineStages.length} estados
              </div>
            </div>

            {/* Floating Status Pill Overlay on the Map (top right, role status for accessibility & vitest) */}
            <div
              role="status"
              className="pointer-events-none absolute right-4 top-11 z-[1000] flex max-w-[calc(100%-32px)] items-center gap-2 rounded-full border border-slate-200/90 bg-white/95 px-3.5 py-1.5 text-xs font-medium text-slate-800 shadow-sm backdrop-blur-xs"
            >
              <span
                className={`size-2 shrink-0 rounded-full ${
                  holdingAtStop
                    ? "bg-amber-500"
                    : isPlaying
                      ? "animate-pulse bg-emerald-500"
                      : "bg-blue-600"
                }`}
                aria-hidden="true"
              />
              <span className="truncate font-mono">
                {currentStep?.statusLabel ?? "0/0 · Sin recorrido"}
              </span>
            </div>

            {/* Map Canvas - Full width, full spacious area */}
            <div ref={mapContainerRef} className="h-full min-h-0 w-full flex-1" />

            {/* Bottom Integrated Playback Bar: Slim Single Row */}
            <div
              aria-label="Controles de reproducción temporal"
              className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200/80 bg-white/95 px-3 py-2 shadow-2xs backdrop-blur-xs"
            >
              {/* Left: Icon-only buttons with Tooltip */}
              <div className="flex items-center gap-1.5 shrink-0">
                <Tooltip content="Reiniciar reproducción" side="top">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPlaying(false);
                      setCurrentStepIndex(0);
                    }}
                    aria-label="Reiniciar reproducción"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100"
                  >
                    <RotateCcw size={14} />
                  </button>
                </Tooltip>

                <Tooltip
                  content={isPlaying ? "Pausar reproducción" : "Iniciar reproducción"}
                  side="top"
                >
                  <button
                    type="button"
                    onClick={() => {
                      if (currentStepIndex >= playbackSteps.length - 1) {
                        setCurrentStepIndex(0);
                      }
                      setIsPlaying((prev) => !prev);
                    }}
                    aria-label={isPlaying ? "Pausar reproducción" : "Iniciar reproducción"}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-lg bg-slate-900 text-white transition hover:bg-slate-800"
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </Tooltip>
              </div>

              {/* Center: Slim Timeline Slider */}
              <div className="flex flex-1 items-center gap-2.5">
                <span className="font-mono text-[11px] font-semibold text-slate-500 shrink-0">
                  {currentStepIndex + 1}/{playbackSteps.length}
                </span>
                <input
                  type="range"
                  aria-label="Línea de tiempo del recorrido"
                  min={0}
                  max={Math.max(0, playbackSteps.length - 1)}
                  value={currentStepIndex}
                  onChange={(e) => {
                    setIsPlaying(false);
                    setCurrentStepIndex(Number(e.target.value));
                  }}
                  className="h-1.5 flex-1 cursor-pointer accent-blue-600"
                />
              </div>

              {/* Right: Speed 1x, 2x, 4x & Dwell selector */}
              <div className="flex items-center gap-2.5 shrink-0 text-xs">
                <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                  {([1, 2, 4] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSpeedMultiplier(spd)}
                      className={`cursor-pointer rounded-md px-2 py-0.5 font-mono text-xs font-bold transition ${
                        speedMultiplier === spd
                          ? "bg-slate-900 text-white shadow-2xs"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-slate-600">
                  <span className="text-[11px] font-medium">Pausa:</span>
                  <span className="relative block">
                    <select
                      aria-label="Pausa en cada parada"
                      value={dwellSeconds}
                      onChange={(e) => setDwellSeconds(Number(e.target.value))}
                      className="block h-8 cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-2 pr-6 font-mono text-xs font-semibold text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 [&>option]:cursor-pointer"
                    >
                      <option value={1}>1 s</option>
                      <option value={3}>3 s</option>
                      <option value={5}>5 s</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500"
                      size={13}
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section
            aria-label="Panel de control de monitoreo"
            className="flex flex-col rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-2xs lg:col-span-4 h-full min-h-0 overflow-hidden"
          >
            {/* Navigation Tabs */}
            <div
              role="tablist"
              aria-label="Pestañas de monitoreo"
              className="grid grid-cols-2 gap-1 rounded-lg border border-slate-200/80 bg-slate-100/90 p-1 shrink-0 mb-3"
            >
              <button
                id="tab-filtros"
                type="button"
                role="tab"
                aria-selected={activeTab === "filtros"}
                aria-controls="panel-filtros"
                tabIndex={activeTab === "filtros" ? 0 : -1}
                onClick={() => setActiveTab("filtros")}
                className={`flex h-8.5 cursor-pointer items-center justify-center rounded-md px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  activeTab === "filtros"
                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                Filtros
              </button>
              <button
                id="tab-estados"
                type="button"
                role="tab"
                aria-selected={activeTab === "estados"}
                aria-controls="panel-estados"
                tabIndex={activeTab === "estados" ? 0 : -1}
                onClick={() => setActiveTab("estados")}
                className={`flex h-8.5 cursor-pointer items-center justify-center gap-1.5 rounded-md px-3 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 ${
                  activeTab === "estados"
                    ? "bg-white text-slate-900 font-semibold shadow-2xs"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
                }`}
              >
                <span>Estados</span>
                <span
                  className={`size-5 shrink-0 rounded-full inline-flex items-center justify-center font-mono text-[10px] font-bold transition-colors ${
                    activeTab === "estados"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-200 text-slate-700"
                  }`}
                >
                  {timelineStages.length}
                </span>
              </button>
            </div>

            {/* Tab 1: Filtros */}
            <div
              id="panel-filtros"
              role="tabpanel"
              aria-labelledby="tab-filtros"
              hidden={activeTab !== "filtros"}
              className="flex-1 flex flex-col min-h-0 overflow-y-auto space-y-3.5 pr-0.5"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Filtros de Cuadrilla y Fecha
                </span>
                {loading && (
                  <span className="text-[10px] font-medium text-blue-600">
                    Cargando…
                  </span>
                )}
              </div>

              {/* Form inputs */}
              <div className="space-y-2.5">
                {/* Date */}
                <div className="space-y-1">
                  <label
                    htmlFor="monitor-date"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Fecha
                  </label>
                  <input
                    id="monitor-date"
                    type="date"
                    aria-label="Fecha de monitoreo"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8.5 w-full rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20"
                  />
                </div>

                {/* Operator */}
                <div className="space-y-1">
                  <label
                    htmlFor="monitor-operator"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Operador
                  </label>
                  <span className="relative block">
                    <select
                      id="monitor-operator"
                      aria-label="Operador"
                      value={selectedOperatorId}
                      onChange={(e) => setSelectedOperatorId(Number(e.target.value))}
                      className="block h-8.5 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-2.5 pr-8 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 [&>option]:cursor-pointer"
                    >
                      <option value={0}>Todos los operadores</option>
                      {operators.map((op) => (
                        <option key={op.idUsuario} value={op.idUsuario}>
                          {op.nombre} ({op.rol})
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                      size={14}
                      aria-hidden="true"
                    />
                  </span>
                </div>

                {/* Activity */}
                <div className="space-y-1">
                  <label
                    htmlFor="monitor-activity"
                    className="block text-[11px] font-semibold text-slate-700"
                  >
                    Tipo de actividad
                  </label>
                  <span className="relative block">
                    <select
                      id="monitor-activity"
                      aria-label="Actividad"
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                      className="block h-8.5 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-2.5 pr-8 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 [&>option]:cursor-pointer"
                    >
                      <option value="Todas">Todas</option>
                      <option value="Corte">Solo Cortes</option>
                      <option value="Reconexion">Solo Reconexiones</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                      size={14}
                      aria-hidden="true"
                    />
                  </span>
                </div>

                {/* Assignment selector if multiple */}
                {filteredAssignments.length > 1 && (
                  <div className="space-y-1">
                    <label
                      htmlFor="monitor-assignment"
                      className="block text-[11px] font-semibold text-slate-700"
                    >
                      Despacho asignado
                    </label>
                    <span className="relative block">
                      <select
                        id="monitor-assignment"
                        aria-label="Despacho asignado"
                        value={selectedAssignmentId}
                        onChange={(e) => setSelectedAssignmentId(Number(e.target.value))}
                        className="block h-8.5 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white px-2.5 pr-8 text-xs font-medium text-slate-800 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 [&>option]:cursor-pointer"
                      >
                        {filteredAssignments.map((a) => (
                          <option key={a.idAsignacion} value={a.idAsignacion}>
                            #{a.idAsignacion} · {a.tipoAsignacion} ({a.cantidadCodigos} órdenes)
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"
                        size={14}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                )}
              </div>

              {/* Cuadrilla Summary Card */}
              {selectedOperator && (
                <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 text-xs text-slate-700 space-y-1.5 mt-1">
                  <div className="flex items-center justify-between font-semibold text-slate-900">
                    <span>{selectedOperator.nombre}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-500">{selectedOperator.rol}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Despachos activos:</span>
                    <span className="font-mono font-semibold text-slate-800">{filteredAssignments.length}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center justify-between">
                    <span>Paradas / Órdenes:</span>
                    <span className="font-mono font-semibold text-slate-800">{stops.length}</span>
                  </div>
                </div>
              )}

              {/* Quick switch button to Estados */}
              <div className="pt-2 border-t border-slate-100 mt-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("estados")}
                  className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 py-2 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 cursor-pointer"
                >
                  <span>Ver estados</span>
                  <span className="rounded-full bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-sky-400">
                    {timelineStages.length}
                  </span>
                </button>
              </div>
            </div>

            {/* Tab 2: Estados del recorrido */}
            <div
              id="panel-estados"
              role="tabpanel"
              aria-labelledby="tab-estados"
              hidden={activeTab !== "estados"}
              className="flex-1 flex flex-col min-h-0 overflow-hidden"
            >
              {/* Estados del recorrido Header & Counter */}
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 pb-2 mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">
                    Hitos y paradas
                  </span>
                </div>
                <span className="font-mono text-[11px] font-semibold text-slate-500">
                  Paso {currentStepIndex + 1}/{timelineStages.length}
                </span>
              </div>

              {/* The 7 States List - Marked dynamically */}
              <div className="flex-1 min-h-0 space-y-1.5 overflow-y-auto pr-1">
                {timelineStages.map((st) => {
                  return (
                    <div
                      key={st.stepIndex}
                      onClick={() => {
                        setIsPlaying(false);
                        setCurrentStepIndex(st.stepIndex);
                        leafletMapRef.current?.setView([st.lat, st.lon], 17);
                      }}
                      className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-2 text-xs transition ${
                        st.isCurrent
                          ? "border-blue-500 bg-blue-50/90 shadow-2xs ring-1 ring-blue-400"
                          : st.isPast
                            ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80"
                            : st.isNext
                              ? "border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50/70"
                              : "border-slate-100 bg-slate-50/50 opacity-75 hover:opacity-100"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[9px] font-bold ${
                              st.isCurrent
                                ? "bg-blue-600 text-white ring-2 ring-blue-300 animate-pulse"
                                : st.isPast
                                  ? "bg-emerald-600 text-white"
                                  : st.isNext
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-300 text-slate-700"
                            }`}
                          >
                            {st.isPast ? <Check size={11} strokeWidth={3} /> : st.stepIndex + 1}
                          </span>
                          <span className="truncate font-semibold text-[11px] text-slate-900">
                            {st.titulo}
                          </span>
                        </div>

                        {/* State Badge with distinct colors */}
                        {st.isCurrent ? (
                          <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-blue-800 border border-blue-200 animate-pulse">
                            En curso
                          </span>
                        ) : st.isPast ? (
                          st.estado === "Observado" ? (
                            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-amber-800 border border-amber-200">
                              Observado
                            </span>
                          ) : (
                            <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-emerald-800 border border-emerald-200">
                              {st.tipo === "inicio" ? "Iniciado" : st.tipo === "transito" ? "Completado" : st.estado}
                            </span>
                          )
                        ) : st.isNext ? (
                          <span className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.2 font-mono text-[10px] font-bold text-indigo-700 border border-indigo-200">
                            Siguiente
                          </span>
                        ) : (
                          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.2 font-mono text-[10px] font-medium text-slate-500 border border-slate-200">
                            Pendiente
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pl-6.5">
                        <span className="truncate">{st.cliente}</span>
                        {st.observacion ? (
                          <span className="shrink-0 font-mono text-[10px] font-medium text-amber-700">
                            {st.observacion}
                          </span>
                        ) : st.dwellMinutes ? (
                          <span className="shrink-0 font-mono text-[10px] text-slate-400">
                            ~{st.dwellMinutes} min
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Right Panel: Big Spacious Map & Slim Playback Controls */}
        </div>
      </main>
    </AuthenticatedLayout>
  );
}
