const FALLBACK_LOCATION = {
  lat: 12.9716,
  lng: 77.5946,
  accuracy: null,
  isFallback: true,
};

const GEOLOCATION_ERRORS = {
  1: 'Location permission denied. Using demo coordinates.',
  2: 'Unable to determine your location. Using demo coordinates.',
  3: 'Location request timed out. Using demo coordinates.',
};

const TARGET_ACCURACY_METERS = 80;
const HIGH_ACCURACY_TIMEOUT_MS = 4000;
const CACHED_LOCATION_MAX_AGE_MS = 1000 * 60 * 5;

const getSingleLocationAttempt = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          isFallback: false,
        });
      },
      reject,
      options,
    );
  });

export const getCurrentLocation = async () => {
  if (!navigator.geolocation) {
    console.warn('GPS unsupported. Using fallback coordinates.');
    return FALLBACK_LOCATION;
  }

  try {
    const cachedLocation = await getSingleLocationAttempt({
      enableHighAccuracy: false,
      timeout: 2500,
      maximumAge: CACHED_LOCATION_MAX_AGE_MS,
    });

    if (
      (cachedLocation.accuracy ?? Number.POSITIVE_INFINITY) <=
      TARGET_ACCURACY_METERS
    ) {
      return cachedLocation;
    }

    try {
      const highAccuracyLocation = await getSingleLocationAttempt({
        enableHighAccuracy: true,
        timeout: HIGH_ACCURACY_TIMEOUT_MS,
        maximumAge: 0,
      });

      return highAccuracyLocation;
    } catch {
      return cachedLocation;
    }
  } catch (cachedError) {
    try {
      return await getSingleLocationAttempt({
        enableHighAccuracy: true,
        timeout: HIGH_ACCURACY_TIMEOUT_MS,
        maximumAge: 0,
      });
    } catch (highAccuracyError) {
      const finalError = highAccuracyError || cachedError;
      console.warn(
        GEOLOCATION_ERRORS[finalError?.code] ||
          'Geolocation failed. Using demo coordinates.'
      );
      return FALLBACK_LOCATION;
    }
  }
};

export { FALLBACK_LOCATION };
