// ======================================================
// SONOMETERS PRO+++
// - Chargement dynamique depuis backend
// - Couleurs selon piste active (logique Patrick 04/22)
// - Heatmap + markers
// - Panneau dB réel
// ======================================================
import { drawDynamicNoiseZones } from "./map.js";

// ------------------------------------------------------
// 1) TABLE COULEURS SELON PISTE ACTIVE
// ------------------------------------------------------
const RUNWAY_COLOR_MAP = {
    "22": {
        green: ["F002","F003","F004","F005","F006","F007","F008","F009","F010","F011","F012","F013","F016"],
        red:   ["F001","F014","F015","F017"]
    },
    "04": {
        green: ["F002","F003","F007","F008","F009","F011","F013","F014","F015"],
        red:   ["F004","F005","F006","F010","F012","F016","F001","F017"]
    }
};

// ------------------------------------------------------
// 2) Déterminer couleur d’un sonomètre
// ------------------------------------------------------
function getSonoColor(id, activeRunway) {
    const map = RUNWAY_COLOR_MAP[activeRunway];
    if (!map) return "gray";

    if (map.green.includes(id)) return "green";
    if (map.red.includes(id)) return "red";

    return "gray";
}

// ------------------------------------------------------
// 3) Heatmap
// ------------------------------------------------------
let heatLayer = null;

function renderHeatmap(sensors) {
    if (!window._map) return;

    // Empêche le crash si la carte n’a pas encore de taille
    const size = window._map.getSize();
    if (size.x === 0 || size.y === 0) {
        console.warn("[HEATMAP] Carte pas encore prête → retry dans 200ms");
        setTimeout(() => renderHeatmap(sensors), 200);
        return;
    }

    if (heatLayer) {
        window._map.removeLayer(heatLayer);
    }

    const points = sensors.map(s => [
        s.lat,
        s.lon,
        Math.max(0.1, (s.db - 35) / 50)
    ]);

    heatLayer = L.heatLayer(points, {
        radius: 35,
        blur: 25,
        maxZoom: 12
    });

    heatLayer.addTo(window._map);
}

// ------------------------------------------------------
//  bouton ON/OFF pour la heatmap
// ------------------------------------------------------
export function toggleNoiseHeatmap(enabled) {
    if (!window._map) return;

    if (!enabled) {
        if (heatLayer) {
            window._map.removeLayer(heatLayer);
        }
        return;
    }

    // Si ON → on redessine la heatmap avec les dernières données
    if (window._lastSonoData) {
        renderHeatmap(window._lastSonoData);
    }
}


// ------------------------------------------------------
// 4) Markers sonomètres
// ------------------------------------------------------
export function renderSonometers(sensors) {
    if (!window._map) {
        console.error("[SONO ERROR] Carte non initialisée");
        return;
    }

    if (window._sonoLayer) {
        window._map.removeLayer(window._sonoLayer);
    }

    const group = L.layerGroup();

    sensors.forEach(s => {
        const color = getSonoColor(s.name, window.ACTIVE_RUNWAY);
        
export function getSonoColor(name, runway) {
    if (!name || !runway) return "blue";

    // Normalisation ID
    const id = String(name).trim().toUpperCase();

    // Récupération config piste
    const cfg = window.SONO_RUNWAY_CONFIG?.[runway];
    if (!cfg) return "blue";

    // Normalisation listes
    const greens = cfg.green.map(x => x.trim().toUpperCase());
    const reds   = cfg.red.map(x => x.trim().toUpperCase());

    // Décision couleur
    if (greens.includes(id)) return "green";
    if (reds.includes(id)) return "red";

    return "blue"; // fallback neutre
}

        const marker = L.circleMarker([s.lat, s.lon], {
            radius: 8,
            color: color,
            fillColor: color,
            fillOpacity: 0.9,
            weight: 2
        });

        marker.bindPopup(`
            <b>${s.name}</b><br>
            ${s.address}<br>
            ${s.town}<br>
            <b>${s.db} dB</b>
        `);

        group.addLayer(marker);
    });

    window._sonoLayer = group;
    group.addTo(window._map);
}

// ------------------------------------------------------
// 5) Panneau dB réel
// ------------------------------------------------------
export function updateDbPanel(payload) {
    const { runway, wind, trafficIndex, sensors } = payload;

    document.getElementById("db-runway").textContent = runway;
    document.getElementById("db-wind").textContent =
        `${wind.dir}° / ${wind.kt} kt`;
    document.getElementById("db-traffic").textContent =
        `${trafficIndex} avions`;

    const list = document.getElementById("db-list");
    list.innerHTML = "";

    sensors.forEach(s => {
        const div = document.createElement("div");
        div.className = "db-item";

        div.innerHTML = `
            <span class="db-item-name">${s.name}</span>
            <span class="db-item-value">${s.db} dB</span>
        `;

        list.appendChild(div);
    });
}

// ------------------------------------------------------
// 6) Chargement depuis backend
// ------------------------------------------------------
export async function loadSonometers() {
    try {
        const r = await fetch("/sonos");
        const json = await r.json();
window._lastSonoData = json.sensors;

        // Piste active envoyée par backend
       window.ACTIVE_RUNWAY = json.runway;

drawDynamicNoiseZones(window.ACTIVE_RUNWAY);   // ← ajout PRO+++
renderSonometers(json.sensors);
renderHeatmap(json.sensors);
updateDbPanel(json);


    } catch (err) {
        console.error("[SONO] Erreur fetch", err);
    }
}
