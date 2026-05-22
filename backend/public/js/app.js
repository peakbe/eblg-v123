// ======================================================
// APP.JS — Cockpit IFR EBLG PRO+++
// ======================================================

import {
    initMap,
    resetMapView,
    toggleNoiseZones,
    initDebugPanel,
    initNoiseZones
} from "./map.js";

import { initMetar, safeLoadMetar } from "./metar.js";
import { initTaf, safeLoadTaf } from "./taf.js";
import { safeLoadFids } from "./fids.js";
import { loadSonometers } from "./sonometers.js";
import { checkApiStatus } from "./status.js";
import { loadLogs } from "./logs.js";
import { startLiveLogs } from "./logsLive.js";

// ------------------------------------------------------
// CHARGEMENT DES SONOMÈTRES UNIQUEMENT QUAND LA CARTE EST PRÊTE
// ------------------------------------------------------
window.addEventListener("map-ready", () => loadSonometers());

// ------------------------------------------------------
// INIT GLOBAL
// ------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    console.log("[APP] Initialisation cockpit IFR…");

    // Carte + debug
    initMap();
    initNoiseZones();
    initDebugPanel();

    // Modules dépendants de la carte (mais PAS les sonomètres)
    setTimeout(() => {
        console.log("[MAP] Init terminée — chargement modules dépendants…");
        safeLoadFids();
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
    
    // FIDS tab
    import { initFidsTabs } from "./fids.js";
initFidsTabs();

});

// ------------------------------------------------------
// TIMERS
// ------------------------------------------------------
function setupTimers() {
    setInterval(safeLoadMetar, 60_000);
    setInterval(safeLoadTaf, 10 * 60_000);
    setInterval(safeLoadFids, 60_000);
    window.addEventListener("map-ready", () => {
    setInterval(loadSonometers, 30_000);
});
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
