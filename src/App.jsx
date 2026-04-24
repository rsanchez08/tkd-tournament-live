import { useState, useEffect, useCallback, useMemo } from "react";

const SHEET_ID = "1CuWdEOdQcZ4hcA6U85nPvQ0C8CJs-OFyyMuTKhbAu3A";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Respuestas%20de%20formulario%201`;

const CINTURONES = ["Blanco", "Amarillo", "Verde", "Azul", "Rojo", "Negro"];
const CINTURON_COLORS = {
  Blanco:   { bg: "#f8f8f8", text: "#222", border: "#d0d0d0", glow: "rgba(200,200,200,0.3)" },
  Amarillo: { bg: "#FFD700", text: "#1a1a00", border: "#c9a800", glow: "rgba(255,215,0,0.3)" },
  Verde:    { bg: "#00C853", text: "#fff",    border: "#009624", glow: "rgba(0,200,83,0.3)" },
  Azul:     { bg: "#2979FF", text: "#fff",    border: "#0052cc", glow: "rgba(41,121,255,0.3)" },
  Rojo:     { bg: "#FF1744", text: "#fff",    border: "#c4001d", glow: "rgba(255,23,68,0.3)" },
  Negro:    { bg: "#1a1a2e", text: "#f0f0f0", border: "#555",    glow: "rgba(100,100,100,0.3)" },
};

const COMPATIBILIDAD = {
  Blanco:   ["Blanco", "Amarillo"],
  Amarillo: ["Blanco", "Amarillo", "Verde"],
  Verde:    ["Amarillo", "Verde", "Azul"],
  Azul:     ["Verde", "Azul", "Rojo", "Negro"],
  Rojo:     ["Azul", "Rojo", "Negro"],
  Negro:    ["Azul", "Rojo", "Negro"],
};

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
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
};

const parseCSV = (text) => {
  const lines = text.split("\n").filter((l) => l.trim());
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
  nombre: (row["Nombre Completo"] || "").trim(),
  genero: (row["Género"] || row["GÃ©nero"] || row["Genero"] || "").trim(),
  edad: parseInt(row["Edad"]) || 0,
  categoria: (row["Categoría de Peso"] || row["CategorÃ­a de Peso"] || row["Categoria de Peso"] || "").trim(),
  cinturon: (row["Cinturón"] || row["CinturÃ³n"] || row["Cinturon"] || "").trim(),
  profesor: (row["Profesor"] || "").trim(),
  academia: (row["Academia"] || "").trim(),
  grupoEdad: obtenerGrupoEdad(row["Edad"]),
  timestamp: (row["Marca temporal"] || "").trim(),
});

const generarBrackets = (atletas) => {
  const grupos = {};
  atletas.forEach((a) => {
    const key = `${a.genero}|${a.categoria}|${a.grupoEdad}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(a);
  });

  const brackets = [];
  const ordenCint = { Blanco: 0, Amarillo: 1, Verde: 2, Azul: 3, Rojo: 4, Negro: 5 };

  Object.entries(grupos).forEach(([clave, grupo]) => {
    const pools = [];
    const asignados = new Set();

    grupo.sort((a, b) => ordenCint[a.cinturon] - ordenCint[b.cinturon]);

    grupo.forEach((atleta) => {
      if (asignados.has(atleta.id)) return;
      let poolEncontrado = false;
      for (const pool of pools) {
        if (pool.every((p) => sonCompatibles(p.cinturon, atleta.cinturon))) {
          pool.push(atleta);
          asignados.add(atleta.id);
          poolEncontrado = true;
          break;
        }
      }
      if (!poolEncontrado) {
        pools.push([atleta]);
        asignados.add(atleta.id);
      }
    });

    pools.forEach((pool, poolIdx) => {
      const shuffled = [...pool].sort(() => Math.random() - 0.5);
      const n = shuffled.length;
      if (n < 1) return;

      const totalRondas = Math.ceil(Math.log2(n));
      const tamañoBracket = Math.pow(2, totalRondas);
      const rondas = [];

      const ronda1 = [];
      let idx = 0;
      for (let i = 0; i < tamañoBracket / 2; i++) {
        const a1 = idx < shuffled.length ? shuffled[idx++] : null;
        const a2 = idx < shuffled.length ? shuffled[idx++] : null;
        ronda1.push({
          id: `${clave}-P${poolIdx}-R1-C${i}`,
          atletaA: a1,
          atletaB: a2,
          ganador: a2 === null && a1 ? a1 : a1 === null && a2 ? a2 : null,
          ronda: 1,
          posicion: i,
        });
      }
      rondas.push(ronda1);

      let combatesPorRonda = ronda1.length;
      for (let r = 2; r <= totalRondas; r++) {
        combatesPorRonda = Math.ceil(combatesPorRonda / 2);
        const ronda = [];
        for (let i = 0; i < combatesPorRonda; i++) {
          ronda.push({
            id: `${clave}-P${poolIdx}-R${r}-C${i}`,
            atletaA: null, atletaB: null, ganador: null, ronda: r, posicion: i,
          });
        }
        rondas.push(ronda);
      }

      if (rondas.length > 1) {
        rondas[0].forEach((combate, i) => {
          if (combate.ganador) {
            const nextPos = Math.floor(i / 2);
            const slot = i % 2 === 0 ? "atletaA" : "atletaB";
            if (rondas[1][nextPos]) rondas[1][nextPos][slot] = combate.ganador;
          }
        });
      }

      brackets.push({
        clave, poolIdx, atletas: pool, rondas, totalRondas,
        cinturones: [...new Set(pool.map((a) => a.cinturon))],
      });
    });
  });

  return brackets;
};

const CintBadge = ({ cinturon, small }) => {
  const c = CINTURON_COLORS[cinturon] || CINTURON_COLORS.Blanco;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: small ? "1px 8px" : "3px 12px",
      borderRadius: 20, fontSize: small ? 9 : 11,
      fontWeight: 800, background: c.bg, color: c.text,
      border: `2px solid ${c.border}`,
      letterSpacing: 0.8, textTransform: "uppercase",
      boxShadow: `0 2px 8px ${c.glow}`, whiteSpace: "nowrap",
    }}>
      {cinturon}
    </span>
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

export default function TKDTournament() {
  const [atletas, setAtletas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [vista, setVista] = useState("dashboard");
  const [brackets, setBrackets] = useState([]);
  const [filtro, setFiltro] = useState({ tipo: "todos" });

  const T = {
    bg: "#08081a", card: "#101028", accent: "#FF1744",
    accentSoft: "rgba(255,23,68,0.12)", gold: "#FFD700",
    text: "#e4e4f0", muted: "#6a6a90", border: "#1e1e3a",
    success: "#00E676", surface: "rgba(255,255,255,0.03)",
  };

  const cargarDatos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(SHEET_CSV_URL);
      if (!res.ok) throw new Error("No se pudo acceder al spreadsheet. Verificá que esté publicado en la web.");
      const text = await res.text();
      const rows = parseCSV(text);
      const lista = rows.map(normalizarAtleta).filter((a) => a.nombre);
      setAtletas(lista);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err.message);
      setAtletas([
        { id:1, nombre:"René Sánchez", genero:"Masculino", edad:24, categoria:"-67 kg", cinturon:"Rojo", profesor:"Nayib Diaz", academia:"AVS ALAJUELA", grupoEdad:"18+", timestamp:"" },
        { id:2, nombre:"Johan Aguirre", genero:"Masculino", edad:23, categoria:"-67 kg", cinturon:"Azul", profesor:"Nayib Diaz", academia:"AVS ALAJUELA", grupoEdad:"18+", timestamp:"" },
        { id:3, nombre:"Vicente Otey", genero:"Masculino", edad:20, categoria:"-67 kg", cinturon:"Azul", profesor:"Nayib Díaz", academia:"AVS TKD", grupoEdad:"18+", timestamp:"" },
        { id:4, nombre:"Kailena Vásquez", genero:"Femenino", edad:17, categoria:"-63 kg", cinturon:"Azul", profesor:"Nayib Diaz", academia:"AVS ALAJUELA", grupoEdad:"15-17", timestamp:"" },
        { id:5, nombre:"Mary Paz", genero:"Femenino", edad:15, categoria:"-53 kg", cinturon:"Azul", profesor:"Nayib Díaz", academia:"AVS TKD", grupoEdad:"15-17", timestamp:"" },
        { id:6, nombre:"Francinie", genero:"Femenino", edad:21, categoria:"-63 kg", cinturon:"Amarillo", profesor:"Nayib Díaz", academia:"AVS TKD", grupoEdad:"18+", timestamp:"" },
      ]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  const stats = useMemo(() => {
    const masc = atletas.filter((a) => a.genero === "Masculino").length;
    const fem = atletas.filter((a) => a.genero === "Femenino").length;
    const academias = [...new Set(atletas.map((a) => a.academia))];
    const cinturones = {};
    atletas.forEach((a) => { cinturones[a.cinturon] = (cinturones[a.cinturon] || 0) + 1; });
    return { total: atletas.length, masc, fem, academias, cinturones };
  }, [atletas]);

  const atletasFiltrados = useMemo(() => {
    if (filtro.tipo === "todos") return atletas;
    return atletas.filter((a) => {
      if (filtro.tipo === "cinturon") return a.cinturon === filtro.valor;
      if (filtro.tipo === "academia") return a.academia === filtro.valor;
      if (filtro.tipo === "profesor") return a.profesor === filtro.valor;
      if (filtro.tipo === "edad") return a.grupoEdad === filtro.valor;
      if (filtro.tipo === "genero") return a.genero === filtro.valor;
      if (filtro.tipo === "categoria") return a.categoria === filtro.valor;
      return true;
    });
  }, [atletas, filtro]);

  const handleGenerarBrackets = () => {
    setBrackets(generarBrackets(atletas));
    setVista("brackets");
  };

  const seleccionarGanador = (bracketIdx, rondaIdx, combateIdx, ganador) => {
    setBrackets((prev) => {
      const copia = JSON.parse(JSON.stringify(prev));
      const bracket = copia[bracketIdx];
      const combate = bracket.rondas[rondaIdx][combateIdx];

      if (combate.ganador && rondaIdx + 1 < bracket.rondas.length) {
        const nextPos = Math.floor(combateIdx / 2);
        const slot = combateIdx % 2 === 0 ? "atletaA" : "atletaB";
        if (bracket.rondas[rondaIdx + 1][nextPos]) {
          bracket.rondas[rondaIdx + 1][nextPos][slot] = null;
          bracket.rondas[rondaIdx + 1][nextPos].ganador = null;
          for (let r = rondaIdx + 2; r < bracket.rondas.length; r++) {
            bracket.rondas[r].forEach(c => { c.atletaA = null; c.atletaB = null; c.ganador = null; });
          }
        }
      }

      combate.ganador = ganador;

      if (ganador && rondaIdx + 1 < bracket.rondas.length) {
        const nextPos = Math.floor(combateIdx / 2);
        const slot = combateIdx % 2 === 0 ? "atletaA" : "atletaB";
        if (bracket.rondas[rondaIdx + 1][nextPos]) {
          bracket.rondas[rondaIdx + 1][nextPos][slot] = ganador;
        }
      }

      return copia;
    });
  };

  const getNombreRonda = (rondaIdx, totalRondas) => {
    const faltantes = totalRondas - rondaIdx;
    if (faltantes === 1) return "FINAL";
    if (faltantes === 2) return "Semifinal";
    if (faltantes === 3) return "Cuartos";
    return `Ronda ${rondaIdx + 1}`;
  };

  const renderHeader = () => (
    <div style={{
      background: `linear-gradient(90deg, ${T.card}, rgba(255,23,68,0.04))`,
      borderBottom: `1px solid ${T.border}`, padding: "12px 20px",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      flexWrap: "wrap", gap: 10, position: "sticky", top: 0, zIndex: 100,
      backdropFilter: "blur(20px)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: `linear-gradient(135deg, ${T.accent}, #c0001d)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 20, boxShadow: `0 0 20px rgba(255,23,68,0.4)`,
        }}>🥋</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: -0.3 }}>PTF Tournament</div>
          <div style={{ fontSize: 10, color: T.muted, letterSpacing: 1.5, textTransform: "uppercase" }}>Sistema de Brackets</div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
        {[
          { id: "dashboard", label: "Dashboard", icon: "📊" },
          { id: "atletas", label: "Atletas", icon: "🥋" },
          { id: "brackets", label: "Brackets", icon: "🏆" },
        ].map((v) => (
          <button key={v.id} onClick={() => setVista(v.id)} style={{
            padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
            fontSize: 12, fontWeight: 700,
            background: vista === v.id ? T.accent : "transparent",
            color: vista === v.id ? "#fff" : T.muted,
            transition: "all 0.2s", letterSpacing: 0.3,
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
        background: T.surface, color: T.muted, display: "flex", alignItems: "center", gap: 6,
      }}>🔄 Actualizar</button>
    </div>
  );

  const renderDashboard = () => (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px 16px" }}>
      {loading && (
        <div style={{ textAlign: "center", padding: 40, color: T.muted }}>
          <div style={{ fontSize: 36, marginBottom: 12, animation: "spin 1s linear infinite" }}>🥋</div>
          <div>Cargando atletas desde Google Sheets...</div>
        </div>
      )}
      {error && (
        <div style={{
          padding: "14px 18px", borderRadius: 12, marginBottom: 16,
          background: "rgba(255,23,68,0.08)", border: `1px solid rgba(255,23,68,0.2)`,
          color: T.accent, fontSize: 13,
        }}>⚠️ {error} — Usando datos de respaldo.</div>
      )}
      <div style={{ textAlign: "center", padding: "32px 0 24px" }}>
        <div style={{ fontSize: 56, marginBottom: 8, filter: "drop-shadow(0 0 24px rgba(255,23,68,0.4))" }}>🥋</div>
        <h1 style={{
          fontSize: 32, fontWeight: 900, margin: 0,
          background: `linear-gradient(135deg, #fff, ${T.accent})`,
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>Torneo PTF Taekwondo</h1>
        <p style={{ color: T.muted, fontSize: 14, marginTop: 6 }}>
          Los profesores inscriben atletas via Google Form → las llaves se generan automáticamente
        </p>
        {lastUpdate && (
          <div style={{ fontSize: 10, color: T.muted, marginTop: 8, letterSpacing: 0.5 }}>
            Última actualización: {lastUpdate.toLocaleTimeString("es-CR")}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 24 }}>
        <StatCard icon="🤼" value={stats.total} label="Total Atletas" color={T.accent} />
        <StatCard icon="♂" value={stats.masc} label="Masculino" color="#2979FF" />
        <StatCard icon="♀" value={stats.fem} label="Femenino" color="#FF4081" />
        <StatCard icon="🏫" value={stats.academias.length} label="Academias" color={T.gold} />
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>
          Distribución por Cinturón
        </h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {CINTURONES.map((c) => (
            <div key={c} onClick={() => { setFiltro({ tipo: "cinturon", valor: c }); setVista("atletas"); }} style={{
              cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
              padding: "8px 14px", borderRadius: 10,
              background: T.surface, border: `1px solid ${T.border}`, transition: "all 0.2s",
            }}>
              <CintBadge cinturon={c} small />
              <span style={{ fontSize: 18, fontWeight: 900, color: "#fff" }}>{stats.cinturones[c] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 13, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>
          Academias Inscritas
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {stats.academias.map((ac) => {
            const count = atletas.filter((a) => a.academia === ac).length;
            return (
              <div key={ac} onClick={() => { setFiltro({ tipo: "academia", valor: ac }); setVista("atletas"); }} style={{
                cursor: "pointer", padding: "10px 16px", borderRadius: 10,
                background: T.surface, border: `1px solid ${T.border}`, transition: "all 0.2s",
              }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{ac}</div>
                <div style={{ fontSize: 11, color: T.muted }}>{count} atleta{count !== 1 && "s"}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <button onClick={handleGenerarBrackets} disabled={atletas.length < 2} style={{
          padding: "14px 36px", borderRadius: 12, border: "none",
          cursor: atletas.length < 2 ? "not-allowed" : "pointer",
          fontSize: 15, fontWeight: 800, letterSpacing: 0.5,
          background: atletas.length < 2 ? T.border : `linear-gradient(135deg, ${T.accent}, #c0001d)`,
          color: "#fff", boxShadow: atletas.length >= 2 ? `0 6px 24px rgba(255,23,68,0.4)` : "none",
          transition: "all 0.3s",
        }}>🏆 Generar Brackets ({atletas.length} atletas)</button>
      </div>
    </div>
  );

  const renderAtletas = () => (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>
          Atletas Inscritos
          <span style={{ fontSize: 14, fontWeight: 400, color: T.muted, marginLeft: 8 }}>
            ({atletasFiltrados.length}{filtro.tipo !== "todos" ? ` de ${atletas.length}` : ""})
          </span>
        </h2>
      </div>

      <div style={{
        display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16,
        padding: 12, background: T.card, borderRadius: 12, border: `1px solid ${T.border}`,
      }}>
        <span style={{ fontSize: 11, color: T.muted, alignSelf: "center", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginRight: 4 }}>Filtrar:</span>
        <button onClick={() => setFiltro({ tipo: "todos" })} style={{
          padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
          background: filtro.tipo === "todos" ? T.accent : T.surface,
          color: filtro.tipo === "todos" ? "#fff" : T.muted,
        }}>Todos</button>
        {CINTURONES.map((c) => (
          <button key={c} onClick={() => setFiltro({ tipo: "cinturon", valor: c })} style={{
            padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 10, fontWeight: 700,
            background: filtro.tipo === "cinturon" && filtro.valor === c ? CINTURON_COLORS[c].bg : T.surface,
            color: filtro.tipo === "cinturon" && filtro.valor === c ? CINTURON_COLORS[c].text : T.muted,
          }}>{c}</button>
        ))}
        <span style={{ borderLeft: `1px solid ${T.border}`, margin: "0 4px" }} />
        {["Masculino", "Femenino"].map((g) => (
          <button key={g} onClick={() => setFiltro({ tipo: "genero", valor: g })} style={{
            padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
            background: filtro.tipo === "genero" && filtro.valor === g ? "#2979FF" : T.surface,
            color: filtro.tipo === "genero" && filtro.valor === g ? "#fff" : T.muted,
          }}>{g === "Masculino" ? "♂" : "♀"} {g}</button>
        ))}
        <span style={{ borderLeft: `1px solid ${T.border}`, margin: "0 4px" }} />
        {["13-14", "15-17", "18+"].map((e) => (
          <button key={e} onClick={() => setFiltro({ tipo: "edad", valor: e })} style={{
            padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
            background: filtro.tipo === "edad" && filtro.valor === e ? T.gold : T.surface,
            color: filtro.tipo === "edad" && filtro.valor === e ? "#000" : T.muted,
          }}>{e}</button>
        ))}
      </div>

      <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.border}` }}>
                {["#", "Nombre", "Género", "Edad", "Grupo", "Peso", "Cinturón", "Profesor", "Academia"].map((h) => (
                  <th key={h} style={{
                    padding: "10px 12px", textAlign: "left", color: T.muted,
                    fontWeight: 700, fontSize: 10, textTransform: "uppercase",
                    letterSpacing: 1, whiteSpace: "nowrap",
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {atletasFiltrados.map((a, i) => (
                <tr key={a.id} style={{
                  borderBottom: `1px solid ${T.border}22`,
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                }}>
                  <td style={{ padding: "10px 12px", color: T.muted, fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: "10px 12px", fontWeight: 700 }}>{a.nombre}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                      background: a.genero === "Masculino" ? "rgba(41,121,255,0.12)" : "rgba(255,64,129,0.12)",
                      color: a.genero === "Masculino" ? "#2979FF" : "#FF4081",
                    }}>{a.genero === "Masculino" ? "♂ M" : "♀ F"}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>{a.edad}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 700, background: "rgba(255,215,0,0.1)", color: T.gold }}>{a.grupoEdad}</span>
                  </td>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{a.categoria}</td>
                  <td style={{ padding: "10px 12px" }}><CintBadge cinturon={a.cinturon} small /></td>
                  <td style={{ padding: "10px 12px", color: T.muted }}>{a.profesor}</td>
                  <td style={{ padding: "10px 12px", color: T.muted }}>{a.academia}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {atletasFiltrados.length === 0 && (
          <div style={{ textAlign: "center", padding: 40, color: T.muted }}>No hay atletas con ese filtro</div>
        )}
      </div>
    </div>
  );

  const renderBrackets = () => {
    if (brackets.length === 0) {
      return (
        <div style={{ maxWidth: 1000, margin: "0 auto", padding: "40px 16px", textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.4 }}>🏆</div>
          <div style={{ color: T.muted, fontSize: 16, marginBottom: 20 }}>No hay brackets generados</div>
          <button onClick={handleGenerarBrackets} style={{
            padding: "12px 28px", borderRadius: 10, border: "none", cursor: "pointer",
            fontSize: 14, fontWeight: 700,
            background: `linear-gradient(135deg, ${T.accent}, #c0001d)`,
            color: "#fff", boxShadow: `0 4px 16px rgba(255,23,68,0.3)`,
          }}>Generar Brackets</button>
        </div>
      );
    }

    const parseClave = (c) => { const [g, p, e] = c.split("|"); return { genero: g, peso: p, edad: e }; };

    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>🏆 Brackets del Torneo</h2>
          <button onClick={() => setBrackets(generarBrackets(atletas))} style={{
            padding: "8px 16px", borderRadius: 8, border: `1px solid ${T.border}`,
            cursor: "pointer", fontSize: 12, fontWeight: 700, background: T.surface, color: T.muted,
          }}>🔀 Re-sortear</button>
        </div>

        {brackets.map((bracket, bIdx) => {
          const info = parseClave(bracket.clave);
          const campeon = bracket.rondas.length > 0 ? bracket.rondas[bracket.rondas.length - 1][0]?.ganador : null;

          return (
            <div key={bIdx} style={{
              background: T.card, borderRadius: 16, border: `1px solid ${T.border}`, marginBottom: 20, overflow: "hidden",
            }}>
              <div style={{
                padding: "14px 20px",
                background: `linear-gradient(90deg, ${T.surface}, rgba(255,23,68,0.04))`,
                borderBottom: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: info.genero === "Masculino" ? "rgba(41,121,255,0.12)" : "rgba(255,64,129,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
                  }}>{info.genero === "Masculino" ? "♂" : "♀"}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>{info.genero} · {info.peso}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>Edad: {info.edad} · {bracket.atletas.length} atletas</div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {bracket.cinturones.map((c) => <CintBadge key={c} cinturon={c} small />)}
                </div>
              </div>

              {campeon && (
                <div style={{
                  margin: "16px 20px", padding: "14px 18px",
                  background: "rgba(255,215,0,0.06)", borderRadius: 12,
                  border: `1px solid rgba(255,215,0,0.15)`,
                  display: "flex", alignItems: "center", gap: 12,
                }}>
                  <span style={{ fontSize: 28 }}>🏆</span>
                  <div>
                    <div style={{ fontSize: 10, color: T.gold, textTransform: "uppercase", fontWeight: 800, letterSpacing: 1.5 }}>Campeón</div>
                    <div style={{ fontSize: 18, fontWeight: 900 }}>{campeon.nombre}</div>
                    <div style={{ fontSize: 11, color: T.muted }}>{campeon.academia}</div>
                  </div>
                  <CintBadge cinturon={campeon.cinturon} />
                </div>
              )}

              <div style={{ padding: 20, overflowX: "auto", display: "flex", gap: 20, alignItems: "flex-start" }}>
                {bracket.rondas.map((ronda, rIdx) => (
                  <div key={rIdx} style={{ minWidth: 240, flexShrink: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 800, color: T.accent,
                      textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 10,
                      textAlign: "center", padding: "4px 0", borderBottom: `2px solid ${T.accentSoft}`,
                    }}>{getNombreRonda(rIdx, bracket.totalRondas)}</div>

                    <div style={{
                      display: "flex", flexDirection: "column", gap: 12, justifyContent: "space-around",
                      minHeight: rIdx > 0 ? bracket.rondas[0].length * 90 / Math.pow(2, rIdx) : "auto",
                    }}>
                      {ronda.map((combate, cIdx) => (
                        <div key={combate.id} style={{
                          borderRadius: 10, overflow: "hidden",
                          border: `1px solid ${combate.ganador ? "rgba(0,230,118,0.15)" : T.border}`,
                          background: combate.ganador ? "rgba(0,230,118,0.03)" : T.surface,
                        }}>
                          {combate.atletaA ? (
                            <div onClick={() => {
                              if (combate.atletaA && combate.atletaB && !combate.ganador)
                                seleccionarGanador(bIdx, rIdx, cIdx, combate.atletaA);
                            }} style={{
                              padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
                              cursor: combate.atletaA && combate.atletaB && !combate.ganador ? "pointer" : "default",
                              background: combate.ganador?.id === combate.atletaA?.id ? "rgba(0,230,118,0.08)" : "transparent",
                              borderLeft: combate.ganador?.id === combate.atletaA?.id ? `3px solid ${T.success}` : "3px solid transparent",
                              transition: "all 0.15s",
                              opacity: combate.ganador && combate.ganador?.id !== combate.atletaA?.id ? 0.4 : 1,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{combate.atletaA.nombre}</div>
                                <div style={{ fontSize: 9, color: T.muted }}>{combate.atletaA.academia}</div>
                              </div>
                              <CintBadge cinturon={combate.atletaA.cinturon} small />
                              {combate.ganador?.id === combate.atletaA?.id && <span style={{ fontSize: 12 }}>🏆</span>}
                            </div>
                          ) : (
                            <div style={{ padding: "8px 12px", fontSize: 11, color: T.muted, fontStyle: "italic", borderLeft: "3px solid transparent" }}>Esperando...</div>
                          )}

                          <div style={{
                            textAlign: "center", padding: "2px 0", fontSize: 9,
                            fontWeight: 900, color: T.accent, background: T.accentSoft, letterSpacing: 3,
                          }}>VS</div>

                          {combate.atletaB ? (
                            <div onClick={() => {
                              if (combate.atletaA && combate.atletaB && !combate.ganador)
                                seleccionarGanador(bIdx, rIdx, cIdx, combate.atletaB);
                            }} style={{
                              padding: "8px 12px", display: "flex", alignItems: "center", gap: 8,
                              cursor: combate.atletaA && combate.atletaB && !combate.ganador ? "pointer" : "default",
                              background: combate.ganador?.id === combate.atletaB?.id ? "rgba(0,230,118,0.08)" : "transparent",
                              borderLeft: combate.ganador?.id === combate.atletaB?.id ? `3px solid ${T.success}` : "3px solid transparent",
                              transition: "all 0.15s",
                              opacity: combate.ganador && combate.ganador?.id !== combate.atletaB?.id ? 0.4 : 1,
                            }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{combate.atletaB.nombre}</div>
                                <div style={{ fontSize: 9, color: T.muted }}>{combate.atletaB.academia}</div>
                              </div>
                              <CintBadge cinturon={combate.atletaB.cinturon} small />
                              {combate.ganador?.id === combate.atletaB?.id && <span style={{ fontSize: 12 }}>🏆</span>}
                            </div>
                          ) : (
                            <div style={{ padding: "8px 12px", fontSize: 11, color: T.muted, fontStyle: "italic", borderLeft: "3px solid transparent" }}>
                              {combate.atletaA && !combate.atletaB && combate.ganador ? "BYE" : "Esperando..."}
                            </div>
                          )}

                          {combate.ganador && combate.atletaA && combate.atletaB && (
                            <div style={{ textAlign: "center", padding: "4px 0", borderTop: `1px solid ${T.border}22` }}>
                              <button onClick={() => seleccionarGanador(bIdx, rIdx, cIdx, null)} style={{
                                background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 9, padding: 2,
                              }}>↩ Reiniciar</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div style={{ background: T.card, borderRadius: 14, border: `1px solid ${T.border}`, padding: 20, marginTop: 8 }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: 1.5 }}>
            Reglas de Compatibilidad de Cinturones
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 8 }}>
            {CINTURONES.map((c) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                <CintBadge cinturon={c} small />
                <span style={{ color: T.muted, fontSize: 11 }}>→</span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {COMPATIBILIDAD[c].map((comp) => <CintBadge key={comp} cinturon={comp} small />)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: `linear-gradient(170deg, ${T.bg} 0%, #0d0d28 40%, #101025 100%)`,
      color: T.text, fontFamily: "'Segoe UI', -apple-system, sans-serif",
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a4a; border-radius: 3px; }
        button:hover { filter: brightness(1.1); }
        tr:hover { background: rgba(255,255,255,0.02) !important; }
      `}</style>
      {renderHeader()}
      {vista === "dashboard" && renderDashboard()}
      {vista === "atletas" && renderAtletas()}
      {vista === "brackets" && renderBrackets()}
    </div>
  );
}
