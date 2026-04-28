import { useState, useEffect, useCallback, useMemo } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SHEET_ID = "1CuWdEOdQcZ4hcA6U85nPvQ0C8CJs-OFyyMuTKhbAu3A";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Respuestas%20de%20formulario%201`;

// ─── PTF CATEGORÍAS OFICIALES ─────────────────────────────────────────────────
const GRUPOS_EDAD = ["Infantil", "Cadete", "Juvenil", "Adulto"];

const CATEGORIAS_PTF = {
  Infantil: {
    Masculino: ["-20 kg","-25 kg","-30 kg","-35 kg","-40 kg","+40 kg"],
    Femenino:  ["-20 kg","-25 kg","-30 kg","-35 kg","-40 kg","+40 kg"],
  },
  Cadete: {
    Masculino: ["-35 kg","-40 kg","-45 kg","-50 kg","-55 kg","-60 kg","+60 kg"],
    Femenino:  ["-35 kg","-40 kg","-45 kg","-50 kg","-55 kg","+55 kg"],
  },
  Juvenil: {
    Masculino: ["-45 kg","-51 kg","-57 kg","-63 kg","-69 kg","-75 kg","+75 kg"],
    Femenino:  ["-40 kg","-46 kg","-52 kg","-58 kg","-64 kg","-70 kg","+70 kg"],
  },
  Adulto: {
    Masculino: ["-57 kg","-63 kg","-71 kg","-80 kg","+80 kg"],
    Femenino:  ["-50 kg","-56 kg","-62 kg","-68 kg","+68 kg"],
  },
};

const GRUPO_COLORS = {
  Infantil: { bg:"#FF9800", text:"#000", border:"#e65c00", soft:"rgba(255,152,0,0.13)", glow:"rgba(255,152,0,0.3)" },
  Cadete:   { bg:"#9C27B0", text:"#fff", border:"#6a0080", soft:"rgba(156,39,176,0.13)", glow:"rgba(156,39,176,0.3)" },
  Juvenil:  { bg:"#1565C0", text:"#fff", border:"#003c8f", soft:"rgba(21,101,192,0.13)", glow:"rgba(21,101,192,0.3)" },
  Adulto:   { bg:"#CE1126", text:"#fff", border:"#8b000d", soft:"rgba(206,17,38,0.13)", glow:"rgba(206,17,38,0.3)" },
};

const CINTURONES = ["Blanco","Amarillo","Verde","Azul","Rojo","Negro"];
const CINTURON_COLORS = {
  Blanco:   { bg:"#e8e8e8", text:"#222", border:"#bbb",    glow:"rgba(200,200,200,0.4)" },
  Amarillo: { bg:"#FFD700", text:"#1a1a00", border:"#c9a800", glow:"rgba(255,215,0,0.4)" },
  Verde:    { bg:"#00C853", text:"#fff",  border:"#009624", glow:"rgba(0,200,83,0.4)" },
  Azul:     { bg:"#2979FF", text:"#fff",  border:"#0052cc", glow:"rgba(41,121,255,0.4)" },
  Rojo:     { bg:"#CE1126", text:"#fff",  border:"#8b000d", glow:"rgba(206,17,38,0.4)" },
  Negro:    { bg:"#1a1a2e", text:"#f0f0f0", border:"#555", glow:"rgba(100,100,100,0.4)" },
};
const COMPATIBILIDAD = {
  Blanco:   ["Blanco","Amarillo"],
  Amarillo: ["Blanco","Amarillo","Verde"],
  Verde:    ["Amarillo","Verde","Azul"],
  Azul:     ["Verde","Azul","Rojo","Negro"],
  Rojo:     ["Azul","Rojo","Negro"],
  Negro:    ["Azul","Rojo","Negro"],
};

// ─── BRACKET LAYOUT ───────────────────────────────────────────────────────────
const MH = 84, MW = 216, MG = 24, RG = 52, U = MH + MG;
const getMatchTop = (r, i) => U * (i * Math.pow(2, r) + (Math.pow(2, r) - 1) / 2);
const getRoundX   = (r)    => r * (MW + RG);
const getTotalH   = (n)    => n * U - MG;
const getTotalW   = (rds)  => rds * (MW + RG) - RG;

// ─── DATA HELPERS ─────────────────────────────────────────────────────────────
const sonCompatibles = (c1, c2) =>
  COMPATIBILIDAD[c1]?.includes(c2) && COMPATIBILIDAD[c2]?.includes(c1);

const obtenerGrupoEdad = (edad) => {
  const e = parseInt(edad);
  if (e < 12)              return "Infantil";
  if (e >= 12 && e <= 14) return "Cadete";
  if (e >= 15 && e <= 17) return "Juvenil";
  if (e >= 18)            return "Adulto";
  return "Infantil";
};

const parseCSVLine = (line) => {
  const result = []; let cur = ""; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { if (inQ && line[i+1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ""; }
    else cur += ch;
  }
  result.push(cur); return result;
};

const parseCSV = (text) => {
  const lines = text.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  return lines.slice(1).map((line, idx) => {
    const vals = parseCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim().replace(/^"|"$/g,"")] = (vals[i]||"").trim().replace(/^"|"$/g,""); });
    obj.id = idx + 1; return obj;
  });
};

const normalizarAtleta = (row) => ({
  id:        row.id,
  nombre:    (row["Nombre Completo"]||"").trim(),
  genero:    (row["Género"]||row["GÃ©nero"]||row["Genero"]||"").trim(),
  edad:      parseInt(row["Edad"])||0,
  categoria: (row["Categoría de Peso"]||row["CategorÃ­a de Peso"]||row["Categoria de Peso"]||"").trim(),
  cinturon:  (row["Cinturón"]||row["CinturÃ³n"]||row["Cinturon"]||"").trim(),
  profesor:  (row["Profesor"]||"").trim(),
  academia:  (row["Academia"]||"").trim(),
  grupoEdad: obtenerGrupoEdad(row["Edad"]),
  timestamp: (row["Marca temporal"]||"").trim(),
});

const generarBrackets = (atletas) => {
  const grupos = {};
  atletas.forEach(a => {
    const k = `${a.genero}|${a.categoria}|${a.grupoEdad}`;
    if (!grupos[k]) grupos[k] = []; grupos[k].push(a);
  });
  const brackets = [];
  const ordenC = { Blanco:0,Amarillo:1,Verde:2,Azul:3,Rojo:4,Negro:5 };

  Object.entries(grupos).forEach(([clave, grupo]) => {
    const pools = []; const seen = new Set();
    grupo.sort((a,b) => ordenC[a.cinturon] - ordenC[b.cinturon]);
    grupo.forEach(atleta => {
      if (seen.has(atleta.id)) return;
      let found = false;
      for (const pool of pools) {
        if (pool.every(p => sonCompatibles(p.cinturon, atleta.cinturon))) {
          pool.push(atleta); seen.add(atleta.id); found = true; break;
        }
      }
      if (!found) { pools.push([atleta]); seen.add(atleta.id); }
    });

    pools.forEach((pool, pi) => {
      const sh = [...pool].sort(() => Math.random() - 0.5);
      const n = sh.length; if (n < 1) return;
      const totalRondas = Math.ceil(Math.log2(Math.max(n, 2)));
      const tam = Math.pow(2, totalRondas);
      const rondas = [];
      const r1 = []; let idx = 0;
      for (let i = 0; i < tam/2; i++) {
        const a1 = idx < sh.length ? sh[idx++] : null;
        const a2 = idx < sh.length ? sh[idx++] : null;
        r1.push({ id:`${clave}-P${pi}-R1-C${i}`, atletaA:a1, atletaB:a2,
          ganador: a2===null&&a1 ? a1 : a1===null&&a2 ? a2 : null, ronda:1, posicion:i });
      }
      rondas.push(r1);
      let cpr = r1.length;
      for (let r = 2; r <= totalRondas; r++) {
        cpr = Math.ceil(cpr/2);
        rondas.push(Array.from({length:cpr},(_,i) => ({
          id:`${clave}-P${pi}-R${r}-C${i}`, atletaA:null, atletaB:null, ganador:null, ronda:r, posicion:i
        })));
      }
      if (rondas.length > 1) {
        rondas[0].forEach((c,i) => {
          if (c.ganador) {
            const sl = i%2===0?"atletaA":"atletaB";
            if (rondas[1][Math.floor(i/2)]) rondas[1][Math.floor(i/2)][sl] = c.ganador;
          }
        });
      }
      brackets.push({ clave, poolIdx:pi, atletas:pool, rondas, totalRondas,
        cinturones:[...new Set(pool.map(a=>a.cinturon))] });
    });
  });
  return brackets;
};

// ─── COMPONENTES BASE ─────────────────────────────────────────────────────────
const CintBadge = ({ cinturon, small }) => {
  const c = CINTURON_COLORS[cinturon] || CINTURON_COLORS.Blanco;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding: small ? "1px 7px" : "3px 12px",
      borderRadius:20, fontSize: small ? 9 : 11, fontWeight:800,
      background:c.bg, color:c.text, border:`1.5px solid ${c.border}`,
      letterSpacing:0.8, textTransform:"uppercase",
      boxShadow:`0 1px 6px ${c.glow}`, whiteSpace:"nowrap",
    }}>{cinturon}</span>
  );
};

const GrupoBadge = ({ grupo, small }) => {
  const c = GRUPO_COLORS[grupo] || GRUPO_COLORS.Adulto;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center",
      padding: small ? "1px 8px" : "3px 14px",
      borderRadius:20, fontSize: small ? 9 : 11, fontWeight:800,
      background:c.bg, color:c.text, border:`1.5px solid ${c.border}`,
      letterSpacing:0.8, textTransform:"uppercase",
      boxShadow:`0 1px 8px ${c.glow}`, whiteSpace:"nowrap",
    }}>{grupo}</span>
  );
};

const StatCard = ({ icon, value, label, color }) => (
  <div style={{
    background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
    borderRadius:14, padding:"18px 16px", textAlign:"center",
    position:"relative", overflow:"hidden",
  }}>
    <div style={{position:"absolute",top:-10,right:-10,fontSize:50,opacity:0.06,transform:"rotate(12deg)"}}>{icon}</div>
    <div style={{fontSize:11,color:"#8a8ab0",textTransform:"uppercase",letterSpacing:1.5,marginBottom:4}}>{label}</div>
    <div style={{fontSize:32,fontWeight:900,color:color||"#fff",letterSpacing:-1}}>{value}</div>
  </div>
);

// Logo PTF Costa Rica (SVG)
const PTFLogo = () => (
  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
    <svg width="52" height="42" viewBox="0 0 52 42" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Top bar */}
      <rect x="0" y="0" width="23" height="5" fill="white"/>
      {/* Left pillar */}
      <rect x="0" y="0" width="5" height="42" fill="white"/>
      {/* Inner left pillar */}
      <rect x="9" y="10" width="5" height="26" fill="white"/>
      {/* Inner top crossbar */}
      <rect x="9" y="10" width="14" height="5" fill="white"/>
      {/* Right section top bar */}
      <rect x="27" y="0" width="25" height="5" fill="white"/>
      {/* Right main pillar */}
      <rect x="27" y="0" width="5" height="42" fill="white"/>
      {/* Right crossbar 1 */}
      <rect x="27" y="14" width="18" height="5" fill="white"/>
      {/* Right crossbar 2 */}
      <rect x="27" y="28" width="12" height="5" fill="white"/>
    </svg>
    <div style={{ lineHeight:1.15 }}>
      <div style={{ fontSize:10, fontWeight:900, color:"#fff", letterSpacing:1.2, textTransform:"uppercase" }}>PROFESSIONAL</div>
      <div style={{ fontSize:10, fontWeight:900, color:"#fff", letterSpacing:1.2, textTransform:"uppercase" }}>TAEKWONDO</div>
      <div style={{ fontSize:10, fontWeight:900, color:"#fff", letterSpacing:1.2, textTransform:"uppercase" }}>FEDERATION</div>
      <div style={{ display:"inline-flex", alignItems:"center", gap:4, marginTop:3,
        background:"#000", padding:"2px 8px", borderRadius:2 }}>
        <span style={{ fontSize:8, fontWeight:900, color:"#fff", letterSpacing:2 }}>COSTA RICA</span>
        <span style={{ fontSize:10 }}>🇨🇷</span>
      </div>
    </div>
  </div>
);

// Filtro toggle button
const FiltroBtn = ({ label, active, bg, textColor, onClick }) => (
  <button onClick={onClick} style={{
    padding:"5px 11px", borderRadius:6, cursor:"pointer",
    fontSize:10, fontWeight:700, transition:"all 0.15s",
    border: active ? `1.5px solid ${bg}` : "1px solid rgba(255,255,255,0.08)",
    background: active ? `${bg}22` : "rgba(255,255,255,0.03)",
    color: active ? (textColor || bg) : "#6a6a90",
  }}>{label}</button>
);

// ─── BRACKET CHART ────────────────────────────────────────────────────────────
function BracketChart({ bracket, bIdx, onSelectGanador, T, getNombreRonda }) {
  const { rondas, totalRondas } = bracket;
  if (!rondas.length) return null;
  const numR0   = rondas[0].length;
  const totalH  = Math.max(getTotalH(numR0), MH + 20);
  const totalW  = getTotalW(totalRondas);

  const paths = [];
  for (let r = 0; r < rondas.length - 1; r++) {
    for (let i = 0; i < rondas[r].length; i += 2) {
      if (i + 1 >= rondas[r].length) continue;
      const yA   = getMatchTop(r, i)   + MH/2;
      const yB   = getMatchTop(r, i+1) + MH/2;
      const yN   = getMatchTop(r+1, i/2) + MH/2;
      const xR   = getRoundX(r) + MW;
      const xMid = xR + RG/2;
      const xNxt = getRoundX(r+1);
      paths.push(`M${xR},${yA} H${xMid} M${xR},${yB} H${xMid} M${xMid},${yA} V${yB} M${xMid},${yN} H${xNxt}`);
    }
  }

  return (
    <div style={{ position:"relative", width:totalW, height:totalH, minHeight:MH+20 }}>
      <svg style={{ position:"absolute", top:0, left:0, width:totalW, height:totalH, overflow:"visible", pointerEvents:"none" }}>
        <defs>
          <filter id={`g${bIdx}`}><feGaussianBlur stdDeviation="1.5" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {paths.map((d,i) => (
          <path key={i} d={d} stroke="#FFD700" strokeWidth={1.5} fill="none"
            strokeLinecap="round" opacity={0.5} filter={`url(#g${bIdx})`}/>
        ))}
      </svg>

      {/* Round labels */}
      {rondas.map((_,rIdx) => (
        <div key={rIdx} style={{
          position:"absolute", top:-26, left:getRoundX(rIdx), width:MW,
          textAlign:"center", fontSize:9, fontWeight:800,
          color:"#FFD700", textTransform:"uppercase", letterSpacing:2,
        }}>{getNombreRonda(rIdx, totalRondas)}</div>
      ))}

      {/* Match cards */}
      {rondas.map((ronda, rIdx) => ronda.map((combate, cIdx) => {
        const top  = getMatchTop(rIdx, cIdx);
        const left = getRoundX(rIdx);
        const canClick = combate.atletaA && combate.atletaB && !combate.ganador;
        const winA = combate.ganador?.id === combate.atletaA?.id;
        const winB = combate.ganador?.id === combate.atletaB?.id;

        return (
          <div key={combate.id} style={{
            position:"absolute", top, left, width:MW, height:MH,
            borderRadius:8, overflow:"hidden", display:"flex", flexDirection:"column",
            border: combate.ganador ? "1px solid rgba(255,215,0,0.4)" : "1px solid rgba(255,255,255,0.07)",
            background: combate.ganador
              ? "linear-gradient(135deg,rgba(255,215,0,0.07),rgba(18,18,40,0.97))"
              : "linear-gradient(135deg,rgba(28,28,52,0.97),rgba(12,12,30,0.99))",
            boxShadow: combate.ganador ? "0 0 18px rgba(255,215,0,0.1)" : "0 2px 14px rgba(0,0,0,0.5)",
          }}>
            {/* Atleta A */}
            <div onClick={() => canClick && onSelectGanador(bIdx, rIdx, cIdx, combate.atletaA)} style={{
              flex:1, display:"flex", alignItems:"center", gap:6, padding:"0 10px",
              cursor: canClick ? "pointer" : "default",
              background: winA ? "rgba(255,215,0,0.08)" : "transparent",
              borderLeft: winA ? "3px solid #FFD700" : "3px solid transparent",
              opacity: combate.ganador && !winA ? 0.36 : 1, transition:"all 0.15s",
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: winA ? "#FFD700" : "#e4e4f0" }}>
                  {combate.atletaA?.nombre || <span style={{color:"#444",fontStyle:"italic"}}>Esperando…</span>}
                </div>
                {combate.atletaA && <div style={{fontSize:9,color:"#5a5a80",marginTop:1}}>{combate.atletaA.academia}</div>}
              </div>
              {combate.atletaA && <CintBadge cinturon={combate.atletaA.cinturon} small/>}
              {winA && <span style={{fontSize:11}}>🏆</span>}
            </div>

            {/* VS */}
            <div style={{
              height:16, display:"flex", alignItems:"center", justifyContent:"center",
              background:"rgba(255,215,0,0.04)",
              borderTop:"1px solid rgba(255,255,255,0.04)", borderBottom:"1px solid rgba(255,255,255,0.04)",
              fontSize:8, fontWeight:900, color:"#FFD700", letterSpacing:3,
            }}>VS</div>

            {/* Atleta B */}
            <div onClick={() => canClick && onSelectGanador(bIdx, rIdx, cIdx, combate.atletaB)} style={{
              flex:1, display:"flex", alignItems:"center", gap:6, padding:"0 10px",
              cursor: canClick ? "pointer" : "default",
              background: winB ? "rgba(255,215,0,0.08)" : "transparent",
              borderLeft: winB ? "3px solid #FFD700" : "3px solid transparent",
              opacity: combate.ganador && !winB ? 0.36 : 1, transition:"all 0.15s",
            }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:11, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", color: winB ? "#FFD700" : "#e4e4f0" }}>
                  {combate.atletaB
                    ? combate.atletaB.nombre
                    : combate.atletaA && combate.ganador
                      ? <span style={{color:"#444"}}>BYE</span>
                      : <span style={{color:"#444",fontStyle:"italic"}}>Esperando…</span>}
                </div>
                {combate.atletaB && <div style={{fontSize:9,color:"#5a5a80",marginTop:1}}>{combate.atletaB.academia}</div>}
              </div>
              {combate.atletaB && <CintBadge cinturon={combate.atletaB.cinturon} small/>}
              {winB && <span style={{fontSize:11}}>🏆</span>}
            </div>

            {combate.ganador && combate.atletaA && combate.atletaB && (
              <button onClick={() => onSelectGanador(bIdx,rIdx,cIdx,null)} style={{
                position:"absolute", bottom:2, right:4,
                background:"none", border:"none", color:"#444", cursor:"pointer", fontSize:8, padding:"1px 4px",
              }}>↩</button>
            )}
          </div>
        );
      }))}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function TKDTournament() {
  const [atletas, setAtletas]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [lastUpdate, setLastUpdate]   = useState(null);
  const [vista, setVista]             = useState("dashboard");
  const [brackets, setBrackets]       = useState([]);
  const [filtros, setFiltros]         = useState({ cinturones:[], generos:[], grupos:[], categorias:[] });

  const T = {
    bg:"#06060f", card:"#0c0c1e", accent:"#CE1126", accentSoft:"rgba(206,17,38,0.1)",
    blue:"#002B7F", gold:"#FFD700", text:"#f0f0f8", muted:"#6a6a90",
    border:"#18183a", success:"#00E676", surface:"rgba(255,255,255,0.025)",
  };

  const toggleFiltro = (tipo, valor) =>
    setFiltros(prev => ({
      ...prev,
      [tipo]: prev[tipo].includes(valor) ? prev[tipo].filter(v=>v!==valor) : [...prev[tipo], valor],
    }));

  const limpiarFiltros = () => setFiltros({ cinturones:[], generos:[], grupos:[], categorias:[] });
  const hayFiltros = Object.values(filtros).some(a => a.length > 0);

  const cargarDatos = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error("No se pudo acceder al spreadsheet.");
      const text = await res.text();
      const lista = parseCSV(text).map(normalizarAtleta).filter(a => a.nombre);
      setAtletas(lista); setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
      setAtletas([
        {id:1,nombre:"René Sánchez",genero:"Masculino",edad:24,categoria:"-63 kg",cinturon:"Rojo",profesor:"Nayib Diaz",academia:"AVS ALAJUELA",grupoEdad:"Adulto",timestamp:""},
        {id:2,nombre:"Johan Aguirre",genero:"Masculino",edad:23,categoria:"-63 kg",cinturon:"Azul",profesor:"Nayib Diaz",academia:"AVS ALAJUELA",grupoEdad:"Adulto",timestamp:""},
        {id:3,nombre:"Vicente Otey",genero:"Masculino",edad:20,categoria:"-63 kg",cinturon:"Azul",profesor:"Nayib Díaz",academia:"AVS TKD",grupoEdad:"Adulto",timestamp:""},
        {id:4,nombre:"Kailena Vásquez",genero:"Femenino",edad:16,categoria:"-52 kg",cinturon:"Azul",profesor:"Nayib Diaz",academia:"AVS ALAJUELA",grupoEdad:"Juvenil",timestamp:""},
        {id:5,nombre:"Mary Paz",genero:"Femenino",edad:15,categoria:"-52 kg",cinturon:"Azul",profesor:"Nayib Díaz",academia:"AVS TKD",grupoEdad:"Juvenil",timestamp:""},
        {id:6,nombre:"Francinie",genero:"Femenino",edad:21,categoria:"-56 kg",cinturon:"Amarillo",profesor:"Nayib Díaz",academia:"AVS TKD",grupoEdad:"Adulto",timestamp:""},
      ]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const stats = useMemo(() => {
    const masc = atletas.filter(a => a.genero==="Masculino").length;
    const fem  = atletas.filter(a => a.genero==="Femenino").length;
    const academias = [...new Set(atletas.map(a => a.academia))];
    const grupos = {};
    GRUPOS_EDAD.forEach(g => { grupos[g] = atletas.filter(a => a.grupoEdad===g).length; });
    const cinturones = {};
    atletas.forEach(a => { cinturones[a.cinturon] = (cinturones[a.cinturon]||0)+1; });
    return { total:atletas.length, masc, fem, academias, grupos, cinturones };
  }, [atletas]);

  const atletasFiltrados = useMemo(() => atletas.filter(a => {
    if (filtros.cinturones.length > 0 && !filtros.cinturones.includes(a.cinturon)) return false;
    if (filtros.generos.length   > 0 && !filtros.generos.includes(a.genero))      return false;
    if (filtros.grupos.length    > 0 && !filtros.grupos.includes(a.grupoEdad))    return false;
    if (filtros.categorias.length > 0 && !filtros.categorias.includes(a.categoria)) return false;
    return true;
  }), [atletas, filtros]);

  const handleGenerarBrackets = () => { setBrackets(generarBrackets(atletas)); setVista("brackets"); };

  const seleccionarGanador = (bIdx, rIdx, cIdx, ganador) => {
    setBrackets(prev => {
      const copy = JSON.parse(JSON.stringify(prev));
      const br = copy[bIdx]; const c = br.rondas[rIdx][cIdx];
      if (c.ganador && rIdx+1 < br.rondas.length) {
        const np = Math.floor(cIdx/2); const sl = cIdx%2===0?"atletaA":"atletaB";
        if (br.rondas[rIdx+1][np]) {
          br.rondas[rIdx+1][np][sl] = null; br.rondas[rIdx+1][np].ganador = null;
          for (let r=rIdx+2; r<br.rondas.length; r++)
            br.rondas[r].forEach(x => { x.atletaA=null; x.atletaB=null; x.ganador=null; });
        }
      }
      c.ganador = ganador;
      if (ganador && rIdx+1 < br.rondas.length) {
        const np = Math.floor(cIdx/2); const sl = cIdx%2===0?"atletaA":"atletaB";
        if (br.rondas[rIdx+1][np]) br.rondas[rIdx+1][np][sl] = ganador;
      }
      return copy;
    });
  };

  const getNombreRonda = (rIdx, total) => {
    const d = total - rIdx;
    if (d===1) return "FINAL"; if (d===2) return "Semifinal";
    if (d===3) return "Cuartos"; return `Ronda ${rIdx+1}`;
  };

  // ─── HEADER ───────────────────────────────────────────────────────────────
  const renderHeader = () => (
    <div style={{
      background:`linear-gradient(90deg, #0a0a20 0%, rgba(206,17,38,0.06) 50%, rgba(0,43,127,0.06) 100%)`,
      borderBottom:`1px solid rgba(206,17,38,0.25)`, padding:"10px 20px",
      display:"flex", alignItems:"center", justifyContent:"space-between",
      flexWrap:"wrap", gap:10, position:"sticky", top:0, zIndex:100,
      backdropFilter:"blur(20px)",
    }}>
      <PTFLogo />

      <div style={{ display:"flex", gap:3, flexWrap:"wrap" }}>
        {[{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"atletas",label:"Atletas",icon:"🥋"},{id:"brackets",label:"Brackets",icon:"🏆"}].map(v => (
          <button key={v.id} onClick={() => setVista(v.id)} style={{
            padding:"7px 16px", borderRadius:8, border:"none", cursor:"pointer",
            fontSize:12, fontWeight:700, transition:"all 0.2s",
            background: vista===v.id ? T.accent : "transparent",
            color: vista===v.id ? "#fff" : T.muted,
          }}>
            {v.icon} {v.label}
            {v.id==="atletas" && atletas.length>0 && (
              <span style={{ marginLeft:4, padding:"1px 6px", borderRadius:10, fontSize:10, fontWeight:800,
                background: vista===v.id ? "rgba(255,255,255,0.2)" : "rgba(206,17,38,0.12)",
                color: vista===v.id ? "#fff" : T.accent,
              }}>{atletas.length}</span>
            )}
          </button>
        ))}
      </div>

      <button onClick={cargarDatos} style={{
        padding:"7px 14px", borderRadius:8, border:`1px solid ${T.border}`,
        cursor:"pointer", fontSize:11, fontWeight:700, background:T.surface, color:T.muted,
      }}>🔄 Actualizar</button>
    </div>
  );

  // ─── DASHBOARD ────────────────────────────────────────────────────────────
  const renderDashboard = () => (
    <div style={{ maxWidth:1040, margin:"0 auto", padding:"24px 16px" }}>
      {loading && (
        <div style={{ textAlign:"center", padding:40, color:T.muted }}>
          <div style={{ fontSize:36, marginBottom:12, animation:"spin 1s linear infinite" }}>🥋</div>
          <div>Cargando desde Google Sheets…</div>
        </div>
      )}
      {error && (
        <div style={{ padding:"12px 16px", borderRadius:10, marginBottom:16, background:T.accentSoft, border:`1px solid rgba(206,17,38,0.25)`, color:T.accent, fontSize:13 }}>
          ⚠️ {error} — Usando datos de respaldo.
        </div>
      )}

      {/* Hero */}
      <div style={{ textAlign:"center", padding:"28px 0 24px" }}>
        <h1 style={{
          fontSize:28, fontWeight:900, margin:0,
          background:"linear-gradient(135deg, #fff 20%, #CE1126 60%, #002B7F 100%)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        }}>Torneo PTF Taekwondo</h1>
        <p style={{ color:T.muted, fontSize:13, marginTop:6 }}>Professional Taekwondo Federation · Costa Rica</p>
        {lastUpdate && <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>Actualizado: {lastUpdate.toLocaleTimeString("es-CR")}</div>}
      </div>

      {/* Stats principales */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:10, marginBottom:20 }}>
        <StatCard icon="🤼" value={stats.total} label="Total Atletas" color={T.accent} />
        <StatCard icon="♂"  value={stats.masc}  label="Masculino"    color="#2979FF" />
        <StatCard icon="♀"  value={stats.fem}   label="Femenino"     color="#FF4081" />
        <StatCard icon="🏫" value={stats.academias.length} label="Academias" color={T.gold} />
      </div>

      {/* Grupos de edad */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:18, marginBottom:16 }}>
        <h3 style={{ margin:"0 0 14px", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:1.5 }}>
          Categorías por Grupo
        </h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:10 }}>
          {GRUPOS_EDAD.map(g => {
            const gc = GRUPO_COLORS[g];
            const count = stats.grupos[g] || 0;
            return (
              <div key={g} onClick={() => { toggleFiltro("grupos", g); setVista("atletas"); }} style={{
                cursor:"pointer", padding:"14px 16px", borderRadius:10,
                background: gc.soft, border:`1.5px solid ${gc.border}`,
                transition:"all 0.2s",
              }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:6 }}>
                  <GrupoBadge grupo={g} small />
                  <span style={{ fontSize:24, fontWeight:900, color:gc.bg }}>{count}</span>
                </div>
                <div style={{ fontSize:10, color:T.muted }}>
                  {g==="Infantil" ? "< 12 años" : g==="Cadete" ? "12–14 años" : g==="Juvenil" ? "15–17 años" : "18+ años"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cinturones */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:18, marginBottom:16 }}>
        <h3 style={{ margin:"0 0 12px", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:1.5 }}>
          Por Cinturón
        </h3>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {CINTURONES.map(c => (
            <div key={c} onClick={() => { toggleFiltro("cinturones", c); setVista("atletas"); }} style={{
              cursor:"pointer", display:"flex", alignItems:"center", gap:8,
              padding:"7px 12px", borderRadius:8,
              background:T.surface, border:`1px solid ${T.border}`, transition:"all 0.2s",
            }}>
              <CintBadge cinturon={c} small />
              <span style={{ fontSize:16, fontWeight:900, color:"#fff" }}>{stats.cinturones[c]||0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Academias */}
      <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:14, padding:18, marginBottom:24 }}>
        <h3 style={{ margin:"0 0 12px", fontSize:11, fontWeight:700, color:T.muted, textTransform:"uppercase", letterSpacing:1.5 }}>
          Academias
        </h3>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {stats.academias.map(ac => {
            const count = atletas.filter(a=>a.academia===ac).length;
            return (
              <div key={ac} style={{ padding:"8px 14px", borderRadius:8, background:T.surface, border:`1px solid ${T.border}` }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{ac}</div>
                <div style={{ fontSize:10, color:T.muted }}>{count} atleta{count!==1?"s":""}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ textAlign:"center" }}>
        <button onClick={handleGenerarBrackets} disabled={atletas.length < 2} style={{
          padding:"13px 36px", borderRadius:12, border:"none",
          cursor: atletas.length < 2 ? "not-allowed" : "pointer",
          fontSize:15, fontWeight:800, letterSpacing:0.5,
          background: atletas.length < 2 ? T.border : `linear-gradient(135deg, ${T.accent}, #8b000d)`,
          color:"#fff", boxShadow: atletas.length >= 2 ? "0 6px 28px rgba(206,17,38,0.45)" : "none",
          transition:"all 0.3s",
        }}>🏆 Generar Brackets ({atletas.length} atletas)</button>
      </div>
    </div>
  );

  // ─── ATLETAS ──────────────────────────────────────────────────────────────
  const renderAtletas = () => {
    const categoriasActivas = filtros.grupos.length > 0
      ? filtros.grupos.flatMap(g => {
          const gc = CATEGORIAS_PTF[g] || {};
          if (filtros.generos.length > 0) return filtros.generos.flatMap(gn => gc[gn] || []);
          return [...new Set([...(gc.Masculino||[]), ...(gc.Femenino||[])])];
        })
      : [...new Set(atletas.map(a=>a.categoria))].sort();

    return (
      <div style={{ maxWidth:1060, margin:"0 auto", padding:"20px 16px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, flexWrap:"wrap", gap:10 }}>
          <h2 style={{ margin:0, fontSize:18, fontWeight:900, color:T.text }}>
            Atletas Inscritos
            <span style={{ fontSize:13, fontWeight:400, color:T.muted, marginLeft:8 }}>
              {atletasFiltrados.length}{hayFiltros ? ` de ${atletas.length}` : ""}
            </span>
          </h2>
          {hayFiltros && (
            <button onClick={limpiarFiltros} style={{
              padding:"5px 14px", borderRadius:8, border:`1px solid rgba(206,17,38,0.3)`,
              background:T.accentSoft, color:T.accent, cursor:"pointer", fontSize:11, fontWeight:700,
            }}>✕ Limpiar filtros</button>
          )}
        </div>

        {/* FILTROS */}
        <div style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:14, marginBottom:14 }}>
          {/* Grupo edad */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:8 }}>
            <span style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, minWidth:68 }}>Grupo</span>
            {GRUPOS_EDAD.map(g => (
              <FiltroBtn key={g} label={g} active={filtros.grupos.includes(g)}
                bg={GRUPO_COLORS[g].bg} textColor={GRUPO_COLORS[g].bg}
                onClick={() => toggleFiltro("grupos", g)} />
            ))}
          </div>

          {/* Cinturón */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:8 }}>
            <span style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, minWidth:68 }}>Cinturón</span>
            {CINTURONES.map(c => (
              <FiltroBtn key={c} label={c} active={filtros.cinturones.includes(c)}
                bg={c==="Blanco"?"#ccc":CINTURON_COLORS[c].bg}
                onClick={() => toggleFiltro("cinturones", c)} />
            ))}
          </div>

          {/* Género */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:8 }}>
            <span style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, minWidth:68 }}>Género</span>
            <FiltroBtn label="♂ Masculino" active={filtros.generos.includes("Masculino")} bg="#2979FF" onClick={() => toggleFiltro("generos","Masculino")} />
            <FiltroBtn label="♀ Femenino"  active={filtros.generos.includes("Femenino")}  bg="#FF4081" onClick={() => toggleFiltro("generos","Femenino")} />
          </div>

          {/* Peso — contextual según grupo+género seleccionados */}
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
            <span style={{ fontSize:10, color:T.muted, fontWeight:700, textTransform:"uppercase", letterSpacing:1, minWidth:68 }}>Peso</span>
            {categoriasActivas.map(cat => (
              <FiltroBtn key={cat} label={cat} active={filtros.categorias.includes(cat)} bg="#00E676"
                onClick={() => toggleFiltro("categorias", cat)} />
            ))}
          </div>
        </div>

        {/* Chips activos */}
        {hayFiltros && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:12 }}>
            <span style={{ fontSize:10, color:T.muted, alignSelf:"center" }}>Activos:</span>
            {Object.entries(filtros).flatMap(([tipo, vals]) => vals.map(v => (
              <span key={`${tipo}-${v}`} onClick={() => toggleFiltro(tipo, v)} style={{
                padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, cursor:"pointer",
                background:"rgba(255,215,0,0.1)", border:"1px solid rgba(255,215,0,0.25)", color:T.gold,
              }}>{v} ✕</span>
            )))}
          </div>
        )}

        {/* Tabla */}
        <div style={{ background:T.card, borderRadius:12, border:`1px solid ${T.border}`, overflow:"hidden" }}>
          <div style={{ overflowX:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`1px solid ${T.border}` }}>
                  {["#","Nombre","Género","Edad","Grupo","Peso","Cinturón","Profesor","Academia"].map(h => (
                    <th key={h} style={{ padding:"10px 12px", textAlign:"left", color:T.muted, fontWeight:700, fontSize:10, textTransform:"uppercase", letterSpacing:1, whiteSpace:"nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atletasFiltrados.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom:`1px solid ${T.border}22`, background: i%2===0?"transparent":"rgba(255,255,255,0.01)" }}>
                    <td style={{ padding:"9px 12px", color:T.muted, fontWeight:600 }}>{i+1}</td>
                    <td style={{ padding:"9px 12px", fontWeight:700, color:T.text }}>{a.nombre}</td>
                    <td style={{ padding:"9px 12px" }}>
                      <span style={{
                        padding:"2px 8px", borderRadius:6, fontSize:10, fontWeight:700,
                        background: a.genero==="Masculino"?"rgba(41,121,255,0.12)":"rgba(255,64,129,0.12)",
                        color: a.genero==="Masculino"?"#2979FF":"#FF4081",
                      }}>{a.genero==="Masculino"?"♂ M":"♀ F"}</span>
                    </td>
                    <td style={{ padding:"9px 12px", color:T.text }}>{a.edad}</td>
                    <td style={{ padding:"9px 12px" }}><GrupoBadge grupo={a.grupoEdad} small/></td>
                    <td style={{ padding:"9px 12px", fontWeight:600, color:T.text }}>{a.categoria}</td>
                    <td style={{ padding:"9px 12px" }}><CintBadge cinturon={a.cinturon} small/></td>
                    <td style={{ padding:"9px 12px", color:T.muted }}>{a.profesor}</td>
                    <td style={{ padding:"9px 12px", color:T.muted }}>{a.academia}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {atletasFiltrados.length===0 && (
            <div style={{ textAlign:"center", padding:40, color:T.muted }}>No hay atletas con esa combinación de filtros</div>
          )}
        </div>
      </div>
    );
  };

  // ─── BRACKETS ─────────────────────────────────────────────────────────────
  const renderBrackets = () => {
    if (!brackets.length) return (
      <div style={{ maxWidth:900, margin:"0 auto", padding:"60px 16px", textAlign:"center" }}>
        <div style={{ fontSize:56, marginBottom:16, opacity:0.3 }}>🏆</div>
        <div style={{ color:T.muted, fontSize:16, marginBottom:24 }}>No hay brackets generados aún</div>
        <button onClick={handleGenerarBrackets} style={{
          padding:"12px 28px", borderRadius:10, border:"none", cursor:"pointer",
          fontSize:14, fontWeight:700, color:"#fff",
          background:`linear-gradient(135deg,${T.accent},#8b000d)`,
          boxShadow:"0 4px 20px rgba(206,17,38,0.4)",
        }}>Generar Brackets</button>
      </div>
    );

    const parseClave = c => { const [g,p,e]=c.split("|"); return {genero:g,peso:p,edad:e}; };

    return (
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"24px 16px" }}>
        {/* Page header */}
        <div style={{
          textAlign:"center", marginBottom:32, padding:"20px 16px 24px",
          background:"linear-gradient(180deg, rgba(206,17,38,0.04) 0%, rgba(0,43,127,0.04) 50%, transparent 100%)",
          borderBottom:`1px solid rgba(206,17,38,0.12)`,
        }}>
          <div style={{ fontSize:9, color:T.gold, letterSpacing:4, textTransform:"uppercase", marginBottom:6, fontWeight:800 }}>
            Tournament Bracket
          </div>
          <div style={{ fontSize:28, fontWeight:900, letterSpacing:3, textTransform:"uppercase",
            background:"linear-gradient(135deg,#fff 20%,#CE1126 60%,#002B7F 100%)",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
          }}>PTF TAEKWONDO · COSTA RICA</div>
          <div style={{ marginTop:14, display:"flex", justifyContent:"center", gap:10 }}>
            <button onClick={() => setBrackets(generarBrackets(atletas))} style={{
              padding:"8px 18px", borderRadius:8, border:`1px solid rgba(255,215,0,0.25)`,
              background:"rgba(255,215,0,0.06)", color:T.gold, cursor:"pointer", fontSize:12, fontWeight:700,
            }}>🔀 Re-sortear</button>
          </div>
        </div>

        {brackets.map((bracket, bIdx) => {
          const info    = parseClave(bracket.clave);
          const gc      = GRUPO_COLORS[info.edad] || GRUPO_COLORS.Adulto;
          const campeon = bracket.rondas[bracket.rondas.length-1]?.[0]?.ganador;

          return (
            <div key={bIdx} style={{
              marginBottom:32,
              background:"linear-gradient(135deg,rgba(10,10,25,0.99),rgba(5,5,18,0.99))",
              border: campeon ? "1px solid rgba(255,215,0,0.3)" : `1px solid ${T.border}`,
              borderRadius:16, overflow:"hidden",
              boxShadow: campeon ? "0 0 40px rgba(255,215,0,0.07)" : "0 4px 28px rgba(0,0,0,0.5)",
            }}>
              {/* Bracket header */}
              <div style={{
                padding:"14px 20px",
                background:`linear-gradient(90deg, ${gc.soft}, transparent)`,
                borderBottom:`1px solid ${gc.border}44`,
                display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10,
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                  <div style={{
                    width:40, height:40, borderRadius:10, fontSize:20,
                    background: info.genero==="Masculino"?"rgba(41,121,255,0.15)":"rgba(255,64,129,0.15)",
                    display:"flex", alignItems:"center", justifyContent:"center",
                  }}>{info.genero==="Masculino"?"♂":"♀"}</div>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <GrupoBadge grupo={info.edad} small/>
                      <span style={{ fontSize:14, fontWeight:800, color:T.text }}>{info.genero} · {info.peso}</span>
                    </div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{bracket.atletas.length} atletas</div>
                  </div>
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  {bracket.cinturones.map(c => <CintBadge key={c} cinturon={c} small/>)}
                </div>
              </div>

              {/* Champion banner */}
              {campeon && (
                <div style={{
                  margin:"16px 20px", padding:"14px 20px", borderRadius:10,
                  background:"linear-gradient(135deg,rgba(255,215,0,0.09),rgba(255,215,0,0.03))",
                  border:"1px solid rgba(255,215,0,0.22)",
                  display:"flex", alignItems:"center", gap:14,
                }}>
                  <div style={{ fontSize:32, filter:"drop-shadow(0 0 14px rgba(255,215,0,0.7))" }}>🏆</div>
                  <div>
                    <div style={{ fontSize:9, color:T.gold, textTransform:"uppercase", fontWeight:800, letterSpacing:2, marginBottom:3 }}>Campeón</div>
                    <div style={{ fontSize:20, fontWeight:900, color:T.gold }}>{campeon.nombre}</div>
                    <div style={{ fontSize:11, color:T.muted }}>{campeon.academia}</div>
                  </div>
                  <CintBadge cinturon={campeon.cinturon}/>
                </div>
              )}

              {/* Bracket visual */}
              <div style={{ padding:"36px 20px 24px", overflowX:"auto" }}>
                <BracketChart bracket={bracket} bIdx={bIdx}
                  onSelectGanador={seleccionarGanador} T={T} getNombreRonda={getNombreRonda}/>
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
      minHeight:"100vh",
      background:`radial-gradient(ellipse at top, #0e0820 0%, ${T.bg} 70%)`,
      color:T.text, fontFamily:"'Segoe UI',-apple-system,sans-serif",
    }}>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#2a2a4a;border-radius:3px;}
        button:hover{filter:brightness(1.15);}
        tr:hover{background:rgba(255,255,255,0.02)!important;}
      `}</style>
      {renderHeader()}
      {vista==="dashboard" && renderDashboard()}
      {vista==="atletas"   && renderAtletas()}
      {vista==="brackets"  && renderBrackets()}
    </div>
  );
}
