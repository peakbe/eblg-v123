// ======================================================
// APP.JS PRO+++ — Cockpit IFR EBLG
// ======================================================

import { initMap, toggleNoiseHeatmap } from "./map.js";
import { updateADSB } from "./map.js";
import { initMetar, safeLoadMetar } from "./metar.js";
import { safeLoadTaf } from "./taf.js";
import { safeLoadFids } from "./fids.js";
import { loadSonometers } from "./sonometers.js";
import { checkApiStatus } from "./status.js";
import { loadLogs } from "./logs.js";
import { startLiveLogs } from "./logsLive.js";

// ======================================================
// DOMContentLoaded — pipeline cockpit IFR
// ======================================================
window.addEventListener("DOMContentLoaded", () => {

    console.log("[APP] Initialisation cockpit IFR…");

    // 1) Carte
    initMap();

    // 2) METAR (piste active + corridor + glide path)
    initMetar();

    // 3) Modules secondaires
    safeLoadTaf();
    safeLoadFids();
    loadSonometers();
    checkApiStatus();
    loadLogs();
    startLiveLogs();

    // 4) ADS-B (Airlabs)
    updateADSB();
    setInterval(updateADSB, 8000);

    // 5) Rafraîchissements périodiques
    setInterval(safeLoadMetar, 60_000);
    setInterval(safeLoadTaf, 5 * 60_000);
    setInterval(safeLoadFids, 60_000);
    setInterval(loadSonometers, 60_000);
    setInterval(checkApiStatus, 30_000);

    // 6) Gestion des onglets
    const tabs = document.querySelectorAll("#sidebar-tabs button");
    const panels = document.querySelectorAll("#sidebar-panels .panel");

    tabs.forEach(btn => {
        btn.addEventListener("click", () => {
            const tab = btn.dataset.tab;

            tabs.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            panels.forEach(p => p.classList.add("hidden"));
            document.getElementById(`panel-${tab}`).classList.remove("hidden");
        });
    });

    const defaultTab = document.querySelector('#sidebar-tabs button[data-tab="metar"]');
    if (defaultTab) defaultTab.click();

    // 7) Bouton reset map
    const resetMapBtn = document.getElementById("btn-reset-map");
    if (resetMapBtn) {
       resetMapBtn.addEventListener("click", () => {
    window.map.setView([50.645, 5.46], 12);
});

    // 8) Heatmap ON/OFF
    let noiseHeatmapEnabled = true;
    const noiseHeatBtn = document.getElementById("btn-noiseheat-toggle");

    if (noiseHeatBtn) {
        noiseHeatBtn.addEventListener("click", () => {
            noiseHeatmapEnabled = !noiseHeatmapEnabled;
            toggleNoiseHeatmap(noiseHeatmapEnabled);
            noiseHeatBtn.textContent = noiseHeatmapEnabled ? "Heatmap ON" : "Heatmap OFF";
        });
    }
const noiseZonesBtn = document.getElementById("btn-noisezones-toggle");
let noiseZonesEnabled = false;

noiseZonesBtn.addEventListener("click", () => {
    noiseZonesEnabled = !noiseZonesEnabled;
    toggleNoiseZones(noiseZonesEnabled);
});

    console.log("[APP] Cockpit IFR opérationnel");
});
