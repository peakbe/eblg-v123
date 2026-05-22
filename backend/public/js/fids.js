// ======================================================
// FIDS.JS — Cockpit IFR EBLG PRO+++
// Compatible API officielle Liège Airport
// ======================================================
const AIRLINE_LOGOS = {
    "TNT": "tnt.png",
    "ASL": "tnt.png",
    "QATAR": "qatar.png",
    "ETHIOPIAN": "ethiopian.png",
    "FEDEX": "fedex.png",
    "FX": "fedex.png"
};

import { ENDPOINTS } from "./config.js";
import { fetchJSON, updateStatusPanel } from "./helpers.js";

// ------------------------------------------------------
// API PUBLIC — appelée par app.js
// ------------------------------------------------------
export async function safeLoadFids() {
    try {
        const data = await fetchJSON(ENDPOINTS.fids);

        // Sécurisation PRO+++
        const arrivals   = Array.isArray(data?.arrivals)   ? data.arrivals   : [];
        const departures = Array.isArray(data?.departures) ? data.departures : [];

        if (arrivals.length === 0 && departures.length === 0) {
            console.warn("[FIDS] Aucun vol reçu", data);
            updateStatusPanel("FIDS", { error: true });
            return;
        }

        renderFids(arrivals, departures);
        updateStatusPanel("FIDS", { ok: true });

    } catch (err) {
        console.error("[FIDS] Erreur safeLoadFids", err);
        updateStatusPanel("FIDS", { error: true });
    }
}


// ------------------------------------------------------
// RENDU PRINCIPAL
// ------------------------------------------------------
export function renderFids(arrivals, departures) {

    const arrEl = document.getElementById("fids-arrivals");
    const depEl = document.getElementById("fids-departures");

    arrEl.innerHTML = "";
    depEl.innerHTML = "";

    // ARRIVALS
    arrivals
        .sort((a,b) => new Date(a.date) - new Date(b.date))
        .forEach(f => {
            arrEl.innerHTML += `
                <div class="fids-row">
                    <span class="fids-flight">${f.flightNumber}</span>
                    <span class="fids-from">${f.origin}</span>
                    <span class="fids-time">${formatTime(f.date)}</span>
                    <span class="fids-stand">${f.stand || "-"}</span>
                </div>
            `;
        });

    // DEPARTURES
    departures
        .sort((a,b) => new Date(a.date) - new Date(b.date))
        .forEach(f => {
            depEl.innerHTML += `
                <div class="fids-row">
                    <span class="fids-flight">${f.flightNumber}</span>
                    <span class="fids-to">${f.destination}</span>
                    <span class="fids-time">${formatTime(f.date)}</span>
                    <span class="fids-stand">${f.stand || "-"}</span>
                </div>
            `;
        });
}

// ------------------------------------------------------
// TRI PAR HEURE (ETA / ETD / Scheduled)
// ------------------------------------------------------
function sortByTime(list) {
    list.sort((a, b) => {
        const ta = getTimeValue(a);
        const tb = getTimeValue(b);
        return ta - tb;
    });
}

function getTimeValue(f) {
    const t = f.estimated || f.scheduled || "";
    return parseTimeToMinutes(t);
}

function parseTimeToMinutes(t) {
    if (!t || typeof t !== "string") return 999999;
    const m = t.match(/(\d{2}):(\d{2})/);
    if (!m) return 999999;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// ------------------------------------------------------
// RENDU SECTION
// ------------------------------------------------------
function renderSection(title, flights) {
    if (!flights.length) {
        return `
            <div class="fids-section">
                <div class="fids-title">${title}</div>
                <div class="fids-empty">Aucun vol</div>
            </div>
        `;
    }

    return `
        <div class="fids-section">
            <div class="fids-title">${title}</div>
            ${flights.map(renderFlight).join("")}
        </div>
    `;
}

// ------------------------------------------------------
// RENDU VOL
// ------------------------------------------------------
function renderFlight(f) {
    const statusClass = getStatusClass(f.status);
    const time = f.estimated || f.scheduled || "--:--";
    const logo = getAirlineLogo(f);

    return `
        <div class="fids-row ${statusClass}">
            <div class="fids-col time">${time}</div>
            <div class="fids-col flight">
                ${logo ? `<img class="fids-logo" src="${logo}" />` : ""}
                ${f.flight || ""}
            </div>
            <div class="fids-col city">${f.city || ""}</div>
            <div class="fids-col status">${f.status || ""}</div>
        </div>
    `;
}


// ------------------------------------------------------
// COULEURS ATC
// ------------------------------------------------------
function getStatusClass(s) {
    if (!s) return "st-unknown";

    s = s.toUpperCase();

    if (s.includes("CANCEL")) return "st-cancel";
    if (s.includes("DELAY")) return "st-delay";
    if (s.includes("BOARD")) return "st-boarding";
    if (s.includes("FINAL")) return "st-final";
    if (s.includes("LANDED")) return "st-landed";
    if (s.includes("ON TIME") || s.includes("ONTIME")) return "st-ontime";

    return "st-unknown";
}

// ------------------------------------------------------
// utilitaire pour trouver le bon logo
// ------------------------------------------------------
function getAirlineLogo(flight) {
    if (!flight || !flight.airline) return null;

    const name = flight.airline.toUpperCase();

    for (const key in AIRLINE_LOGOS) {
        if (name.includes(key)) {
            return `/assets/logos/${AIRLINE_LOGOS[key]}`;
        }
    }

    return null;
}

// ------------------------------------------------------
// Logique JS pour afficher Arrivées / Départs
// ------------------------------------------------------
export function initFidsTabs() {
    const tabs = document.querySelectorAll("[data-fids]");
    const arr = document.getElementById("fids-arrivals");
    const dep = document.getElementById("fids-departures");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");

            const mode = tab.getAttribute("data-fids");

            if (mode === "arrivals") {
                arr.style.display = "block";
                dep.style.display = "none";
            } else {
                arr.style.display = "none";
                dep.style.display = "block";
            }
        });
    });
}

