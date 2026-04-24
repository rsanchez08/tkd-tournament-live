import { useState, useEffect, useCallback, useMemo } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SHEET_ID = "1CuWdEOdQcZ4hcA6U85nPvQ0C8CJs-OFyyMuTKhbAu3A";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Respuestas%20de%20formulario%201`;

const CINTURONES = ["Blanco", "Amarillo", "Verde", "Azul", "Rojo", "Negro"];
const CINTURON_COLORS = {
  Blanco:   { bg: "#e8e8e8", text: "#222", border: "#bbb",    glow: "rgba(200,200,200,0.4)" },
  Amarillo: { bg: "#FFD700", text: "#1a1a00", border: "#c9a800", glow: "rgba(255,215,0,0.4)" },
  Verde:    { bg: "#00C853", text: "#fff",    border: "#009624", glow: "rgba(0,200,83,0.4)" },
  Azul:     { bg: "#2979FF", text: "#fff",    border: "#0052cc", glow: "rgba(41,121,255,0.4)" },
  Rojo:     { bg: "#FF1744", text: "#fff",    border: "#c4001d", glow: "rgba(255,23,68,0.4)" },
  Negro:    { bg: "#1a1a2e", text: "#f0f0f0", border: "#555",    glow: "rgba(100,100,100,0.4)" },
};
const COMPATIBILIDAD = {
  Blanco:   ["Blanco", "Amarillo"],
  Amarillo: ["Blanco", "Amarillo", "Verde"],
  Verde:    ["Amarillo", "Verde", "Azul"],
  Azul:     ["Verde", "Azul", "Rojo", "Negro"],
  Rojo:     ["Azul", "Rojo", "Negro"],
  Negro:    ["Azul", "Rojo", "Negro"],
};

// Bracket layout constants
const MH  = 84;   // match card height
const MW  = 216;  // match card width
const MG  = 24;   // vertical gap between matches in same round
const RG  = 52;   // horizontal gap between rounds (connector space)
const U   = MH + MG; // unit = 108

const getMatchTop  = (r, i) => U * (i * Math.pow(2, r) + (Math.pow(2, r) - 1) / 2);
const getRoundX    = (r)    => r * (MW + RG);
const getTotalH    = (n)    => n * U - MG;
const getTotalW    = (rounds) => rounds * (MW + RG) - RG;

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────
const sonCompatibles = (c1, c2) =>
  COMPATIBILIDAD[c1]?.includes(c2) && COMPATIBILIDAD[c2]?.includes(c1);

const obtenerGrupoEdad = (edad) => {
  const e = parseInt(edad);
  if (e >= 13 && e <= 14) return "13-14";
  if (e >= 15 && e <= 17) return "15-17";
  if (e >= 18) return "18+";
  return "Otro";
};

const parseCSVLine = (line) => {
  const result = []; let current = ""; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i+1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) { result.push(current); current = ""; }
    else current += ch;
  }
  result.push(current);
  return result;
};

const parseCSV = (text) => {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line, idx) => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => {
      obj[h.trim().replace(/^"|"$/g, "")] = (vals[i] || "").trim().replace(/^"|"$/g, "");
    });
    obj.id = idx + 1;
    return obj;
  });
};

const normalizarAtleta = (row) => ({
  id: row.id,
  nombre:   (row["Nombre Completo"] || "").trim(),
  genero:   (row["Género"] || row["GÃ©nero"] || row["Genero"] || "").trim(),
  edad:     parseInt(row["Edad"]) || 0,
  categoria:(row["Categoría de Peso"] || row["CategorÃ­a de Peso"] || row["Categoria de Peso"] || "").trim(),
  cinturon: (row["Cinturón"] || row["CinturÃ³n"] || row["Cinturon"] || "").trim(),
  profesor: (row["Profesor"] || "").trim(),
  academia: (row["Academia"] || "").trim(),
  grupoEdad: obtenerGrupoEdad(row["Edad"]),
  timestamp:(row["Marca temporal"] || "").trim(),
});

const generarBrackets = (atletas) => {
  const grupos = {};
  atletas.forEach(a => {
    const key = `${a.genero}|${a.categoria}|${a.grupoEdad}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(a);
  });
  const brackets = [];
  const ordenCint = { Blanco:0, Amarillo:1, Verde:2, Azul:3, Rojo:4, Negro:5 };

  Object.entries(grupos).forEach(([clave, grupo]) => {
    const pools = []; const asignados = new Set();
    grupo.sort((a, b) => ordenCint[a.cinturon] - ordenCint[b.cinturon]);
    grupo.forEach(atleta => {
      if (asignados.has(atleta.id)) return;
      let found = false;
      for (const pool of pools) {
        if (pool.every(p => sonCompatibles(p.cinturon, atleta.cinturon))) {
          pool.push(atleta); asignados.add(atleta.id); found = true; break;
        }
      }
      if (!found) { pools.push([atleta]); asignados.add(atleta.id); }
    });

    pools.forEach((pool, poolIdx) => {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const n = shuffled.length;
      if (n < 1) return;
      const totalRondas = Math.ceil(Math.log2(Math.max(n, 2)));
      const tamano = Math.pow(2, totalRondas);
      const rondas = [];

      const ronda1 = [];
      let idx = 0;
      for (let i = 0; i < tamano / 2; i++) {
        const a1 = idx < shuffled.length ? shuffled[idx++] : null;
        const a2 = idx < shuffled.length ? shuffled[idx++] : null;
        ronda1.push({
          id: `${clave}-P${poolIdx}-R1-C${i}`, atletaA: a1, atletaB: a2,
          ganador: a2 === null && a1 ? a1 : a1 === null && a2 ? a2 : null,
          ronda: 1, posicion: i,
        });
      }
      rondas.push(ronda1);

      let cpr = ronda1.length;
      for (let r = 2; r <= totalRondas; r++) {
        cpr = Math.ceil(cpr / 2);
        rondas.push(Array.from({ length: cpr }, (_, i) => ({
          id: `${clave}-P${poolIdx}-R${r}-C${i}`,
          atletaA: null, atletaB: null, ganador: null, ronda: r, posicion: i,
        })));
      }

      if (rondas.length > 1) {
        rondas[0].forEach((c, i) => {
          if (c.ganador) {
            const slot = i % 2 === 0 ? "atletaA" : "atletaB";
            if (rondas[1][Math.floor(i/2)]) rondas[1][Math.floor(i/2)][slot] = c.ganador;
          }
        });
      }

      brackets.push({
        clave, poolIdx, atletas: pool, rondas, totalRondas,
        cinturones: [...new Set(pool.map(a => a.cinturon))],
      });
    });
  });
  return brackets;
};

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
const CintBadge = ({ cinturon, small }) => {
  const c = CINTURON_COLORS[cinturon] || CINTURON_COLORS.Blanco;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: small ? "1px 7px" : "3px 12px",
      borderRadius: 20, fontSize: small ? 9 : 11, fontWeight: 800,
      background: c.bg, color: c.text, border: `1.5px solid ${c.border}`,
      letterSpacing: 0.8, textTransform: "uppercase",
      boxShadow: `0 1px 6px ${c.glow}`, whiteSpace: "nowrap",
    }}>{cinturon}</span>
  );
};

const StatCard = ({ icon, value, label, color }) => (
  <div style={{
    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 14, padding: "18px 16px", textAlign: "center",
    position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: -10, right: -10, fontSize: 50, opacity: 0.06, transform: "rotate(12deg)" }}>{icon}</div>
    <div style={{ fontSize: 11, color: "#8a8ab0", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 }}>{label}</div>
    <div style={{ fontSize: 32, fontWeight: 900, color: color || "#fff", letterSpacing: -1 }}>{value}</div>
  </div>
);

// ─── BRACKET CHART ────────────────────────────────────────────────────────────
function BracketChart({ bracket, bIdx, onSelectGanador, T, getNombreRonda }) {
  const { rondas, totalRondas } = bracket;
  if (!rondas.length) return null;

  const numR0 = rondas[0].length;
  const totalH = Math.max(getTotalH(numR0), MH + 20);
  const totalW = getTotalW(totalRondas);

  // SVG connector paths
  const paths = [];
  for (let r = 0; r < rondas.length - 1; r++) {
    for (let i = 0; i < rondas[r].length; i += 2) {
      if (i + 1 >= rondas[r].length) continue;
      const yA   = getMatchTop(r, i)   + MH / 2;
      const yB   = getMatchTop(r, i+1) + MH / 2;
      const yN   = getMatchTop(r+1, i/2) + MH / 2;
      const xR   = getRoundX(r) + MW;
      const xMid = xR + RG / 2;
      const xNext= getRoundX(r+1);
      paths.push(`M${xR},${yA} H${xMid} M${xR},${yB} H${xMid} M${xMid},${yA} V${yB} M${xMid},${yN} H${xNext}`);
    }
  }

  return (
    <div style={{ position: "relative", width: totalW, height: totalH, minHeight: MH + 20 }}>
      {/* Golden connector lines */}
      <svg
        style={{ position: "absolute", top: 0, left: 0, width: totalW, height: totalH, overflow: "visible", pointerEvents: "none" }}
      >
        <defs>
          <filter id={`glow-${bIdx}`}>
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {paths.map((d, i) => (
          <path key={i} d={d} stroke="#FFD700" strokeWidth={1.5} fill="none"
            strokeLinecap="round" opacity={0.55} filter={`url(#glow-${bIdx})`} />
        ))}
      </svg>

      {/* Round labels row */}
      {rondas.map((_, rIdx) => (
        <div key={`label-${rIdx}`} style={{
          position: "absolute", top: -28, left: getRoundX(rIdx), width: MW,
          textAlign: "center", fontSize: 9, fontWeight: 800,
          color: T.gold, textTransform: "uppercase", letterSpacing: 2,
        }}>
          {getNombreRonda(rIdx, totalRondas)}
        </div>
      ))}

      {/* Match cards */}
      {rondas.map((ronda, rIdx) =>
        ronda.map((combate, cIdx) => {
          const top  = getMatchTop(rIdx, cIdx);
          const left = getRoundX(rIdx);
          const isClickableA = combate.atletaA && combate.atletaB && !combate.ganador;
          const isClickableB = combate.atletaA && combate.atletaB && !combate.ganador;
          const winA = combate.ganador?.id === combate.atletaA?.id;
          const winB = combate.ganador?.id === combate.atletaB?.id;

          return (
            <div key={combate.id} style={{
              position: "absolute", top, left, width: MW, height: MH,
              borderRadius: 8, overflow: "hidden",
              border: combate.ganador
                ? "1px solid rgba(255,215,0,0.35)"
                : "1px solid rgba(255,255,255,0.08)",
              background: combate.ganador
                ? "linear-gradient(135deg, rgba(255,215,0,0.06), rgba(20,20,40,0.95))"
                : "linear-gradient(135deg, rgba(30,30,55,0.95), rgba(15,15,35,0.98))",
              boxShadow: combate.ganador
                ? "0 0 16px rgba(255,215,0,0.12)"
                : "0 2px 12px rgba(0,0,0,0.4)",
              display: "flex", flexDirection: "column",
            }}>
              {/* Atleta A */}
              <div
                onClick={() => isClickableA && onSelectGanador(bIdx, rIdx, cIdx, combate.atletaA)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
                  cursor: isClickableA ? "pointer" : "default",
                  background: winA ? "rgba(255,215,0,0.08)" : "transparent",
                  borderLeft: winA ? "3px solid #FFD700" : "3px solid transparent",
                  opacity: combate.ganador && !winA ? 0.38 : 1,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: winA ? "#FFD700" : "#e4e4f0" }}>
                    {combate.atletaA?.nombre || <span style={{ color: "#444", fontStyle: "italic" }}>Esperando…</span>}
                  </div>
                  {combate.atletaA && <div style={{ fontSize: 9, color: "#5a5a80", marginTop: 1 }}>{combate.atletaA.academia}</div>}
                </div>
                {combate.atletaA && <CintBadge cinturon={combate.atletaA.cinturon} small />}
                {winA && <span style={{ fontSize: 11, marginLeft: 2 }}>🏆</span>}
              </div>

              {/* VS divider */}
              <div style={{
                height: 16, display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(255,215,0,0.05)", borderTop: "1px solid rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.04)",
                fontSize: 8, fontWeight: 900, color: "#FFD700", letterSpacing: 3,
              }}>VS</div>

              {/* Atleta B */}
              <div
                onClick={() => isClickableB && onSelectGanador(bIdx, rIdx, cIdx, combate.atletaB)}
                style={{
                  flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "0 10px",
                  cursor: isClickableB ? "pointer" : "default",
                  background: winB ? "rgba(255,215,0,0.08)" : "transparent",
                  borderLeft: winB ? "3px solid #FFD700" : "3px solid transparent",
                  opacity: combate.ganador && !winB ? 0.38 : 1,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: winB ? "#FFD700" : "#e4e4f0" }}>
                    {combate.atletaB
                      ? combate.atletaB.nombre
                      : combate.atletaA && !combate.atletaB && combate.ganador
                        ? <span style={{ color: "#444" }}>BYE</span>
                        : <span style={{ color: "#444", fontStyle: "italic" }}>Esperando…</span>}
                  </div>
                  {combate.atletaB && <div style={{ fontSize: 9, color: "#5a5a80", marginTop: 1 }}>{combate.atletaB.academia}</div>}
                </div>
                {combate.atletaB && <CintBadge cinturon={combate.atletaB.cinturon} small />}
                {winB && <span style={{ fontSize: 11, marginLeft: 2 }}>🏆</span>}
              </div>

              {/* Reset button */}
              {combate.ganador && combate.atletaA && combate.atletaB && (
                <button
                  onClick={() => onSelectGanador(bIdx, rIdx, cIdx, null)}
                  style={{
                    position: "absolute", bottom: 2, right: 4,
                    background: "none", border: "none", color: "#444",
                    cursor: "pointer", fontSize: 8, padding: "1px 4px",
                  }}
                >↩</button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── MULTI FILTER BAR ─────────────────────────────────────────────────────────
function FiltroBtn({ label, active, color, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: "5px 11px", borderRadius: 6, border: active ? "1.5px solid" : "1px solid rgba(255,255,255,0.08)",
      borderColor: active ? (color || "#FFD700") : "transparent",
      cursor: "pointer", fontSize: 10, fontWeight: 700,
      background: active ? `${color || "#FFD700"}18` : "rgba(255,255,255,0.03)",
      color: active ? (color || "#FFD700") : "#6a6a90",
      transition: "all 0.15s",
    }}>{label}</button>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function TKDTournament() {
  const [atletas, setAtletas] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [vista, setVista]       = useState("dashboard");
  const [brackets, setBrackets] = useState([]);

  // Multi-select filters
  const [filtros, setFiltros] = useState({ cinturones: [], generos: [], edades: [], categorias: [] });

  const T = {
    bg: "#07071a", card: "#0f0f26", accent: "#FF1744",
    accentSoft: "rgba(255,23,68,0.1)", gold: "#FFD700",
    text: "#e4e4f0", muted: "#6a6a90", border: "#1a1a38",
    success: "#00E676", surface: "rgba(255,255,255,0.025)",
  };

  const toggleFiltro = (tipo, valor) => {
    setFiltros(prev => ({
      ...prev,
      [tipo]: prev[tipo].includes(valor)
        ? prev[tipo].filter(v => v !== valor)
        : [...prev[tipo], valor],
    }));
  };
  const limpiarFiltros = () => setFiltros({ cinturones: [], generos: [], edades: [], categorias: [] });
  const hayFiltros = Object.values(filtros).some(arr => arr.length > 0);

  const cargarDatos = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error("No se pudo acceder al spreadsheet.");
      const text = await res.text();
      const lista = parseCSV(text).map(normalizarAtleta).filter(a => a.nombre);
      setAtletas(lista);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
      setAtletas([
        { id:1, nombre:"René Sánchez",   genero:"Masculino", edad:24, categoria:"-67 kg", cinturon:"Rojo",     profesor:"Nayib Diaz",  academia:"AVS ALAJUELA", grupoEdad:"18+", timestamp:"" },
        { id:2, nombre:"Johan Aguirre",  genero:"Masculino", edad:23, categoria:"-67 kg", cinturon:"Azul",     profesor:"Nayib Diaz",  academia:"AVS ALAJUELA", grupoEdad:"18+", timestamp:"" },
        { id:3, nombre:"Vicente Otey",   genero:"Masculino", edad:20, categoria:"-67 kg", cinturon:"Azul",     profesor:"Nayib Díaz",  academia:"AVS TKD",      grupoEdad:"18+", timestamp:"" },
        { id:4, nombre:"Kailena Vásquez",genero:"Femenino",  edad:17, categoria:"-63 kg", cinturon:"Azul",     profesor:"Nayib Diaz",  academia:"AVS ALAJUELA", grupoEdad:"15-17", timestamp:"" },
        { id:5, nombre:"Mary Paz",       genero:"Femenino",  edad:15, categoria:"-53 kg", cinturon:"Azul",     profesor:"Nayib Díaz",  academia:"AVS TKD",      grupoEdad:"15-17", timestamp:"" },
        { id:6, nombre:"Francinie",      genero:"Femenino",  edad:21, categoria:"-63 kg", cinturon:"Amarillo", profesor:"Nayib Díaz",  academia:"AVS TKD",      grupoEdad:"18+", timestamp:"" },
      ]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const stats = useMemo(() => {
    const masc = atletas.filter(a => a.genero === "Masculino").length;
    const fem  = atletas.filter(a => a.genero === "Femenino").length;
    const academias = [...new Set(atletas.map(a => a.academia))];
    const cinturones = {};
    atletas.forEach(a => { cinturones[a.cinturon] = (cinturones[a.cinturon] || 0) + 1; });
    return { total: atletas.length, masc, fem, academias, cinturones };
  }, [atletas]);

  const atletasFiltrados = useMemo(() => {
    return atletas.filter(a => {
      if (filtros.cinturones.length > 0 && !filtros.cinturones.includes(a.cinturon)) return false;
      if (filtros.generos.length  > 0 && !filtros.generos.includes(a.genero))    return false;
      if (filtros.edades.length   > 0 && !filtros.edades.includes(a.grupoEdad))  return false;
      if (filtros.categorias.length > 0 && !filtros.categorias.includes(a.categoria)) return false;
      return true;
    });
  }, [atletas, filtros]);

  const handleGenerarBrackets = () => { setBrackets(generarBrackets(atletas)); setVista("brackets"); };

  const seleccionarGanador = (bracketIdx, rondaIdx, combateIdx, ganador) => {
    setBrackets(prev => {
      const copia = JSON.parse(JSON.stringify(prev));
      const bracket = copia[bracketIdx];
      const combate = bracket.rondas[rondaIdx][combateIdx];

      if (combate.ganador && rondaIdx + 1 < bracket.rondas.length) {
        const nPos = Math.floor(combateIdx / 2);
        const slot = combateIdx % 2 === 0 ? "atletaA" : "atletaB";
        if (bracket.rondas[rondaIdx+1][nPos]) {
          bracket.rondas[rondaIdx+1][nPos][slot] = null;
          bracket.rondas[rondaIdx+1][nPos].ganador = null;
          for (let r = rondaIdx + 2; r < bracket.rondas.length; r++)
            bracket.rondas[r].forEach(c => { c.atletaA = null; c.atletaB = null; c.ganador = null; });
        }
      }
      combate.ganador = ganador;
      if (ganador && rondaIdx + 1 < bracket.rondas.length) {
        const nPos = Math.floor(combateIdx / 2);
        const slot = combateIdx % 2 === 0 ? "atletaA" : "atletaB";
        if (bracket.rondas[rondaIdx+1][nPos]) bracket.rondas[rondaIdx+1][nPos][slot] = ganador;
      }
      return copia;
    });
  };

  const getNombreRonda = (rIdx, total) => {
    const d = total - rIdx;
    if (d === 1) return "FINAL";
    if (d === 2) return "Semifinal";
    if (d === 3) return "Cuartos";
    return `Ronda ${rIdx + 1}`;
  };

  // ─── HEADER ───────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <div style={{
      background: `linear-gradient(90deg, ${T.card} 0%, rgba(255,215,0,0.02) 100%)`,
      borderBottom: `1px solid ${T.border}`, padding: "12px 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 100,
      backdropFilter: "blur(20px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: "linear-gradient(135deg, #FF1744, #c0001d)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, boxShadow: "0 0 20px rgba(255,23,68,0.4)",
        }}>🥋</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.3, color: T.text }}>PTF Tournament</div>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>Sistema de Brackets</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {[
          { id: "dashboard", label: "Dashboard", icon: "📊" },
          { id: "atletas",   label: "Atletas",   icon: "🥋" },
          { id: "brackets",  label: "Brackets",  icon: "🏆" },
        ].map(v => (
          <button key={v.id} onClick={() => setVista(v.id)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700,
            background: vista === v.id ? T.accent : "transparent",
            color: vista === v.id ? "#fff" : T.muted,
            transition: "all 0.2s",
          }}>
            {v.icon} {v.label}
            {v.id === "atletas" && atletas.length > 0 && (
              <span style={{
                marginLeft: 4, padding: "1px 6px", borderRadius: 10,
                background: vista === v.id ? "rgba(255,255,255,0.2)" : T.accentSoft,
                fontSize: 10, fontWeight: 800,
              }}>{atletas.length}</span>
            )}
          </button>
        ))}
      </div>

      <button onClick={cargarDatos} style={{
        padding: "7px 14px", borderRadius: 8, border: `1px solid ${T.border}`,
        cursor: "pointer", fontSize: 11, fontWeight: 700,
        background: T.surface, color: T.muted,
      }}>🔄 Actualizar</button>
    </div>
  );

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: T.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12, animation: "spin 1s linear infinite" }}>🥋</div>
          <div>Cargando desde Google Sheets…</div>
        </div>
      )}
      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 10, marginBottom: 16, background: T.accentSoft, border: `1px solid rgba(255,23,68,0.2)`, color: T.accent, fontSize: 13 }}>
          ⚠️ {error} — Usando datos de respaldo.
        </div>
      )}

      <div style={{ textAlign: "center", padding: "28px 0 20px" }}>
        <div style={{ fontSize: 52, marginBottom: 8, filter: "drop-shadow(0 0 24px rgba(255,23,68,0.4))" }}>🥋</div>
        <h1 style={{
          fontSize: 30, fontWeight: 900, margin: 0,
          background: `linear-gradient(135deg, #fff 30%, ${T.accent})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Torneo PTF Taekwondo</h1>
        <p style={{ color: T.muted, fontSize: 13, marginTop: 6 }}>Inscripciones via Google Form → brackets automáticos</p>
        {lastUpdate && <div style={{ fontSize: 10, color: T.muted, marginTop: 6 }}>Actualizado: {lastUpdate.toLocaleTimeString("es-CR")}</div>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 20 }}>
        <StatCard icon="🤼" value={stats.total} label="Total Atletas" color={T.accent} />
        <StatCard icon="♂"  value={stats.masc}  label="Masculino"    color="#2979FF" />
        <StatCard icon="♀"  value={stats.fem}   label="Femenino"     color="#FF4081" />
        <StatCard icon="🏫" value={stats.academias.length} label="Academias" color={T.gold} />
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>Por Cinturón</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CINTURONES.map(c => (
            <div key={c} onClick={() => { toggleFiltro("cinturones", c); setVista("atletas"); }} style={{
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              padding: "7px 12px", borderRadius: 8, background: T.surface,
              border: `1px solid ${T.border}`, transition: "all 0.2s",
            }}>
              <CintBadge cinturon={c} small />
              <span style={{ fontSize: 16, fontWeight: 900, color: "#fff" }}>{stats.cinturones[c] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>Academias</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stats.academias.map(ac => {
            const count = atletas.filter(a => a.academia === ac).length;
            return (
              <div key={ac} onClick={() => { setVista("atletas"); }} style={{
                cursor: "pointer", padding: "8px 14px", borderRadius: 8,
                background: T.surface, border: `1px solid ${T.border}`, transition: "all 0.2s",
              }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{ac}</div>
                <div style={{ fontSize: 10, color: T.muted }}>{count} atleta{count !== 1 ? "s" : ""}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <button onClick={handleGenerarBrackets} disabled={atletas.length < 2} style={{
          padding: "13px 32px", borderRadius: 12, border: "none",
          cursor: atletas.length < 2 ? "not-allowed" : "pointer",
          fontSize: 14, fontWeight: 800, letterSpacing: 0.5,
          background: atletas.length < 2 ? T.border : `linear-gradient(135deg, ${T.accent}, #c0001d)`,
          color: "#fff", boxShadow: atletas.length >= 2 ? "0 6px 24px rgba(255,23,68,0.4)" : "none",
          transition: "all 0.3s",
        }}>🏆 Generar Brackets ({atletas.length} atletas)</button>
      </div>
    </div>
  );

  // ─── ATLETAS ──────────────────────────────────────────────────────────────
  const renderAtletas = () => {
    const categorias = [...new Set(atletas.map(a => a.categoria))].sort();

    return (
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: T.text }}>
            Atletas Inscritos
            <span style={{ fontSize: 13, fontWeight: 400, color: T.muted, marginLeft: 8 }}>
              {atletasFiltrados.length}{hayFiltros ? ` de ${atletas.length}` : ""}
            </span>
          </h2>
          {hayFiltros && (
            <button onClick={limpiarFiltros} style={{
              padding: "5px 14px", borderRadius: 8, border: `1px solid rgba(255,23,68,0.3)`,
              background: T.accentSoft, color: T.accent, cursor: "pointer", fontSize: 11, fontWeight: 700,
            }}>✕ Limpiar filtros</button>
          )}
        </div>

        {/* ─ FILTROS ─ */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
          {/* Cinturón */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, minWidth: 62 }}>Cinturón</span>
            {CINTURONES.map(c => (
              <FiltroBtn
                key={c} label={c}
                active={filtros.cinturones.includes(c)}
                color={CINTURON_COLORS[c]?.bg === "#f8f8f8" ? "#ccc" : CINTURON_COLORS[c]?.bg}
                onClick={() => toggleFiltro("cinturones", c)}
              />
            ))}
          </div>

          {/* Género */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, minWidth: 62 }}>Género</span>
            <FiltroBtn label="♂ Masculino" active={filtros.generos.includes("Masculino")} color="#2979FF" onClick={() => toggleFiltro("generos", "Masculino")} />
            <FiltroBtn label="♀ Femenino"  active={filtros.generos.includes("Femenino")}  color="#FF4081" onClick={() => toggleFiltro("generos", "Femenino")} />
          </div>

          {/* Edad */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, minWidth: 62 }}>Edad</span>
            {["13-14", "15-17", "18+"].map(e => (
              <FiltroBtn key={e} label={e} active={filtros.edades.includes(e)} color={T.gold} onClick={() => toggleFiltro("edades", e)} />
            ))}
          </div>

          {/* Categoría de peso */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: T.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, minWidth: 62 }}>Peso</span>
            {categorias.map(cat => (
              <FiltroBtn key={cat} label={cat} active={filtros.categorias.includes(cat)} color="#00E676" onClick={() => toggleFiltro("categorias", cat)} />
            ))}
          </div>
        </div>

        {/* Chips de filtros activos */}
        {hayFiltros && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            <span style={{ fontSize: 10, color: T.muted, alignSelf: "center" }}>Filtros:</span>
            {Object.entries(filtros).flatMap(([tipo, vals]) =>
              vals.map(v => (
                <span key={`${tipo}-${v}`} onClick={() => toggleFiltro(tipo, v)} style={{
                  padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: "rgba(255,215,0,0.1)", border: "1px solid rgba(255,215,0,0.25)",
                  color: T.gold, cursor: "pointer",
                }}>{v} ✕</span>
              ))
            )}
          </div>
        )}

        {/* Tabla */}
        <div style={{ background: T.card, borderRadius: 12, border: `1px solid ${T.border}`, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                  {["#", "Nombre", "Género", "Edad", "Grupo", "Peso", "Cinturón", "Profesor", "Academia"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: T.muted, fontWeight: 700, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atletasFiltrados.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: `1px solid ${T.border}22`, background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)" }}>
                    <td style={{ padding: "9px 12px", color: T.muted, fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ padding: "9px 12px", fontWeight: 700, color: T.text }}>{a.nombre}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{
                        padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                        background: a.genero === "Masculino" ? "rgba(41,121,255,0.12)" : "rgba(255,64,129,0.12)",
                        color: a.genero === "Masculino" ? "#2979FF" : "#FF4081",
                      }}>{a.genero === "Masculino" ? "♂ M" : "♀ F"}</span>
                    </td>
                    <td style={{ padding: "9px 12px", color: T.text }}>{a.edad}</td>
                    <td style={{ padding: "9px 12px" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(255,215,0,0.08)", color: T.gold }}>{a.grupoEdad}</span>
                    </td>
                    <td style={{ padding: "9px 12px", fontWeight: 600, color: T.text }}>{a.categoria}</td>
                    <td style={{ padding: "9px 12px" }}><CintBadge cinturon={a.cinturon} small /></td>
                    <td style={{ padding: "9px 12px", color: T.muted }}>{a.profesor}</td>
                    <td style={{ padding: "9px 12px", color: T.muted }}>{a.academia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {atletasFiltrados.length === 0 && (
            <div style={{ textAlign: "center", padding: 40, color: T.muted }}>No hay atletas con esa combinación de filtros</div>
          )}
        </div>
      </div>
    );
  };

  // ─── BRACKETS ─────────────────────────────────────────────────────────────
  const renderBrackets = () => {
    if (brackets.length === 0) {
      return (
        <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.3 }}>🏆</div>
          <div style={{ color: T.muted, fontSize: 16, marginBottom: 24 }}>No hay brackets generados aún</div>
          <button onClick={handleGenerarBrackets} style={{
            padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 700, color: "#fff",
            background: `linear-gradient(135deg, ${T.accent}, #c0001d)`,
            boxShadow: "0 4px 16px rgba(255,23,68,0.3)",
          }}>Generar Brackets</button>
        </div>
      );
    }

    const parseClave = c => { const [g, p, e] = c.split("|"); return { genero: g, peso: p, edad: e }; };

    return (
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
        {/* Page header */}
        <div style={{
          textAlign: "center", marginBottom: 32,
          padding: "24px 16px",
          background: "linear-gradient(180deg, rgba(255,215,0,0.04) 0%, transparent 100%)",
          borderBottom: `1px solid rgba(255,215,0,0.08)`,
        }}>
          <div style={{ fontSize: 11, color: T.gold, letterSpacing: 3, textTransform: "uppercase", marginBottom: 6, fontWeight: 700 }}>Tournament Bracket</div>
          <div style={{ fontSize: 32, fontWeight: 900, color: T.gold, letterSpacing: 4, textTransform: "uppercase", textShadow: "0 0 40px rgba(255,215,0,0.3)" }}>
            PTF TAEKWONDO
          </div>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 16 }}>
            <button onClick={() => setBrackets(generarBrackets(atletas))} style={{
              padding: "8px 18px", borderRadius: 8, border: `1px solid rgba(255,215,0,0.25)`,
              background: "rgba(255,215,0,0.06)", color: T.gold, cursor: "pointer",
              fontSize: 12, fontWeight: 700,
            }}>🔀 Re-sortear</button>
          </div>
        </div>

        {brackets.map((bracket, bIdx) => {
          const info = parseClave(bracket.clave);
          const campeon = bracket.rondas[bracket.rondas.length - 1]?.[0]?.ganador;

          return (
            <div key={bIdx} style={{
              marginBottom: 36,
              background: "linear-gradient(135deg, rgba(10,10,28,0.98), rgba(5,5,20,0.99))",
              border: campeon ? "1px solid rgba(255,215,0,0.25)" : `1px solid ${T.border}`,
              borderRadius: 16, overflow: "hidden",
              boxShadow: campeon ? "0 0 40px rgba(255,215,0,0.06)" : "0 4px 24px rgba(0,0,0,0.4)",
            }}>
              {/* Bracket header */}
              <div style={{
                padding: "16px 20px",
                background: "linear-gradient(90deg, rgba(255,215,0,0.05), transparent)",
                borderBottom: `1px solid rgba(255,215,0,0.08)`,
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, fontSize: 18,
                    background: info.genero === "Masculino" ? "rgba(41,121,255,0.1)" : "rgba(255,64,129,0.1)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{info.genero === "Masculino" ? "♂" : "♀"}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>{info.genero} · {info.peso}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>Edad {info.edad} · {bracket.atletas.length} atletas</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  {bracket.cinturones.map(c => <CintBadge key={c} cinturon={c} small />)}
                </div>
              </div>

              {/* Champion banner */}
              {campeon && (
                <div style={{
                  margin: "16px 20px", padding: "14px 20px",
                  background: "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(255,215,0,0.03))",
                  borderRadius: 10, border: "1px solid rgba(255,215,0,0.2)",
                  display: "flex", alignItems: "center", gap: 14,
                }}>
                  <div style={{ fontSize: 32, filter: "drop-shadow(0 0 12px rgba(255,215,0,0.6))" }}>🏆</div>
                  <div>
                    <div style={{ fontSize: 9, color: T.gold, textTransform: "uppercase", fontWeight: 800, letterSpacing: 2, marginBottom: 3 }}>Campeón</div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: T.gold }}>{campeon.nombre}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{campeon.academia}</div>
                  </div>
                  <CintBadge cinturon={campeon.cinturon} />
                </div>
              )}

              {/* Bracket chart */}
              <div style={{ padding: "36px 20px 20px", overflowX: "auto" }}>
                <BracketChart
                  bracket={bracket}
                  bIdx={bIdx}
                  onSelectGanador={seleccionarGanador}
                  T={T}
                  getNombreRonda={getNombreRonda}
                />
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── ROOT ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh",
      background: `radial-gradient(ellipse at top, #0d0d2a 0%, ${T.bg} 60%)`,
      color: T.text,
      fontFamily: "'Segoe UI', -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
        button:hover { filter: brightness(1.15); }
        tr:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>
      {renderHeader()}
      {vista === "dashboard" && renderDashboard()}
      {vista === "atletas"   && renderAtletas()}
      {vista === "brackets"  && renderBrackets()}
    </div>
  );
}
