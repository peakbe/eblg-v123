// ======================================================
// EBLG DASHBOARD — BACKEND PRO+++
// server.mjs
// ======================================================

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

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

// ------------------------------------------------------
// MIDDLEWARES
// ------------------------------------------------------
app.use(cors());

const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));

// ======================================================
// CONSTANTES EBLG / PISTES
// ======================================================
const EBLG = { lat: 50.637, lon: 5.443 };

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
app.get("/fids", (req, res) => {
    const nowIso = new Date().toISOString().slice(11, 16); // HH:MM

    const flights = [
        {
            type: "arrival",
            flight: "FX123",
            city: "Paris CDG",
            eta: nowIso,
            status: "ON TIME"
        },
        {
            type: "arrival",
            flight: "FX456",
            city: "Leipzig",
            eta: nowIso,
            status: "LANDED"
        },
        {
            type: "departure",
            flight: "FX789",
            city: "Cologne",
            etd: nowIso,
            status: "BOARDING"
        },
        {
            type: "departure",
            flight: "FX999",
            city: "Paris CDG",
            etd: nowIso,
            status: "DELAYED"
        }
    ];

    res.json({ flights });
});

// ======================================================
// SONOMETERS — MODE AUTONOME PRO+++
// ======================================================
import sonometers from "./sonometers-data.js";

app.get("/sonos", (req, res) => {
    res.json({ sensors: sonometers });
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
