import { useEffect } from "react";
import L from "leaflet";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  Circle,
  useMap
} from "react-leaflet";

import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

/* ---------- MARKER SETUP ---------- */

const defaultIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const mechanicIcon = L.icon({
  ...defaultIcon.options,
  className: "mechanic-marker",
});

/* ---------- TILE PROVIDER ---------- */

const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

/* ---------- MAP AUTO FIT ---------- */

const FitBounds = ({ customerPosition, mechanicPosition }) => {
  const map = useMap();

  useEffect(() => {

    if (!customerPosition) return;

    if (!mechanicPosition) {
      map.setView(customerPosition, 14);
      return;
    }

    const bounds = L.latLngBounds([
      customerPosition,
      mechanicPosition,
    ]);

    map.fitBounds(bounds, {
      padding: [60, 60],
      maxZoom: 15,
    });

  }, [customerPosition, mechanicPosition, map]);

  return null;
};

/* ---------- DISTANCE CALCULATOR ---------- */

const getDistanceKm = (lat1, lon1, lat2, lon2) => {

  const R = 6371;

  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return (R * c).toFixed(2);
};

/* ---------- COMPONENT ---------- */

const LocationMap = ({ customerLocation, mechanicLocation }) => {

  if (!customerLocation?.lat || !customerLocation?.lng) return null;

  const customerPosition = [
    Number(customerLocation.lat),
    Number(customerLocation.lng),
  ];

  const mechanicPosition =
    mechanicLocation?.lat && mechanicLocation?.lng
      ? [Number(mechanicLocation.lat), Number(mechanicLocation.lng)]
      : null;

  const distance =
    mechanicPosition &&
    getDistanceKm(
      customerPosition[0],
      customerPosition[1],
      mechanicPosition[0],
      mechanicPosition[1]
    );

  return (

    <div className="card overflow-hidden">

      <MapContainer
        center={customerPosition}
        zoom={14}
        scrollWheelZoom={false}
        className="h-64 w-full"
      >

        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url={tileUrl}
        />

        {/* CUSTOMER MARKER */}

        <Marker
          position={customerPosition}
          icon={defaultIcon}
        >
          <Popup>Customer Location</Popup>
        </Marker>

        {/* CUSTOMER ACCURACY */}

        {customerLocation.accuracy && (

          <Circle
            center={customerPosition}
            radius={customerLocation.accuracy}
            pathOptions={{
              color: "#F59E0B",
              fillOpacity: 0.15,
            }}
          />

        )}

        {/* MECHANIC MARKER */}

        {mechanicPosition && (

          <Marker
            position={mechanicPosition}
            icon={mechanicIcon}
          >
            <Popup>
              <div className="space-y-1">
                <p className="font-medium">Mechanic Area Location</p>
                {mechanicLocation?.addressLine1 && (
                  <p>{mechanicLocation.addressLine1}</p>
                )}
                {mechanicLocation?.addressLine2 && (
                  <p>{mechanicLocation.addressLine2}</p>
                )}
              </div>
            </Popup>
          </Marker>

        )}

        {/* FIT BOTH MARKERS */}

        <FitBounds
          customerPosition={customerPosition}
          mechanicPosition={mechanicPosition}
        />

      </MapContainer>

      {/* INFO PANEL */}

      <div className="p-4 border-t border-[var(--border)]">

        <div className="flex justify-between text-sm">
          <span className="text-muted">Customer GPS accuracy</span>
          <span>
            {customerLocation.accuracy
              ? `${Math.round(customerLocation.accuracy)} m`
              : "unknown"}
          </span>
        </div>

        {distance && (

          <div className="flex justify-between text-sm mt-1">
            <span className="text-muted">Distance</span>
            <span>{distance} km</span>
          </div>

        )}

      </div>

    </div>

  );

};

export default LocationMap;