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
import { safeLoadFids, initFidsTabs } from "./fids.js";
import { loadSonometers } from "./sonometers.js";
import { checkApiStatus } from "./status.js";
import { loadLogs } from "./logs.js";
import { startLiveLogs } from "./logsLive.js";
import { initRadar } from "./radar.js";

// ======================================================
// CHARGEMENT DES SONOMÈTRES UNIQUEMENT QUAND LA CARTE EST PRÊTE
// ======================================================
window.addEventListener("map-ready", () => {
    loadSonometers();
});

// ======================================================
// INIT GLOBAL
// ======================================================
window.addEventListener("DOMContentLoaded", () => {
    console.log("[APP] Initialisation cockpit IFR…");

    // 1) Carte + debug
    initMap();
    initNoiseZones();
    initDebugPanel();

    // 2) Radar (polling interne dans radar.js)
    window.addEventListener("map-ready", () => {
    initRadar();
});

    // 3) Modules dépendants de la carte (mais PAS les sonomètres)
    setTimeout(() => {
        console.log("[MAP] Init terminée — chargement modules dépendants…");
        safeLoadFids();
        loadLogs();
        startLiveLogs();
    }, 300);

    // 4) Météo (indépendant de la carte)
    initMetar();
    initTaf();

    // 5) Status API
    checkApiStatus();

    // 6) Timers
    setupTimers();

    // 7) UI
    setupUIBindings();

    // 8) FIDS tab
    initFidsTabs();
});

// ======================================================
// TIMERS
// ======================================================
function setupTimers() {
    setInterval(safeLoadMetar, 60_000);
    setInterval(safeLoadTaf, 10 * 60_000);
    setInterval(safeLoadFids, 60_000);

    // Sonomètres → seulement quand la carte est prête
    window.addEventListener("map-ready", () => {
        setInterval(loadSonometers, 30_000);
    });

    setInterval(checkApiStatus, 60_000);
    setInterval(loadLogs, 120_000);

    // ❌ SUPPRIMÉ : setInterval(loadRadar, …)
    // ✔ initRadar() gère déjà son propre polling interne
}

// ======================================================
// UI
// ======================================================
function setupUIBindings() {
    // Reset carte
    const resetBtn = document.getElementById("btn-reset-map");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => resetMapView());
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
