import { normalizeAreaName } from "../constants/appConstants";

const AVERAGE_SPEED_KMPH = 30;

const toRadians = (value) => (value * Math.PI) / 180;
const hashSeed = (value = "") =>
  `${value}`
    .split("")
    .reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);

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

const CITY_CENTER_COORDINATES = {
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Delhi: { lat: 28.6139, lng: 77.2090 },
  Gurgaon: { lat: 28.4595, lng: 77.0266 },
  Hyderabad: { lat: 17.3850, lng: 78.4867 },
  Jaipur: { lat: 26.9124, lng: 75.7873 },
  Kochi: { lat: 9.9312, lng: 76.2673 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Mumbai: { lat: 19.0760, lng: 72.8777 },
  Noida: { lat: 28.5355, lng: 77.3910 },
  Pune: { lat: 18.5204, lng: 73.8567 },
};

const createDemoAreaCoordinate = (city, area) => {
  const cityCenter = CITY_CENTER_COORDINATES[city];

  if (!cityCenter) {
    return null;
  }

  const seed = hashSeed(`${city}-${area}`);
  const cityRadiusSteps = 0.06;
  const latOffset = (((seed % 900) / 900) - 0.5) * cityRadiusSteps;
  const lngOffsetBase =
    ((((Math.floor(seed / 13) % 900) / 900) - 0.5) * cityRadiusSteps);
  const longitudeScale = Math.max(
    Math.cos((cityCenter.lat * Math.PI) / 180),
    0.35
  );

  return {
    lat: Number((cityCenter.lat + latOffset).toFixed(6)),
    lng: Number((cityCenter.lng + lngOffsetBase / longitudeScale).toFixed(6)),
  };
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

  return createDemoAreaCoordinate(city, normalizedArea);
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
