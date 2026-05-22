// ======================================================
// MAP.JS — Cockpit IFR EBLG PRO+++
// ======================================================
import { toggleHeatmapState } from "./sonometers.js";

export function toggleNoiseHeatmap(state) {
    toggleHeatmapState(state);
}

export let map = null;

let adsbLayer = null;
let corridorLayer = null;
let runwayLayer = null;
let headingLayer = null;

// ------------------------------------------------------
// INIT MAP
// ------------------------------------------------------
export function initMap() {
    map = L.map("map", {
        zoomControl: false,
        minZoom: 8,
        maxZoom: 18,
        preferCanvas: true
    }).setView([50.637, 5.443], 12);

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18
    }).addTo(map);

    adsbLayer = L.layerGroup().addTo(map);
    corridorLayer = L.layerGroup().addTo(map);
    runwayLayer = L.layerGroup().addTo(map);
    headingLayer = L.layerGroup().addTo(map);

    drawRunways();
}

// ------------------------------------------------------
// RESET MAP
// ------------------------------------------------------
export function resetMapView() {
    if (!map) return;
    map.setView([50.637, 5.443], 12);
}

// ------------------------------------------------------
// DEBUG PANEL — FPS / CPU
// ------------------------------------------------------
export function initDebugPanel() {
    const fpsEl = document.getElementById("fps");
    const cpuEl = document.getElementById("cpu");
    const renderEl = document.getElementById("render");

    if (!fpsEl || !cpuEl || !renderEl) {
        console.warn("[DEBUG] éléments manquants");
        return;
    }

    let last = performance.now();

    function loop() {
        const now = performance.now();
        const dt = now - last;
        last = now;

        fpsEl.textContent = (1000 / dt).toFixed(1);
        cpuEl.textContent = dt.toFixed(1);
        renderEl.textContent = dt.toFixed(1);

        requestAnimationFrame(loop);
    }

    loop();
}

// ------------------------------------------------------
// RUNWAYS
// ------------------------------------------------------
const RWY = {
    "04": { lat: 50.64594, lon: 5.44321, heading: 40 },
    "22": { lat: 50.63302, lon: 5.46163, heading: 220 }
};

// Exposition globale pour sonometers.js
window.runwayThresholds = {
    "04": { lat: RWY["04"].lat, lon: RWY["04"].lon },
    "22": { lat: RWY["22"].lat, lon: RWY["22"].lon }
};

function drawRunways() {
    runwayLayer.clearLayers();

    Object.entries(RWY).forEach(([id, thr]) => {
        const end = computePoint(thr.lat, thr.lon, thr.heading, 3);

        L.polyline(
            [
                [thr.lat, thr.lon],
                [end.lat, end.lon]
            ],
            { color: "#ff8800", weight: 5, opacity: 0.95 } // orange cockpit
            
        ).addTo(runwayLayer);

        L.marker([thr.lat, thr.lon], {
            icon: L.divIcon({
                className: "rwy-label",
                html: `<div class="rwy">${id}</div>`
            })
            
        }).addTo(runwayLayer);
    });
}

// ------------------------------------------------------
// CORRIDOR APPROCHE
// ------------------------------------------------------
export function drawCorridor(points) {
    corridorLayer.clearLayers();
    if (!points) return;

    L.polygon(points, {
        color: "cyan",
        weight: 2,
        fillOpacity: 0.15
    }).addTo(corridorLayer);
}

// ------------------------------------------------------
// ADS-B UPDATE
// ------------------------------------------------------
export function updateADSB(list) {
    adsbLayer.clearLayers();
    headingLayer.clearLayers();

    let corridorDrawn = false;

    if (!Array.isArray(list) || !list.length) {
        corridorLayer.clearLayers();
        return;
    }

    list.forEach(ac => {
        if (!ac.lat || !ac.lon) return;

        // Marker avion
        const icon = L.divIcon({
            className: "adsb-marker",
            html: `
                <div class="plane" style="transform: rotate(${ac.track || 0}deg)"></div>
                <div class="label">${ac.call || ""}</div>
            `,
            iconSize: [30, 30]
        });

        L.marker([ac.lat, ac.lon], { icon }).addTo(adsbLayer);

        // Heading arrow
        drawHeadingArrow(ac);

        // Corridor approche
        if (ac.corridor) {
            drawCorridor(ac.corridor);
            corridorDrawn = true;
        }
    });

    if (!corridorDrawn) corridorLayer.clearLayers();
}

// ------------------------------------------------------
// HEADING ARROW
// ------------------------------------------------------
function drawHeadingArrow(ac) {
    if (!ac.track) return;

    const start = { lat: ac.lat, lon: ac.lon };
    const end = computePoint(ac.lat, ac.lon, ac.track, 1.5);

    const line = L.polyline(
        [
            [start.lat, start.lon],
            [end.lat, end.lon]
        ],
        { color: "yellow", weight: 2 }
    ).addTo(headingLayer);

    L.polylineDecorator(line, {
        patterns: [
            {
                offset: "100%",
                repeat: 0,
                symbol: L.Symbol.arrowHead({
                    pixelSize: 10,
                    polygon: false,
                    pathOptions: { stroke: true, color: "yellow" }
                })
            }
        ]
    }).addTo(headingLayer);
}

// ------------------------------------------------------
// UTILS
// ------------------------------------------------------
function computePoint(lat, lon, brg, distKm) {
    const R = 6371;
    const d = distKm / R;
    const br = (brg * Math.PI) / 180;

    const lat1 = (lat * Math.PI) / 180;
    const lon1 = (lon * Math.PI) / 180;

    const lat2 =
        Math.asin(
            Math.sin(lat1) * Math.cos(d) +
                Math.cos(lat1) * Math.sin(d) * Math.cos(br)
        );

    const lon2 =
        lon1 +
        Math.atan2(
            Math.sin(br) * Math.sin(d) * Math.cos(lat1),
            Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
        );

    return {
        lat: (lat2 * 180) / Math.PI,
        lon: (lon2 * 180) / Math.PI
    };
}

// ------------------------------------------------------
// NOISE MAP (depuis app.js)
// ------------------------------------------------------
export function toggleNoiseZones() {
    console.log("[ZONES BRUIT] toggle");
}
