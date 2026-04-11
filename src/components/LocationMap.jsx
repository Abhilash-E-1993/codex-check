import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  Circle,
  useMap
} from "react-leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import {
  buildSimulatedRoute,
  DEMO_MECHANIC_SPEED_KMPH,
  getPointAlongRoute,
  getRouteDistanceKm,
  getSimulationDurationMs,
} from "../utils/mechanicTrackingService";

/* ---------- MARKER SETUP ---------- */

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const mechanicIcon = L.icon({
  ...defaultIcon.options,
  className: "mechanic-marker",
});

const customerIcon = L.divIcon({
  className: "location-pin-shell",
  html: '<span class="location-pin customer-pin"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  popupAnchor: [0, -12],
});

const liveMechanicIcon = L.divIcon({
  className: "location-pin-shell",
  html: '<span class="location-pin mechanic-pin"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12],
});

/* ---------- TILE PROVIDER ---------- */

const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/* ---------- MAP AUTO FIT ---------- */

const FitBounds = ({ customerPosition, mechanicPosition, routePoints }) => {
  const map = useMap();
  const lastBoundsKeyRef = useRef("");

  useEffect(() => {

    if (!customerPosition) return;

    if (!mechanicPosition) {
      map.setView(customerPosition, 14);
      return;
    }

    const boundsKey = JSON.stringify([
      customerPosition,
      mechanicPosition,
      routePoints?.[0],
      routePoints?.[routePoints.length - 1],
    ]);

    if (lastBoundsKeyRef.current === boundsKey) {
      return;
    }

    lastBoundsKeyRef.current = boundsKey;

    const bounds = L.latLngBounds([
      customerPosition,
      mechanicPosition,
      ...(routePoints || []),
    ]);

    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 15,
    });

  }, [customerPosition, mechanicPosition, map, routePoints]);

  return null;
};

/* ---------- DISTANCE CALCULATOR ---------- */

const getDistanceKm = (lat1, lon1, lat2, lon2) => {

  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return (R * c).toFixed(2);
};

const formatEtaLabel = (distanceKm, requestStatus, trackingEnabled) => {
  if (requestStatus === "Completed") {
    return "Arrived";
  }

  if (!distanceKm) {
    return trackingEnabled ? "Calculating..." : "Not available";
  }

  const etaMinutes = Math.max(
    1,
    Math.round((Number(distanceKm) / DEMO_MECHANIC_SPEED_KMPH) * 60)
  );

  return etaMinutes <= 1 ? "Less than 1 min" : `${etaMinutes} min`;
};

/* ---------- COMPONENT ---------- */

const LocationMap = ({
  customerLocation,
  mechanicLocation,
  requestStatus,
  completionOTP,
  simulateMechanicMovement = false,
}) => {
  const customerPosition = [
    Number(customerLocation.lat),
    Number(customerLocation.lng),
  ];

  const mechanicPosition =
    mechanicLocation?.lat && mechanicLocation?.lng
      ? [Number(mechanicLocation.lat), Number(mechanicLocation.lng)]
      : null;

  const routePoints = useMemo(
    () =>
      buildSimulatedRoute(
        mechanicLocation,
        customerLocation
      ).map((point) => [point.lat, point.lng]),
    [customerLocation, mechanicLocation]
  );

  const routeObjects = useMemo(
    () => routePoints.map(([lat, lng]) => ({ lat, lng })),
    [routePoints]
  );

  const simulationDurationMs = useMemo(
    () => getSimulationDurationMs(routeObjects, requestStatus),
    [requestStatus, routeObjects]
  );

  const mechanicHasReachedCustomer =
    requestStatus === "Completed" || Boolean(completionOTP);

  const trackingEnabled =
    simulateMechanicMovement &&
    requestStatus === "Accepted" &&
    !mechanicHasReachedCustomer &&
    routeObjects.length > 1;

  const [simulationProgress, setSimulationProgress] = useState(
    trackingEnabled ? 0 : 1
  );
  const animationFrameRef = useRef(null);

  useEffect(() => {
    if (!trackingEnabled) {
      setSimulationProgress(1);
      return undefined;
    }

    setSimulationProgress(0);
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / simulationDurationMs, 1);
      setSimulationProgress(progress);

      if (progress < 1) {
        animationFrameRef.current = window.requestAnimationFrame(animate);
      }
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [simulationDurationMs, trackingEnabled]);

  const liveMechanicPoint = useMemo(() => {
    if (!routeObjects.length) {
      return mechanicPosition;
    }

    if (!trackingEnabled) {
      const lastPoint = routePoints[routePoints.length - 1] || mechanicPosition;
      return mechanicHasReachedCustomer
        ? lastPoint
        : mechanicPosition || lastPoint;
    }

    const nextPoint = getPointAlongRoute(routeObjects, simulationProgress);
    return nextPoint ? [nextPoint.lat, nextPoint.lng] : mechanicPosition;
  }, [
    mechanicPosition,
    mechanicHasReachedCustomer,
    requestStatus,
    routeObjects,
    routePoints,
    simulationProgress,
    trackingEnabled,
  ]);

  const fullRouteDistance =
    routeObjects.length > 1 ? getRouteDistanceKm(routeObjects) : 0;

  const remainingDistance =
    trackingEnabled && routeObjects.length > 1 && liveMechanicPoint
      ? getDistanceKm(
          liveMechanicPoint[0],
          liveMechanicPoint[1],
          customerPosition[0],
          customerPosition[1]
        )
      : mechanicPosition &&
        getDistanceKm(
          customerPosition[0],
          customerPosition[1],
          mechanicPosition[0],
          mechanicPosition[1]
        );

  const travelProgressLabel = trackingEnabled
    ? `${Math.round(simulationProgress * 100)}%`
    : mechanicHasReachedCustomer
      ? "Arrived"
      : "Waiting";

  const etaLabel = formatEtaLabel(
    mechanicHasReachedCustomer ? 0 : remainingDistance,
    mechanicHasReachedCustomer ? "Completed" : requestStatus,
    trackingEnabled
  );

  const startPointLabel =
    mechanicLocation?.addressLine1 && mechanicLocation?.addressLine2
      ? `${mechanicLocation.addressLine1}, ${mechanicLocation.addressLine2}`
      : mechanicLocation?.addressLine1 ||
        mechanicLocation?.addressLine2 ||
        "Mechanic base location";

  if (
    Number.isNaN(customerPosition[0]) ||
    Number.isNaN(customerPosition[1])
  ) {
    return null;
  }

  return (

    <div className="card overflow-hidden">

      {simulateMechanicMovement && (
        <div className="tracking-map-header">
          <div>
            <p className="tracking-map-title">
              Mechanic Live Tracking
            </p>
            <p className="tracking-map-subtitle">
              Demo movement begins after request acceptance and stops when the mechanic reaches you or requests OTP.
            </p>
          </div>

          <div className="tracking-header-badges">
            <span className="badge badge-warning">
              {trackingEnabled ? "On the way" : requestStatus || "Tracking"}
            </span>
            <span className="tracking-chip">
              ETA {etaLabel}
            </span>
          </div>
        </div>
      )}

      {simulateMechanicMovement && (
        <div className="tracking-stat-grid">
          <div className="tracking-stat-card">
            <span className="tracking-stat-label">Mechanic start</span>
            <strong className="tracking-stat-value">
              {startPointLabel}
            </strong>
          </div>

          <div className="tracking-stat-card">
            <span className="tracking-stat-label">Live ETA</span>
            <strong className="tracking-stat-value">
              {etaLabel}
            </strong>
          </div>

          <div className="tracking-stat-card">
              <span className="tracking-stat-label">Trip status</span>
              <strong className="tracking-stat-value">
                {completionOTP ? "Waiting for OTP confirmation" : travelProgressLabel}
              </strong>
            </div>
          </div>
      )}

      <MapContainer
        center={customerPosition}
        zoom={14}
        scrollWheelZoom={false}
        className={simulateMechanicMovement ? "h-80 w-full" : "h-64 w-full"}
      >

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url={tileUrl}
        />

        {/* CUSTOMER MARKER */}

        <Marker
          position={customerPosition}
          icon={simulateMechanicMovement ? customerIcon : defaultIcon}
        >
          <Popup>Customer Location</Popup>
          {simulateMechanicMovement && (
            <Tooltip direction="top" offset={[0, -10]} permanent>
              Customer
            </Tooltip>
          )}
        </Marker>

        {/* CUSTOMER ACCURACY */}

        {customerLocation.accuracy && (

          <Circle
            center={customerPosition}
            radius={customerLocation.accuracy}
            pathOptions={{
              color: "#F59E0B",
              fillOpacity: 0.15,
            }}
          />

        )}

        {/* MECHANIC MARKER */}

        {routePoints.length > 1 && simulateMechanicMovement && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: "#f59e0b",
              weight: 4,
              opacity: 0.85,
              dashArray: "10 10",
            }}
          />
        )}

        {routePoints.length > 1 && simulateMechanicMovement && (
          <CircleMarker
            center={routePoints[0]}
            radius={7}
            pathOptions={{
              color: "#fbbf24",
              fillColor: "#f59e0b",
              fillOpacity: 0.95,
            }}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-medium">Mechanic starting point</p>
                <p>{startPointLabel}</p>
              </div>
            </Popup>
            <Tooltip direction="top" offset={[0, -8]} permanent>
              Start
            </Tooltip>
          </CircleMarker>
        )}

        {(liveMechanicPoint || mechanicPosition) && (
          <Marker
            position={liveMechanicPoint || mechanicPosition}
            icon={simulateMechanicMovement ? liveMechanicIcon : mechanicIcon}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-medium">
                  {simulateMechanicMovement
                    ? mechanicHasReachedCustomer
                      ? "Mechanic at customer location"
                      : "Mechanic en route"
                    : "Mechanic Area Location"}
                </p>
                {mechanicLocation?.addressLine1 && (
                  <p>{mechanicLocation.addressLine1}</p>
                )}
                {mechanicLocation?.addressLine2 && (
                  <p>{mechanicLocation.addressLine2}</p>
                )}
                {simulateMechanicMovement && (
                  <p>ETA: {etaLabel}</p>
                )}
              </div>
            </Popup>
            {simulateMechanicMovement && trackingEnabled && (
              <Tooltip direction="top" offset={[0, -10]} permanent>
                Mechanic
              </Tooltip>
            )}
            {simulateMechanicMovement && mechanicHasReachedCustomer && (
              <Tooltip direction="top" offset={[0, -10]} permanent>
                Arrived
              </Tooltip>
            )}
          </Marker>
        )}

        {/* FIT BOTH MARKERS */}

        <FitBounds
          customerPosition={customerPosition}
          mechanicPosition={mechanicPosition}
          routePoints={routePoints}
        />

      </MapContainer>

      {/* INFO PANEL */}

      <div className="p-4 border-t border-[var(--border)]">

        {simulateMechanicMovement && (
          <div className="tracking-legend">
            <span className="tracking-legend-item">
              <span className="tracking-legend-dot tracking-legend-dot-start" />
              Start point
            </span>
            <span className="tracking-legend-item">
              <span className="tracking-legend-dot tracking-legend-dot-mechanic" />
              Mechanic
            </span>
            <span className="tracking-legend-item">
              <span className="tracking-legend-dot tracking-legend-dot-customer" />
              Customer
            </span>
          </div>
        )}

        <div className="flex justify-between text-sm">
          <span className="text-muted">Customer GPS accuracy</span>
          <span>
            {customerLocation.accuracy
              ? `${Math.round(customerLocation.accuracy)} m`
              : "unknown"}
          </span>
        </div>

        {remainingDistance && (

          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted">
              {simulateMechanicMovement ? "Remaining distance" : "Distance"}
            </span>
            <span>{remainingDistance} km</span>
          </div>

        )}

        {simulateMechanicMovement && Boolean(fullRouteDistance) && (
          <>
            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted">Updated ETA</span>
              <span>{etaLabel}</span>
            </div>

            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted">Route distance</span>
              <span>{fullRouteDistance.toFixed(2)} km</span>
            </div>

            <div className="flex justify-between text-sm mt-1">
              <span className="text-muted">Trip progress</span>
              <span>
                {completionOTP
                  ? "Stopped for OTP"
                  : travelProgressLabel}
              </span>
            </div>

            <div className="tracking-progress-shell mt-3">
              <div
                className="tracking-progress-bar"
                style={{
                  width: trackingEnabled
                    ? `${Math.round(simulationProgress * 100)}%`
                    : mechanicHasReachedCustomer
                      ? "100%"
                      : "0%",
                }}
              />
            </div>
          </>
        )}

      </div>

    </div>

  );

};

export default LocationMap;
