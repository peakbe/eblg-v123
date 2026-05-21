// ======================================================
// SONOMETERS — PRO+++
// Tri, filtres, distances, couleurs ATC, intégration carte
// ======================================================

import { ENDPOINTS } from "./config.js";
import { fetchJSON, updateStatusPanel } from "./helpers.js";
import { map } from "./map.js";

const IS_DEV = location.hostname.includes("localhost") || location.hostname.includes("127.0.0.1");
const log = (...a) => IS_DEV && console.log("[SONO]", ...a);
const logErr = (...a) => console.error("[SONO ERROR]", ...a);

let sonoDataRaw = [];
let sonoMarkersLayer = null;

// ------------------------------------------------------
// API PUBLIC — appelée par app.js
// ------------------------------------------------------
export async function loadSonometers() {
    try {
        const data = await fetchJSON(ENDPOINTS.sono);
        if (!data || !data.sensors) {
            logErr("Données sonomètres invalides", data);
            updateStatusPanel("SONO", { error: true });
            return;
        }

        sonoDataRaw = data.sensors.map(normalizeSensor);
        populateTownFilter(sonoDataRaw);
        renderSonometers();

        updateStatusPanel("SONO", { ok: true });
        log("Sonomètres chargés :", sonoDataRaw.length);
    } catch (err) {
        logErr("Erreur loadSonometers", err);
        updateStatusPanel("SONO", { error: true });
    }
}

// ------------------------------------------------------
// Normalisation
// ------------------------------------------------------
function normalizeSensor(s) {
    return {
        id: s.id,
        name: s.name || `Sono ${s.id}`,
        lat: s.lat,
        lon: s.lon,
        db: s.db ?? null,
        address: s.address || "Adresse inconnue",
        town: s.town || "Inconnue",
        status: s.status || "OK",
        distance: null
    };
}

// ------------------------------------------------------
// Calcul distance piste → sonomètre (approx, en mètres)
// ------------------------------------------------------
function computeDistanceToRunway(lat, lon) {
    if (!window.activeRunway || !window.runwayThresholds) return null;

    const thr = window.runwayThresholds[window.activeRunway];
    if (!thr) return null;

    const dx = (lat - thr.lat);
    const dy = (lon - thr.lon);

    return Math.sqrt(dx * dx + dy * dy) * 111000;
}

// ------------------------------------------------------
// Tri / filtre
// ------------------------------------------------------
function sortSonometers(list, mode) {
    switch (mode) {
        case "distance":
            return list.sort((a, b) => (a.distance ?? 999999) - (b.distance ?? 999999));
        case "id":
            return list.sort((a, b) => a.id - b.id);
        case "address":
            return list.sort((a, b) => a.address.localeCompare(b.address));
        default:
            return list;
    }
}

function filterSonometers(list, town) {
    if (town === "all") return list;
    return list.filter(s => s.town === town);
}

function populateTownFilter(list) {
    const sel = document.getElementById("sono-filter-town");
    if (!sel) return;

    const towns = [...new Set(list.map(s => s.town))].filter(Boolean).sort();

    sel.innerHTML =
        `<option value="all">Commune: Toutes</option>` +
        towns.map(t => `<option value="${t}">${t}</option>`).join("");
}

// ------------------------------------------------------
// Couleurs ATC
// ------------------------------------------------------
function getATCColor(db) {
    if (db == null) return "gray";
    if (db < 45) return "limegreen";
    if (db < 55) return "dodgerblue";
    return "red";
}

// ------------------------------------------------------
// Rendu principal
// ------------------------------------------------------
function renderSonometers() {
    if (!sonoDataRaw.length) return;

    // distance
    const enriched = sonoDataRaw.map(s => ({
        ...s,
        distance: computeDistanceToRunway(s.lat, s.lon)
    }));

    // filtre
    const townSel = document.getElementById("sono-filter-town");
    const town = townSel ? townSel.value : "all";
    let list = filterSonometers(enriched, town);

    // tri
    const sortSel = document.getElementById("sono-sort");
    const mode = sortSel ? sortSel.value : "distance";
    list = sortSonometers(list, mode);

    renderSonoList(list);
    renderSonoMarkers(list);
}

// ------------------------------------------------------
// Rendu liste
// ------------------------------------------------------
function renderSonoList(list) {
    const container = document.getElementById("sono-list");
    if (!container) return;

    container.innerHTML = "";

    list.forEach(s => {
        const div = document.createElement("div");
        div.className = "sono-list-item";
        div.dataset.id = s.id;

        const distTxt = s.distance != null
            ? `${(s.distance / 1000).toFixed(2)} km`
            : "N/A";

        div.innerHTML = `
            <div class="sono-line-main">
                <span class="sono-name">${s.name}</span>
                <span class="sono-db" style="color:${getATCColor(s.db)}">${s.db ?? "?"} dB</span>
            </div>
            <div class="sono-line-sub">
                <span>${s.address} (${s.town})</span>
                <span>${distTxt}</span>
            </div>
        `;

        div.addEventListener("mouseenter", () => highlightMarker(s.id));
        div.addEventListener("mouseleave", () => unhighlightMarker(s.id));
        div.addEventListener("click", () => focusOnSensor(s));

        container.appendChild(div);
    });
}

// ------------------------------------------------------
// Rendu markers sur la carte
// ------------------------------------------------------
function renderSonoMarkers(list) {
    if (!import { map } from "./map.js";) {
        logErr("import { map } from "./map.js"; non défini, impossible de rendre les markers");
        return;
    }

    if (sonoMarkersLayer) {
        sonoMarkersLayer.clearLayers();
        import { map } from "./map.js";.removeLayer(sonoMarkersLayer);
    }

    sonoMarkersLayer = L.layerGroup();

    list.forEach(s => {
        const icon = L.divIcon({
            className: "sono-marker",
            html: `<div class="dot" style="background:${getATCColor(s.db)}"></div>`,
            iconSize: [12, 12]
        });

        const m = L.marker([s.lat, s.lon], { icon });

        m.on("mouseover", () => highlightListItem(s.id));
        m.on("mouseout", () => unhighlightListItem(s.id));
        m.on("click", () => focusOnSensor(s));

        m._sonoId = s.id;
        sonoMarkersLayer.addLayer(m);
    });

    if (!map) return;
sonoMarkersLayer.addTo(map);

}

// ------------------------------------------------------
// Highlight liste ↔ markers
// ------------------------------------------------------
function highlightMarker(id) {
    if (!sonoMarkersLayer) return;
    sonoMarkersLayer.eachLayer(m => {
        if (m._sonoId === id) {
            m._icon && m._icon.classList.add("active");
        }
    });
}

function unhighlightMarker(id) {
    if (!sonoMarkersLayer) return;
    sonoMarkersLayer.eachLayer(m => {
        if (m._sonoId === id) {
            m._icon && m._icon.classList.remove("active");
        }
    });
}

function highlightListItem(id) {
    const el = document.querySelector(`.sono-list-item[data-id="${id}"]`);
    if (el) el.classList.add("active");
}

function unhighlightListItem(id) {
    const el = document.querySelector(`.sono-list-item[data-id="${id}"]`);
    if (el) el.classList.remove("active");
}

function focusOnSensor(s) {
    if (!import { map } from "./map.js";) return;
    import { map } from "./map.js";.setView([s.lat, s.lon], 15);
}

// ------------------------------------------------------
// Listeners UI
// ------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    const sortSel = document.getElementById("sono-sort");
    const townSel = document.getElementById("sono-filter-town");

    sortSel && sortSel.addEventListener("change", renderSonometers);
    townSel && townSel.addEventListener("change", renderSonometers);
});
