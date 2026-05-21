// ======================================================
// APP.JS — Cockpit IFR EBLG PRO+++
// ======================================================

import {
    initMap,
    resetMapView,
    toggleNoiseHeatmap,
    toggleNoiseZones,
    initDebugPanel
} from "./map.js";

import { initMetar, safeLoadMetar } from "./metar.js";
import { initTaf, safeLoadTaf } from "./taf.js";
import { safeLoadFids } from "./fids.js";
import { loadSonometers } from "./sonometers.js";
import { checkApiStatus } from "./status.js";
import { loadLogs } from "./logs.js";
import { startLiveLogs } from "./logsLive.js";

// ------------------------------------------------------
// INIT GLOBAL
// ------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    console.log("[APP] Initialisation cockpit IFR…");

    // Carte + debug
    initMap();
    initDebugPanel();

    // Modules dépendants de la carte → léger délai pour laisser Leaflet finir
    setTimeout(() => {
        console.log("[MAP] Init terminée — chargement modules dépendants…");
        safeLoadFids();
        loadSonometers();      // markers + heatmap
        loadLogs();
        startLiveLogs();
    }, 300);

    // Météo (indépendant de la carte)
    initMetar();
    initTaf();

    // Status API
    checkApiStatus();

    // Timers
    setupTimers();

    // UI
    setupUIBindings();
});

// ------------------------------------------------------
// TIMERS
// ------------------------------------------------------
function setupTimers() {
    setInterval(safeLoadMetar, 60_000);
    setInterval(safeLoadTaf, 10 * 60_000);
    setInterval(safeLoadFids, 60_000);
    setInterval(loadSonometers, 30_000);
    setInterval(checkApiStatus, 60_000);
    setInterval(loadLogs, 120_000);
}

// ------------------------------------------------------
// UI
// ------------------------------------------------------
function setupUIBindings() {
    // Reset carte
    const resetBtn = document.getElementById("btn-reset-map");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => resetMapView());
    }

    // Heatmap bruit
    const heatmapToggle = document.getElementById("btn-heatmap");
    if (heatmapToggle) {
        heatmapToggle.addEventListener("change", e => {
            toggleNoiseHeatmap(e.target.checked);
        });
    }

    // Zones de bruit
    const noiseZonesBtn = document.getElementById("btn-noisezones-toggle");
    if (noiseZonesBtn) {
        noiseZonesBtn.addEventListener("click", () => toggleNoiseZones());
    }

    // Onglets panneaux
    const tabs = document.querySelectorAll("[data-panel-target]");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("data-panel-target");

            document.querySelectorAll(".panel").forEach(p =>
                p.classList.add("hidden")
            );
            const panel = document.getElementById(targetId);
            if (panel) panel.classList.remove("hidden");
        });
    });
}
