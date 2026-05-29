// ======================================================
// METAR.JS — Cockpit IFR EBLG PRO+++
// ======================================================

import { ENDPOINTS } from "./config.js";
import { fetchJSON, updateStatusPanel } from "./helpers.js";

// ------------------------------------------------------
// Fonction appelée par app.js
// ------------------------------------------------------
async function loadMetar() {
    try {
        const data = await fetchJSON(ENDPOINTS.metar);

        // Backend renvoie parfois { metar: "N/A" }
        if (!data || !data.raw) {
            console.warn("[METAR] Format inattendu:", data);
            renderMetar(null);
            updateStatusPanel("METAR", { error: true });
            return;
        }

        renderMetar(data);
        updateStatusPanel("METAR", { ok: true });

    } catch (err) {
        console.error("[METAR] Erreur loadMetar()", err);
        renderMetar(null);
        updateStatusPanel("METAR", { error: true });
    }
}

// ------------------------------------------------------
// Rendu METAR
// ------------------------------------------------------
function renderMetar(data) {
    const metarEl = document.getElementById("metar-x");
    const ageEl = document.getElementById("metar-age");
    const rwWindEl = document.getElementById("runway-wind");
    const rwActiveEl = document.getElementById("runway-active");

    if (!data) {
        if (metarEl) metarEl.textContent = "METAR indisponible";
        if (ageEl) ageEl.textContent = "Âge METAR : inconnu";
        if (rwWindEl) rwWindEl.textContent = "Vent : inconnu";
        if (rwActiveEl) rwActiveEl.textContent = "Piste active : inconnue";
        window.activeRunway = null;
        return;
    }

    const raw = data.raw;
    const age = data.ageMinutes ?? null;

    if (metarEl) metarEl.textContent = raw;
    if (ageEl) {
        ageEl.textContent = age != null
            ? `Âge METAR : ${age.toFixed(1)} min`
            : "Âge METAR : inconnu";
    }

    const wind = parseWind(raw);
    const activeRw = computeActiveRunway(wind?.dir);

    if (rwWindEl && wind) {
        rwWindEl.textContent =
            `Vent ${wind.dir ?? "VRB"}°/${wind.speed} kt` +
            (wind.gust ? ` (rafales ${wind.gust} kt)` : "");
    }

    if (rwActiveEl) {
        rwActiveEl.textContent = activeRw
            ? `Piste active : ${activeRw}`
            : "Piste active : inconnue";
    }

    window.activeRunway = activeRw || null;
}

// ------------------------------------------------------
// Parsing vent
// ------------------------------------------------------
function parseWind(raw) {
    if (!raw) return null;
    const m = raw.match(/(\d{3}|VRB)(\d{2})(G(\d{2}))?KT/);
    if (!m) return null;

    return {
        dir: m[1] === "VRB" ? null : parseInt(m[1], 10),
        speed: parseInt(m[2], 10),
        gust: m[4] ? parseInt(m[4], 10) : null
    };
}

// ------------------------------------------------------
// Piste active
// ------------------------------------------------------
function computeActiveRunway(windDir) {
    if (windDir == null || isNaN(windDir)) return null;
    const diff04 = angleDiff(windDir, 40);
    const diff22 = angleDiff(windDir, 220);
    return diff04 <= diff22 ? "04" : "22";
}

function angleDiff(a, b) {
    let d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
}

// ------------------------------------------------------
// EXPORT GLOBAL (clé pour app.js)
// ------------------------------------------------------
window.loadMetar = loadMetar;
window.initMetar = () => {};
