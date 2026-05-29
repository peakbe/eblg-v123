// ======================================================
// LOGS.JS — Cockpit IFR EBLG PRO+++
// - Chargement sécurisé des logs backend
// - Anti-HTML, anti-erreur silencieuse
// - Intégration panneau "LOGS"
// ======================================================

import { ENDPOINTS } from "./config.js";
import { fetchJSON, updateStatusPanel } from "./helpers.js";

export async function loadLogs() {
    try {
        const data = await fetchJSON(ENDPOINTS.logs || "/logs");

        if (!data || !Array.isArray(data.entries)) {
            console.warn("[LOGS] Données invalides", data);
            updateStatusPanel("LOGS", { error: true });
            return;
        }

        renderLogs(data.entries);
        updateStatusPanel("LOGS", { ok: true });

    } catch (err) {
        console.error("[LOGS] Erreur loadLogs", err);
        updateStatusPanel("LOGS", { error: true });
    }
}

function renderLogs(list) {
    const box = document.getElementById("logs-box");
    if (!box) return;

    box.innerHTML = list
        .map(l => `<div class="log-line">${escapeHtml(l)}</div>`)
        .join("");
}

function escapeHtml(s) {
    return s.replace(/[&<>"]/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;"
    }[c]));
}
