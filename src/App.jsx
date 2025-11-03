import React, { useEffect, useState, useRef, useMemo } from "react";
import { MapContainer, TileLayer, GeoJSON, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix icon paths (works in many CRA setups)
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png'
});

// ENDPOINT (tu API pública en Render)
const API_URL = "https://spain-mobile-towers-api.onrender.com";

function LocateButton({ setCenter }) {
  const map = useMap();
  return (
    <button
      className="btn btn-ghost"
      onClick={() => {
        if (!navigator.geolocation) return alert("Geolocalización no soportada");
        navigator.geolocation.getCurrentPosition((pos) => {
          const lat = pos.coords.latitude, lon = pos.coords.longitude;
          map.setView([lat, lon], 13);
          setCenter([lat, lon]);
        }, (err) => alert("Error geolocalizando: " + err.message));
      }}
    >
      Mi ubicación
    </button>
  );
}

export default function App() {
  const [geojson, setGeojson] = useState(null);
  const [operators, setOperators] = useState([]);
  const [selectedOperator, setSelectedOperator] = useState("");
  const [searchText, setSearchText] = useState("");
  const [center, setCenter] = useState([40.4168, -3.7038]); // Madrid default
  const mapRef = useRef(null);

  useEffect(() => {
    async function fetchGeojson() {
      try {
        const res = await fetch(`${API_URL}/antenas/geojson`);
        if (!res.ok) throw new Error("Error " + res.status);
        const data = await res.json();
        setGeojson(data);
        // extract operators
        const ops = new Set();
        (data.features || []).forEach(f => {
          if (f.properties && f.properties.operador) ops.add(f.properties.operador);
        });
        setOperators(Array.from(ops).sort());
      } catch (err) {
        console.error(err);
        alert("Error cargando datos del servidor (ver consola)");
      }
    }
    fetchGeojson();
  }, []);

  const filtered = useMemo(() => {
    if (!geojson) return null;
    const s = (searchText || "").toLowerCase();
    return {
      type: "FeatureCollection",
      features: geojson.features.filter(ft => {
        const p = ft.properties || {};
        if (selectedOperator && p.operador && p.operador.toLowerCase() !== selectedOperator.toLowerCase()) return false;
        if (s) {
          const direccion = (p.direccion || "").toLowerCase();
          const operador = (p.operador || "").toLowerCase();
          if (!direccion.includes(s) && !operador.includes(s)) return false;
        }
        return true;
      })
    };
  }, [geojson, selectedOperator, searchText]);

  function fitToData() {
    const map = mapRef.current;
    if (!map || !filtered || filtered.features.length === 0) return;
    const bounds = L.geoJSON(filtered).getBounds();
    map.fitBounds(bounds, { padding: [50, 50] });
  }

  return (
    <div style={{height:"100vh", display:"flex", flexDirection:"column"}}>
      <header className="header">
        <div style={{fontWeight:700}}>Spain Mobile Towers Dashboard</div>
        <div style={{display:"flex", gap:10}}>
          <a style={{color:"white", textDecoration:"underline"}} href={`${API_URL}/docs`} target="_blank" rel="noreferrer">API Docs</a>
          <a style={{color:"white", textDecoration:"underline"}} href="https://github.com/ajsanchezv92/spain-mobile-towers-api" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </header>

      <div style={{display:"flex", flex:1}}>
        <aside className="controls">
          <h3>Controles</h3>

          <label className="small">Operador</label>
          <select value={selectedOperator} onChange={e => setSelectedOperator(e.target.value)} style={{width:"100%", padding:8, marginBottom:8}}>
            <option value="">— Todos —</option>
            {operators.map(op => <option key={op} value={op}>{op}</option>)}
          </select>

          <label className="small">Buscar (direccion u operador)</label>
          <input placeholder="Ej: Palma, Vodafone" value={searchText} onChange={e => setSearchText(e.target.value)} style={{width:"100%", padding:8, marginBottom:12}}/>

          <div style={{display:"flex", gap:8, marginBottom:12}}>
            <button className="btn btn-primary" onClick={fitToData}>Ajustar al mapa</button>
            <button className="btn btn-ghost" onClick={() => { setSelectedOperator(""); setSearchText(""); }}>Reset</button>
          </div>

          <div style={{marginTop:10}}>
            <small className="small">Total antenas: {geojson ? geojson.features.length : "—"}</small><br/>
            <small className="small">Filtradas: {filtered ? filtered.features.length : "—"}</small>
          </div>

          <div style={{marginTop:12}}>
            <small className="small">Tip: usa "Mi ubicación" para centrar el mapa.</small>
            <div style={{marginTop:8}}>
              {/* Locate button integrated into map via component */}
            </div>
          </div>
        </aside>

        <div style={{flex:1}}>
          <MapContainer center={center} zoom={6} style={{height:"100%", width:"100%"}} whenCreated={m => { mapRef.current = m }}>
            <TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {filtered && (
              <GeoJSON data={filtered} onEachFeature={(feature, layer) => {
                const p = feature.properties || {};
                const html = `<b>${p.operador || 'Desconocido'}</b><br/>${p.direccion || ''}<br/><a href='${p.url || '#'}' target='_blank'>Detalles</a>`;
                layer.bindPopup(html);
              }} />
            )}
            <LocateButton setCenter={setCenter} />
          </MapContainer>
        </div>
      </div>
    </div>
  );
        }
