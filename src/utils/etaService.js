import { normalizeAreaName } from "../constants/appConstants";

const AVERAGE_SPEED_KMPH = 30;

const toRadians = (value) => (value * Math.PI) / 180;

/* ---------- REAL AREA COORDINATES ---------- */

const AREA_COORDINATES = {
  Bengaluru: {
    Hebbal: { lat: 13.0358, lng: 77.5970 },
    Yelahanka: { lat: 13.1007, lng: 77.5963 },
    Whitefield: { lat: 12.9698, lng: 77.7500 },
    Indiranagar: { lat: 12.9784, lng: 77.6408 },
    Koramangala: { lat: 12.9279, lng: 77.6271 },
    Jayanagar: { lat: 12.9250, lng: 77.5938 },
    Rajajinagar: { lat: 12.9915, lng: 77.5545 },
    Malleshwaram: { lat: 13.0031, lng: 77.5713 },
   "Electronic City": { lat: 12.8399, lng: 77.6770 },
    Marathahalli: { lat: 12.9591, lng: 77.6974 },
  },
};

/* ---------- DISTANCE ---------- */

export const calculateDistanceKm = (fromLocation, toLocation) => {
  if (!fromLocation?.lat || !fromLocation?.lng || !toLocation?.lat || !toLocation?.lng) {
    return null;
  }

  const earthRadiusKm = 6371;

  const deltaLat = toRadians(toLocation.lat - fromLocation.lat);
  const deltaLng = toRadians(toLocation.lng - fromLocation.lng);

  const fromLat = toRadians(fromLocation.lat);
  const toLat = toRadians(toLocation.lat);

  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
};

/* ---------- GET AREA COORDINATES ---------- */

export const getApproximateAreaCoordinates = (city, area) => {
  const normalizedArea = normalizeAreaName(city, area);

  if (AREA_COORDINATES?.[city]?.[normalizedArea]) {
    return AREA_COORDINATES[city][normalizedArea];
  }

  /* fallback to city center if unknown */

  const fallbackCityCenters = {
    Bengaluru: { lat: 12.9716, lng: 77.5946 },
  };

  return fallbackCityCenters[city] || null;
};

/* ---------- ETA USING AREA ---------- */

export const estimateEtaMinutes = (customerLocation, mechanicCity, mechanicArea) => {

  const mechanicLocation = getApproximateAreaCoordinates(mechanicCity, mechanicArea);

  const distanceKm = calculateDistanceKm(customerLocation, mechanicLocation);

  if (!distanceKm) return null;

  return Math.max(5, Math.round((distanceKm / AVERAGE_SPEED_KMPH) * 60));
};

/* ---------- ETA USING EXACT LOCATION ---------- */

export const estimateEtaMinutesFromLocation = (customerLocation, mechanicLocation) => {

  const distanceKm = calculateDistanceKm(customerLocation, mechanicLocation);

  if (!distanceKm) return null;

  return Math.max(5, Math.round((distanceKm / AVERAGE_SPEED_KMPH) * 60));
};
