// ======================================================
// METAR.JS — Cockpit IFR EBLG PRO+++
// ======================================================

import { ENDPOINTS } from "./config.js";
import { fetchJSON, updateStatusPanel } from "./helpers.js";

const ICAO = "EBLG";

// ------------------------------------------------------
// CHARGEMENT METAR (fonction attendue par app.js)
// ------------------------------------------------------
async function loadMetar() {
    try {
        const data = await fetchJSON(ENDPOINTS.metar);

        if (!data || !data.raw) {
            console.error("[METAR] Données invalides", data);
            updateStatusPanel("METAR", { error: true });
            renderMetar(null);
            return;
        }

        renderMetar(data);
        updateStatusPanel("METAR", { ok: true });

    } catch (err) {
        console.error("[METAR] Erreur loadMetar()", err);
        updateStatusPanel("METAR", { error: true });
        renderMetar(null);
    }
}

// ------------------------------------------------------
// RENDU METAR
// ------------------------------------------------------
function renderMetar(data) {
    const raw = data?.raw || "";
    const age = data?.ageMinutes ?? null;

    const metarEl = document.getElementById("metar-x");
    const ageEl = document.getElementById("metar-age");
    const rwWindEl = document.getElementById("runway-wind");
    const rwActiveEl = document.getElementById("runway-active");

    if (metarEl) metarEl.textContent = raw || "METAR indisponible";

    if (ageEl) {
        ageEl.textContent = age != null
            ? `Âge METAR : ${age.toFixed(1)} min`
            : "Âge METAR : inconnu";
    }

    const wind = parseWindFromMetar(raw);
    const activeRw = computeActiveRunway(wind?.dir);

    if (rwWindEl && wind) {
        rwWindEl.textContent =
            `Vent ${wind.dir ?? "VRB"}°/${wind.speed} kt` +
            (wind.gust ? ` (rafales ${wind.gust} kt)` : "");
    } else if (rwWindEl) {
        rwWindEl.textContent = "Vent : inconnu";
    }

    if (rwActiveEl) {
        rwActiveEl.textContent = activeRw
            ? `Piste active : ${activeRw}`
            : "Piste active : inconnue";
    }

    window.activeRunway = activeRw || null;
}

// ------------------------------------------------------
// PARSING VENT
// ------------------------------------------------------
function parseWindFromMetar(raw) {
    if (!raw) return null;

    const m = raw.match(/(\d{3}|VRB)(\d{2})(G(\d{2}))?KT/);
    if (!m) return null;

    const dir = m[1] === "VRB" ? null : parseInt(m[1], 10);
    const speed = parseInt(m[2], 10);
    const gust = m[4] ? parseInt(m[4], 10) : null;

    return { dir, speed, gust };
}

// ------------------------------------------------------
// PISTE ACTIVE (04 / 22)
// ------------------------------------------------------
function computeActiveRunway(windDir) {
    if (windDir == null || isNaN(windDir)) return null;

    const rwy04 = 40;
    const rwy22 = 220;

    const diff04 = angleDiff(windDir, rwy04);
    const diff22 = angleDiff(windDir, rwy22);

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
