// ======================================================
// SONOMETERS.JS — Cockpit IFR EBLG PRO+++
// ======================================================

import { map } from "./map.js";

// ------------------------------------------------------
// VARIABLES
// ------------------------------------------------------
let sonoMarkersLayer = L.layerGroup();
let noiseHeatmapLayer = null;

export let sonoDataRaw = [];
export let heatmapEnabled = false;

// ------------------------------------------------------
// LOAD SONOMETERS
// ------------------------------------------------------
export async function loadSonometers() {
    try {
        const r = await fetch("/sonos");
        const json = await r.json();

        if (!json || !Array.isArray(json.sensors)) {
            console.warn("[SONO] format invalide");
            return;
        }

        sonoDataRaw = json.sensors;

        renderSonometers(sonoDataRaw);
        renderNoiseHeatmap(sonoDataRaw);

    } catch (e) {
        console.error("[SONO] Erreur fetch", e);
    }
}

// ------------------------------------------------------
// RENDER MARKERS
// ------------------------------------------------------
function renderSonometers(list) {
    if (!map) return;

    sonoMarkersLayer.clearLayers();

    list.forEach(s => {
        // Vérification stricte
        if (typeof s.lat !== "number" || typeof s.lon !== "number") {
            console.warn("[SONO] Coordonnées invalides", s);
            return;
        }

        const icon = L.divIcon({
            className: "sono-marker",
            html: `
                <div class="sono-dot"></div>
                <div class="sono-label">${s.name}</div>
            `,
            iconSize: [20, 20]
        });

        // Utilisation EXACTE des coordonnées backend
        L.marker([s.lat, s.lon], { icon }).addTo(sonoMarkersLayer);
    });

    sonoMarkersLayer.addTo(map);
}

// ------------------------------------------------------
// HEATMAP BRUIT
// ------------------------------------------------------
function renderNoiseHeatmap(list) {
    if (!map) return;

    // Supprimer l’ancienne heatmap
    if (noiseHeatmapLayer) {
        map.removeLayer(noiseHeatmapLayer);
        noiseHeatmapLayer = null;
    }

    if (!heatmapEnabled) return;

    // Normalisation dB → intensité 0–1
    const points = list
        .filter(s => s.lat && s.lon && s.db != null)
        .map(s => [
            s.lat,
            s.lon,
            Math.max(0.1, (s.db - 30) / 40) // 30–70 dB → 0.1–1
        ]);

    noiseHeatmapLayer = L.heatLayer(points, {
        radius: 35,
        blur: 20,
        maxZoom: 17,
        minOpacity: 0.25,
        gradient: {
            0.0: "lime",
            0.5: "yellow",
            1.0: "red"
        }
    });

    noiseHeatmapLayer.addTo(map);
}

// ------------------------------------------------------
// PUBLIC API — appelé par map.js
// ------------------------------------------------------
export function toggleHeatmapState(state) {
    heatmapEnabled = state;
    renderNoiseHeatmap(sonoDataRaw);
}

// ------------------------------------------------------
// UTILISÉ PAR map.js quand ADS-B update
// ------------------------------------------------------
export function updateNoiseHeatmap(list) {
    if (!heatmapEnabled) return;
    renderNoiseHeatmap(list);
}
const dbPanel = document.getElementById("db-panel");
const dbToggle = document.getElementById("db-toggle");
const dbClose = document.getElementById("db-close");

dbToggle.onclick = () => dbPanel.classList.toggle("hidden");
dbClose.onclick = () => dbPanel.classList.add("hidden");

export function updateDbPanel(payload) {
    const { runway, wind, trafficIndex, sensors } = payload;

    document.getElementById("db-runway").textContent = runway;
    document.getElementById("db-wind").textContent =
        `${wind.dir}° / ${wind.kt} kt`;
    document.getElementById("db-traffic").textContent =
        `${trafficIndex} avions`;

    const list = document.getElementById("db-list");
    list.innerHTML = "";

    sensors.forEach(s => {
        const div = document.createElement("div");
        div.className = "db-item";

        div.innerHTML = `
            <span class="db-item-name">${s.name}</span>
            <span class="db-item-value">${s.db} dB</span>
        `;

        list.appendChild(div);
    });
}
