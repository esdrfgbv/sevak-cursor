export function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Current-location access is not available in this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
      },
      () => reject(new Error("Location permission was denied or unavailable.")),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
    );
  });
}

export function watchCurrentPosition(onSuccess, onError) {
  if (!navigator.geolocation) {
    onError?.(new Error("Current-location access is not available in this browser."));
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      onSuccess({
        lat: Number(position.coords.latitude.toFixed(6)),
        lng: Number(position.coords.longitude.toFixed(6)),
      });
    },
    () => onError?.(new Error("Location permission was denied or unavailable.")),
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 8000 },
  );

  return () => navigator.geolocation.clearWatch(watchId);
}

export function buildGoogleMapsDirectionsUrl(origin, destination) {
  const originParam = origin ? `${origin.lat},${origin.lng}` : "";
  const destinationParam = `${destination.lat},${destination.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destinationParam)}&travelmode=driving`;
}
