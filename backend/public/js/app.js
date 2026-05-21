// ======================================================
// APP.JS — Cockpit IFR EBLG PRO+++
// - Orchestration globale
// - Timers METAR / TAF / FIDS / SONO / ADS-B
// - Boutons UI (reset map, heatmap, panneaux)
// ======================================================

import { ENDPOINTS } from "./config.js";

import {
    initMap,
    resetMapView,
    toggleNoiseHeatmap,
    toggleNoiseZones,   // ← AJOUT
    updateADSB
} from "./map.js";

import {
    initMetar,
    safeLoadMetar
} from "./metar.js";

import {
    initTaf,
    safeLoadTaf
} from "./taf.js";

import { safeLoadFids } from "./fids.js";
import { loadSonometers } from "./sonometers.js";
import { checkApiStatus } from "./status.js";
import { loadLogs } from "./logs.js";
import { startLiveLogs } from "./logsLive.js";
import { initDebugPanel } from "./map.js";

// ======================================================
// INIT GLOBAL
// ======================================================
document.addEventListener("DOMContentLoaded", () => {
    // Carte
    initMap();
    initDebugPanel();

    // METAR / TAF
    initMetar();
    initTaf();

    // FIDS / SONO / STATUS / LOGS
    safeLoadFids();
    loadSonometers();
    checkApiStatus();
    loadLogs();
    startLiveLogs();

    // ADS-B
    startAdsbLoop();

    // Timers récurrents
    setupTimers();

    // UI boutons
    setupUIBindings();
});

// ======================================================
// TIMERS
// ======================================================
function setupTimers() {
    // METAR : toutes les 60 s
    setInterval(safeLoadMetar, 60_000);

    // TAF : toutes les 10 min
    setInterval(safeLoadTaf, 10 * 60_000);

    // FIDS : toutes les 60 s
    setInterval(safeLoadFids, 60_000);

    // Sonomètres : toutes les 30 s
    setInterval(loadSonometers, 30_000);

    // Statut API : toutes les 60 s
    setInterval(checkApiStatus, 60_000);

    // Logs “snapshot” : toutes les 2 min
    setInterval(loadLogs, 120_000);
}

// ======================================================
// ADS-B LOOP
// ======================================================
function startAdsbLoop() {
    const POLL_MS = 5_000;

    const loop = async () => {
        try {
            const r = await fetch(ENDPOINTS.adsb || "/api/adsb");
            if (!r.ok) throw new Error("HTTP " + r.status);

            const json = await r.json();
            const list = json.ac || [];
            updateADSB(list);

        } catch (err) {
            console.error("[ADSB] Erreur", err);
        } finally {
            setTimeout(loop, POLL_MS);
        }
    };

    loop();
}

// ======================================================
// UI BINDINGS
// ======================================================
function setupUIBindings() {
    // Reset map
    const resetBtn = document.getElementById("btn-reset-map");
    if (resetBtn) {
        resetBtn.addEventListener("click", () => {
            resetMapView();
        });
    }

    // Heatmap bruit
    const heatmapToggle = document.getElementById("btn-heatmap");
    if (heatmapToggle) {
        heatmapToggle.addEventListener("change", (e) => {
            const state = e.target.checked ?? e.target.classList.contains("active");
            toggleNoiseHeatmap(state);
        });
    }

    // Zones bruit
    const noiseZonesBtn = document.getElementById("btn-noisezones-toggle");
    if (noiseZonesBtn) {
        noiseZonesBtn.addEventListener("click", () => {
            toggleNoiseZones();
        });
    }

    // Panneaux / tabs
    const tabs = document.querySelectorAll("[data-panel-target]");
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            const targetId = tab.getAttribute("data-panel-target");
            if (!targetId) return;

            document
                .querySelectorAll(".panel")
                .forEach(p => p.classList.add("hidden"));

            const panel = document.getElementById(targetId);
            if (panel) panel.classList.remove("hidden");
        });
    });
}
