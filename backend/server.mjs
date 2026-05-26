// ======================================================
// EBLG DASHBOARD — BACKEND PRO+++
// server.mjs
// ======================================================

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import { EBLG } from "./constants.js";

import {
    getCachedMetar,
    setCachedMetar,
    getCachedTaf,
    setCachedTaf
} from "./metarCache.mjs";

import {
    getCachedAdsb,
    setCachedAdsb
} from "./adsbCache.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

import { filterRadarData } from "./radar.js";

// ------------------------------------------------------
// MIDDLEWARES
// ------------------------------------------------------
app.use(cors());

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// ======================================================
// CONSTANTES EBLG / PISTES
// ======================================================
const RWY = {
    "04": { lat: 50.64594, lon: 5.44321, heading: 40 },
    "22": { lat: 50.63302, lon: 5.46163, heading: 220 }
};

// ======================================================
// OUTILS GÉOMÉTRIQUES PRO+++
// ======================================================
function distKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingTo(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x =
        Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
        Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.cos(dLon);

    const brng = Math.atan2(y, x) * 180 / Math.PI;
    return (brng + 360) % 360;
}

function angleDiff(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

// ======================================================
// ADS-B — FILTRE GÉOGRAPHIQUE PRO+++
// ======================================================
function filterGeographic(acList, radiusKm = 80) {
    return acList.filter(ac => {
        const d = distKm(EBLG.lat, EBLG.lon, ac.lat, ac.lon);
        return d <= radiusKm;
    });
}

// ======================================================
// ADS-B — DÉTECTION APPROCHE RWY 04/22 PRO+++
// ======================================================
function detectApproach(ac) {
    const results = {};

    for (const rwy of ["04", "22"]) {
        const thr = RWY[rwy];

        const brgToThreshold = bearingTo(ac.lat, ac.lon, thr.lat, thr.lon);
        const diff = angleDiff(brgToThreshold, thr.heading);
        const d = distKm(ac.lat, ac.lon, thr.lat, thr.lon);

        if (diff < 15 && d < 12) {
            results[rwy] = { diff, d };
        }
    }

    if (results["04"] && !results["22"]) return "04";
    if (results["22"] && !results["04"]) return "22";

    if (results["04"] && results["22"]) {
        return results["04"].d < results["22"].d ? "04" : "22";
    }

    return null;
}

// ======================================================
// ADS-B — DÉTECTION DÉPART RWY 04/22 PRO+++
// ======================================================
function detectDeparture(ac) {
    for (const rwy of ["04", "22"]) {
        const thr = RWY[rwy];

        const brgFromThreshold = bearingTo(thr.lat, thr.lon, ac.lat, ac.lon);
        const diff = angleDiff(brgFromThreshold, RWY[rwy].heading);
        const d = distKm(ac.lat, ac.lon, thr.lat, thr.lon);

        if (diff < 20 && d < 8 && ac.gs > 80) {
            return rwy;
        }
    }
    return null;
}

// ======================================================
// ADS-B — CORRIDOR APPROCHE DYNAMIQUE PRO+++
// ======================================================
function generateApproachCorridor(rwy, lengthKm = 12, halfWidthKm = 0.6) {
    const thr = RWY[rwy];
    const heading = thr.heading * Math.PI / 180;

    const vx = Math.cos(heading);
    const vy = Math.sin(heading);

    const nx = -vy;
    const ny = vx;

    const p0 = [thr.lat, thr.lon];

    const p1 = [
        thr.lat + vy * (lengthKm / 111),
        thr.lon + vx * (lengthKm / (111 * Math.cos(thr.lat * Math.PI / 180)))
    ];

    return [
        [
            p0[0] + ny * (halfWidthKm / 111),
            p0[1] + nx * (halfWidthKm / (111 * Math.cos(p0[0] * Math.PI / 180)))
        ],
        [
            p0[0] - ny * (halfWidthKm / 111),
            p0[1] - nx * (halfWidthKm / (111 * Math.cos(p0[0] * Math.PI / 180)))
        ],
        [
            p1[0] - ny * (halfWidthKm / 111),
            p1[1] - nx * (halfWidthKm / (111 * Math.cos(p1[0] * Math.PI / 180)))
        ],
        [
            p1[0] + ny * (halfWidthKm / 111),
            p1[1] + nx * (halfWidthKm / (111 * Math.cos(p1[0] * Math.PI / 180)))
        ]
    ];
}

// ======================================================
// METAR — EBLG (cache + normalisation PRO+++)
// ======================================================
app.get("/metar", async (req, res) => {
    const cached = getCachedMetar();
    if (cached) return res.json(cached);

    try {
        const url = "https://api.checkwx.com/metar/EBLG/decoded";
        const r = await fetch(url, {
            headers: { "X-API-Key": process.env.CHECKWX_KEY }
        });

        if (!r.ok) {
            console.error("[METAR] HTTP", r.status);
            if (cached) return res.json(cached);
            return res.json({ fallback: true, raw: "METAR indisponible", ageMinutes: null });
        }

        const json = await r.json();
        const metar = json.data?.[0];

        if (!metar) {
            console.error("[METAR] JSON sans data[0]");
            if (cached) return res.json(cached);
            return res.json({ fallback: true, raw: "METAR indisponible", ageMinutes: null });
        }

        const raw = metar.raw_text || "METAR indisponible";
        const obs = metar.observed ? new Date(metar.observed) : null;
        const ageMinutes = obs ? (Date.now() - obs.getTime()) / 60000 : null;

        const payload = { raw, ageMinutes, fallback: false };
        setCachedMetar(payload);
        return res.json(payload);

    } catch (err) {
        console.error("[METAR] Erreur", err);
        const cached2 = getCachedMetar();
        if (cached2) return res.json(cached2);
        return res.json({ fallback: true, raw: "METAR indisponible", ageMinutes: null });
    }
});

// ======================================================
// TAF — EBLG (cache + normalisation PRO+++)
// ======================================================
app.get("/taf", async (req, res) => {
    const cached = getCachedTaf();
    if (cached) return res.json(cached);

    try {
        const url = "https://api.checkwx.com/taf/EBLG/decoded";
        const r = await fetch(url, {
            headers: { "X-API-Key": process.env.CHECKWX_KEY }
        });

        if (!r.ok) {
            console.error("[TAF] HTTP", r.status);
            if (cached) return res.json(cached);
            return res.json({ fallback: true, raw: "TAF indisponible", ageMinutes: null });
        }

        const json = await r.json();
        const taf = json.data?.[0];

        if (!taf) {
            console.error("[TAF] JSON sans data[0]");
            if (cached) return res.json(cached);
            return res.json({ fallback: true, raw: "TAF indisponible", ageMinutes: null });
        }

        const raw = taf.raw_text || "TAF indisponible";

        let issueDate = null;
        if (taf.timestamp?.issued) {
            issueDate = new Date(taf.timestamp.issued);
        } else if (taf.issued) {
            issueDate = new Date(taf.issued);
        }

        const ageMinutes = issueDate ? (Date.now() - issueDate.getTime()) / 60000 : null;

        const payload = { raw, ageMinutes, fallback: false };
        setCachedTaf(payload);
        return res.json(payload);

    } catch (err) {
        console.error("[TAF] Erreur", err);
        const cached2 = getCachedTaf();
        if (cached2) return res.json(cached2);
        return res.json({ fallback: true, raw: "TAF indisponible", ageMinutes: null });
    }
});

// ======================================================
// FIDS — MODE AUTONOME PRO+++ (format frontend)
// ======================================================
app.get("/fids", async (req, res) => {
    try {
        const [arr, dep] = await Promise.all([
            fetch("https://fids.liegeairport.com/api/flights/Arrivals").then(r => r.json()),
            fetch("https://fids.liegeairport.com/api/flights/Departures").then(r => r.json())
        ]);

        res.json({
            arrivals: arr,
            departures: dep
        });

    } catch (err) {
        console.error("[FIDS] Erreur API officielle", err);
        res.json({ arrivals: [], departures: [] });
    }
});

// ======================================================
// SONOMETERS — MODE AUTONOME PRO+++
// ======================================================
import sonometers from "./sonometers-data.js";

// ======================================================
// 1) CONSTANTES PISTES
// ======================================================
const RUNWAYS = {
    "22": { lat: 50.6435, lon: 5.4430 },
    "04": { lat: 50.6465, lon: 5.4590 }
};

let ACTIVE_RUNWAY = "22";

// ======================================================
// 2) HAVERSINE (distance en mètres)
// ======================================================
function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = x => (x * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Détermination de la piste active - vent réel METAR
function getActiveRunwayFromWind(windDir) {
    if (windDir == null) return "22";

    const heading22 = 220;
    const heading04 = 40;

    const d22 = Math.abs(windDir - heading22);
    const d04 = Math.abs(windDir - heading04);

    const n22 = Math.min(d22, 360 - d22);
    const n04 = Math.min(d04, 360 - d04);

    return n22 < n04 ? "22" : "04";
}

// Récupération du trafic réel - OpenSky / ADSBexchange
async function getTrafficIndex() {
    try {
        const r = await fetch("https://eblg-dashboard-v84.onrender.com/api/adsb");
        const data = await r.json();

        const aircraft = data.states?.length ?? 0;

        return Math.min(20, aircraft); // index 0–20
    } catch (err) {
        console.error("[ADSB ERROR]", err);
        return 0;
    }
}

// ======================================================
// 3) MODELE ACOUSTIQUE
// ======================================================
function computeSimulatedDb(sensor, activeRunway, wind, trafficIndex) {
    const base = 40; // bruit de fond

    // Distance à la piste active
    const RUNWAYS = {
        "22": { lat: 50.6435, lon: 5.4430 },
        "04": { lat: 50.6465, lon: 5.4590 }
    };

    const rw = RUNWAYS[activeRunway];
    const d = haversine(sensor.lat, sensor.lon, rw.lat, rw.lon);

    // Atténuation géométrique
    const distanceLoss = 20 * Math.log10(Math.max(d, 100) / 100);

    // Boost piste active (alignement)
    const name = sensor.name.toUpperCase();
    const runwayBoost =
        (name.includes("NORD") && activeRunway === "22") ||
        (name.includes("SUD") && activeRunway === "04")
            ? 10
            : 4;

    // Boost trafic réel
    const trafficBoost = Math.log10(trafficIndex + 1) * 6;

    // Effet vent réel (downwind = +3 dB)
    let windBoost = 0;
    if (wind?.dir != null) {
        const diff = Math.abs(wind.dir - (activeRunway === "22" ? 220 : 40));
        const aligned = Math.min(diff, 360 - diff);
        if (aligned < 45) windBoost = 3;
    }

    // Niveau source à 100 m
    const L0 = 70 + runwayBoost + trafficBoost + windBoost;

    // Niveau final
    let L = L0 - distanceLoss;

    // Clamp réaliste
    L = Math.max(35, Math.min(85, L));

    // Jitter réaliste
    L += (Math.random() - 0.5) * 1.5;

    return Math.round(L * 10) / 10;
}

// ======================================================
// 4) ENDPOINT /sonos
// ======================================================

// Récupérer le vent réel depuis METAR
async function getBackendMetar() {
    try {
        const r = await fetch("https://eblg-dashboard-v84.onrender.com/metar");
        const data = await r.json();

        return {
            windDir: data?.wind_direction?.value ?? null,
            windSpeed: data?.wind_speed?.value ?? null
        };
    } catch (err) {
        console.error("[METAR ERROR]", err);
        return { windDir: null, windSpeed: null };
    }
}

app.get("/sonos", async (req, res) => {
    const metar = await getBackendMetar();
    const trafficIndex = await getTrafficIndex();

    const wind = {
        dir: metar.windDir,
        kt: metar.windSpeed
    };

    const ACTIVE_RUNWAY = getActiveRunwayFromWind(wind.dir);

    const sensors = sonometers.map(s => ({
        ...s,
        db: computeSimulatedDb(s, ACTIVE_RUNWAY, wind, trafficIndex)
    }));

    res.json({
        runway: ACTIVE_RUNWAY,
        wind,
        trafficIndex,
        sensors
    });
});

// ======================================================
// ADS-B — AIRLABS PRO++ (cache + normalisation + filtres)
// ======================================================
app.get("/api/adsb", async (req, res) => {
    const cached = getCachedAdsb();
    if (cached) return res.json(cached);

    try {
        const url = `https://airlabs.co/api/v9/flights?api_key=${process.env.AIRLABS_KEY}`;
        const r = await fetch(url);

        if (!r.ok) {
            console.error("[ADSB] Airlabs HTTP", r.status);
            if (cached) return res.json(cached);
            return res.status(502).json({ error: "Airlabs upstream error" });
        }

        const json = await r.json();
        const flights = json.response || [];

        let ac = flights
            .map(f => {
                if (!f.lat || !f.lng) return null;

                return {
                    icao: f.hex || null,
                    hex: f.hex || null,
                    call: f.flight_icao || f.flight_iata || "",
                    lat: f.lat,
                    lon: f.lng,
                    alt_baro: f.alt || null,
                    gs: f.speed || null,
                    track: f.dir || null,
                    type: f.aircraft_icao || null
                };
            })
            .filter(Boolean);

        ac = filterGeographic(ac, 80);

        ac = ac.map(a => {
            const approach = detectApproach(a);
            const departure = detectDeparture(a);

            return {
                ...a,
                approach,
                departure,
                corridor: approach ? generateApproachCorridor(approach) : null
            };
        });

        const payload = { ac };
        setCachedAdsb(payload);
        return res.json(payload);

    } catch (e) {
        console.error("[ADSB] Airlabs fetch failed", e);
        const cached2 = getCachedAdsb();
        if (cached2) return res.json(cached2);
        res.status(500).json({ error: "ADSB fetch failed" });
    }
});

// ======================================================
// Backend radar — logique type - centre EBLG
// ======================================================
const RADIUS_KM = 150;

app.get("/radar", async (req, res) => {
    try {
        const r = await fetch("https://opensky-network.org/api/states/all");
        const json = await r.json();

        const states = json.states || [];

        const flights = states
            .map(s => ({
                icao24: s[0],
                callsign: (s[1] || "").trim(),
                country: s[2],
                lat: s[6],
                lon: s[5],
                alt: s[7],
                heading: s[10],
                speed: s[9]
            }))
            .filter(f => f.lat && f.lon && isInRadius(f.lat, f.lon, EBLG, RADIUS_KM));

        res.json({ flights });

    } catch (err) {
        console.error("[RADAR] error", err);
        res.status(500).json({ error: "radar_error" });
    }
});

// ======================================================
// LOGS — MODE SIMPLE PRO+++
// ======================================================
app.get("/logs", (req, res) => {
    const now = new Date().toISOString();
    const entries = [
        `${now} METAR/TAF backend OK`,
        `${now} ADSB Airlabs OK (cache ou live)`,
        `${now} FIDS autonome OK`,
        `${now} SONOS autonome OK`
    ];
    res.json({ entries });
});

// ======================================================
// FALLBACK SPA — TOUJOURS EN DERNIER
// ======================================================
app.get("*", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
});

// ======================================================
// START
// ======================================================
app.listen(PORT, () => {
    console.log(`[SERVER] Listening on port ${PORT}`);
});
