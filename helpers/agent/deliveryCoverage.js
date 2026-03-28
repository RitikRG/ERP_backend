const toFiniteNumber = (value) => {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeText = (value) => String(value || "").trim();

export const normalizeIncomingLocation = (payload = {}) => {
  const latitude = toFiniteNumber(payload.Latitude);
  const longitude = toFiniteNumber(payload.Longitude);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    latitude,
    longitude,
    address: normalizeText(payload.Address),
    label: normalizeText(payload.Label),
  };
};

export const resolveDeliveryAddressFromLocation = (location = {}) =>
  normalizeText(location.address) || normalizeText(location.label) || "";

export const hasDeliveryZoneConfig = (organisation, sop) => {
  if (!sop?.delivery?.enabled) {
    return false;
  }

  const latitude = toFiniteNumber(organisation?.shopLocation?.latitude);
  const longitude = toFiniteNumber(organisation?.shopLocation?.longitude);
  const radiusKm = toFiniteNumber(sop?.delivery?.radiusKm);

  return latitude !== null && longitude !== null && radiusKm !== null && radiusKm >= 0;
};

export const calculateDistanceKm = (origin, destination) => {
  const originLat = toFiniteNumber(origin?.latitude);
  const originLng = toFiniteNumber(origin?.longitude);
  const destinationLat = toFiniteNumber(destination?.latitude);
  const destinationLng = toFiniteNumber(destination?.longitude);

  if (
    originLat === null ||
    originLng === null ||
    destinationLat === null ||
    destinationLng === null
  ) {
    return null;
  }

  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(destinationLat - originLat);
  const deltaLng = toRadians(destinationLng - originLng);
  const lat1 = toRadians(originLat);
  const lat2 = toRadians(destinationLat);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

export const evaluateDeliveryCoverage = ({ organisation, sop, customerLocation }) => {
  if (!hasDeliveryZoneConfig(organisation, sop)) {
    return {
      canValidate: false,
      withinRadius: null,
      distanceKm: null,
      radiusKm: toFiniteNumber(sop?.delivery?.radiusKm),
    };
  }

  const distanceKm = calculateDistanceKm(organisation.shopLocation, customerLocation);
  const radiusKm = toFiniteNumber(sop?.delivery?.radiusKm);

  if (distanceKm === null || radiusKm === null) {
    return {
      canValidate: false,
      withinRadius: null,
      distanceKm: null,
      radiusKm,
    };
  }

  return {
    canValidate: true,
    withinRadius: distanceKm <= radiusKm,
    distanceKm,
    radiusKm,
  };
};
