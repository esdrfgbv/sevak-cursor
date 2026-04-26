export interface Coordinates {
  lat: number;
  lng: number;
}

export function getBrowserLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by this browser"));
      return;
    }

    if (!window.isSecureContext) {
      reject(new Error("Current location requires HTTPS or localhost"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Location permission was denied. Allow location access in the browser and try again."
            : error.code === error.POSITION_UNAVAILABLE
              ? "Current location is unavailable. Check device location settings and try again."
              : error.code === error.TIMEOUT
                ? "Fetching current location timed out. Try again."
                : "Unable to fetch current location.";
        reject(new Error(message));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
      }
    );
  });
}
