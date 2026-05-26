let radarLayer = null;
const radarMarkers = new Map(); // icao24 -> marker

export async function loadRadar() {
    try {
        const r = await fetch("/radar");
        const json = await r.json();
        renderRadar(json.flights || []);
    } catch (e) {
        console.error("[RADAR] error", e);
    }
}

function renderRadar(flights) {
    if (!window._map) return;

    // création couche si besoin
    if (!radarLayer) {
        radarLayer = L.layerGroup().addTo(window._map);
    }

    const seen = new Set();

    flights.forEach(f => {
        seen.add(f.icao24);

        let marker = radarMarkers.get(f.icao24);

        if (!marker) {
            marker = L.marker([f.lat, f.lon], {
                icon: makePlaneIcon(f.heading)
            });
            marker.addTo(radarLayer);
            radarMarkers.set(f.icao24, marker);
        } else {
            marker.setLatLng([f.lat, f.lon]);
            marker.setIcon(makePlaneIcon(f.heading));
        }

        marker.bindTooltip(`${f.callsign || f.icao24}<br>${Math.round(f.alt || 0)} ft`, {
            direction: "top"
        });
    });

    // supprimer les avions qui ne sont plus dans le flux
    radarMarkers.forEach((marker, icao24) => {
        if (!seen.has(icao24)) {
            radarLayer.removeLayer(marker);
            radarMarkers.delete(icao24);
        }
    });
}

// icône avion orientée
function makePlaneIcon(heading) {
    return L.divIcon({
        className: "radar-plane",
        html: "✈",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        // rotation via CSS transform
    });
}
