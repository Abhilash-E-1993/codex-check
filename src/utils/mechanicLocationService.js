import { getApproximateAreaCoordinates } from "./etaService";

const hashSeed = (value = "") =>
  `${value}`
    .split("")
    .reduce((total, char, index) => total + char.charCodeAt(0) * (index + 1), 0);

const createDeterministicOffset = (seed, baseLatitude) => {
  const hashed = hashSeed(seed);
  const latOffset = ((hashed % 200) - 100) / 10000;
  const lngOffsetBase = ((Math.floor(hashed / 7) % 200) - 100) / 10000;
  const longitudeScale = Math.max(Math.cos((baseLatitude * Math.PI) / 180), 0.35);

  return {
    latOffset,
    lngOffset: lngOffsetBase / longitudeScale,
  };
};

export const getMechanicBaseLocation = (city, area, mechanicSeed = "") => {
  const coordinates = getApproximateAreaCoordinates(city, area);

  if (!coordinates) {
    return null;
  }

  const { latOffset, lngOffset } = createDeterministicOffset(
    `${city}-${area}-${mechanicSeed}`,
    coordinates.lat
  );

  return {
    addressLine1: `${area} Service Point`,
    addressLine2: `${city}`,
    lat: Number((coordinates.lat + latOffset).toFixed(6)),
    lng: Number((coordinates.lng + lngOffset).toFixed(6)),
  };
};

export const getMechanicAreaLocation = (city, area) =>
  getMechanicBaseLocation(city, area, "area-center");
