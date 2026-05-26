// ======================================================
// RADAR FRONTEND — Cockpit IFR EBLG PRO+++
// - Avions orientés selon heading
// - Couleur selon altitude
// - Mise à jour fluide
// ====================================================

// Centre EBLG
import { EBLG } from "./constants.js";
const RADIUS_KM = 150;

// Cache simple pour éviter de surcharger l'API
let lastRadarData = null;
let lastRadarTs = 0;
const RADAR_CACHE_MS = 2000; // 2 secondes

// ------------------------------------------------------
// Distance Haversine (km)
// ------------------------------------------------------
function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = d => d * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ------------------------------------------------------
// Filtrage et normalisation des données OpenSky
// ------------------------------------------------------
function normalizeAndFilterStates(states) {
    if (!Array.isArray(states)) return [];

    return states
        .map(s => ({
            icao24: s[0],
            callsign: (s[1] || "").trim(),
            originCountry: s[2],
            lon: s[5],
            lat: s[6],
            baroAltitude: s[7],
            onGround: s[8],
            velocity: s[9],      // m/s
            heading: s[10],      // deg
            verticalRate: s[11], // m/s
            squawk: s[14],
            spi: s[15],
            lastContact: s[4]
        }))
        .filter(f =>
            typeof f.lat === "number" &&
            typeof f.lon === "number" &&
            !Number.isNaN(f.lat) &&
            !Number.isNaN(f.lon)
        )
        .filter(f => {
            const d = haversineKm(f.lat, f.lon, EBLG.lat, EBLG.lon);
            return d <= RADIUS_KM;
        });
}

// ------------------------------------------------------
// Fetch OpenSky + cache
// ------------------------------------------------------
async function fetchRadarRaw() {
    const now = Date.now();
    if (lastRadarData && now - lastRadarTs < RADAR_CACHE_MS) {
        return lastRadarData;
    }

    const url = "https://opensky-network.org/api/states/all";

    const r = await fetch(url);
    if (!r.ok) {
        throw new Error(`OpenSky error ${r.status}`);
    }

    const json = await r.json();
    const flights = normalizeAndFilterStates(json.states || []);

    lastRadarData = flights;
    lastRadarTs = now;

    return flights;
}

// ------------------------------------------------------
// API publique pour server.mjs
// ------------------------------------------------------
export async function getRadarFlights() {
    try {
        const flights = await fetchRadarRaw();
        return { flights };
    } catch (err) {
        console.error("[RADAR] getRadarFlights error", err);
        return { flights: [], error: true };
    }
}

let radarLayer = null;
const radarMarkers = new Map(); // icao24 -> marker

// ------------------------------------------------------
// Couleur selon altitude (ft)
// ------------------------------------------------------
function getAltitudeColor(alt) {
    if (!alt || alt < 500) return "#ff4444";      // rouge = très bas
    if (alt < 3000) return "#ffaa00";             // orange = approche
    if (alt < 10000) return "#00ccff";            // cyan = moyenne altitude
    return "#00ff99";                             // vert = haut
}

// ------------------------------------------------------
// Icône avion orientée
// ------------------------------------------------------
function makePlaneIcon(heading, alt) {
    const color = getAltitudeColor(alt);

    return L.divIcon({
        className: "radar-plane",
        html: `
            <div class="plane-icon" 
                 style="transform: rotate(${heading}deg); color:${color}">
                ✈
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });
}

// ------------------------------------------------------
// Mise à jour des avions
// ------------------------------------------------------
export function renderRadar(flights) {
    if (!window._map) return;

    if (!radarLayer) {
        radarLayer = L.layerGroup().addTo(window._map);
    }

    const seen = new Set();

    flights.forEach(f => {
        seen.add(f.icao24);

        let marker = radarMarkers.get(f.icao24);

        if (!marker) {
            marker = L.marker([f.lat, f.lon], {
                icon: makePlaneIcon(f.heading, f.baroAltitude)
            });
            marker.addTo(radarLayer);
            radarMarkers.set(f.icao24, marker);
        } else {
            marker.setLatLng([f.lat, f.lon]);
            marker.setIcon(makePlaneIcon(f.heading, f.baroAltitude));
        }

        marker.bindTooltip(`
            <b>${f.callsign || f.icao24}</b><br>
            Alt : ${Math.round(f.baroAltitude || 0)} ft<br>
            Vitesse : ${Math.round((f.velocity || 0) * 3.6)} km/h
        `, { direction: "top" });
    });

    // Suppression des avions disparus
    radarMarkers.forEach((marker, icao24) => {
        if (!seen.has(icao24)) {
            radarLayer.removeLayer(marker);
            radarMarkers.delete(icao24);
        }
    });
}

// ------------------------------------------------------
// Polling radar (toutes les 2 secondes)
// ------------------------------------------------------
export async function loadRadar() {
    try {
        const r = await fetch("/radar");
        const json = await r.json();
        renderRadar(json.flights || []);
    } catch (e) {
        console.error("[RADAR] erreur", e);
    }
}
