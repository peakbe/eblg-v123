// ======================================================
// FIDS.JS — Cockpit IFR EBLG PRO+++
// Compatible API officielle Liège Airport
// ======================================================

import { ENDPOINTS } from "./config.js";
import { fetchJSON, updateStatusPanel } from "./helpers.js";

// ------------------------------------------------------
// API PUBLIC — appelée par app.js
// ------------------------------------------------------
export async function safeLoadFids() {
    try {
        const data = await fetchJSON(ENDPOINTS.fids);

        const arrivals   = Array.isArray(data?.arrivals)   ? data.arrivals   : [];
        const departures = Array.isArray(data?.departures) ? data.departures : [];

        renderFids(arrivals, departures);
        updateStatusPanel("FIDS", { ok: true });

    } catch (err) {
        console.error("[FIDS] Erreur safeLoadFids", err);
        updateStatusPanel("FIDS", { error: true });
    }
}

// ------------------------------------------------------
// FORMAT HEURE
// ------------------------------------------------------
function formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("fr-BE", { hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------
// STATUTS ANIMÉS
// ------------------------------------------------------
function getFidsStatus(flight) {
    const now = Date.now();
    const sched = new Date(flight.date).getTime();
    const etd   = flight.eTx ? new Date(flight.eTx).getTime() : null;
    const atd   = flight.aTx ? new Date(flight.aTx).getTime() : null;

    // 1) LANDED (arrivals)
    if (flight.direction === "Arrivals" && atd) {
        return { label: "LANDED", css: "fids-status-landed" };
    }

    // 2) BOARDING (departures)
    if (flight.direction === "Departures" && etd && now > sched - 20*60000) {
        return { label: "BOARDING", css: "fids-status-boarding" };
    }

    // 3) DELAYED
    if (etd && etd > sched + 5*60000) {
        return { label: "DELAYED", css: "fids-status-delayed" };
    }

    // 4) ON TIME
    return { label: "ON TIME", css: "" };
}

// ------------------------------------------------------
// RENDU PRINCIPAL FIDS
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
            const st = getFidsStatus(f);

            arrEl.innerHTML += `
                <div class="fids-row">
                    <span class="fids-flight">${f.flightNumber}</span>
                    <span class="fids-from">${f.origin}</span>
                    <span class="fids-time">${formatTime(f.date)}</span>
                    <span class="fids-stand">${f.stand || "-"}</span>
                    <span class="fids-status ${st.css}">${st.label}</span>
                </div>
            `;
        });

    // DEPARTURES
    departures
        .sort((a,b) => new Date(a.date) - new Date(b.date))
        .forEach(f => {
            const st = getFidsStatus(f);

            depEl.innerHTML += `
                <div class="fids-row">
                    <span class="fids-flight">${f.flightNumber}</span>
                    <span class="fids-to">${f.destination}</span>
                    <span class="fids-time">${formatTime(f.date)}</span>
                    <span class="fids-stand">${f.stand || "-"}</span>
                    <span class="fids-status ${st.css}">${st.label}</span>
                </div>
            `;
        });
}

// ------------------------------------------------------
// TABS ARRIVALS / DEPARTURES
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
