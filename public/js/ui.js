// ======================================================
// UI — VERSION PRO+
// Sidebar, panneaux, toggles, debug panel
// ======================================================

import { heatLayer, clusterLayer, playHeatmapHistory } from "./sonometers.js";


// ------------------------------------------------------
// Logging PRO+
// ------------------------------------------------------
const IS_DEV = location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1");
const log = (...a) => IS_DEV && console.log("[UI]", ...a);
const logErr = (...a) => console.error("[UI ERROR]", ...a);


// ======================================================
// 1) UI de base (sidebar + panneau sono)
// ======================================================
export function initUI() {
    try {
        const sonoHeader = document.getElementById("sono-header");
        const sonoPanel = document.getElementById("sono-panel");
        const sonoToggle = document.getElementById("sono-toggle");
        const sidebar = document.getElementById("sidebar");
        const sidebarToggle = document.getElementById("sidebar-toggle");

        // Panneau sonomètres
        if (sonoHeader && sonoPanel && sonoToggle) {
            sonoHeader.onclick = () => {
                sonoPanel.classList.toggle("collapsed");
                const collapsed = sonoPanel.classList.contains("collapsed");
                sonoToggle.textContent = collapsed ? "⯈" : "⯆";
            };
        }

        // Sidebar
        if (sidebar && sidebarToggle) {
            sidebarToggle.onclick = () => {
                sidebar.classList.toggle("sidebar-collapsed");
            };
        }

        log("UI initialisée");

    } catch (err) {
        logErr("Erreur initUI :", err);
    }
}


// ======================================================
// 2) Bouton ON/OFF Heatmap
// ======================================================
export function initHeatmapToggleUI(map) {
    try {
        const btn = document.getElementById("toggle-heatmap");
        if (!btn) return;

        btn.onclick = () => {
            if (map.hasLayer(heatLayer)) {
                map.removeLayer(heatLayer);
                btn.classList.add("off");
            } else {
                map.addLayer(heatLayer);
                btn.classList.remove("off");
            }
        };

        log("Toggle Heatmap UI initialisé");

    } catch (err) {
        logErr("Erreur initHeatmapToggleUI :", err);
    }
}


// ======================================================
// 3) Bouton ON/OFF Clusters
// ======================================================
export function initClusterToggle(map) {
    try {
        const btn = document.getElementById("toggle-clusters");
        if (!btn) return;

        btn.onclick = () => {
            if (map.hasLayer(clusterLayer)) {
                map.removeLayer(clusterLayer);
            } else {
                map.addLayer(clusterLayer);
            }
        };

        log("Toggle clusters initialisé");

    } catch (err) {
        logErr("Erreur initClusterToggle :", err);
    }
}


// ======================================================
// 4) Mode Heatmap Historique
// ======================================================
export function initHeatmapHistory(map) {
    try {
        const btn = document.getElementById("play-history");
        if (!btn) return;

        btn.onclick = () => playHeatmapHistory(map);

        log("Mode historique heatmap initialisé");

    } catch (err) {
        logErr("Erreur initHeatmapHistory :", err);
    }
}


// ======================================================
// 5) Panneau Debug (FPS + CPU + Render Time)
// ======================================================
export function initDebugPanel(map) {
    try {
        const fpsEl = document.getElementById("fps");
        const cpuEl = document.getElementById("cpu");
        const renderEl = document.getElementById("render");

        if (!fpsEl || !cpuEl || !renderEl) {
            log("Debug panel non présent dans le DOM");
            return;
        }

        let last = performance.now();
        let frames = 0;

        function loop() {
            const now = performance.now();
            frames++;

            if (now - last >= 1000) {
                fpsEl.textContent = frames;
                frames = 0;
                last = now;
            }

            const cpu = (performance.now() - now).toFixed(2);
            cpuEl.textContent = cpu;

            requestAnimationFrame(loop);
        }

        loop();

        map.on("layeradd layerremove moveend zoomend", () => {
            const t0 = performance.now();
            requestAnimationFrame(() => {
                const t1 = performance.now();
                renderEl.textContent = (t1 - t0).toFixed(2);
            });
        });

        log("Debug panel initialisé");

    } catch (err) {
        logErr("Erreur initDebugPanel :", err);
    }
}
