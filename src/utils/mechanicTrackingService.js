import { calculateDistanceKm } from "./etaService";

export const DEMO_MECHANIC_SPEED_KMPH = 26;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const lerp = (start, end, progress) => start + (end - start) * progress;

const interpolatePoint = (from, to, progress) => ({
  lat: lerp(from.lat, to.lat, progress),
  lng: lerp(from.lng, to.lng, progress),
});

const getPerpendicularOffset = (from, to, amount) => {
  const deltaLat = to.lat - from.lat;
  const deltaLng = to.lng - from.lng;
  const magnitude = Math.hypot(deltaLat, deltaLng) || 1;

  return {
    lat: (-deltaLng / magnitude) * amount,
    lng: (deltaLat / magnitude) * amount,
  };
};

const createControlPoint = (from, to) => {
  const midpoint = interpolatePoint(from, to, 0.5);
  const distanceKm = calculateDistanceKm(from, to) || 0;
  const offsetStrength = clamp(distanceKm * 0.008, 0.0012, 0.01);
  const offset = getPerpendicularOffset(from, to, offsetStrength);

  return {
    lat: midpoint.lat + offset.lat,
    lng: midpoint.lng + offset.lng,
  };
};

const getQuadraticBezierPoint = (from, control, to, progress) => {
  const firstLeg = interpolatePoint(from, control, progress);
  const secondLeg = interpolatePoint(control, to, progress);

  return interpolatePoint(firstLeg, secondLeg, progress);
};

export const buildSimulatedRoute = (startLocation, endLocation) => {
  if (
    startLocation?.lat == null ||
    startLocation?.lng == null ||
    endLocation?.lat == null ||
    endLocation?.lng == null
  ) {
    return [];
  }

  const start = {
    lat: Number(startLocation.lat),
    lng: Number(startLocation.lng),
  };
  const end = {
    lat: Number(endLocation.lat),
    lng: Number(endLocation.lng),
  };

  const distanceKm = calculateDistanceKm(start, end) || 0;
  const segmentCount = clamp(Math.round(distanceKm * 28), 24, 140);
  const controlPoint = createControlPoint(start, end);
  const route = [];

  for (let index = 0; index <= segmentCount; index += 1) {
    const progress = index / segmentCount;
    route.push(getQuadraticBezierPoint(start, controlPoint, end, progress));
  }

  return route;
};

export const getRouteDistanceKm = (routePoints = []) => {
  if (routePoints.length < 2) {
    return 0;
  }

  let totalDistance = 0;

  for (let index = 1; index < routePoints.length; index += 1) {
    totalDistance += calculateDistanceKm(
      routePoints[index - 1],
      routePoints[index]
    ) || 0;
  }

  return totalDistance;
};

export const getPointAlongRoute = (routePoints = [], progress = 0) => {
  if (!routePoints.length) {
    return null;
  }

  if (routePoints.length === 1) {
    return routePoints[0];
  }

  const safeProgress = clamp(progress, 0, 1);
  const scaledIndex = safeProgress * (routePoints.length - 1);
  const lowerIndex = Math.floor(scaledIndex);
  const upperIndex = Math.min(routePoints.length - 1, lowerIndex + 1);
  const segmentProgress = scaledIndex - lowerIndex;

  return interpolatePoint(
    routePoints[lowerIndex],
    routePoints[upperIndex],
    segmentProgress
  );
};

export const getSimulationDurationMs = (routePoints = [], status) => {
  if (status === "Completed") {
    return 0;
  }

  const routeDistanceKm = getRouteDistanceKm(routePoints);

  if (!routeDistanceKm) {
    return 45000;
  }

  const durationMs = (routeDistanceKm / DEMO_MECHANIC_SPEED_KMPH) * 60 * 60 * 1000;

  return clamp(Math.round(durationMs), 45000, 240000);
};
