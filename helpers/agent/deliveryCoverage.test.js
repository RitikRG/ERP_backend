import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDistanceKm,
  evaluateDeliveryCoverage,
  hasDeliveryZoneConfig,
  normalizeIncomingLocation,
  resolveDeliveryAddressFromLocation,
} from "./deliveryCoverage.js";

test("normalizeIncomingLocation parses Twilio location payload", () => {
  const location = normalizeIncomingLocation({
    Latitude: "12.9716",
    Longitude: "77.5946",
    Address: "MG Road, Bengaluru",
    Label: "Work",
  });

  assert.deepEqual(location, {
    latitude: 12.9716,
    longitude: 77.5946,
    address: "MG Road, Bengaluru",
    label: "Work",
  });
});

test("resolveDeliveryAddressFromLocation prefers address over label", () => {
  assert.equal(
    resolveDeliveryAddressFromLocation({
      address: "Koramangala, Bengaluru",
      label: "Home",
    }),
    "Koramangala, Bengaluru"
  );
  assert.equal(
    resolveDeliveryAddressFromLocation({
      address: "",
      label: "Home",
    }),
    "Home"
  );
});

test("hasDeliveryZoneConfig requires shop coordinates and delivery radius", () => {
  assert.equal(
    hasDeliveryZoneConfig(
      {
        shopLocation: {
          latitude: 12.9716,
          longitude: 77.5946,
        },
      },
      {
        delivery: {
          enabled: true,
          radiusKm: 5,
        },
      }
    ),
    true
  );

  assert.equal(
    hasDeliveryZoneConfig(
      {
        shopLocation: {
          latitude: null,
          longitude: 77.5946,
        },
      },
      {
        delivery: {
          enabled: true,
          radiusKm: 5,
        },
      }
    ),
    false
  );
});

test("evaluateDeliveryCoverage passes for locations inside radius", () => {
  const result = evaluateDeliveryCoverage({
    organisation: {
      shopLocation: {
        latitude: 12.9716,
        longitude: 77.5946,
      },
    },
    sop: {
      delivery: {
        enabled: true,
        radiusKm: 5,
      },
    },
    customerLocation: {
      latitude: 12.9735,
      longitude: 77.5995,
    },
  });

  assert.equal(result.canValidate, true);
  assert.equal(result.withinRadius, true);
  assert.ok(result.distanceKm < 5);
});

test("evaluateDeliveryCoverage fails for locations outside radius", () => {
  const result = evaluateDeliveryCoverage({
    organisation: {
      shopLocation: {
        latitude: 12.9716,
        longitude: 77.5946,
      },
    },
    sop: {
      delivery: {
        enabled: true,
        radiusKm: 1,
      },
    },
    customerLocation: {
      latitude: 13.0358,
      longitude: 77.597,
    },
  });

  assert.equal(result.canValidate, true);
  assert.equal(result.withinRadius, false);
  assert.ok(result.distanceKm > 1);
});

test("calculateDistanceKm returns null for invalid coordinates", () => {
  assert.equal(
    calculateDistanceKm(
      { latitude: 12.9716, longitude: null },
      { latitude: 12.9735, longitude: 77.5995 }
    ),
    null
  );
});
