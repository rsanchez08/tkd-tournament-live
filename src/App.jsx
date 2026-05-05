import { useState, useEffect, useCallback, useMemo } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SHEET_ID = "1vC7RFIPBPKrlIms_nizfAYAbeKYeqwlGzEijf6Mnvzo";
const SHEET_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=Respuestas%20de%20formulario%201`;

// ─── PTF CATEGORÍAS ───────────────────────────────────────────────────────────
const GRUPOS_EDAD = ["Infantil", "Cadete", "Juvenil", "Adulto"];
const CATEGORIAS_PTF = {
  Infantil: { Masculino:["-20 kg","-25 kg","-30 kg","-35 kg","-40 kg","+40 kg"], Femenino:["-20 kg","-25 kg","-30 kg","-35 kg","-40 kg","+40 kg"] },
  Cadete:   { Masculino:["-35 kg","-40 kg","-45 kg","-50 kg","-55 kg","-60 kg","+60 kg"], Femenino:["-35 kg","-40 kg","-45 kg","-50 kg","-55 kg","+55 kg"] },
  Juvenil:  { Masculino:["-45 kg","-51 kg","-57 kg","-63 kg","-69 kg","-75 kg","+75 kg"], Femenino:["-40 kg","-46 kg","-52 kg","-58 kg","-64 kg","-70 kg","+70 kg"] },
  Adulto:   { Masculino:["-57 kg","-63 kg","-71 kg","-80 kg","+80 kg"], Femenino:["-50 kg","-56 kg","-62 kg","-68 kg","+68 kg"] },
};
const GRUPO_META = {
  Infantil: { color:"#D97706", soft:"#FEF3C7", border:"#F59E0B", label:"< 12 años" },
  Cadete:   { color:"#7C3AED", soft:"#EDE9FE", border:"#8B5CF6", label:"12–14 años" },
  Juvenil:  { color:"#1D4ED8", soft:"#DBEAFE", border:"#3B82F6", label:"15–17 años" },
  Adulto:   { color:"#B91C1C", soft:"#FEE2E2", border:"#EF4444", label:"18+ años" },
};
const CINTURONES = ["Blanco","Amarillo","Verde","Azul","Rojo","Negro"];
const CINTURON_COLORS = {
  Blanco:   { bg:"#F3F4F6", text:"#374151", border:"#D1D5DB", dot:"#9CA3AF" },
  Amarillo: { bg:"#FEF9C3", text:"#713F12", border:"#FDE047", dot:"#EAB308" },
  Verde:    { bg:"#DCFCE7", text:"#14532D", border:"#4ADE80", dot:"#16A34A" },
  Azul:     { bg:"#DBEAFE", text:"#1E3A8A", border:"#60A5FA", dot:"#2563EB" },
  Rojo:     { bg:"#FEE2E2", text:"#7F1D1D", border:"#FCA5A5", dot:"#DC2626" },
  Negro:    { bg:"#1F2937", text:"#F9FAFB", border:"#4B5563", dot:"#111827" },
};
const COMPATIBILIDAD = {
  Blanco:["Blanco","Amarillo"], Amarillo:["Blanco","Amarillo","Verde"],
  Verde:["Amarillo","Verde","Azul"], Azul:["Verde","Azul","Rojo","Negro"],
  Rojo:["Azul","Rojo","Negro"], Negro:["Azul","Rojo","Negro"],
};

// ─── BRACKET LAYOUT ───────────────────────────────────────────────────────────
const MH=88, MW=220, MG=28, RG=56, U=MH+MG;
const getMatchTop=(r,i)=>U*(i*Math.pow(2,r)+(Math.pow(2,r)-1)/2);
const getRoundX  =(r)=>r*(MW+RG);
const getTotalH  =(n)=>n*U-MG;
const getTotalW  =(rds)=>rds*(MW+RG)-RG;

// ─── DATA ─────────────────────────────────────────────────────────────────────
const sonCompatibles=(c1,c2)=>COMPATIBILIDAD[c1]?.includes(c2)&&COMPATIBILIDAD[c2]?.includes(c1);
const obtenerGrupoEdad=(edad)=>{
  const e=parseInt(edad);
  if(e<12)return"Infantil"; if(e<=14)return"Cadete"; if(e<=17)return"Juvenil"; return"Adulto";
};
const parseCSVLine=(line)=>{
  const r=[];let cur="",inQ=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==='"'){if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ;}
    else if(c===','&&!inQ){r.push(cur);cur="";}else cur+=c;
  }r.push(cur);return r;
};
const parseCSV=(text)=>{
  const lines=text.split("\n").filter(l=>l.trim());
  if(lines.length<2)return[];
  const h=parseCSVLine(lines[0]);
  return lines.slice(1).map((line,idx)=>{
    const v=parseCSVLine(line),obj={};
    h.forEach((k,i)=>{obj[k.trim().replace(/^"|"$/g,"")]=(v[i]||"").trim().replace(/^"|"$/g,"");});
    obj.id=idx+1;return obj;
  });
};
const normalizarAtleta=(row)=>({
  id:row.id,
  nombre:(row["Nombre del competidor"]||row["Nombre Completo"]||"").trim(),
  genero:(row["Genero"]||row["Género"]||row["GÃ©nero"]||"").trim(),
  edad:parseInt(row["Edad"])||0,
  categoria:(row["Peso"]||row["Categoría de Peso"]||row["CategorÃ­a de Peso"]||row["Categoria de Peso"]||"").trim(),
  cinturon:(row["Grado de cinturón"]||row["Cinturón"]||row["CinturÃ³n"]||row["Cinturon"]||"").trim(),
  segmento:(row["Segmento de competición"]||"").trim(),
  telefono:(row["Número telefonico"]||"").trim(),
  profesor:(row["Profesor"]||"").trim(),
  academia:(row["Academia"]||"").trim(),
  grupoEdad:obtenerGrupoEdad(row["Edad"]),
  timestamp:(row["Marca temporal"]||"").trim(),
});
const generarBrackets=(atletas)=>{
  const grupos={};
  atletas.forEach(a=>{const k=`${a.genero}|${a.categoria}|${a.grupoEdad}`;if(!grupos[k])grupos[k]=[];grupos[k].push(a);});
  const brackets=[];
  const oC={Blanco:0,Amarillo:1,Verde:2,Azul:3,Rojo:4,Negro:5};
  Object.entries(grupos).forEach(([clave,grupo])=>{
    const pools=[],seen=new Set();
    grupo.sort((a,b)=>oC[a.cinturon]-oC[b.cinturon]);
    grupo.forEach(a=>{
      if(seen.has(a.id))return;
      let f=false;
      for(const p of pools){if(p.every(x=>sonCompatibles(x.cinturon,a.cinturon))){p.push(a);seen.add(a.id);f=true;break;}}
      if(!f){pools.push([a]);seen.add(a.id);}
    });
    pools.forEach((pool,pi)=>{
      const sh=[...pool].sort(()=>Math.random()-0.5);
      const n=sh.length;if(n<1)return;
      const totalRondas=Math.ceil(Math.log2(Math.max(n,2)));
      const tam=Math.pow(2,totalRondas);
      const rondas=[];
      const r1=[];let idx=0;
      for(let i=0;i<tam/2;i++){
        const a1=idx<sh.length?sh[idx++]:null,a2=idx<sh.length?sh[idx++]:null;
        r1.push({id:`${clave}-P${pi}-R1-C${i}`,atletaA:a1,atletaB:a2,
          ganador:a2===null&&a1?a1:a1===null&&a2?a2:null,ronda:1,posicion:i});
      }
      rondas.push(r1);
      let cpr=r1.length;
      for(let r=2;r<=totalRondas;r++){
        cpr=Math.ceil(cpr/2);
        rondas.push(Array.from({length:cpr},(_,i)=>({id:`${clave}-P${pi}-R${r}-C${i}`,atletaA:null,atletaB:null,ganador:null,ronda:r,posicion:i})));
      }
      if(rondas.length>1)rondas[0].forEach((c,i)=>{if(c.ganador){const sl=i%2===0?"atletaA":"atletaB";if(rondas[1][Math.floor(i/2)])rondas[1][Math.floor(i/2)][sl]=c.ganador;}});
      brackets.push({clave,poolIdx:pi,atletas:pool,rondas,totalRondas,cinturones:[...new Set(pool.map(a=>a.cinturon))]});
    });
  });
  return brackets;
};

// ─── BADGES ───────────────────────────────────────────────────────────────────
const CintBadge=({cinturon,small})=>{
  const c=CINTURON_COLORS[cinturon]||CINTURON_COLORS.Blanco;
  return(
    <span style={{display:"inline-flex",alignItems:"center",gap:4,padding:small?"2px 8px":"3px 12px",
      borderRadius:20,fontSize:small?9:11,fontWeight:700,background:c.bg,color:c.text,
      border:`1px solid ${c.border}`,whiteSpace:"nowrap",letterSpacing:0.5}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:c.dot,flexShrink:0}}/>
      {cinturon}
    </span>
  );
};
const GrupoBadge=({grupo,small})=>{
  const m=GRUPO_META[grupo]||GRUPO_META.Adulto;
  return(
    <span style={{display:"inline-flex",alignItems:"center",padding:small?"2px 8px":"3px 12px",
      borderRadius:4,fontSize:small?9:11,fontWeight:700,background:m.soft,color:m.color,
      border:`1px solid ${m.border}`,whiteSpace:"nowrap",letterSpacing:0.3,textTransform:"uppercase"}}>
      {grupo}
    </span>
  );
};

// ─── PTF LOGO ─────────────────────────────────────────────────────────────────
const PTFLogo=()=>(
  <img src="/PHOTO-2026-04-23-18-26-17.jpg" alt="Professional Taekwondo Federation"
    style={{height:56,width:"auto",display:"block",mixBlendMode:"screen"}}/>
);

// ─── BRACKET CHART ────────────────────────────────────────────────────────────
const BracketChart=({bracket,bIdx,onSelectGanador,getNombreRonda})=>{
  const{rondas,totalRondas}=bracket;
  if(!rondas.length)return null;
  const numR0=rondas[0].length;
  const totalH=Math.max(getTotalH(numR0),MH+20);
  const totalW=getTotalW(totalRondas);
  const paths=[];
  for(let r=0;r<rondas.length-1;r++){
    for(let i=0;i<rondas[r].length;i+=2){
      if(i+1>=rondas[r].length)continue;
      const yA=getMatchTop(r,i)+MH/2,yB=getMatchTop(r,i+1)+MH/2,yN=getMatchTop(r+1,i/2)+MH/2;
      const xR=getRoundX(r)+MW,xM=xR+RG/2,xN=getRoundX(r+1);
      paths.push(`M${xR},${yA} H${xM} M${xR},${yB} H${xM} M${xM},${yA} V${yB} M${xM},${yN} H${xN}`);
    }
  }
  return(
    <div style={{position:"relative",width:totalW,height:totalH,minHeight:MH+20}}>
      <svg style={{position:"absolute",top:0,left:0,width:totalW,height:totalH,overflow:"visible",pointerEvents:"none"}}>
        {paths.map((d,i)=><path key={i} d={d} stroke="#CE1126" strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.4}/>)}
      </svg>
      {rondas.map((_,rIdx)=>(
        <div key={rIdx} style={{position:"absolute",top:-26,left:getRoundX(rIdx),width:MW,
          textAlign:"center",fontSize:9,fontWeight:800,color:"#CE1126",textTransform:"uppercase",letterSpacing:2}}>
          {getNombreRonda(rIdx,totalRondas)}
        </div>
      ))}
      {rondas.map((ronda,rIdx)=>ronda.map((combate,cIdx)=>{
        const top=getMatchTop(rIdx,cIdx),left=getRoundX(rIdx);
        const canClick=combate.atletaA&&combate.atletaB&&!combate.ganador;
        const winA=combate.ganador?.id===combate.atletaA?.id;
        const winB=combate.ganador?.id===combate.atletaB?.id;
        return(
          <div key={combate.id} style={{position:"absolute",top,left,width:MW,height:MH,
            borderRadius:8,overflow:"hidden",display:"flex",flexDirection:"column",
            border:combate.ganador?"1px solid rgba(206,17,38,0.35)":"1px solid #E5E7EB",
            background:combate.ganador?"#FFF9F9":"#FFFFFF",
            boxShadow:combate.ganador?"0 2px 12px rgba(206,17,38,0.08)":"0 1px 4px rgba(0,0,0,0.07)"}}>
            {/* Atleta A */}
            <div onClick={()=>canClick&&onSelectGanador(bIdx,rIdx,cIdx,combate.atletaA)} style={{
              flex:1,display:"flex",alignItems:"center",gap:8,padding:"0 12px",
              cursor:canClick?"pointer":"default",transition:"all 0.15s",
              background:winA?"#FEF2F2":"transparent",
              borderLeft:winA?"3px solid #CE1126":"3px solid transparent",
              opacity:combate.ganador&&!winA?0.35:1}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:winA?"#CE1126":"#111827"}}>
                  {combate.atletaA?.nombre||<span style={{color:"#9CA3AF",fontStyle:"italic",fontSize:11}}>Esperando…</span>}
                </div>
                {combate.atletaA&&<div style={{fontSize:9,color:"#6B7280",marginTop:1}}>{combate.atletaA.academia}</div>}
              </div>
              {combate.atletaA&&<CintBadge cinturon={combate.atletaA.cinturon} small/>}
              {winA&&<span style={{fontSize:12}}>🏆</span>}
            </div>
            {/* VS */}
            <div style={{height:18,display:"flex",alignItems:"center",justifyContent:"center",
              background:"#F9FAFB",borderTop:"1px solid #F3F4F6",borderBottom:"1px solid #F3F4F6",
              fontSize:8,fontWeight:900,color:"#9CA3AF",letterSpacing:4}}>VS</div>
            {/* Atleta B */}
            <div onClick={()=>canClick&&onSelectGanador(bIdx,rIdx,cIdx,combate.atletaB)} style={{
              flex:1,display:"flex",alignItems:"center",gap:8,padding:"0 12px",
              cursor:canClick?"pointer":"default",transition:"all 0.15s",
              background:winB?"#FEF2F2":"transparent",
              borderLeft:winB?"3px solid #CE1126":"3px solid transparent",
              opacity:combate.ganador&&!winB?0.35:1}}>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",color:winB?"#CE1126":"#111827"}}>
                  {combate.atletaB?combate.atletaB.nombre:combate.atletaA&&combate.ganador?<span style={{color:"#9CA3AF"}}>BYE</span>:<span style={{color:"#9CA3AF",fontStyle:"italic",fontSize:11}}>Esperando…</span>}
                </div>
                {combate.atletaB&&<div style={{fontSize:9,color:"#6B7280",marginTop:1}}>{combate.atletaB.academia}</div>}
              </div>
              {combate.atletaB&&<CintBadge cinturon={combate.atletaB.cinturon} small/>}
              {winB&&<span style={{fontSize:12}}>🏆</span>}
            </div>
            {combate.ganador&&combate.atletaA&&combate.atletaB&&(
              <button onClick={()=>onSelectGanador(bIdx,rIdx,cIdx,null)} style={{
                position:"absolute",bottom:2,right:6,background:"none",border:"none",
                color:"#9CA3AF",cursor:"pointer",fontSize:9,padding:2}}>↩ reiniciar</button>
            )}
          </div>
        );
      }))}
    </div>
  );
};

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function TKDTournament(){
  const[atletas,setAtletas]=useState([]);
  const[loading,setLoading]=useState(true);
  const[error,setError]=useState(null);
  const[lastUpdate,setLastUpdate]=useState(null);
  const[vista,setVista]=useState("dashboard");
  const[brackets,setBrackets]=useState([]);
  // Athlete filters
  const[filtros,setFiltros]=useState({cinturones:[],generos:[],grupos:[],categorias:[]});
  // Bracket filters
  const[bFiltros,setBFiltros]=useState({grupos:[],generos:[],pesos:[],cinturones:[]});

  // Light theme
  const T={
    bg:"#F3F4F6",card:"#FFFFFF",accent:"#CE1126",accentSoft:"rgba(206,17,38,0.07)",
    blue:"#002B7F",blueSoft:"rgba(0,43,127,0.08)",gold:"#92400E",
    text:"#111827",sub:"#374151",muted:"#6B7280",border:"#E5E7EB",
    success:"#059669",shadow:"0 1px 3px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.04)",
    shadowMd:"0 4px 6px rgba(0,0,0,0.07),0 2px 4px rgba(0,0,0,0.05)",
    shadowLg:"0 10px 15px rgba(0,0,0,0.08),0 4px 6px rgba(0,0,0,0.04)",
  };

  const toggleFiltro=(tipo,valor)=>setFiltros(p=>({...p,[tipo]:p[tipo].includes(valor)?p[tipo].filter(v=>v!==valor):[...p[tipo],valor]}));
  const limpiarFiltros=()=>setFiltros({cinturones:[],generos:[],grupos:[],categorias:[]});
  const hayFiltros=Object.values(filtros).some(a=>a.length>0);

  const toggleBFiltro=(tipo,valor)=>setBFiltros(p=>({...p,[tipo]:p[tipo].includes(valor)?p[tipo].filter(v=>v!==valor):[...p[tipo],valor]}));
  const limpiarBFiltros=()=>setBFiltros({grupos:[],generos:[],pesos:[],cinturones:[]});
  const hayBFiltros=Object.values(bFiltros).some(a=>a.length>0);

  const cargarDatos=useCallback(async()=>{
    setLoading(true);setError(null);
    try{
      const res=await fetch(SHEET_CSV_URL);
      if(!res.ok)throw new Error("No se pudo acceder al spreadsheet.");
      const text=await res.text();
      const lista=parseCSV(text).map(normalizarAtleta).filter(a=>a.nombre);
      setAtletas(lista);setLastUpdate(new Date());
    }catch(err){
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
  },[]);
  useEffect(()=>{cargarDatos();},[cargarDatos]);

  const stats=useMemo(()=>{
    const masc=atletas.filter(a=>a.genero==="Masculino").length;
    const fem=atletas.filter(a=>a.genero==="Femenino").length;
    const academias=[...new Set(atletas.map(a=>a.academia))];
    const grupos={};GRUPOS_EDAD.forEach(g=>{grupos[g]=atletas.filter(a=>a.grupoEdad===g).length;});
    const cinturones={};atletas.forEach(a=>{cinturones[a.cinturon]=(cinturones[a.cinturon]||0)+1;});
    return{total:atletas.length,masc,fem,academias,grupos,cinturones};
  },[atletas]);

  const atletasFiltrados=useMemo(()=>atletas.filter(a=>{
    if(filtros.cinturones.length>0&&!filtros.cinturones.includes(a.cinturon))return false;
    if(filtros.generos.length>0&&!filtros.generos.includes(a.genero))return false;
    if(filtros.grupos.length>0&&!filtros.grupos.includes(a.grupoEdad))return false;
    if(filtros.categorias.length>0&&!filtros.categorias.includes(a.categoria))return false;
    return true;
  }),[atletas,filtros]);

  const bracketsFiltrados=useMemo(()=>{
    if(!hayBFiltros)return brackets;
    return brackets.filter(br=>{
      const[genero,peso,grupo]=br.clave.split("|");
      if(bFiltros.grupos.length>0&&!bFiltros.grupos.includes(grupo))return false;
      if(bFiltros.generos.length>0&&!bFiltros.generos.includes(genero))return false;
      if(bFiltros.pesos.length>0&&!bFiltros.pesos.includes(peso))return false;
      if(bFiltros.cinturones.length>0&&!br.cinturones.some(c=>bFiltros.cinturones.includes(c)))return false;
      return true;
    });
  },[brackets,bFiltros,hayBFiltros]);

  const handleGenerarBrackets=()=>{setBrackets(generarBrackets(atletas));setVista("brackets");};
  const seleccionarGanador=(bIdx,rIdx,cIdx,ganador)=>{
    setBrackets(prev=>{
      const copy=JSON.parse(JSON.stringify(prev));
      const br=copy[bIdx],c=br.rondas[rIdx][cIdx];
      if(c.ganador&&rIdx+1<br.rondas.length){
        const np=Math.floor(cIdx/2),sl=cIdx%2===0?"atletaA":"atletaB";
        if(br.rondas[rIdx+1][np]){
          br.rondas[rIdx+1][np][sl]=null;br.rondas[rIdx+1][np].ganador=null;
          for(let r=rIdx+2;r<br.rondas.length;r++)br.rondas[r].forEach(x=>{x.atletaA=null;x.atletaB=null;x.ganador=null;});
        }
      }
      c.ganador=ganador;
      if(ganador&&rIdx+1<br.rondas.length){const np=Math.floor(cIdx/2),sl=cIdx%2===0?"atletaA":"atletaB";if(br.rondas[rIdx+1][np])br.rondas[rIdx+1][np][sl]=ganador;}
      return copy;
    });
  };
  const getNombreRonda=(rIdx,total)=>{const d=total-rIdx;if(d===1)return"FINAL";if(d===2)return"Semifinal";if(d===3)return"Cuartos";return`Ronda ${rIdx+1}`;};

  // ─── HEADER ──────────────────────────────────────────────────────────────
  const renderHeader=()=>(
    <div style={{background:"#0B1120",borderBottom:"3px solid #CE1126",padding:"12px 28px",
      display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12,
      position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 16px rgba(0,0,0,0.4)"}}>
      <PTFLogo/>
      <nav style={{display:"flex",gap:4}}>
        {[{id:"dashboard",label:"Dashboard",icon:"📊"},{id:"atletas",label:"Atletas",icon:"🥋"},{id:"brackets",label:"Brackets",icon:"🏆"}].map(v=>(
          <button key={v.id} onClick={()=>setVista(v.id)} style={{
            padding:"8px 18px",borderRadius:6,border:"none",cursor:"pointer",
            fontSize:13,fontWeight:600,transition:"all 0.15s",
            background:vista===v.id?"#CE1126":"transparent",
            color:vista===v.id?"#fff":"rgba(255,255,255,0.6)",
            letterSpacing:0.3}}>
            {v.icon} {v.label}
            {v.id==="atletas"&&atletas.length>0&&(
              <span style={{marginLeft:6,padding:"1px 7px",borderRadius:10,fontSize:10,fontWeight:800,
                background:vista===v.id?"rgba(255,255,255,0.25)":"rgba(206,17,38,0.3)",
                color:vista===v.id?"#fff":"#FF8A80"}}>{atletas.length}</span>
            )}
          </button>
        ))}
      </nav>
      <button onClick={cargarDatos} style={{padding:"8px 16px",borderRadius:6,
        border:"1px solid rgba(255,255,255,0.15)",cursor:"pointer",fontSize:12,fontWeight:600,
        background:"transparent",color:"rgba(255,255,255,0.7)",display:"flex",alignItems:"center",gap:6}}>
        🔄 Actualizar
      </button>
    </div>
  );

  // ─── DASHBOARD ───────────────────────────────────────────────────────────
  const renderDashboard=()=>(
    <div style={{maxWidth:1080,margin:"0 auto",padding:"32px 24px"}}>
      {loading&&<div style={{textAlign:"center",padding:60,color:T.muted}}><div style={{fontSize:40,marginBottom:12,animation:"spin 1s linear infinite"}}>🥋</div><div style={{fontSize:15}}>Cargando atletas…</div></div>}
      {error&&<div style={{padding:"12px 18px",borderRadius:8,marginBottom:20,background:"#FEF2F2",border:"1px solid #FECACA",color:"#991B1B",fontSize:13,fontWeight:500}}>⚠️ {error}</div>}

      {/* Page title */}
      <div style={{marginBottom:28}}>
        <h1 style={{margin:0,fontSize:26,fontWeight:800,color:T.text,letterSpacing:-0.5}}>Panel General</h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:T.muted}}>
          Professional Taekwondo Federation · Costa Rica
          {lastUpdate&&<span> · Actualizado {lastUpdate.toLocaleTimeString("es-CR")}</span>}
        </p>
      </div>

      {/* Stat cards */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:14,marginBottom:24}}>
        {[
          {icon:"🤼",value:stats.total,label:"Total Atletas",color:T.accent},
          {icon:"♂",value:stats.masc,label:"Masculino",color:"#1D4ED8"},
          {icon:"♀",value:stats.fem,label:"Femenino",color:"#DB2777"},
          {icon:"🏫",value:stats.academias.length,label:"Academias",color:"#059669"},
        ].map(s=>(
          <div key={s.label} style={{background:T.card,borderRadius:10,padding:"20px 18px",
            boxShadow:T.shadow,border:`1px solid ${T.border}`}}>
            <div style={{fontSize:11,color:T.muted,fontWeight:600,textTransform:"uppercase",letterSpacing:1,marginBottom:8}}>{s.icon} {s.label}</div>
            <div style={{fontSize:34,fontWeight:800,color:s.color,letterSpacing:-1}}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Grupos de edad */}
      <div style={{background:T.card,borderRadius:12,padding:24,boxShadow:T.shadow,border:`1px solid ${T.border}`,marginBottom:20}}>
        <h2 style={{margin:"0 0 18px",fontSize:14,fontWeight:700,color:T.text,textTransform:"uppercase",letterSpacing:1}}>Grupos de Edad</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
          {GRUPOS_EDAD.map(g=>{
            const m=GRUPO_META[g],count=stats.grupos[g]||0;
            return(
              <div key={g} onClick={()=>{toggleFiltro("grupos",g);setVista("atletas");}} style={{
                cursor:"pointer",padding:"16px 18px",borderRadius:10,
                background:m.soft,border:`1.5px solid ${m.border}`,transition:"all 0.15s",
              }}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:800,color:m.color,textTransform:"uppercase",letterSpacing:0.5}}>{g}</div>
                    <div style={{fontSize:11,color:m.color,opacity:0.7,marginTop:2}}>{m.label}</div>
                  </div>
                  <div style={{fontSize:28,fontWeight:900,color:m.color}}>{count}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cinturones + Academias */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:28}}>
        <div style={{background:T.card,borderRadius:12,padding:20,boxShadow:T.shadow,border:`1px solid ${T.border}`}}>
          <h2 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:T.text,textTransform:"uppercase",letterSpacing:1}}>Por Cinturón</h2>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {CINTURONES.map(c=>{
              const cc=CINTURON_COLORS[c],count=stats.cinturones[c]||0,pct=stats.total?Math.round(count/stats.total*100):0;
              return(
                <div key={c} onClick={()=>{toggleFiltro("cinturones",c);setVista("atletas");}}
                  style={{cursor:"pointer",display:"flex",alignItems:"center",gap:10}}>
                  <CintBadge cinturon={c} small/>
                  <div style={{flex:1,height:6,borderRadius:3,background:"#F3F4F6",overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:cc.dot,borderRadius:3,transition:"width 0.3s"}}/>
                  </div>
                  <span style={{fontSize:12,fontWeight:700,color:T.sub,minWidth:20,textAlign:"right"}}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{background:T.card,borderRadius:12,padding:20,boxShadow:T.shadow,border:`1px solid ${T.border}`}}>
          <h2 style={{margin:"0 0 14px",fontSize:13,fontWeight:700,color:T.text,textTransform:"uppercase",letterSpacing:1}}>Academias</h2>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {stats.academias.map(ac=>{
              const count=atletas.filter(a=>a.academia===ac).length;
              return(
                <div key={ac} style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                  padding:"8px 12px",borderRadius:8,background:"#F9FAFB",border:`1px solid ${T.border}`}}>
                  <span style={{fontSize:13,fontWeight:600,color:T.sub}}>{ac}</span>
                  <span style={{fontSize:12,fontWeight:700,color:T.accent,background:"#FEE2E2",padding:"2px 8px",borderRadius:20}}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{textAlign:"center"}}>
        <button onClick={handleGenerarBrackets} disabled={atletas.length<2} style={{
          padding:"14px 40px",borderRadius:8,border:"none",
          cursor:atletas.length<2?"not-allowed":"pointer",
          fontSize:15,fontWeight:700,letterSpacing:0.5,
          background:atletas.length<2?"#D1D5DB":"#CE1126",
          color:"#fff",boxShadow:atletas.length>=2?"0 4px 16px rgba(206,17,38,0.35)":"none",
          transition:"all 0.3s"}}>
          🏆 Generar Brackets ({atletas.length} atletas)
        </button>
      </div>
    </div>
  );

  // ─── ATLETAS ─────────────────────────────────────────────────────────────
  const renderAtletas=()=>{
    const FBtn=({label,active,color,onClick})=>(
      <button onClick={onClick} style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,
        border:active?`1.5px solid ${color}`:`1px solid ${T.border}`,
        background:active?`${color}12`:"transparent",color:active?color:T.muted,transition:"all 0.15s"}}>{label}</button>
    );
    const categoriasDisp=filtros.grupos.length>0
      ?filtros.grupos.flatMap(g=>{const gc=CATEGORIAS_PTF[g]||{};
        return filtros.generos.length>0?filtros.generos.flatMap(gn=>gc[gn]||[]):[...new Set([...(gc.Masculino||[]),...(gc.Femenino||[])])];
      }):[...new Set(atletas.map(a=>a.categoria))].sort();

    return(
      <div style={{maxWidth:1080,margin:"0 auto",padding:"28px 24px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20,flexWrap:"wrap",gap:10}}>
          <div>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,color:T.text}}>Atletas Inscritos</h1>
            <p style={{margin:"4px 0 0",fontSize:13,color:T.muted}}>
              {atletasFiltrados.length}{hayFiltros?` de ${atletas.length} total`:` atletas registrados`}
            </p>
          </div>
          {hayFiltros&&(
            <button onClick={limpiarFiltros} style={{padding:"7px 16px",borderRadius:6,
              border:`1px solid #FECACA`,background:"#FEF2F2",color:"#B91C1C",cursor:"pointer",fontSize:12,fontWeight:600}}>
              ✕ Limpiar filtros
            </button>
          )}
        </div>

        {/* Filtros */}
        <div style={{background:T.card,borderRadius:12,padding:20,boxShadow:T.shadow,border:`1px solid ${T.border}`,marginBottom:16}}>
          {[
            {label:"Grupo",tipo:"grupos",opts:GRUPOS_EDAD.map(g=>({val:g,color:GRUPO_META[g].color}))},
            {label:"Cinturón",tipo:"cinturones",opts:CINTURONES.map(c=>({val:c,color:CINTURON_COLORS[c].dot}))},
            {label:"Género",tipo:"generos",opts:[{val:"Masculino",color:"#1D4ED8"},{val:"Femenino",color:"#DB2777"}]},
            {label:"Peso",tipo:"categorias",opts:categoriasDisp.map(c=>({val:c,color:"#059669"}))},
          ].map(({label,tipo,opts})=>(
            <div key={tipo} style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:10}}>
              <span style={{fontSize:11,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,minWidth:64}}>{label}</span>
              {opts.map(({val,color})=>(
                <FBtn key={val} label={val} active={filtros[tipo].includes(val)} color={color}
                  onClick={()=>toggleFiltro(tipo,val)}/>
              ))}
            </div>
          ))}
        </div>

        {/* Chips activos */}
        {hayFiltros&&(
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
            <span style={{fontSize:11,color:T.muted,fontWeight:600}}>Filtros activos:</span>
            {Object.entries(filtros).flatMap(([tipo,vals])=>vals.map(v=>(
              <span key={`${tipo}-${v}`} onClick={()=>toggleFiltro(tipo,v)} style={{
                padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:600,cursor:"pointer",
                background:"#FEE2E2",border:"1px solid #FECACA",color:"#991B1B"}}>
                {v} ✕
              </span>
            )))}
          </div>
        )}

        {/* Tabla */}
        <div style={{background:T.card,borderRadius:12,boxShadow:T.shadowMd,border:`1px solid ${T.border}`,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{background:"#F9FAFB",borderBottom:`2px solid ${T.border}`}}>
                  {["#","Nombre","Género","Edad","Grupo","Categoría","Cinturón","Academia","Teléfono"].map(h=>(
                    <th key={h} style={{padding:"11px 14px",textAlign:"left",color:T.muted,fontWeight:700,fontSize:11,textTransform:"uppercase",letterSpacing:0.8,whiteSpace:"nowrap"}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {atletasFiltrados.map((a,i)=>(
                  <tr key={a.id} style={{borderBottom:`1px solid ${T.border}`,transition:"background 0.1s"}}>
                    <td style={{padding:"10px 14px",color:T.muted,fontWeight:600,fontSize:12}}>{i+1}</td>
                    <td style={{padding:"10px 14px",fontWeight:700,color:T.text}}>{a.nombre}</td>
                    <td style={{padding:"10px 14px"}}>
                      <span style={{padding:"2px 10px",borderRadius:20,fontSize:11,fontWeight:600,
                        background:a.genero==="Masculino"?"#DBEAFE":"#FCE7F3",
                        color:a.genero==="Masculino"?"#1E3A8A":"#831843"}}>
                        {a.genero==="Masculino"?"♂ Masc":"♀ Fem"}
                      </span>
                    </td>
                    <td style={{padding:"10px 14px",color:T.sub,fontWeight:500}}>{a.edad}</td>
                    <td style={{padding:"10px 14px"}}><GrupoBadge grupo={a.grupoEdad} small/></td>
                    <td style={{padding:"10px 14px",fontWeight:600,color:T.sub}}>{a.categoria}</td>
                    <td style={{padding:"10px 14px"}}><CintBadge cinturon={a.cinturon} small/></td>
                    <td style={{padding:"10px 14px",color:T.muted}}>{a.academia}</td>
                    <td style={{padding:"10px 14px",color:T.muted,whiteSpace:"nowrap"}}>{a.telefono||"—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {atletasFiltrados.length===0&&(
            <div style={{textAlign:"center",padding:48,color:T.muted}}>
              <div style={{fontSize:32,marginBottom:8}}>🔍</div>
              <div style={{fontSize:14}}>No hay atletas con esa combinación de filtros</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ─── BRACKETS ────────────────────────────────────────────────────────────
  const renderBrackets=()=>{
    const parseClave=c=>{const[g,p,e]=c.split("|");return{genero:g,peso:p,edad:e};};
    const allPesos=[...new Set(brackets.map(b=>b.clave.split("|")[1]))].sort();
    const allCints=[...new Set(brackets.flatMap(b=>b.cinturones))];
    const BFBtn=({label,active,color,onClick})=>(
      <button onClick={onClick} style={{padding:"5px 12px",borderRadius:6,cursor:"pointer",fontSize:11,fontWeight:600,
        border:active?`1.5px solid ${color}`:`1px solid ${T.border}`,
        background:active?`${color}14`:"transparent",
        color:active?color:T.muted,transition:"all 0.15s"}}>{label}</button>
    );

    if(!brackets.length)return(
      <div style={{maxWidth:900,margin:"0 auto",padding:"80px 24px",textAlign:"center"}}>
        <div style={{fontSize:56,marginBottom:16,opacity:0.15}}>🏆</div>
        <div style={{color:T.muted,fontSize:16,marginBottom:28}}>No hay brackets generados aún</div>
        <button onClick={handleGenerarBrackets} style={{padding:"13px 32px",borderRadius:8,border:"none",cursor:"pointer",
          fontSize:14,fontWeight:700,color:"#fff",background:"#CE1126",
          boxShadow:"0 4px 16px rgba(206,17,38,0.35)"}}>Generar Brackets</button>
      </div>
    );

    return(
      <div style={{minHeight:"calc(100vh - 72px)",background:T.bg,padding:"28px 24px"}}>
        <div style={{maxWidth:1200,margin:"0 auto"}}>

          {/* Page header */}
          <div style={{textAlign:"center",marginBottom:32}}>
            <div style={{fontSize:10,color:T.accent,letterSpacing:4,textTransform:"uppercase",marginBottom:6,fontWeight:700}}>Tournament Bracket</div>
            <div style={{fontSize:26,fontWeight:900,letterSpacing:2,textTransform:"uppercase",color:T.text}}>
              PTF TAEKWONDO · COSTA RICA
            </div>
            <div style={{marginTop:14,display:"flex",justifyContent:"center",gap:10}}>
              <button onClick={()=>setBrackets(generarBrackets(atletas))} style={{
                padding:"8px 18px",borderRadius:7,border:`1px solid ${T.border}`,
                background:T.card,color:T.sub,cursor:"pointer",fontSize:12,fontWeight:700,
                boxShadow:T.shadow}}>
                🔀 Re-sortear
              </button>
            </div>
          </div>

          {/* Bracket filters */}
          <div style={{background:T.card,borderRadius:12,padding:18,
            border:`1px solid ${T.border}`,marginBottom:24,boxShadow:T.shadow}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:8}}>
              <div style={{fontSize:11,color:T.accent,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5}}>
                🔍 Filtrar Brackets
                {hayBFiltros&&<span style={{marginLeft:8,fontSize:10,color:T.muted}}>{bracketsFiltrados.length} de {brackets.length}</span>}
              </div>
              {hayBFiltros&&(
                <button onClick={limpiarBFiltros} style={{padding:"4px 12px",borderRadius:6,
                  border:"1px solid #FECACA",background:"#FEF2F2",
                  color:"#B91C1C",cursor:"pointer",fontSize:11,fontWeight:600}}>✕ Limpiar</button>
              )}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,minWidth:64}}>Grupo</span>
                {GRUPOS_EDAD.map(g=><BFBtn key={g} label={g} active={bFiltros.grupos.includes(g)} color={GRUPO_META[g].color} onClick={()=>toggleBFiltro("grupos",g)}/>)}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,minWidth:64}}>Género</span>
                <BFBtn label="♂ Masculino" active={bFiltros.generos.includes("Masculino")} color="#1D4ED8" onClick={()=>toggleBFiltro("generos","Masculino")}/>
                <BFBtn label="♀ Femenino"  active={bFiltros.generos.includes("Femenino")}  color="#DB2777" onClick={()=>toggleBFiltro("generos","Femenino")}/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <span style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,minWidth:64}}>Peso</span>
                {allPesos.map(p=><BFBtn key={p} label={p} active={bFiltros.pesos.includes(p)} color="#059669" onClick={()=>toggleBFiltro("pesos",p)}/>)}
              </div>
              {allCints.length>0&&(
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,color:T.muted,fontWeight:700,textTransform:"uppercase",letterSpacing:1,minWidth:64}}>Cinturón</span>
                  {allCints.map(c=><BFBtn key={c} label={c} active={bFiltros.cinturones.includes(c)} color={CINTURON_COLORS[c]?.dot||T.accent} onClick={()=>toggleBFiltro("cinturones",c)}/>)}
                </div>
              )}
            </div>
          </div>

          {bracketsFiltrados.length===0&&hayBFiltros&&(
            <div style={{textAlign:"center",padding:60,color:T.muted}}>
              <div style={{fontSize:36,marginBottom:10}}>🔍</div>
              <div>Ningún bracket coincide con los filtros seleccionados</div>
            </div>
          )}

          {/* Brackets */}
          {bracketsFiltrados.map((bracket,bIdx)=>{
            const info=parseClave(bracket.clave);
            const gm=GRUPO_META[info.edad]||GRUPO_META.Adulto;
            const campeon=bracket.rondas[bracket.rondas.length-1]?.[0]?.ganador;
            return(
              <div key={bIdx} style={{marginBottom:28,
                background:T.card,
                border:campeon?`1px solid rgba(206,17,38,0.25)`:`1px solid ${T.border}`,
                borderRadius:14,overflow:"hidden",
                boxShadow:campeon?T.shadowMd:T.shadow}}>
                {/* Header */}
                <div style={{padding:"14px 22px",
                  borderBottom:`1px solid ${T.border}`,
                  display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,
                  background:`linear-gradient(90deg,${gm.soft},${T.card})`}}>
                  <div style={{display:"flex",alignItems:"center",gap:14}}>
                    <div style={{width:40,height:40,borderRadius:8,background:gm.soft,
                      display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,
                      border:`1px solid ${gm.border}`}}>
                      {info.genero==="Masculino"?"♂":"♀"}
                    </div>
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                        <GrupoBadge grupo={info.edad} small/>
                        <span style={{fontSize:14,fontWeight:800,color:T.text}}>{info.genero} · {info.peso}</span>
                      </div>
                      <div style={{fontSize:11,color:T.muted}}>{bracket.atletas.length} atletas</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:4}}>{bracket.cinturones.map(c=><CintBadge key={c} cinturon={c} small/>)}</div>
                </div>
                {/* Champion */}
                {campeon&&(
                  <div style={{margin:"14px 22px",padding:"14px 18px",borderRadius:10,
                    background:"#FEF9F9",border:"1px solid rgba(206,17,38,0.2)",
                    display:"flex",alignItems:"center",gap:14}}>
                    <div style={{fontSize:32}}>🏆</div>
                    <div>
                      <div style={{fontSize:9,color:T.accent,textTransform:"uppercase",fontWeight:800,letterSpacing:2,marginBottom:3}}>Campeón</div>
                      <div style={{fontSize:18,fontWeight:900,color:T.accent}}>{campeon.nombre}</div>
                      <div style={{fontSize:11,color:T.muted}}>{campeon.academia}</div>
                    </div>
                    <CintBadge cinturon={campeon.cinturon}/>
                  </div>
                )}
                {/* Chart */}
                <div style={{padding:"38px 22px 24px",overflowX:"auto"}}>
                  <BracketChart bracket={bracket} bIdx={bIdx} onSelectGanador={seleccionarGanador} getNombreRonda={getNombreRonda}/>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return(
    <div style={{minHeight:"100vh",background:T.bg,
      color:T.text,fontFamily:"'Segoe UI',-apple-system,BlinkMacSystemFont,sans-serif"}}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:6px;height:6px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#D1D5DB;border-radius:3px;}
        button:hover{filter:brightness(1.08);}
        tbody tr:hover{background:#F9FAFB!important;}
      `}</style>
      {renderHeader()}
      {vista==="dashboard"&&renderDashboard()}
      {vista==="atletas"  &&renderAtletas()}
      {vista==="brackets" &&renderBrackets()}
    </div>
  );
}
