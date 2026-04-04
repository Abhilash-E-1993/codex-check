import { getApproximateAreaCoordinates } from './etaService';

export const getMechanicAreaLocation = (city, area) => {
  const coordinates = getApproximateAreaCoordinates(city, area);

  if (!coordinates) {
    return null;
  }

  // The displayed address should describe the same approximate point we plot on the map.
  return {
    addressLine1: `${area} Area Center`,
    addressLine2: `${city}`,
    lat: coordinates.lat,
    lng: coordinates.lng,
  };
};
