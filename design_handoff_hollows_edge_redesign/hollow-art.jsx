/* Art + palette lifted VERBATIM from jacobstrong3357/Hollow-edge index.html
   (lines 4718-5993, 6382-6398, 6493-6511). Do not restyle: this is the
   pixel-perfect source of truth for the recreation. */
const { useState, useEffect, useRef } = React;
const npcById = (s, id) => s.npcs.find((n) => n.id === id);

const C = {
  bg: "#101321", panel: "#171B2E", panel2: "#1E2338", line: "#2B3050",
  text: "#C9CBD8", dim: "#8A8FA8", amber: "#D9A441", red: "#9E3039", redBright: "#C24450",
  parch: "#E9DFC8", parchLine: "#C9B98F", ink: "#2B2416", inkDim: "#6B5F44", turn: "#7A5FA0",
  sky: "#141830", ground: "#0B0E1C", sil: "#05070F", pale: "#AEB4CC", garment: "#232845",
};

function Scene({ loc, kind, height = 150 }) {
  const win = (x, y, w = 8, h = 12, arch) => (
    <g key={`w${x}${y}`}>
      <rect x={x} y={y} width={w} height={h} fill={C.amber} opacity="0.8" className="mvFlick" />
      {arch && <circle cx={x + w / 2} cy={y} r={w / 2} fill={C.amber} opacity="0.8" className="mvFlick" />}
    </g>
  );
  const pine = (x, sc = 1) => (
    <g key={`p${x}`} transform={`translate(${x},0) scale(${sc})`}>
      <polygon points="0,155 -22,155 -11,110" fill={C.sil} />
      <polygon points="0,132 -20,132 -10,92" fill={C.sil} />
      <polygon points="-2,112 -18,112 -10,80" fill={C.sil} />
      <rect x="-13" y="152" width="5" height="8" fill={C.sil} />
    </g>
  );
  const stone = (x, y, w, h) => <rect key={`s${x}`} x={x} y={y} width={w} height={h} rx={w / 2.2} fill={C.sil} />;
  const house = (x, w, h, withWin = true) => (
    <g key={`h${x}`}>
      <rect x={x} y={160 - h} width={w} height={h} fill={C.sil} />
      <polygon points={`${x - 5},${160 - h} ${x + w + 5},${160 - h} ${x + w / 2},${160 - h - 22}`} fill={C.sil} />
      {withWin && win(x + w / 2 - 4, 160 - h + 12)}
    </g>
  );
  let elems = null;
  if (loc === "Graveyard") elems = (<g>{stone(70, 122, 26, 38)}{stone(120, 132, 22, 28)}{stone(255, 126, 24, 34)}
    <rect x="200" y="106" width="6" height="54" fill={C.sil} /><rect x="188" y="118" width="30" height="6" fill={C.sil} />
    <path d="M310,160 L310,100 M310,118 L292,98 M310,132 L330,110 M310,108 L322,90" stroke={C.sil} strokeWidth="5" fill="none" strokeLinecap="round" /></g>);
  else if (loc === "Dark Forest") elems = <g>{pine(60, 1)}{pine(120, 1.25)}{pine(185, 0.9)}{pine(250, 1.35)}{pine(315, 1.05)}</g>;
  else if (loc === "Old Church") elems = (<g>
    <rect x="150" y="112" width="120" height="48" fill={C.sil} />
    <rect x="100" y="62" width="50" height="98" fill={C.sil} />
    <polygon points="95,62 155,62 125,20" fill={C.sil} />
    <rect x="122" y="8" width="5" height="14" fill={C.sil} /><rect x="116" y="12" width="17" height="4" fill={C.sil} />
    {win(120, 80, 9, 16, true)}{win(180, 126, 9, 14, true)}{win(220, 126, 9, 14, true)}</g>);
  else if (loc === "Village Square") elems = (<g>{house(40, 70, 55)}{house(290, 70, 62)}
    <ellipse cx="195" cy="156" rx="42" ry="8" fill={C.sil} />
    <rect x="189" y="118" width="12" height="38" fill={C.sil} />
    <ellipse cx="195" cy="118" rx="20" ry="5" fill={C.sil} /></g>);
  else if (loc === "Tavern") elems = (<g>
    <rect x="100" y="82" width="180" height="78" fill={C.sil} />
    <polygon points="90,82 290,82 190,48" fill={C.sil} />
    <rect x="178" y="118" width="24" height="42" fill={C.ink} />
    {win(130, 100, 12, 16)}{win(240, 100, 12, 16)}
    <rect x="282" y="88" width="26" height="4" fill={C.sil} />
    <rect x="296" y="92" width="16" height="20" fill={C.amber} opacity="0.75" />
    <ellipse cx="80" cy="152" rx="14" ry="10" fill={C.sil} /></g>);
  else if (loc === "Old Mill") elems = (<g>
    <rect x="118" y="92" width="92" height="68" fill={C.sil} />
    <polygon points="110,92 218,92 164,56" fill={C.sil} />
    <rect x="200" y="118" width="10" height="42" fill={C.ink} />
    {win(140, 114, 10, 14)}
    <circle cx="235" cy="130" r="30" fill="none" stroke={C.sil} strokeWidth="6" />
    <circle cx="235" cy="130" r="5" fill={C.sil} />
    <path d="M235,130 L265,130 M235,130 L256,151 M235,130 L235,160 M235,130 L214,151 M235,130 L205,130 M235,130 L214,109 M235,130 L235,100 M235,130 L256,109" stroke={C.sil} strokeWidth="4" />
    <rect x="195" y="158" width="90" height="6" fill={C.sil} opacity="0.7" /></g>);
  else elems = (<g>{house(140, 110, 68)}
    <rect x="222" y="66" width="12" height="24" fill={C.sil} />
    {[60, 80, 100, 300, 320, 340].map((x) => <rect key={x} x={x} y={140} width="5" height="20" fill={C.sil} />)}</g>);

  return (
    <svg viewBox="0 0 400 175" style={{ width: "100%", height, display: "block" }} preserveAspectRatio="xMidYMid slice">
      <rect width="400" height="175" fill={C.sky} />
      <circle cx="330" cy="42" r="26" fill={C.parch} opacity="0.1" />
      <circle cx="330" cy="42" r="16" fill={C.parch} opacity="0.9" />
      {[[50, 30], [110, 55], [170, 25], [230, 45], [285, 22]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="1.1" fill={C.parch} opacity="0.5" />)}
      <rect y="158" width="400" height="17" fill={C.ground} />
      {elems}
      <ellipse className="mvFog" cx="120" cy="150" rx="90" ry="12" fill={C.dim} opacity="0.1" />
      <ellipse className="mvFog2" cx="300" cy="158" rx="110" ry="10" fill={C.dim} opacity="0.09" />
      {kind === "body" && (<g>
        <path d="M160,158 C162,146 172,142 185,142 C202,142 212,148 212,158 Z" fill={C.parch} opacity="0.85" />
        <path d="M160,158 L212,158" stroke={C.ink} strokeWidth="1" /></g>)}
      {kind === "turned" && (<g>
        <polygon points="186,158 214,158 206,112 194,112" fill={C.pale} opacity="0.85" />
        <circle cx="200" cy="105" r="8" fill={C.pale} opacity="0.9" />
        <circle cx="197" cy="104" r="1.3" fill={C.turn} /><circle cx="203" cy="104" r="1.3" fill={C.turn} /></g>)}
    </svg>
  );
}

function Portrait({ id, size = 56, dead, turnedKnown, disp }) {
  /* Second-pass faces: light from the candle side, profession worn plainly,
     and nobody who sleeps well. The mouth and brows lift only when this
     villager is genuinely warm toward the player (disp >= 1); hostility is
     carried by rings and prose, never by a scowl. The dead are greyed and
     crossed out wherever they appear. */
  const TINT = { marta: "#3A3560", tobias: "#3A3348", ansel: "#2C2A44", greta: "#2E4230", wilhelm: "#46372E", liesel: "#4A3550", falk: "#2E3A48", rosa: "#42304A" }[id] || "#2A2F4A";
  const skin = turnedKnown ? "#C9CDDC" : (id === "tobias" || id === "falk") ? "#DDD1B6" : "#E9DFC8";
  const shadeC = turnedKnown ? "#9AA0B8" : "#C4AE8C";
  const eyeCol = turnedKnown ? C.turn : { greta: "#3E5A34", rosa: "#38302A", liesel: "#4A3020" }[id] || "#33291E";
  const mk = !turnedKnown && (disp || 0) >= 1 ? "smile" : "neutral";
  const eye = (x, lid = 0, nar = 0) => (
    <g key={`e${x}`}>
      <ellipse cx={x} cy="41.6" rx="3.5" ry={2.6 - nar} fill={turnedKnown ? "#E8EAF2" : "#F8F3E6"} />
      <circle cx={x} cy="41.6" r="1.75" fill={eyeCol} />
      <circle cx={x} cy="41.7" r="0.85" fill="#141017" />
      <circle cx={x - 0.6} cy="40.9" r="0.5" fill="#FFF" opacity="0.9" />
      <path d={`M${x - 3.4},${39.9 + lid} q3.4,${-1.8 + lid} 6.8,0`} stroke={skin} strokeWidth={1.2 + lid} fill="none" />
      <path d={`M${x - 3.5},${39.6 + lid} q3.5,-1.9 7,0`} stroke="#8A7458" strokeWidth="0.8" fill="none" opacity="0.7" />
    </g>
  );
  const F = {
    marta: { garment: <g><path d="M13,80 C13,61 67,61 67,80 Z" fill="#5E4A38" /><path d="M28,80 C28,66 52,66 52,80 Z" fill="#D8CBB2" opacity="0.9" /><path d="M30,68 q10,6 20,0" stroke="#B8A88C" strokeWidth="1" fill="none" /></g>,
      over: <g><path d="M23,39 C19,17 61,17 57,39 L52,33 C53,23 27,23 28,33 Z" fill="#8A93B8" /><path d="M23,39 C21,28 26,20 34,18 L30,26 Z" fill="#9CA5C8" /><path d="M56,36 q7,-2 6,-8 q5,4 0,9 Z" fill="#8A93B8" /><path d="M27,37 q-2,4 -1,7" stroke="#6E5A42" strokeWidth="1.2" fill="none" /><circle cx="50" cy="47" r="1.4" fill="#F5EFE0" opacity="0.55" /><circle cx="31" cy="26.5" r="1.6" fill="#F5EFE0" opacity="0.4" /><circle cx="35.5" cy="23.5" r="1.1" fill="#F5EFE0" opacity="0.35" /></g>, e: [0.4, 0] },
    tobias: { garment: <g><path d="M12,80 C12,60 68,60 68,80 Z" fill="#3E362C" /><path d="M26,64 q14,-8 28,0 l-2,6 q-12,-6 -24,0 Z" fill="#5E5040" /></g>,
      over: <g><path d="M26,50 C22,74 58,74 54,50 L50,48 C50,64 30,64 30,48 Z" fill="#9C9280" stroke="#7E7462" strokeWidth="0.8" /><path d="M36,56 q-0.5,6 -1.5,10 M44,56 q0.5,6 1.5,10 M40,57 v11" stroke="#B8AE9C" strokeWidth="1" fill="none" /><path d="M25,34 q-2,5 -0.5,9 M55,34 q2,5 0.5,9" stroke="#B8AE9C" strokeWidth="2.6" fill="none" strokeLinecap="round" /><path d="M30,28 q10,-4 20,0 M32,24.5 q8,-3 16,0" stroke="#A08C6C" strokeWidth="1" fill="none" opacity="0.6" /><path d="M27,45.5 q2,2 1.6,3.6 M53,45.5 q-2,2 -1.6,3.6" stroke="#A08C6C" strokeWidth="0.9" fill="none" opacity="0.7" /><path d="M27,44 q2,-1 3.4,0.4 l-0.6,2 q-1.6,0.6 -2.8,-0.4 Z" fill="#5E5040" opacity="0.4" /><circle cx="49.5" cy="32.5" r="1.7" fill="#5E5040" opacity="0.35" /></g>, e: [1.1, 0.7] },
    ansel: { garment: <g><path d="M14,80 C14,60 66,60 66,80 Z" fill="#26232E" /><rect x="34" y="61" width="12" height="6" rx="1.5" fill="#EDEAE0" /><path d="M40,69 v7 M37,71.8 h6" stroke="#8A8060" strokeWidth="1.3" /></g>,
      /* a receding, grey-shot priest's hairline, kept well clear of Rosa's
         full dark cap in both silhouette and colour so the two are never
         mistaken for each other at a glance */
      over: <g><path d="M26,32 C26,24 34,20 40,20 C46,20 54,24 54,32 L50,29 C48,24 32,24 30,29 Z" fill="#5A5860" /><path d="M27.5,46 q1.6,4 4.4,5.6 M52.5,46 q-1.6,4 -4.4,5.6" stroke="#B89A74" strokeWidth="1" fill="none" opacity="0.7" /></g>, e: [0.6, 0.3] },
    greta: { garment: <g><path d="M13,80 C13,62 67,62 67,80 Z" fill="#3A4A36" /><path d="M24,72 q16,-8 32,0" stroke="#2C3A2A" strokeWidth="2" fill="none" /></g>,
      over: <g><path d="M20,44 C15,14 65,14 60,44 L54,40 C56,22 24,22 26,40 Z" fill="#35503F" /><path d="M20,44 q-1,6 2,10 M60,44 q1,6 -2,10" stroke="#35503F" strokeWidth="5" fill="none" /><path d="M56,26 l5,-6 M59,29 l6,-1 M57,23 l-2,-4" stroke="#5B7A52" strokeWidth="1.4" strokeLinecap="round" /><circle cx="33" cy="47.5" r="0.7" fill="#B89A74" /><circle cx="36.5" cy="49" r="0.6" fill="#B89A74" /><circle cx="45" cy="47.5" r="0.7" fill="#B89A74" /></g>, e: [0.5, 0.7] },
    wilhelm: { garment: <g><path d="M12,80 C12,60 68,60 68,80 Z" fill="#57493A" /><path d="M24,80 L44,60 L52,66 L36,80 Z" fill="#4A3626" /><circle cx="47" cy="64" r="1.5" fill="#B8A878" /></g>,
      over: <g><path d="M25,34 C25,22 55,22 55,34 L52,30 C46,26 34,26 28,30 Z" fill="#3A3026" /><path d="M26,46 C24,70 56,70 54,46 L50,44 C48,60 32,60 30,44 Z" fill="#3A3026" /><path d="M35,53 q-0.5,7 -2,11 M45,53 q0.5,7 2,11 M40,54 v12" stroke="#57493A" strokeWidth="1.1" fill="none" /><path d="M30,30.5 q3,-1.4 5.4,-0.2 l-0.8,2.6 q-2.2,0.8 -4,-0.6 Z" fill="#3A3A3A" opacity="0.45" /><circle cx="51.5" cy="46" r="2" fill="#3A3A3A" opacity="0.3" /><path d="M44,28 q4,-1.6 7,0.4" stroke="#8A8276" strokeWidth="1.6" fill="none" opacity="0.5" /></g>, e: [0.7, 0.3] },
    liesel: { garment: <g><path d="M13,80 C13,61 67,61 67,80 Z" fill="#5A3A44" /><path d="M33,64 L40,76 L47,64" stroke="#D8CBB2" strokeWidth="1.4" fill="none" /><circle cx="47" cy="66.5" r="1.7" fill="none" stroke="#B8A878" strokeWidth="1" /><path d="M47,68 v5.5 M47,73.5 l2.5,1.2" stroke="#B8A878" strokeWidth="1.1" strokeLinecap="round" /></g>,
      over: <g><circle cx="40" cy="12.5" r="7" fill="#4A3A2E" /><path d="M33,13 q7,-5 14,0" stroke="#5E4A38" strokeWidth="1.2" fill="none" /><path d="M24,40 C22,20 58,20 56,40 L52,34 C52,26 28,26 28,34 Z" fill="#4A3A2E" /><circle cx="23.5" cy="48" r="1.8" fill={C.amber} /><circle cx="56.5" cy="48" r="1.8" fill={C.amber} /><circle cx="30.5" cy="48.5" r="2.6" fill="#C67A6A" opacity="0.15" /><circle cx="49.5" cy="48.5" r="2.6" fill="#C67A6A" opacity="0.15" /></g>, e: [0.3, 0.3] },
    falk: { garment: <g><path d="M14,80 C14,61 66,61 66,80 Z" fill="#3A4152" /><path d="M28,66 q12,-7 24,0 l-3,6 q-9,-5 -18,0 Z" fill="#2E3442" /><path d="M36,62 q4,4 8,0 l-2,7 h-4 Z" fill="#D8CBB2" opacity="0.85" /></g>,
      over: <g><path d="M25,38 q-3.5,2 -4.5,7 M55,38 q3.5,2 4.5,7" stroke="#D8D2C4" strokeWidth="4" fill="none" strokeLinecap="round" /><path d="M27,46 q1.6,3.6 4,5 M53,46 q-1.6,3.6 -4,5" stroke="#B89A74" strokeWidth="1" fill="none" opacity="0.7" /><circle cx="33.5" cy="41.5" r="5.6" fill="#2A2F42" opacity="0.88" /><circle cx="46.5" cy="41.5" r="5.6" fill="#2A2F42" opacity="0.88" /><circle cx="33.5" cy="41.5" r="5.6" fill="none" stroke="#B8A878" strokeWidth="1.1" /><circle cx="46.5" cy="41.5" r="5.6" fill="none" stroke="#B8A878" strokeWidth="1.1" /><path d="M38.6,41.5 h2.8" stroke="#B8A878" strokeWidth="1.1" /><path d="M27.9,41 L23,39.4 M52.1,41 L57,39.4" stroke="#B8A878" strokeWidth="1" /><path d="M30.5,38.5 l4,4 M43.5,38.5 l4,4" stroke="#FFF" strokeWidth="0.9" opacity="0.35" /></g>, e: [0, 0] },
    rosa: { garment: <g><path d="M14,80 C14,61 66,61 66,80 Z" fill="#3E3550" /><path d="M40,62 v18" stroke="#2E2740" strokeWidth="1.2" />{[66, 70, 74].map((y) => <circle key={y} cx="40" cy={y} r="0.9" fill="#D8CBB2" opacity="0.8" />)}<path d="M28,63 q6,9 5.5,17" stroke="#C8BFA6" strokeWidth="2.4" fill="none" opacity="0.8" /><path d="M29.2,67 l1.7,-0.4 M30.8,71 l1.7,-0.3 M31.9,75 l1.7,-0.2" stroke="#6B5F44" strokeWidth="0.8" /><path d="M50,64 l5,3 M55,67 l-1.6,1.6" stroke="#C8CEDA" strokeWidth="1.1" strokeLinecap="round" /></g>,
      over: <g><path d="M24,42 C22,20 58,20 56,42 L52,37 C52,27 28,27 28,37 Z" fill="#2E2A3E" /><path d="M40,22.5 v6" stroke="#1E1B2C" strokeWidth="1.2" /><path d="M24,40 q-2,10 1,20 M56,40 q2,10 -1,20" stroke="#2E2A3E" strokeWidth="5" fill="none" /><circle cx="24.5" cy="61.5" r="2" fill="#6E2A34" /><circle cx="55.5" cy="61.5" r="2" fill="#6E2A34" /></g>, e: [0.2, -0.3] },
  }[id] || { garment: <path d="M14,80 C14,62 66,62 66,80 Z" fill={C.garment} />, over: null, e: [0, 0] };
  const MOUTH = mk === "smile" ? "q5.5,2.4 11,0" : "h11";
  const MPOS = { tobias: [53, "#5E584C"], wilhelm: [52, "#8A7458"], liesel: [52.5, "#8A5A50"], ansel: [53.5], falk: [54] }[id] || [53];
  const BCFG = { tobias: ["#9C9282", 2.2, 0], ansel: ["#231F28", 1.6, 0], greta: ["#2A4032", 1.5, 0], wilhelm: ["#3A3026", 2.8, 0], liesel: ["#4A3A2E", 1.5, 0], falk: ["#B8B0A0", 1.7, -1.6], rosa: ["#2E2A3E", 1.4, 0] }[id] || ["#6E5A42", 1.4, 0];
  const BROWS = mk === "smile"
    ? "M29.5,36.4 q3.5,-2.4 6.6,-1.2 M43.9,35.2 q3.5,-1.2 6.6,1.2"
    : "M29.5,37.4 q3.5,-1.6 6.6,-0.4 M43.9,37 q3.5,-1.2 6.6,0.4";
  return (
    <svg viewBox="0 0 80 80" width={size} height={size} style={{ display: "block", filter: dead ? "grayscale(1)" : "none", opacity: dead ? 0.55 : 1 }}>
      <defs>
        <radialGradient id={`mvP2bg-${id}`} cx="50%" cy="22%" r="92%">
          <stop offset="0%" stopColor={TINT} /><stop offset="68%" stopColor="#1A1E32" /><stop offset="100%" stopColor="#07090F" />
        </radialGradient>
        <filter id="mvPRough" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="1" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.3" />
        </filter>
      </defs>
      <rect width="80" height="80" rx="10" fill={`url(#mvP2bg-${id})`} />
      <ellipse cx="16" cy="46" rx="18" ry="32" fill="#D9A441" opacity="0.1" />
      <g filter="url(#mvPRough)">
        {F.garment}
        <path d="M34,58 h12 l-1,6 h-10 Z" fill={skin} />
        <ellipse cx="40" cy="41" rx="16.5" ry="19.5" fill={skin} />
        <path d="M40,21.5 C50,21.5 56.5,30 56.5,41 C56.5,52 50,60.5 40,60.5 C47,54.5 50,48.5 50,41 C50,33.5 47,27.5 40,21.5 Z" fill={shadeC} opacity="0.5" />
        <path d="M26,33 C27.5,27 32,23.5 38,22.6" stroke="#FFF6E0" strokeWidth="1.3" opacity="0.35" fill="none" strokeLinecap="round" />
        {eye(33.5, F.e[0], F.e[1])}{eye(46.5, F.e[0], F.e[1])}
        <ellipse cx="33.5" cy="44.6" rx="3" ry="1.3" fill="#8A7458" opacity="0.28" />
        <ellipse cx="46.5" cy="44.6" rx="3" ry="1.3" fill="#8A7458" opacity="0.28" />
        <path d="M28.5,46.5 q1.4,3 3.6,4.2 M51.5,46.5 q-1.4,3 -3.6,4.2" stroke="#B89A74" strokeWidth="0.9" fill="none" opacity="0.5" />
        <path d="M40,42 q1.6,4.4 -0.6,6.4 q-1.2,0.8 -2.2,0.2" stroke="#B89A74" strokeWidth="1.1" fill="none" opacity="0.8" />
        {F.over}
        <path d={`M34.5,${MPOS[0]} ${MOUTH}`} stroke={MPOS[1] || "#8A6A50"} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        <g transform={`translate(0,${BCFG[2]})`}><path d={BROWS} stroke={BCFG[0]} strokeWidth={BCFG[1]} fill="none" strokeLinecap="round" /></g>
      </g>
      {dead && <path d="M24,26 L56,58 M56,26 L24,58" stroke="#AEB4CC" strokeWidth="4.5" strokeLinecap="round" opacity="0.8" />}
    </svg>
  );
}
function MonsterArt({ id, size = 64, light, flat }) {
  /* eyes glow out of the dark instead of sitting flat on it */
  const eye = (x, y, c = C.amber) => (
    <g>
      <circle cx={x} cy={y} r="6" fill={c} opacity="0.18" />
      <circle cx={x} cy={y} r="3.2" fill={c} opacity="0.35" />
      <circle cx={x} cy={y} r="1.6" fill={c} />
      <circle cx={x - 0.5} cy={y - 0.5} r="0.6" fill="#FFF6E0" opacity="0.9" />
    </g>
  );
  const art = {
    werewolf: (<g>
      <path d="M46,118 C42,104 44,92 50,84 L56,88 L54,118 Z" fill={C.sil} />
      <path d="M74,118 C78,104 76,92 70,84 L64,88 L66,118 Z" fill={C.sil} />
      <path d="M46,116 l-3,4 M52,117 l-1,4 M56,116 l1,4 M74,116 l3,4 M68,117 l1,4 M64,116 l-1,4" stroke={C.parch} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M38,54 C34,74 42,88 60,90 C78,88 86,74 82,54 C76,44 44,44 38,54 Z" fill={C.sil} />
      <path d="M40,54 L34,42 M48,48 L44,34 M60,46 L60,30 M72,48 L76,34 M80,54 L86,42" stroke={C.sil} strokeWidth="5.5" strokeLinecap="round" />
      <path d="M40,56 C28,66 22,84 26,100 M80,56 C92,66 98,84 94,100" stroke={C.sil} strokeWidth="8.5" fill="none" strokeLinecap="round" />
      <path d="M20,98 l-2,14 M25,100 l-1,15 M30,99 l2,14 M34,97 l4,13" stroke={C.sil} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M18,110 l-2,-3 M24,112 l-1,-3 M31,110 l1,-3 M37,108 l2,-3" stroke={C.parch} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M100,98 l2,14 M95,100 l1,15 M90,99 l-2,14 M86,97 l-4,13" stroke={C.sil} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M102,110 l2,-3 M96,112 l1,-3 M89,110 l-1,-3 M83,108 l-2,-3" stroke={C.parch} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M46,34 C44,22 52,16 60,16 C68,16 76,22 74,34 C74,44 68,50 60,50 C52,50 46,44 46,34 Z" fill={C.sil} />
      <path d="M50,20 L44,6 L58,18 Z M70,20 L76,6 L62,18 Z" fill={C.sil} />
      <path d="M52,40 C52,50 68,50 68,40 L64,52 C62,58 58,58 56,52 Z" fill={C.sil} />
      <path d="M54,44 C57,48 63,48 66,44 L64,50 C62,53 58,53 56,50 Z" fill="#2A0A06" />
      <polygon points="55,44 56.5,51 58,44" fill={C.parch} />
      <polygon points="62,44 63.5,51 65,44" fill={C.parch} />
      <polygon points="58,50 59.5,45 61,50" fill={C.parch} />
      <path d="M47,32 L57,30 M63,30 L73,32" stroke={C.sil} strokeWidth="4.5" strokeLinecap="round" />
      {eye(54, 35, C.amber)}{eye(66, 35, C.amber)}
    </g>),
    vampire: (<g>
      <path d="M60,34 L4,116 L18,108 L24,118 L34,104 L44,116 L52,102 L60,118 L68,102 L76,116 L86,104 L96,118 L102,108 L116,116 Z" fill={C.sil} />
      <path d="M32,58 L4,26 L12,52 L0,44 L28,68" fill={C.sil} />
      <path d="M88,58 L116,26 L108,52 L120,44 L92,68" fill={C.sil} />
      <path d="M40,60 C40,30 80,30 80,60 L72,54 C72,38 48,38 48,54 Z" fill={C.sil} />
      <path d="M46,34 C46,20 74,20 74,36 C74,54 68,64 60,66 C52,64 46,52 46,34 Z" fill={C.sil} />
      <path d="M49,46 C50,54 54,60 60,62 M71,46 C70,54 66,60 60,62" stroke="#05060E" strokeWidth="2.4" fill="none" opacity="0.8" />
      <path d="M52,54 C56,58 64,58 68,54 L66,58 C63,61 57,61 54,58 Z" fill="#2A0A06" />
      <polygon points="55,55 56.5,63 58,55" fill={C.parch} />
      <polygon points="62,55 63.5,63 65,55" fill={C.parch} />
      <path d="M47,38 L57,36 M63,36 L73,38" stroke={C.sil} strokeWidth="4" strokeLinecap="round" />
      {eye(54, 41, C.redBright)}{eye(66, 41, C.redBright)}
      <path d="M86,96 C82,86 84,74 90,70 L88,90 Z" fill={C.sil} />
      <path d="M90,72 L94,58 M92,73 L98,60 M94,74 L102,62 M95,76 L104,66" stroke={C.sil} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M94,60 l1,-4 M98,62 l1,-4 M102,64 l1,-3" stroke={C.parch} strokeWidth="1.6" strokeLinecap="round" />
    </g>),
    wraith: (<g>
      <path d="M60,10 C34,10 26,40 32,60 L24,104 L34,90 L38,110 L46,88 L52,112 L60,88 L68,112 L74,88 L82,110 L86,90 L96,104 L88,60 C94,40 86,10 60,10 Z" fill={C.pale} opacity="0.82" />
      <path d="M60,10 C38,10 30,34 33,52" stroke={C.parch} strokeWidth="1.6" fill="none" opacity="0.4" />
      <path d="M42,32 C42,20 78,20 78,34 C78,58 70,72 60,74 C50,72 42,56 42,32 Z" fill={C.sil} />
      <ellipse cx="53" cy="40" rx="4.5" ry="6.5" fill="#05070F" />
      <ellipse cx="67" cy="40" rx="4.5" ry="6.5" fill="#05070F" />
      {eye(53, 41, C.pale)}{eye(67, 41, C.pale)}
      <ellipse cx="60" cy="58" rx="5" ry="9" fill="#05070F" />
      <path d="M34,66 C20,80 16,96 20,112 M86,66 C100,80 104,96 100,112" stroke={C.pale} strokeWidth="1.8" fill="none" opacity="0.3" strokeLinecap="round" />
    </g>),
    ghoul: (<g>
      {/* crouched low, the bony back arched high at the haunch */}
      <path d="M84,116 C90,90 84,68 66,62 C52,57 40,64 38,78 C36,90 42,100 38,116 Z" fill={C.sil} />
      {/* a knobbed spine ridge */}
      <path d="M66,62 l3,-6 M74,66 l4,-5 M80,74 l5,-4 M84,84 l5,-2" stroke={C.sil} strokeWidth="2.6" strokeLinecap="round" />
      {/* a long neck, dipping the head to the ground */}
      <path d="M42,74 C32,80 26,90 24,100" stroke={C.sil} strokeWidth="7.5" fill="none" strokeLinecap="round" />
      {/* gaunt bald head, jaw agape near the earth */}
      <path d="M30,94 C18,92 12,100 16,108 C20,116 34,114 36,104 C37,98 34,94 30,94 Z" fill={C.sil} />
      {/* a wide jaw of teeth */}
      <path d="M15,104 L34,105 L31,113 L17,111 Z" fill="#2A0A06" />
      <polygon points="17,104 19,111 21,105" fill={C.parch} />
      <polygon points="22,105 24,112 26,105" fill={C.parch} />
      <polygon points="27,105 29,111 31,106" fill={C.parch} />
      {eye(26, 96, "#C8C040")}
      {/* a long forearm braced on the ground, digging claws */}
      <path d="M46,86 C40,98 34,108 34,116" stroke={C.sil} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M34,116 l-5,-1 M34,116 l-3,-4 M34,116 l2,-4" stroke={C.sil} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M29,115 l-2,2 M31,112 l-2,1 M36,112 l-1,2" stroke={C.parch} strokeWidth="1.5" strokeLinecap="round" />
      {/* the rear haunch drawn up beneath it */}
      <path d="M72,96 C82,98 88,106 86,116" stroke={C.sil} strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d="M86,116 l-4,-3 M86,116 l1,-4 M86,116 l5,-2" stroke={C.sil} strokeWidth="2.2" strokeLinecap="round" />
    </g>),
    witch: (<g>
      {/* cloak flaring to the ground, ragged at the hem */}
      <path d="M28,116 C24,90 30,62 48,54 L72,54 C90,62 96,90 92,116 L84,108 L78,116 L70,108 L62,116 L54,108 L46,116 L38,108 Z" fill={C.sil} />
      {/* crooked staff topped with a glowing charm */}
      <path d="M20,116 C25,88 17,62 26,38" stroke={C.sil} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      <path d="M26,38 C20,34 18,26 22,22 C27,27 31,29 26,38 Z" fill={C.sil} />
      <circle cx="24" cy="26" r="4.5" fill="#7AA850" opacity="0.5" className="mvGlowPulse" />
      {/* gnarled hand at the staff */}
      <path d="M30,64 C24,62 22,67 26,71 M30,64 C25,66 25,71 29,72 M30,64 C27,59 22,60 22,66" stroke={C.sil} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {/* wide pointed hat: the brim */}
      <path d="M20,50 C40,43 80,43 100,50 C80,57 40,57 20,50 Z" fill={C.sil} />
      {/* the crown, with a bent tip */}
      <path d="M48,48 C50,26 58,12 78,6 C72,16 68,30 68,48 Z" fill={C.sil} />
      {/* gaunt face beneath the brim */}
      <path d="M48,52 C48,68 54,84 60,86 C66,82 70,68 70,54 Z" fill={C.sil} />
      {/* a long hooked nose */}
      <path d="M60,58 L55,74 C56,79 63,78 62,73 L62,60 Z" fill={C.sil} />
      {/* thin mouth and a snaggletooth */}
      <path d="M52,80 q7,3 13,-1" stroke="#05070F" strokeWidth="2" fill="none" />
      <polygon points="55,80 56,85 58,80" fill={C.parch} />
      <path d="M46,54 L54,55 M64,55 L72,54" stroke={C.sil} strokeWidth="3.5" strokeLinecap="round" />
      {eye(52, 64, "#9EC838")}{eye(66, 64, "#9EC838")}
    </g>),
    demon: (<g>
      <path d="M24,116 C20,88 30,64 44,58 C40,48 44,38 54,36 L60,50 L66,36 C76,38 80,48 76,58 C90,64 100,88 96,116 Z" fill={C.sil} />
      <path d="M46,40 C34,30 34,14 46,6 C42,20 46,30 52,38 Z" fill={C.sil} />
      <path d="M74,40 C86,30 86,14 74,6 C78,20 74,30 68,38 Z" fill={C.sil} />
      <path d="M50,64 L70,64 L67,73 L60,68 L53,73 Z" fill="#2A0A06" />
      <polygon points="52,64 54,70 56,64" fill={C.parch} />
      <polygon points="58,64 60,70 62,64" fill={C.parch} />
      <polygon points="64,64 66,70 68,64" fill={C.parch} />
      <path d="M46,50 L57,52 M63,52 L74,50" stroke={C.sil} strokeWidth="4.5" strokeLinecap="round" />
      {eye(54, 54, C.redBright)}{eye(66, 54, C.redBright)}
      <path d="M92,104 C104,100 110,86 104,78" stroke={C.sil} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M104,78 l-4,-4 l6,-1 l-1,6 Z" fill={C.sil} />
      {[[36, 90], [86, 96]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.2" fill="#E8703A" opacity="0.6" className="mvSpark" style={{ animationDelay: `${i * 1.3}s` }} />)}
    </g>),
    shifter: (<g>
      <path d="M30,116 C28,92 34,74 60,74 C86,74 92,92 90,116 Z" fill={C.sil} />
      <ellipse cx="60" cy="52" rx="28" ry="32" fill={C.sil} />
      <path d="M60,22 L56,40 L62,52 L54,66 L60,82" stroke="#05070F" strokeWidth="3.5" fill="none" />
      <path d="M60,22 L57,40 L61,52 L55,66 L59,80" stroke={C.pale} strokeWidth="1.2" fill="none" opacity="0.5" />
      {eye(48, 50, C.pale)}{eye(72, 50, C.turn)}
      <path d="M42,64 q6,2 12,1" stroke="#05070F" strokeWidth="2" fill="none" />
      <path d="M66,66 q6,-1 11,-4" stroke="#05070F" strokeWidth="2" fill="none" />
      <path d="M84,42 C93,40 95,52 87,58" stroke={C.line} strokeWidth="2.2" fill="none" strokeLinecap="round" />
    </g>),
    banshee: (<g>
      {[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M54,${28 + i * 6} C ${78 + i * 6},${20 + i * 5} ${98 + i * 4},${28 + i * 8} ${118},${34 + i * 10}`} stroke={C.pale} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity={0.7 - i * 0.1} />)}
      <path d="M50,40 C38,32 24,34 12,44 M48,52 C36,48 24,52 14,62" stroke={C.pale} strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.4" />
      <path d="M46,52 C34,66 34,96 40,118 L44,104 L48,118 L54,102 L58,118 L60,54 Z" fill={C.pale} opacity="0.72" />
      <path d="M44,28 C42,16 66,14 66,30 C66,54 58,70 52,72 C46,68 44,48 44,28 Z" fill={C.pale} />
      <path d="M46,40 C46,52 48,62 52,68 M64,38 C64,52 60,62 54,68" stroke={C.sky} strokeWidth="1.4" fill="none" opacity="0.6" />
      <ellipse cx="50" cy="36" rx="4.5" ry="7" fill="#0A121C" />
      <ellipse cx="60" cy="35" rx="4.5" ry="7" fill="#0A121C" />
      <path d="M50,43 L47,64 M60,42 L61,60" stroke={C.sky} strokeWidth="1.6" opacity="0.5" strokeLinecap="round" />
      {eye(50, 36, "#7EBEDC")}{eye(60, 35, "#7EBEDC")}
      <path d="M52,50 C48,58 48,66 52,72 C56,66 56,58 54,50 Z" fill="#060E18" />
    </g>),
    lich: (<g>
      {/* tattered sorcerer's robe, flaring wide, dripping at the ragged hem */}
      <path d="M34,116 C30,86 34,62 60,56 C86,62 90,86 86,116 L80,104 L75,116 L69,106 L63,116 L57,106 L51,116 L45,105 L40,116 Z" fill={C.sil} />
      {/* both arms flung up, ragged sleeves, spread bone claws */}
      <path d="M50,62 C40,56 30,50 24,40" stroke={C.sil} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M31,51 l-3,12 M36,54 l-2,11 M41,57 l-1,10" stroke={C.sil} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M24,40 l-4,-9 M24,40 l-1,-10 M24,40 l3,-9 M24,40 l6,-7" stroke={C.sil} strokeWidth="2.6" strokeLinecap="round" />
      <path d="M70,62 C80,56 90,50 96,40" stroke={C.sil} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M89,51 l3,12 M84,54 l2,11 M79,57 l1,10" stroke={C.sil} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M96,40 l4,-9 M96,40 l1,-10 M96,40 l-3,-9 M96,40 l-6,-7" stroke={C.sil} strokeWidth="2.6" strokeLinecap="round" />
      {/* the skull */}
      <path d="M46,40 C46,24 74,24 74,40 C74,50 69,57 63,58 L57,58 C51,57 46,50 46,40 Z" fill={C.sil} />
      {/* a jagged iron crown */}
      <path d="M44,28 L40,12 L48,22 L52,6 L57,22 L60,2 L63,22 L68,6 L72,22 L80,12 L76,28 Z" fill={C.sil} />
      {/* hollow sockets, a cold light burning far back in them */}
      <ellipse cx="54" cy="40" rx="5.2" ry="6" fill="#04120F" />
      <ellipse cx="66" cy="40" rx="5.2" ry="6" fill="#04120F" />
      {eye(54, 40, "#8FE0CE")}{eye(66, 40, "#8FE0CE")}
      {/* nasal hollow and a grinning jaw of teeth */}
      <path d="M59,45 L60,50 L61,45 Z" fill="#050B0C" />
      <path d="M53,52 L67,52 L65,57 L55,57 Z" fill="#050B0C" />
      <path d="M56,52 l0,5 M60,52 l0,5 M64,52 l0,5" stroke={C.parch} strokeWidth="0.9" opacity="0.85" />
      <polygon points="54,57 55.4,52 56.8,57" fill={C.parch} opacity="0.9" />
      <polygon points="63.2,57 64.6,52 66,57" fill={C.parch} opacity="0.9" />
    </g>),
    revenant: (<g>
      <path d="M46,116 C42,92 44,64 52,52 C50,40 54,30 60,30 C66,30 70,40 68,52 C76,64 78,92 74,116 Z" fill={C.sil} />
      <path d="M48,60 L72,66 M46,72 L74,78 M48,84 L72,90 M50,96 L70,102" stroke="#2A2E22" strokeWidth="2.2" strokeLinecap="round" opacity="0.7" />
      <path d="M50,54 L40,86 M70,54 L80,86" stroke={C.sil} strokeWidth="6" strokeLinecap="round" />
      <path d="M38,86 l-2,10 M40,86 l1,10 M42,86 l3,9" stroke={C.sil} strokeWidth="2" strokeLinecap="round" />
      <path d="M82,86 l2,10 M80,86 l-1,10 M78,86 l-3,9" stroke={C.sil} strokeWidth="2" strokeLinecap="round" />
      <ellipse cx="60" cy="24" rx="11" ry="13" fill={C.sil} />
      <path d="M55,30 L65,30 L63,39 L57,39 Z" fill="#2A0A06" />
      <path d="M55,30 l1,9 M59,30 l0,9 M63,30 l-1,9" stroke={C.sil} strokeWidth="0.9" />
      {eye(56, 22, "#9AB090")}{eye(64, 22, "#9AB090")}
    </g>),
    doppel: (<g>
      <g transform="translate(6,-2)"><ellipse cx="70" cy="54" rx="24" ry="30" fill={C.sil} opacity="0.5" /></g>
      <path d="M18,116 C16,92 24,76 46,76 C58,76 66,82 68,92 L64,116 Z" fill={C.sil} />
      <path d="M56,116 C54,90 64,74 82,76 C96,78 100,94 96,116 Z" fill={C.sil} />
      <ellipse cx="42" cy="52" rx="22" ry="26" fill={C.sil} />
      {eye(35, 50, C.pale)}{eye(49, 50, C.pale)}
      <path d="M35,62 q7,3 14,0" stroke="#05070F" strokeWidth="2" fill="none" />
      <ellipse cx="78" cy="52" rx="22" ry="26" fill={C.sil} />
      {eye(71, 50, C.pale)}{eye(85, 50, C.dim)}
      <path d="M71,60 q7,5 14,2" stroke="#05070F" strokeWidth="2" fill="none" />
      <path d="M60,30 L60,78" stroke="#05070F" strokeWidth="2" opacity="0.6" />
    </g>),
    hag: (<g>
      {/* hunched robe with a high humped back */}
      <path d="M30,116 C26,92 28,66 48,60 C66,55 82,64 84,84 C86,100 82,110 86,116 Z" fill={C.sil} />
      {/* wild hair, streaming back off the skull */}
      <path d="M52,44 C36,38 20,42 8,54 M54,50 C38,48 24,54 14,66 M56,56 C42,58 30,66 24,78" stroke={C.sil} strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M52,42 C42,32 28,30 16,34 M54,48 C44,42 32,44 22,50" stroke={C.sil} strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.7" />
      {/* gaunt head thrust forward off the neck */}
      <path d="M52,46 C50,60 58,72 68,72 C78,68 80,54 74,46 C68,40 56,40 52,46 Z" fill={C.sil} />
      {/* a long hooked nose */}
      <path d="M68,54 L76,66 C76,70 71,71 70,67 L68,57 Z" fill={C.sil} />
      {/* gaping mouth, a last few teeth */}
      <path d="M58,66 C60,72 68,72 70,66 L68,70 C65,74 61,74 59,70 Z" fill="#05070F" />
      <polygon points="60,66 61,71 63,66" fill={C.parch} />
      {eye(58, 54, "#A0C0C8")}{eye(70, 52, "#A0C0C8")}
      {/* a long reaching arm, splayed claws */}
      <path d="M58,78 C46,84 34,92 24,102" stroke={C.sil} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M24,102 l-7,2 M24,102 l-6,6 M24,102 l-2,8 M24,102 l2,7" stroke={C.sil} strokeWidth="2.2" strokeLinecap="round" />
      <path d="M17,104 l-2,-2 M18,108 l-2,-1 M22,110 l-1,-2 M26,109 l0,-2" stroke={C.parch} strokeWidth="1.4" strokeLinecap="round" />
      {/* a second gnarled arm */}
      <path d="M64,84 C58,96 50,104 44,114" stroke={C.sil} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M44,114 l-4,3 M44,114 l0,4 M44,114 l4,3" stroke={C.sil} strokeWidth="2" strokeLinecap="round" />
    </g>),
    necromancer: (<g>
      <path d="M40,116 C36,86 40,56 60,50 C80,56 84,86 80,116 Z" fill={C.sil} />
      <path d="M46,52 C46,32 74,32 74,52 C74,44 66,38 60,38 C54,38 46,44 46,52 Z" fill={C.sil} />
      <path d="M50,50 C50,40 70,40 70,50 L64,72 L56,72 Z" fill="#060810" />
      {/* one arm raised in conjuring, the other down to grip the staff */}
      <path d="M44,60 C30,54 20,44 18,32 M76,58 C86,62 92,70 92,82" stroke={C.sil} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M18,32 l-3,-6 l6,1" stroke={C.sil} strokeWidth="2.4" strokeLinecap="round" />
      {/* a tall staff crowned with a bound skull, glowing */}
      <path d="M91,116 L90,26" stroke={C.sil} strokeWidth="4.5" strokeLinecap="round" />
      <circle cx="90" cy="19" r="7.5" fill={C.turn} opacity="0.35" className="mvGlowPulse" />
      <ellipse cx="90" cy="19" rx="5" ry="6.2" fill={C.sil} />
      <circle cx="87.6" cy="18" r="1.5" fill="#060810" /><circle cx="92.4" cy="18" r="1.5" fill="#060810" />
      <path d="M87.5,23 l5,0" stroke="#060810" strokeWidth="0.9" />
      {/* gnarled knuckles wrapped round the shaft */}
      <path d="M92,82 l4,-2 M92,82 l4,1 M92,82 l3,3" stroke={C.sil} strokeWidth="2.2" strokeLinecap="round" />
      {eye(55, 54, C.turn)}{eye(65, 54, C.turn)}
      <path d="M24,116 l-1,-10 l4,3 M30,116 l0,-8 M108,116 l1,-10 l-4,3 M100,116 l0,-8" stroke={C.sil} strokeWidth="2.4" strokeLinecap="round" opacity="0.85" />
      {[[26, 100], [98, 102], [60, 88]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.2" fill={C.turn} opacity="0.5" className="mvMote" style={{ animationDelay: `${i * 2.5}s` }} />)}
    </g>),
    mimic: (<g>
      <path d="M26,114 C18,92 24,66 42,58 C40,44 54,36 64,44 C70,34 86,40 84,54 C100,60 102,88 94,114 Z" fill={C.sil} />
      <path d="M28,72 C18,68 12,58 14,48 M92,80 C102,78 108,86 106,96" stroke={C.sil} strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M14,48 l-3,-5 M14,48 l-5,-1 M14,48 l-1,-6" stroke={C.parch} strokeWidth="1.8" strokeLinecap="round" />
      {eye(46, 56, C.redBright)}{eye(66, 52, "#40C0A0")}{eye(58, 76, C.amber)}
      <path d="M40,86 C50,92 66,90 74,84 L70,90 C62,95 50,95 44,90 Z" fill="#2A0A06" />
      <polygon points="46,86 47,92 49,86" fill={C.parch} />
      <polygon points="60,88 61,93 63,87" fill={C.parch} />
      <path d="M34,70 L40,76 M78,66 L72,72 M56,100 L60,94" stroke={C.turn} strokeWidth="1.4" strokeLinecap="round" opacity="0.5" />
    </g>),
    succubus: (<g>
      {/* great bat wings, spread wide behind her */}
      <path d="M52,50 C36,36 18,38 8,56 C19,51 26,54 30,60 C23,58 19,63 18,72 C29,65 35,68 39,74 C35,71 34,77 34,84 C42,72 49,62 54,58 Z" fill={C.sil} />
      <path d="M68,50 C84,36 102,38 112,56 C101,51 94,54 90,60 C97,58 101,63 102,72 C91,65 85,68 81,74 C85,71 86,77 86,84 C78,72 71,62 66,58 Z" fill={C.sil} />
      {/* the wing struts, faint bones in the membrane */}
      <path d="M52,54 C40,48 26,50 16,58 M54,58 C44,56 32,60 24,68" stroke={C.sky} strokeWidth="1" fill="none" opacity="0.4" strokeLinecap="round" />
      <path d="M68,54 C80,48 94,50 104,58 M66,58 C76,56 88,60 96,68" stroke={C.sky} strokeWidth="1" fill="none" opacity="0.4" strokeLinecap="round" />
      {/* slender body */}
      <path d="M48,116 C44,92 46,66 54,54 L66,54 C74,66 76,92 72,116 Z" fill={C.sil} />
      <path d="M52,58 C46,68 44,84 46,98 M68,58 C74,68 76,84 74,98" stroke={C.sil} strokeWidth="4.5" fill="none" strokeLinecap="round" />
      {/* a slim curling tail, low at her hip */}
      <path d="M70,96 C82,98 90,92 90,82" stroke={C.sil} strokeWidth="4" fill="none" strokeLinecap="round" />
      <path d="M90,82 l-4,-3 l6,-1 l-1,6 Z" fill={C.sil} />
      {/* small horns */}
      <path d="M52,28 C48,22 48,16 52,12 M68,28 C72,22 72,16 68,12" stroke={C.sil} strokeWidth="3" fill="none" strokeLinecap="round" />
      <ellipse cx="60" cy="34" rx="13" ry="16" fill={C.sil} />
      {eye(55, 32, C.redBright)}{eye(65, 32, C.redBright)}
      <path d="M53,42 q7,4 14,0" stroke="#3A1420" strokeWidth="1.8" fill="none" />
      <polygon points="59,43 60,47 61,43" fill={C.parch} />
      {[[14, 64], [106, 64]].map(([x, y], i) => <path key={i} d={`M${x},${y} q3,-4 0,-8 q4,2 2,7`} fill="none" stroke="#E86088" strokeWidth="1.2" opacity="0.5" className="mvMote" style={{ animationDelay: `${i * 2}s` }} />)}
    </g>),
    hollowed: (<g>
      {[[10, 1], [22, 0.8]].map(([x, sc], i) => <g key={`lt${x}`} transform={`translate(${x},0) scale(${sc})`}><polygon points="0,120 -14,120 -7,70" fill={C.sil} opacity="0.7" /><polygon points="0,96 -12,96 -6,58" fill={C.sil} opacity="0.7" /></g>)}
      {[[112, 1], [100, 0.8]].map(([x, sc], i) => <g key={`rt${x}`} transform={`translate(${x},0) scale(${sc})`}><polygon points="0,120 -14,120 -7,70" fill={C.sil} opacity="0.6" /></g>)}
      <path d="M50,120 L51,34 Q51,10 60,4 Q69,10 69,34 L70,120 Z" fill={C.sil} />
      <path d="M44,44 Q60,36 76,44 L74,54 Q60,48 46,54 Z" fill={C.sil} />
      <ellipse cx="60" cy="18" rx="9" ry="12.5" fill={C.pale} opacity="0.9" />
      <ellipse cx="57" cy="14" rx="2.4" ry="4.5" fill="#000" opacity="0.08" />
      <ellipse cx="63" cy="22" rx="3" ry="2.4" fill="#000" opacity="0.12" />
      <path d="M46,48 C34,58 30,78 32,98 C33,108 36,116 40,120 M74,48 C86,58 90,78 88,98 C87,108 84,116 80,120" stroke={C.sil} strokeWidth="5.5" fill="none" strokeLinecap="round" />
      <path d="M34,100 l-5,18 M38,102 l-2,18 M42,102 l3,18 M86,100 l5,18 M82,102 l2,18 M78,102 l-3,18" stroke={C.sil} strokeWidth="2.6" strokeLinecap="round" />
    </g>),
  }[id];
  const seed = { werewolf: 3, vampire: 11, wraith: 5, ghoul: 8, witch: 13, demon: 2, shifter: 17, banshee: 7, lich: 4, revenant: 9, doppel: 15, hag: 6, necromancer: 10, mimic: 12, succubus: 14, hollowed: 16 }[id] || 1;
  /* each horror keeps its own night-colour: a radial aura fading to black,
     the same card the bestiary mock wore, so the art reads on parchment and
     on the dark screens alike without the old red halo or pale discs. */
  const aura = { werewolf: "#8A5A2A", vampire: "#8A2432", wraith: "#4A5E8A", ghoul: "#5A5030", witch: "#3E6A38", demon: "#8A2A18", shifter: "#5A4A6A", banshee: "#3E6E82", lich: "#2E6058", revenant: "#4A5040", doppel: "#585062", hag: "#3A4A5A", necromancer: "#3E5A48", mimic: "#5A3A5A", succubus: "#7A3050", hollowed: "#4A5E38" }[id] || "#3A3550";
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{ display: "block" }}>
      <defs>
        {/* a light roughen only: enough for an organic edge, never enough to
            eat a face the way the old scale-6 pass did */}
        <filter id={`mvR${seed}`} x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence type="fractalNoise" baseFrequency="0.075" numOctaves="2" seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
        </filter>
        <radialGradient id={`mvAura${seed}`} cx="50%" cy="30%" r="92%">
          <stop offset="0%" stopColor={aura} stopOpacity="0.36" />
          <stop offset="55%" stopColor="#12152A" />
          <stop offset="100%" stopColor="#05070F" />
        </radialGradient>
        <clipPath id={`mvClip${seed}`}><rect x="2" y="2" width="116" height="116" rx="16" /></clipPath>
      </defs>
      {/* flat: the journal wants ink on paper, so drop the night-aura card
          and let the silhouette sit straight on the parchment */}
      {!flat && <rect x="2" y="2" width="116" height="116" rx="16" fill={`url(#mvAura${seed})`} />}
      <g clipPath={`url(#mvClip${seed})`}>
        <ellipse cx="60" cy="110" rx="34" ry="5" fill="#000" opacity={flat ? 0.14 : 0.3} />
        <g filter={`url(#mvR${seed})`}>{art}</g>
      </g>
    </svg>
  );
}

/* The kill, seen: the creature's own art dying by the rite that ended it.
   One animation family per method, so silver reads as a pierce, fire as a
   burning, and the crossroads as the ground closing over it. */
const METHOD_FX = {
  silver: "pierce", stake: "pierce", iron: "pierce",
  fire: "burn", grimoire: "burn", holy: "burn", effigy: "burn",
  mirror: "shatter", bell: "shatter", backname: "shatter", phylactery: "shatter",
  salt: "dissolve", exorcism: "dissolve",
  crossroads: "sink", rest: "sink",
  hawthorn: "shrink", quicksilver: "shrink",
};
function MonsterDeath({ id, method, size = 120, light }) {
  const fx = METHOD_FX[method] || "dissolve";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <div className="mvKillGround" />
      <div className={`mvKill-${fx}`} style={{ width: size, height: size }}>
        <MonsterArt id={id} size={size} light={light} />
      </div>
      {fx === "burn" && [0.15, 0.38, 0.6, 0.8].map((fr, i) => (
        <span key={i} className="mvEmber" style={{ left: `${fr * 100}%`, bottom: 10, animationDelay: `${0.6 + i * 0.5}s` }} />
      ))}
      {fx === "pierce" && <div className="mvKillFlash" />}
    </div>
  );
}

/* The room you are received in: each villager's own walls and tools behind
   the talk, in the same woodcut-silhouette style as the location scenes. */
function InterviewScene({ id, height = 92, afflicted }) {
  /* Every room is its own painting: a full-scene ambient wash in the room's
     own colour, a handful of large shapes, one blazing light source, and a
     few things barely seen at the edge of the gloom. All movement is CSS
     animation on flat shapes; nothing here costs a re-render. */
  const flameG = (x, y, sc = 1, d = 0) => (
    <g className="mvFlame" style={{ animationDelay: `${d}s` }}>
      <ellipse cx={x} cy={y} rx={2.2 * sc} ry={4.4 * sc} fill={C.amber} />
      <ellipse cx={x} cy={y + sc} rx={1.1 * sc} ry={2.2 * sc} fill="#F8ECC0" />
    </g>
  );
  const glow = (x, y, r = 16, d = 0) => (
    <ellipse cx={x} cy={y} rx={r} ry={r * 0.72} fill="url(#ivsGlow)" className="mvGlowPulse" style={{ animationDelay: `${d}s` }} />
  );
  const pool = (x, y, rx, ry, d = 0, op = 1) => (
    <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="url(#ivsWarm)" opacity={op} className="mvGlowPulse" style={{ animationDelay: `${d}s` }} />
  );
  const candle = (x, y, h = 13, sc = 1.3, d = 0) => (
    <g key={`c${x}${y}`}>
      {glow(x, y - 5, 18, d)}
      <rect x={x - 3} y={y} width={6} height={h} rx={1.6} fill="#DCD2B8" />
      <path d={`M${x - 3},${y + 2} q-2,4 -0.4,${h - 6}`} stroke="#EDE6D2" strokeWidth="1.2" fill="none" opacity="0.6" />
      {flameG(x, y - 5.5, sc, d)}
    </g>
  );
  const motes = (x, y, d = 0, col = C.parch) => (
    <g>
      {[0, 1, 2].map((i) => (
        <circle key={i} cx={x + i * 8 - 8} cy={y + (i % 2) * 7} r="1" fill={col}
          className="mvMote" style={{ animationDelay: `${d + i * 2.3}s` }} />
      ))}
    </g>
  );
  const sparks = (x, y, d = 0, n = 4) => (
    <g>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={x + i * 9 - (n - 1) * 4.5} cy={y + (i % 2) * 5} r="1.3" fill="#F0B060"
          className="mvSpark" style={{ animationDelay: `${d + i * 0.9}s` }} />
      ))}
    </g>
  );
  const rooms = {
    /* -------- THE BAKERY: the whole room is oven-warm -------- */
    marta: (<g>
      <rect width="400" height="120" fill="url(#ivsBgMarta)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.26" />
      {/* far shelf, tomorrow's loaves barely seen */}
      <rect x="252" y="26" width="132" height="5" fill="#1E130C" />
      {[272, 306, 340, 370].map((x) => <path key={x} d={`M${x - 13},26 C${x - 13},16 ${x + 13},16 ${x + 13},26 Z`} fill="#2C1C10" />)}
      {/* the great oven, most of the left wall */}
      <path d="M18,112 C18,34 148,34 148,112 Z" fill="#301D11" />
      <path d="M18,112 C18,34 148,34 148,112 L134,112 C134,46 32,46 32,112 Z" fill="#422916" opacity="0.6" />
      <rect x="72" y="4" width="20" height="40" fill="#241509" />
      <path d="M46,112 C46,68 120,68 120,112 Z" fill="#160A05" />
      <ellipse cx="83" cy="102" rx="34" ry="13" fill="#D85F2E" className="mvEmberBed" />
      <ellipse cx="83" cy="103" rx="21" ry="8" fill="#F09055" className="mvEmberBed" style={{ animationDelay: "0.9s" }} />
      <ellipse cx="83" cy="104" rx="11" ry="4.5" fill="#F8C08A" />
      {pool(83, 108, 120, 26, 0, 1)}
      {sparks(83, 74, 0.3)}
      {/* the peel, taller than she is */}
      <g transform="rotate(14 166 60)"><rect x="163" y="14" width="5" height="94" fill="#7A5230" /><path d="M154,16 q12,-12 24,0 l-4,10 h-16 Z" fill="#8A5C34" /></g>
      {/* stool and shawl, in the warm */}
      <rect x="192" y="92" width="30" height="5" fill="#3E2814" /><rect x="196" y="97" width="5" height="15" fill="#2A1A0E" /><rect x="213" y="97" width="5" height="15" fill="#2A1A0E" />
      <path d="M190,92 q17,-13 34,0 l-6,11 q-11,6 -22,0 Z" fill="#6E2A34" />
      {/* the table, the loaves that matter, the candle */}
      <rect x="240" y="86" width="140" height="7" fill="#3E2814" /><rect x="240" y="86" width="140" height="2" fill="#6E4A24" opacity="0.7" />
      <rect x="248" y="93" width="6" height="19" fill="#241608" /><rect x="366" y="93" width="6" height="19" fill="#241608" />
      {[266, 302].map((x) => (
        <g key={x}><ellipse cx={x} cy={80} rx="17" ry="8" fill="#A87840" /><path d={`M${x - 10},77 q10,-6 20,0`} stroke="#D0A068" strokeWidth="2" fill="none" /></g>
      ))}
      {pool(300, 88, 55, 14, 0.8, 0.8)}
      {candle(344, 70, 14, 1.3, 0.8)}
      {/* the cup gone cold */}
      <rect x="352" y="100" width="13" height="9" rx="2" fill="#241608" />
      <path d="M358,97 q3,-7 -1,-12" stroke={C.pale} strokeWidth="1.2" fill="none" className="mvSmokeWisp" style={{ animationDelay: "1.6s" }} />
      {motes(100, 62, 0.6)}
    </g>),
    /* -------- THE GRAVE SHED: cold blue, one lantern against it -------- */
    tobias: (<g>
      <rect width="400" height="120" fill="url(#ivsBgTobias)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.3" />
      {/* the lantern, and everything it can hold back */}
      <path d="M118,0 v22" stroke="#0C0E16" strokeWidth="3" />
      {pool(118, 106, 120, 28, 0.3, 1)}
      <rect x="103" y="22" width="30" height="34" rx="3" fill="#120D08" />
      <rect x="108" y="27" width="20" height="24" fill="#241408" />
      {glow(118, 39, 22, 0.3)}
      {flameG(118, 41, 1.5, 0.3)}
      {/* spades worn to the wood, leaning where they always lean */}
      <g transform="rotate(-12 56 78)"><rect x="53" y="26" width="6" height="76" fill="#6E4A28" /><path d="M45,98 h22 l-4,14 h-14 Z" fill="#1A1D28" /></g>
      <g transform="rotate(8 82 80)"><rect x="79" y="32" width="6" height="72" fill="#5E3F22" /><path d="M71,100 h22 l-4,12 h-14 Z" fill="#1A1D28" /></g>
      {/* the lime sack in the lantern light */}
      <path d="M154,112 q-3,-24 15,-27 q18,3 15,27 Z" fill="#8A7248" />
      <path d="M154,112 q-3,-24 15,-27 l0,27 Z" fill="#A08454" opacity="0.5" />
      <path d="M162,86 h14" stroke="#4A3A24" strokeWidth="2.5" />
      {/* fresh-turned earth, grass already trying, a spade still standing */}
      <ellipse cx="228" cy="107" rx="34" ry="8" fill="#2E2216" />
      <path d="M214,99 q-3,-8 2,-12 M240,100 q4,-9 -1,-14" stroke="#6B5F44" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <g transform="rotate(-20 240 82)"><rect x="238" y="52" width="5" height="48" fill="#7A5230" /><rect x="233" y="47" width="15" height="6" rx="3" fill="#7A5230" /><path d="M232,96 h17 l-3,14 h-11 Z" fill="#1A1D28" /></g>
      {/* the coffin against the far wall, gone blue with the hour */}
      <polygon points="304,22 336,22 346,50 336,110 304,110 294,50" fill="#1E2232" />
      <polygon points="304,22 320,22 320,110 304,110 294,50" fill="#262C40" opacity="0.7" />
      <path d="M294,50 h52" stroke="#12141E" strokeWidth="2" />
      {/* cross on the wall, rope on the floor */}
      <path d="M374,30 v24 M364,38 h20" stroke="#3A4468" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="374" cy="108" rx="12" ry="4.5" fill="none" stroke="#1E2232" strokeWidth="3.5" />
      <ellipse cx="374" cy="105" rx="7" ry="2.8" fill="none" stroke="#1E2232" strokeWidth="3" />
      {motes(118, 62, 1.2)}
    </g>),
    /* -------- THE VESTRY: moonlight, and one candle answering it -------- */
    ansel: (<g>
      <rect width="400" height="120" fill="url(#ivsBgAnsel)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.25" />
      {/* the great window, the moon caught in one pane */}
      <path d="M40,112 v-56 a34,34 0 0 1 68,0 v56 Z" fill="#0E0F1C" />
      <path d="M48,112 v-54 a26,26 0 0 1 52,0 v54 Z" fill="url(#ivsGlass)" />
      <path d="M74,32 v80 M48,74 h52" stroke="#0E0F1C" strokeWidth="5" />
      <circle cx="62" cy="56" r="8" fill="#C8CEE0" opacity="0.9" />
      <polygon points="50,112 106,112 150,120 30,120" fill="#8FA3C8" opacity="0.05" />
      {motes(76, 60, 0.9, "#AEB4CC")}
      {/* the kneeler, empty at this hour */}
      <path d="M186,60 L240,52 l0,11 L186,71 Z" fill="#10101E" />
      <rect x="192" y="66" width="9" height="46" fill="#10101E" />
      <rect x="226" y="60" width="9" height="52" fill="#10101E" />
      <circle cx="196.5" cy="108" r="2.2" fill="#C8A050" opacity="0.8" /><circle cx="230.5" cy="108" r="2.2" fill="#C8A050" opacity="0.8" />
      {/* the cross on the wall: grand, not looming, and first thing seen */}
      {pool(322, 108, 95, 22, 0.2, 0.95)}
      <ellipse cx="330" cy="46" rx="36" ry="30" fill="url(#ivsGlow)" opacity="0.35" className="mvGlowPulse" style={{ animationDelay: "1.1s" }} />
      <path d="M330,20 v58 M309,41 h42" stroke="#0C0C18" strokeWidth="7" strokeLinecap="round" />
      <path d="M330,20 v58 M309,41 h42" stroke="#3E3560" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      {/* the altar beneath it, the ledger open upon it */}
      <rect x="288" y="88" width="84" height="6" fill="#10101E" />
      <rect x="294" y="94" width="6" height="18" fill="#10101E" /><rect x="360" y="94" width="6" height="18" fill="#10101E" />
      <path d="M300,86 q13,-7 26,0 q13,-7 26,0 l0,8 q-13,-5 -26,0 q-13,-5 -26,0 Z" fill="#D8CFB8" />
      <path d="M326,82 v9" stroke="#8A7E62" strokeWidth="1.2" />
      {candle(366, 60, 28, 1.5, 0.2)}
    </g>),
    /* -------- THE STILLROOM: green murk, glass, and a blade -------- */
    greta: (<g>
      <rect width="400" height="120" fill="url(#ivsBgGreta)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.28" />
      {/* the high shelf and its alembics */}
      <rect y="14" width="400" height="6" fill="#090C10" />
      <rect y="50" width="400" height="6" fill="#0A0E12" />
      {[[64, 24, 38, "#4A5A3E"], [104, 19, 30, "#3E4E34"], [284, 26, 40, "#55684A"], [330, 20, 32, "#42533A"]].map(([x, w, h, col]) => (
        <g key={x}>
          <path d={`M${x - w / 2},50 L${x + w / 2},50 L${x + 4},${50 - h} q-4,-5 -8,0 Z`} fill={col} />
          <ellipse cx={x - 4} cy={50 - h / 2.4} rx="1.7" ry={h / 6} fill="#C8D4C0" opacity="0.35" />
        </g>
      ))}
      {/* two bundles still drying, stirring faintly */}
      {[190, 228].map((x, i) => (
        <g key={x} className="mvSway" style={{ animationDelay: `${i * 1.3}s`, animationDuration: `${6 + i}s` }}>
          <path d={`M${x},20 v14`} stroke="#0A0E12" strokeWidth="1.8" />
          <path d={`M${x - 8},52 h16 L${x},32 Z`} fill={i ? "#2C4A26" : "#22301F"} />
        </g>
      ))}
      {/* the candle, the basin, the knife left mid-work */}
      {pool(158, 108, 90, 22, 0.5, 0.95)}
      {candle(158, 68, 36, 1.5, 0.5)}
      <path d="M226,84 q26,14 52,0 l-4,24 q-22,9 -44,0 Z" fill="#4E6A48" />
      <path d="M226,84 q26,14 52,0 l-1,6 q-25,13 -50,0 Z" fill="#5E7E56" opacity="0.7" />
      <rect x="304" y="100" width="76" height="9" rx="3" fill="#2A1C12" />
      <path d="M312,98 L354,92" stroke="#C8CEDA" strokeWidth="3.5" strokeLinecap="round" />
      <rect x="352" y="88" width="20" height="6" rx="3" fill="#3E2814" transform="rotate(-8 352 91)" />
      {/* jars almost lost in the dark */}
      <rect x="338" y="86" width="62" height="4" fill="#0A0E12" opacity="0.8" />
      {[344, 364, 384].map((x) => <rect key={x} x={x} y="68" width="14" height="18" rx="2" fill="#2E3A28" opacity="0.55" />)}
      {motes(158, 58, 0.7)}
    </g>),
    /* -------- THE FORGE: the room itself is an ember -------- */
    wilhelm: (<g>
      <rect width="400" height="120" fill="url(#ivsBgWilhelm)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.22" />
      {/* the hearth, and the heart of it */}
      <path d="M28,112 v-56 q0,-14 14,-14 h66 q14,0 14,14 v56 Z" fill="#331A0E" />
      <path d="M28,112 v-56 q0,-14 14,-14 h66 q14,0 14,14 v56 h-10 v-54 q0,-10 -10,-10 h-54 q-10,0 -10,10 v54 Z" fill="#4E2814" opacity="0.8" />
      <path d="M40,112 v-50 q0,-10 10,-10 h50 q10,0 10,10 v50 Z" fill="#2A1208" />
      <ellipse cx="75" cy="84" rx="32" ry="26" fill="url(#ivsEmber)" opacity="0.6" className="mvGlowPulse" />
      <ellipse cx="75" cy="98" rx="40" ry="15" fill="#E06030" className="mvEmberBed" />
      <ellipse cx="75" cy="99" rx="25" ry="9" fill="#F09055" className="mvEmberBed" style={{ animationDelay: "0.8s" }} />
      <ellipse cx="75" cy="100" rx="13" ry="5" fill="#F8C08A" />
      {pool(75, 104, 130, 30, 0, 1)}
      {sparks(75, 68, 0.2)}
      {/* the bellows, standing like a friar */}
      <path d="M158,112 L196,112 L188,50 q-11,-11 -22,0 Z" fill="#241410" />
      <path d="M163,86 L192,83" stroke="#0E0806" strokeWidth="3" />
      <rect x="173" y="40" width="7" height="12" rx="3.5" fill="#16100C" />
      {/* the anvil, black against the glow */}
      <path d="M234,82 h58 l-13,10 h-10 v10 h17 v10 h-42 v-10 h17 v-10 h-14 Z" fill="#140C0A" />
      <path d="M292,82 q16,2 11,12 l-15,-4 Z" fill="#140C0A" />
      {/* tongs on their peg, the sledge against the wall */}
      <g transform="rotate(5 322 68)">
        <path d="M322,36 v-8" stroke="#1E140E" strokeWidth="3" />
        <ellipse cx="322" cy="68" rx="6" ry="32" fill="none" stroke="#1E140E" strokeWidth="5" />
      </g>
      <g transform="rotate(14 366 70)"><rect x="362" y="34" width="7" height="80" fill="#2E1C12" /><rect x="350" y="20" width="31" height="17" rx="4" fill="#1C1410" /></g>
      {motes(130, 60, 0.8, "#F0B060")}
    </g>),
    /* -------- THE TAPROOM: lamplight on brass and oak -------- */
    liesel: (<g>
      <rect width="400" height="120" fill="url(#ivsBgLiesel)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.26" />
      {/* the bottle shelf, catching what light reaches it */}
      <rect x="24" y="30" width="120" height="5" fill="#140D08" />
      {[[36, "#2E4A38"], [56, "#5A2430"], [76, "#6E5228"], [100, "#2C3A2A"], [122, "#4A2028"]].map(([x, col], i) => (
        <g key={x}><rect x={x} y={12 - (i % 2) * 3} width="11" height={18 + (i % 2) * 3} rx="2.5" fill={col} /><rect x={x + 3.5} y={4 - (i % 2) * 3} width="4" height="9" fill={col} /><circle cx={x + 3.5} cy={18} r="1.2" fill={C.parch} opacity="0.7" /></g>
      ))}
      {/* the lamp over the bar */}
      <path d="M226,0 v34" stroke="#0A0704" strokeWidth="2.5" />
      <path d="M210,52 L242,52 L233,34 L219,34 Z" fill="#0F0A06" />
      {glow(226, 52, 24, 0.2)}
      {flameG(226, 49, 1.5, 0.2)}
      {pool(226, 90, 120, 28, 0.2, 1)}
      {/* two mugs still swinging faintly on their hooks */}
      {[168, 194].map((x, i) => (
        <g key={x} className="mvSway" style={{ animationDelay: `${i * 0.8}s`, animationDuration: `${6 + i}s` }}>
          <path d={`M${x},30 v8`} stroke="#140D08" strokeWidth="2" />
          <rect x={x - 7} y={38} width="14" height="15" rx="2.5" fill="#241608" />
          <path d={`M${x + 7},42 q7,3.5 0,8`} stroke="#241608" strokeWidth="2.5" fill="none" />
        </g>
      ))}
      {/* the bar, tankards waiting on the light */}
      <rect x="24" y="84" width="230" height="8" fill="#3E2814" /><rect x="24" y="84" width="230" height="2.4" fill="#7A5230" opacity="0.8" />
      <rect x="34" y="92" width="7" height="20" fill="#241608" /><rect x="240" y="92" width="7" height="20" fill="#241608" />
      {[120, 162, 204].map((x, i) => (
        <g key={x}><rect x={x} y={62} width="19" height="22" rx="3" fill="#8A6A3E" /><rect x={x + 2.5} y={65} width="5" height="16" fill="#B08850" opacity="0.75" /><path d={`M${x + 19},67 q8,4.5 0,12`} stroke="#8A6A3E" strokeWidth="3" fill="none" /></g>
      ))}
      {/* the barrel, face out, tap dripping amber */}
      <circle cx="322" cy="80" r="32" fill="#3E2814" />
      <circle cx="322" cy="80" r="32" fill="none" stroke="#241608" strokeWidth="4" />
      <circle cx="322" cy="80" r="20" fill="none" stroke="#241608" strokeWidth="2.5" />
      <circle cx="322" cy="80" r="5" fill="#180E06" />
      <rect x="319" y="84" width="6" height="8" fill="#180E06" />
      <circle cx="322" cy="95" r="1.4" fill={C.amber} opacity="0.85" />
      <path d="M296,112 l8,-8 M348,112 l-8,-8" stroke="#241608" strokeWidth="5" strokeLinecap="round" />
      {motes(226, 62, 1)}
    </g>),
    /* -------- THE SURGERY: cold glass, one warm island of light -------- */
    falk: (<g>
      <rect width="400" height="120" fill="url(#ivsBgFalk)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.28" />
      {/* the cabinet, its bottles asleep */}
      <rect x="30" y="18" width="88" height="94" rx="3" fill="#0F141C" />
      <rect x="36" y="24" width="76" height="82" fill="#151C28" />
      <path d="M36,52 h76 M36,80 h76" stroke="#0F141C" strokeWidth="4" />
      {[44, 60, 78, 94].map((x, i) => <rect key={`ca${x}`} x={x} y={37 - (i % 2) * 3} width="11" height={15 + (i % 2) * 3} rx="2" fill={["#2A3A44", "#26323E", "#2E3A34", "#26323E"][i]} opacity="0.9" />)}
      {[46, 64, 84].map((x, i) => <rect key={`cb${x}`} x={x} y={64 - (i % 2) * 2} width="12" height={14 + (i % 2) * 2} rx="2" fill={["#2E3A34", "#2A3A44", "#26323E"][i]} opacity="0.9" />)}
      {/* the chart nobody asks about */}
      <rect x="352" y="22" width="36" height="48" fill="#1A2028" stroke="#2A3240" strokeWidth="2" />
      <path d="M370,28 v34 M363,36 h14 M361,46 h18 M364,56 h12" stroke="#3E4A58" strokeWidth="1.6" />
      {/* the bench: bell jar, spectacles, and the candle's island */}
      {pool(232, 96, 100, 24, 0.6, 0.95)}
      <rect x="150" y="86" width="180" height="7" fill="#1C2430" /><rect x="150" y="86" width="180" height="2" fill="#3E4A58" opacity="0.8" />
      <rect x="158" y="93" width="7" height="19" fill="#141A24" /><rect x="316" y="93" width="7" height="19" fill="#141A24" />
      <rect x="230" y="66" width="22" height="14" rx="7" fill={C.pale} opacity="0.4" />
      <path d="M220,86 C220,58 262,58 262,86 Z" fill="#3A4A66" opacity="0.4" stroke="#4E5E7C" strokeWidth="1.4" />
      <rect x="236" y="52" width="10" height="6" rx="2" fill="#141A24" />
      <circle cx="286" cy="81" r="4.5" fill="none" stroke="#0F141C" strokeWidth="1.8" /><circle cx="297" cy="81" r="4.5" fill="none" stroke="#0F141C" strokeWidth="1.8" /><path d="M290.5,81 h2" stroke="#0F141C" strokeWidth="1.8" />
      {candle(186, 62, 24, 1.4, 0.6)}
      <path d="M186,50 q4,-8 -1,-14" stroke={C.pale} strokeWidth="1.1" fill="none" className="mvSmokeWisp" style={{ animationDelay: "2s" }} />
      {/* his bag on the floor, packed as if he might still be called for */}
      <path d="M338,112 v-16 q0,-8 9,-8 h22 q9,0 9,8 v16 Z" fill="#3A241A" />
      <path d="M348,88 q10,-9 20,0" stroke="#2A180F" strokeWidth="3.5" fill="none" />
      <circle cx="358" cy="98" r="2" fill="#C8A050" opacity="0.9" />
      {motes(232, 58, 0.5)}
    </g>),
    /* -------- THE SEWING ROOM: violet dusk, needle-light -------- */
    rosa: (<g>
      <rect width="400" height="120" fill="url(#ivsBgRosa)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.26" />
      {/* the dress form, wearing only wire */}
      <path d="M56,34 C40,42 40,64 56,72 L84,72 C100,64 100,42 84,34 Z" fill="#332B46" />
      <path d="M56,34 C40,42 40,64 56,72 L64,72 C52,64 52,42 64,34 Z" fill="#3E3556" opacity="0.8" />
      {[76, 84, 92].map((y, i) => <ellipse key={y} cx="70" cy={y + i * 4} rx={22 + i * 5} ry="4.5" fill="none" stroke="#4A3E5E" strokeWidth="2.2" />)}
      <rect x="67" y="72" width="6" height="34" fill="#5E3F24" />
      <path d="M52,108 h36" stroke="#5E3F24" strokeWidth="5" strokeLinecap="round" />
      <circle cx="70" cy="26" r="6.5" fill="#332B46" />
      {/* the hoop on the wall: a bird, mid-flight, always mid-flight */}
      <circle cx="170" cy="38" r="19" fill="none" stroke="#7A5230" strokeWidth="3.5" />
      <circle cx="170" cy="38" r="15" fill="#221B30" />
      <path d="M160,42 q6,-9 14,-3 q-3,-6 4,-9" stroke={C.parch} strokeWidth="1.4" fill="none" opacity="0.75" />
      {/* the worktable: bolts of cloth, the shears, the needle's own light */}
      {pool(300, 96, 100, 24, 0.7, 0.95)}
      <rect x="212" y="86" width="172" height="7" fill="#2A2033" /><rect x="212" y="86" width="172" height="2" fill="#4E3E5C" opacity="0.9" />
      <rect x="220" y="93" width="7" height="19" fill="#1C1626" /><rect x="370" y="93" width="7" height="19" fill="#1C1626" />
      {[[232, "#6E2A38"], [258, "#3E3560"], [284, "#8A7248"]].map(([x, col], i) => (
        <g key={x}><circle cx={x} cy={76 - i * 2} r={10 + i} fill={col} /><circle cx={x} cy={76 - i * 2} r={3.5} fill="#160F20" /></g>
      ))}
      <path d="M312,82 l16,-9 M312,73 l16,9" stroke={C.pale} strokeWidth="2.4" strokeLinecap="round" opacity="0.85" /><circle cx="320" cy="77.5" r="2" fill={C.pale} />
      <path d="M344,40 q28,14 8,44" stroke={C.parch} strokeWidth="1.3" fill="none" opacity="0.6" className="mvSway" style={{ animationDuration: "7s" }} />
      <path d="M344,40 l8,-10" stroke={C.parch} strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
      {candle(356, 68, 18, 1.4, 0.7)}
      {motes(300, 56, 1.1)}
    </g>),
  };
  /* The rooms as the events leave them: the bakery after the riot, the
     taproom boarded shut, the vestry after the fire, and the sick season
     in the stillroom and the surgery. Same walls, harder hour. */
  const roomsHurt = {
    marta: (<g>
      <rect width="400" height="120" fill="url(#ivsBgFalk)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.3" />
      {/* the rack stripped bare */}
      <rect x="252" y="26" width="132" height="5" fill="#161A24" />
      {/* the oven gone cold, one thread of smoke off the dead fire */}
      <path d="M18,112 C18,34 148,34 148,112 Z" fill="#1E222E" />
      <rect x="72" y="4" width="20" height="40" fill="#161A24" />
      <path d="M46,112 C46,68 120,68 120,112 Z" fill="#0C0E16" />
      <ellipse cx="83" cy="106" rx="26" ry="8" fill="#23262E" />
      <circle cx="76" cy="104" r="1.5" fill="#D85F2E" opacity="0.5" className="mvEmberBed" />
      <path d="M83,96 q5,-10 -2,-20" stroke={C.pale} strokeWidth="1.3" fill="none" className="mvSmokeWisp" />
      {/* flour where flour should never be */}
      <ellipse cx="192" cy="110" rx="46" ry="6" fill="#C8C2B0" opacity="0.32" />
      <ellipse cx="254" cy="112" rx="30" ry="5" fill="#C8C2B0" opacity="0.22" />
      <path d="M158,112 q-2,-16 10,-18 l14,4 q6,10 2,14 Z" fill="#6E5C3C" />
      <path d="M172,100 q16,5 26,10" stroke="#C8C2B0" strokeWidth="5" strokeLinecap="round" opacity="0.45" />
      {/* the table on its side, a loaf trodden into the boards */}
      <rect x="296" y="58" width="8" height="54" fill="#2A3038" />
      <rect x="304" y="66" width="26" height="6" fill="#222834" />
      <rect x="304" y="92" width="26" height="6" fill="#222834" />
      <path d="M232,108 a10,7 0 0 1 10,-7 l-2,7 Z" fill="#6E583A" />
      <path d="M252,110 a9,6 0 0 1 9,-6 l-1,6 Z" fill="#6E583A" />
      {/* the stool on its back, the shawl trodden flat */}
      <g transform="rotate(112 210 104)"><rect x="196" y="92" width="30" height="5" fill="#242A34" /><rect x="200" y="97" width="5" height="14" fill="#1C222C" /><rect x="217" y="97" width="5" height="14" fill="#1C222C" /></g>
      <path d="M318,108 q14,-6 30,-2 l-3,6 q-13,-3 -27,0 Z" fill="#54222C" />
      {/* one candle she keeps lit anyway */}
      {pool(366, 104, 46, 12, 0.5, 0.6)}
      <rect x="356" y="96" width="20" height="16" fill="#20262E" />
      {candle(366, 84, 12, 1.2, 0.5)}
    </g>),
    liesel: (<g>
      <rect width="400" height="120" fill="url(#ivsBgTobias)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.3" />
      {/* the shelf boarded over, nails and all */}
      <rect x="24" y="30" width="120" height="5" fill="#10131C" />
      <g transform="rotate(-9 84 26)"><rect x="30" y="21" width="108" height="9" fill="#3A2A18" /><circle cx="38" cy="25" r="1.2" fill="#0C0E14" /><circle cx="130" cy="27" r="1.2" fill="#0C0E14" /></g>
      <g transform="rotate(7 84 34)"><rect x="30" y="30" width="108" height="9" fill="#332414" /><circle cx="38" cy="35" r="1.2" fill="#0C0E14" /><circle cx="130" cy="33" r="1.2" fill="#0C0E14" /></g>
      {/* the lamp hangs dark; the hooks hang empty */}
      <path d="M226,0 v34" stroke="#0A0C12" strokeWidth="2.5" />
      <path d="M210,52 L242,52 L233,34 L219,34 Z" fill="#10131A" />
      {[168, 194].map((x) => <path key={x} d={`M${x},30 v6 q3,3 5,1`} stroke="#10131C" strokeWidth="2" fill="none" />)}
      {/* the bar: a spilled tankard, a stool legs-up, glass underfoot */}
      <rect x="24" y="84" width="230" height="8" fill="#232834" /><rect x="24" y="84" width="230" height="2" fill="#3A4254" opacity="0.7" />
      <rect x="34" y="92" width="7" height="20" fill="#161A24" /><rect x="240" y="92" width="7" height="20" fill="#161A24" />
      <g transform="rotate(84 128 80)"><rect x="118" y="62" width="19" height="22" rx="3" fill="#3E3524" /></g>
      <ellipse cx="152" cy="86" rx="20" ry="2.5" fill="#151009" opacity="0.8" />
      <g transform="rotate(180 200 76)"><rect x="186" y="70" width="28" height="5" fill="#242A36" /><rect x="190" y="75" width="4" height="12" fill="#1C222E" /><rect x="206" y="75" width="4" height="12" fill="#1C222E" /></g>
      <path d="M282,108 l7,-12 4,12 Z" fill="#2E4A38" opacity="0.85" />
      <path d="M296,110 l5,-7 3,7 Z" fill="#2E4A38" opacity="0.7" />
      {/* the barrel chalked dry */}
      <circle cx="322" cy="80" r="32" fill="#232834" />
      <circle cx="322" cy="80" r="32" fill="none" stroke="#161A24" strokeWidth="4" />
      <path d="M308,66 l28,28 M336,66 l-28,28" stroke={C.pale} strokeWidth="2.5" opacity="0.45" />
      <path d="M296,112 l8,-8 M348,112 l-8,-8" stroke="#161A24" strokeWidth="5" strokeLinecap="round" />
      {/* one candle burning for whoever is left upstairs */}
      {pool(70, 98, 50, 14, 0.4, 0.6)}
      {candle(70, 70, 14, 1.2, 0.4)}
    </g>),
    ansel: (<g>
      <rect width="400" height="120" fill="url(#ivsBgAsh)" />
      <rect y="104" width="400" height="16" fill="#000" opacity="0.3" />
      {/* the window holds its arch; the glass did not */}
      <path d="M40,112 v-56 a34,34 0 0 1 68,0 v56 Z" fill="#0C0B14" />
      <path d="M48,112 v-54 a26,26 0 0 1 52,0 v54 Z" fill="#1A1C2C" />
      <polygon points="52,70 74,56 68,84 90,72 80,102 56,98" fill="url(#ivsGlass)" opacity="0.7" />
      <circle cx="70" cy="72" r="7" fill="#C8CEE0" opacity="0.8" />
      <path d="M74,32 v80 M48,74 h52" stroke="#0C0B14" strokeWidth="5" />
      {/* the fallen beam, still remembering the fire */}
      <g transform="rotate(32 210 60)">
        <rect x="140" y="54" width="150" height="11" fill="#100C0A" />
        <path d="M148,60 h58" stroke="#D85F2E" strokeWidth="1.6" opacity="0.5" className="mvEmberBed" />
      </g>
      <path d="M186,52 q4,-10 -2,-18" stroke="#8A8FA0" strokeWidth="1.2" fill="none" className="mvSmokeWisp" style={{ animationDelay: "0.8s" }} />
      <path d="M254,86 q5,-10 -1,-18" stroke="#8A8FA0" strokeWidth="1.2" fill="none" className="mvSmokeWisp" style={{ animationDelay: "2.2s" }} />
      {/* ash where the pews were */}
      <ellipse cx="196" cy="110" rx="34" ry="6" fill="#3A3640" />
      <ellipse cx="248" cy="112" rx="24" ry="4.5" fill="#322E3A" />
      {/* the cross keeps the wall, scorched and standing */}
      <ellipse cx="330" cy="46" rx="34" ry="30" fill="url(#ivsGlow)" opacity="0.22" className="mvGlowPulse" style={{ animationDelay: "1.1s" }} />
      <g transform="rotate(4 330 48)">
        <path d="M330,20 v58 M309,41 h42" stroke="#0A0806" strokeWidth="7" strokeLinecap="round" />
        <path d="M330,24 v20" stroke="#D85F2E" strokeWidth="1.4" opacity="0.35" className="mvEmberBed" />
      </g>
      {/* the altar down on one knee, the ledger half-ash */}
      <g transform="rotate(-9 330 92)"><rect x="288" y="88" width="84" height="6" fill="#0C0B14" /><rect x="294" y="94" width="6" height="18" fill="#0C0B14" /></g>
      <path d="M310,106 q12,-6 22,0 l-2,7 q-9,-4 -18,0 Z" fill="#B8AE96" />
      <path d="M328,104 q8,-4 14,0 l-2,6 q-5,-2 -10,0 Z" fill="#28242E" />
      {/* one candle, kept burning anyway */}
      {pool(368, 102, 50, 14, 0.2, 0.7)}
      {candle(372, 80, 24, 1.4, 0.2)}
      {motes(210, 50, 0.6, "#8A8FA0")}
    </g>),
    greta: (<g>
      {rooms.greta}
      {/* the sick season: the fire never goes out now */}
      <path d="M196,112 q0,-14 12,-14 q12,0 12,14 Z" fill="#1A2014" />
      <path d="M208,96 q5,-9 -1,-16" stroke={C.pale} strokeWidth="1.3" fill="none" className="mvSmokeWisp" style={{ animationDelay: "1.2s" }} />
      {[352, 366].map((x, i) => <rect key={x} x={x} y={96 - i * 4} width="16" height="4" rx="1" fill="#B8B2A0" opacity="0.75" />)}
      {candle(110, 82, 22, 1.3, 1.4)}
    </g>),
    falk: (<g>
      {rooms.falk}
      {/* the well-sickness: basins, cloths, no time to sleep */}
      <path d="M108,104 q15,8 30,0 l-2,8 h-26 Z" fill="#8A93A8" opacity="0.8" />
      <rect x="146" y="106" width="18" height="4" rx="1" fill="#B8B2A0" opacity="0.85" />
      <rect x="146" y="101" width="18" height="4" rx="1" fill="#C8C2B0" opacity="0.7" />
      {candle(96, 92, 20, 1.2, 1.6)}
    </g>),
  };
  return (
    <svg viewBox="0 0 400 120" style={{ width: "100%", height, display: "block" }} preserveAspectRatio="xMidYMax slice">
      <defs>
        <radialGradient id="ivsGlow">
          <stop offset="0%" stopColor="#E7B75B" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#D9A441" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#D9A441" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="ivsWarm">
          <stop offset="0%" stopColor="#F0B060" stopOpacity="0.5" />
          <stop offset="45%" stopColor="#C87838" stopOpacity="0.2" />
          <stop offset="100%" stopColor="#C87838" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="ivsGlass" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#4E5E8C" /><stop offset="100%" stopColor="#283252" />
        </linearGradient>
        <radialGradient id="ivsBgMarta" cx="22%" cy="72%" r="95%">
          <stop offset="0%" stopColor="#6E4020" /><stop offset="45%" stopColor="#3A2213" /><stop offset="100%" stopColor="#171210" />
        </radialGradient>
        <linearGradient id="ivsBgTobias" x1="0.8" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#2A3148" /><stop offset="55%" stopColor="#1B1E2C" /><stop offset="100%" stopColor="#14151E" />
        </linearGradient>
        <linearGradient id="ivsBgAnsel" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#3A4668" /><stop offset="55%" stopColor="#232A44" /><stop offset="100%" stopColor="#131120" />
        </linearGradient>
        <linearGradient id="ivsBgAsh" x1="0.2" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#2E2A38" /><stop offset="55%" stopColor="#1C1824" /><stop offset="100%" stopColor="#14101A" />
        </linearGradient>
        <radialGradient id="ivsBgGreta" cx="42%" cy="55%" r="85%">
          <stop offset="0%" stopColor="#2E3C26" /><stop offset="55%" stopColor="#1C2617" /><stop offset="100%" stopColor="#0F140D" />
        </radialGradient>
        <radialGradient id="ivsBgWilhelm" cx="20%" cy="70%" r="105%">
          <stop offset="0%" stopColor="#7E3C1E" /><stop offset="45%" stopColor="#46220F" /><stop offset="100%" stopColor="#1C100C" />
        </radialGradient>
        <radialGradient id="ivsBgLiesel" cx="55%" cy="70%" r="90%">
          <stop offset="0%" stopColor="#5E3A1C" /><stop offset="50%" stopColor="#33200F" /><stop offset="100%" stopColor="#171009" />
        </radialGradient>
        <linearGradient id="ivsBgFalk" x1="0.3" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#2E3A44" /><stop offset="55%" stopColor="#1C2430" /><stop offset="100%" stopColor="#11141C" />
        </linearGradient>
        <radialGradient id="ivsBgRosa" cx="68%" cy="68%" r="95%">
          <stop offset="0%" stopColor="#45304A" /><stop offset="50%" stopColor="#2A2033" /><stop offset="100%" stopColor="#141020" />
        </radialGradient>
        <radialGradient id="ivsEmber">
          <stop offset="0%" stopColor="#F08A4A" stopOpacity="0.9" />
          <stop offset="55%" stopColor="#B4402E" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#5A1F1A" stopOpacity="0" />
        </radialGradient>
      </defs>
      {(afflicted && roomsHurt[id]) || rooms[id] || <rect width="400" height="120" fill="#131628" />}
    </svg>
  );
}

/* Each room wears its name on the banner. */
const IV_ROOM_NAME = {
  marta: "THE BAKERY", tobias: "THE GRAVE SHED", ansel: "THE VESTRY",
  greta: "THE STILLROOM", wilhelm: "THE FORGE", liesel: "THE TAPROOM",
  falk: "THE SURGERY", rosa: "THE SEWING ROOM",
};

/* ---------- Dawn, painted per place ----------
   The morning the village wakes to: one scene per place a death can be
   found, with afflicted variants when the village's lasting wounds are on
   that ground. Chosen from state the night already decided; nothing here
   rolls anything. */
function DawnScene({ loc, s, height = 190 }) {
  const key =
    loc === "Graveyard" ? "graveyard" :
    loc === "Dark Forest" ? "forest" :
    loc === "Old Church" ? ((s.burned || []).includes("Old Church") ? "church_burned" : "church") :
    loc === "Village Square" ? (s.wellFouled ? "well_fouled" : s.breadRiot ? "square_riot" : "square") :
    loc === "Tavern" ? (s.tavernShut ? "tavern_shut" : "tavern") :
    loc === "Old Mill" ? ((s.burned || []).includes("Old Mill") ? "mill_flood" : "mill") : "cottage";
  const pine = (x, sc = 1, col = "#372C4A") => (
    <g key={`pn${x}`} transform={`translate(${x},0) scale(${sc})`}>
      <polygon points="0,164 -24,164 -12,112" fill={col} /><polygon points="0,138 -21,138 -10,94" fill={col} />
      <polygon points="-2,116 -19,116 -10,82" fill={col} /><rect x="-14" y="160" width="5" height="8" fill={col} />
    </g>
  );
  const SKIES = {
    cottage: ["#2E3452", "#6E5372", "#BE7E62", "#E8B87A", 322, 128, 70],
    graveyard: ["#2A2C48", "#5E4A6E", "#A86A6A", "#D9A08A", 86, 130, 70],
    forest: ["#26324A", "#4E5A62", "#8A825A", "#C8B072", 334, 116, 60],
    church: ["#302E52", "#6A4E74", "#B0766A", "#E0A878", 66, 118, 70],
    church_burned: ["#2E2A38", "#4A4050", "#7A5A54", "#A88468", 66, 118, 55],
    square: ["#2E3450", "#66557A", "#C08668", "#EEC084", 200, 140, 80],
    square_riot: ["#2E2C44", "#585068", "#9A7460", "#C89A74", 200, 142, 62],
    well_fouled: ["#2A3240", "#48564E", "#6E8062", "#9AA070", 200, 140, 50],
    tavern: ["#2C3050", "#684E68", "#B47062", "#E2A578", 344, 126, 70],
    tavern_shut: ["#282C46", "#4E4658", "#7E6058", "#A88468", 344, 130, 50],
    mill: ["#283048", "#5C6A72", "#9CA26A", "#D8C87E", 300, 122, 65],
    mill_flood: ["#242A34", "#40484A", "#5E6858", "#8A9270", 300, 124, 50],
  }[key];
  const MIST = { graveyard: 0.26, forest: 0.3, square: 0.22, well_fouled: 0.24, church_burned: 0.12, tavern_shut: 0.12, square_riot: 0.15, mill: 0.24, mill_flood: 0.32 }[key] || 0.18;
  const houses = [[26, 96, 62, 58], [318, 96, 60, 56]].map(([x, y, w, h]) => (
    <g key={x}><rect x={x} y={y} width={w} height={h} fill="#1E1934" /><polygon points={`${x - 6},${y} ${x + w + 6},${y} ${x + w / 2},${y - 26}`} fill="#181430" /><rect x={x + w / 2 - 6} y={y + 14} width="12" height="14" fill="#0E0B18" /></g>
  ));
  const well = (<g>
    <ellipse cx="200" cy="160" rx="30" ry="8" fill="#1E1934" />
    <rect x="176" y="128" width="48" height="30" rx="4" fill="#1E1934" />
    <rect x="196" y="100" width="8" height="28" fill="#131022" />
    <path d="M176,104 h48" stroke="#131022" strokeWidth="4" />
    <polygon points="170,104 230,104 200,86" fill="#181430" />
  </g>);
  const els = {
    cottage: (<g>
      {pine(30, 0.8)}
      <ellipse cx="316" cy="166" rx="95" ry="6" fill="#E8B87A" opacity="0.28" />
      <rect x="150" y="92" width="100" height="70" fill="#1E1930" />
      <polygon points="142,92 258,92 200,56" fill="#171326" />
      <rect x="232" y="64" width="11" height="28" fill="#171326" />
      <path d="M237,62 q4,-8 -1,-13" stroke="#D8CBB2" strokeWidth="2" fill="none" opacity="0.5" className="mvSmokeWisp" />
      <rect x="186" y="116" width="24" height="46" fill="#0B0814" />
      <rect x="160" y="112" width="14" height="16" fill="#0E0B18" />
      <rect x="226" y="112" width="14" height="16" fill="#0E0B18" />
      <rect x="270" y="132" width="3" height="30" fill="#131022" />
      <rect x="266" y="120" width="11" height="14" rx="2" fill="#131022" />
      <ellipse cx="271.5" cy="127" rx="2.2" ry="3.4" fill={C.amber} className="mvFlick" />
      <g transform="rotate(-14 129 156)"><path d="M118,162 q1,-10 11,-10 q10,0 11,10 Z" fill="#131022" /><path d="M120,150 q9,-8 18,0" stroke="#131022" strokeWidth="2" fill="none" /></g>
      {[86, 100, 288, 302, 316].map((x) => <rect key={x} x={x} y="146" width="4" height="18" fill="#131022" />)}
    </g>),
    graveyard: (<g>
      <path d="M330,162 L330,84 M330,104 L306,80 M330,122 L356,96 M330,92 L344,70 M306,80 L296,66" stroke="#1C1730" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M340,72 q4,-4 8,0" stroke="#131022" strokeWidth="2" fill="none" />
      <ellipse cx="298" cy="63" rx="4.5" ry="3" fill="#131022" /><path d="M302,63 l6,-2" stroke="#131022" strokeWidth="1.5" />
      {[[60, 128, 24, 34], [108, 138, 20, 26], [206, 132, 22, 30], [370, 136, 20, 28]].map(([x, y, w, h]) => (
        <rect key={x} x={x} y={y} width={w} height={h} rx={w / 2.2} fill="#1C1730" />
      ))}
      <path d="M158,120 v34 M148,130 h20" stroke="#1C1730" strokeWidth="6" strokeLinecap="round" />
      <ellipse cx="262" cy="164" rx="30" ry="7" fill="#161022" />
      <ellipse cx="262" cy="162" rx="20" ry="4" fill="#2E2216" />
    </g>),
    forest: (<g>
      <polygon points="334,116 260,190 306,190" fill="#EED8B0" opacity="0.08" />
      <polygon points="334,116 350,190 396,190" fill="#EED8B0" opacity="0.06" />
      {pine(20, 0.55, "#2E3852")}{pine(86, 0.5, "#2E3852")}{pine(150, 0.6, "#2E3852")}{pine(222, 0.5, "#2E3852")}
      {/* kept clear of the sun disc (centred 334,116, r60): every tree
         stays left of x=260, none crossing the light */}
      {pine(16, 0.75, "#232B3E")}{pine(48, 1.1, "#1E2434")}{pine(118, 0.85, "#232B3E")}{pine(180, 1.2, "#1E2434")}{pine(258, 0.9, "#232B3E")}
      <ellipse cx="300" cy="168" rx="14" ry="5" fill="#1E2434" />
      <rect x="292" y="156" width="16" height="12" fill="#1E2434" />
      <path d="M212,120 q5,8 -1,16" stroke="#6E2A34" strokeWidth="3" fill="none" className="mvSway" />
    </g>),
    church: (<g>
      <rect x="196" y="100" width="128" height="62" fill="#1B1630" />
      <rect x="150" y="52" width="52" height="110" fill="#1B1630" />
      <polygon points="144,52 208,52 176,10" fill="#161228" />
      <rect x="173" y="0" width="5" height="12" fill="#161228" /><rect x="167" y="3" width="17" height="4" fill="#161228" />
      <path d="M168,76 a8,8 0 0 1 16,0 v14 h-16 Z" fill="#E8A85A" opacity="0.75" className="mvFlick" />
      {[236, 268, 300].map((x) => <path key={x} d={`M${x},118 a7,7 0 0 1 14,0 v12 h-14 Z`} fill="#E8A85A" opacity="0.65" className="mvFlick" />)}
      <path d="M348,60 q4,-4 8,0 M362,50 q4,-4 8,0" stroke="#1B1630" strokeWidth="2" fill="none" />
      {[36, 52, 68, 84].map((x) => <rect key={x} x={x} y="148" width="4" height="16" fill="#1B1630" />)}
      <rect x="30" y="144" width="62" height="4" fill="#1B1630" />
    </g>),
    church_burned: (<g>
      <rect x="196" y="112" width="128" height="50" fill="#171225" />
      <path d="M196,112 L214,98 L230,112 L252,94 L270,112 L292,100 L324,112 Z" fill="#171225" />
      <path d="M214,98 l-5,-15 M252,94 l4,-17 M292,100 l-3,-15" stroke="#100C18" strokeWidth="4" strokeLinecap="round" />
      <rect x="150" y="52" width="52" height="110" fill="#1B1630" />
      <polygon points="144,52 208,52 176,10" fill="#161228" />
      <rect x="173" y="0" width="5" height="12" fill="#161228" /><rect x="167" y="3" width="17" height="4" fill="#161228" />
      <path d="M168,76 a8,8 0 0 1 16,0 v14 h-16 Z" fill="#0B0814" />
      <ellipse cx="258" cy="152" rx="42" ry="8" fill="#0E0A16" />
      <ellipse cx="258" cy="150" rx="24" ry="4" fill="#D85F2E" opacity="0.45" className="mvEmberBed" />
      <path d="M238,96 q6,-16 -2,-30" stroke="#8A8FA0" strokeWidth="2" fill="none" className="mvSmokeWisp" />
      <path d="M282,100 q5,-14 -1,-26" stroke="#8A8FA0" strokeWidth="1.6" fill="none" className="mvSmokeWisp" style={{ animationDelay: "1.6s" }} />
      <path d="M348,58 q4,-4 8,0 M334,48 q4,-4 8,0" stroke="#1B1630" strokeWidth="2" fill="none" />
    </g>),
    square: (<g>
      {houses}
      <g className="mvSway"><path d="M88,96 h16" stroke="#131022" strokeWidth="2" /><rect x="90" y="98" width="12" height="10" rx="1.5" fill="#131022" /></g>
      {well}
      <g transform="rotate(104 254 160)"><path d="M248,152 h12 v10 q-6,3 -12,0 Z" fill="#131022" /></g>
      <ellipse cx="262" cy="166" rx="12" ry="2.5" fill="#131022" opacity="0.7" />
    </g>),
    square_riot: (<g>
      {houses}
      {well}
      <g transform="rotate(-9 148 152)"><rect x="118" y="146" width="60" height="5" fill="#131022" /><rect x="124" y="151" width="5" height="13" fill="#131022" /><rect x="166" y="151" width="5" height="13" fill="#131022" /></g>
      <path d="M96,160 l16,-9 M108,164 l13,-5" stroke="#131022" strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="252" cy="164" rx="24" ry="4" fill="#C8C2B0" opacity="0.28" />
      <path d="M242,160 a8,6 0 0 1 8,-6 l-1,6 Z" fill="#6E583A" />
      <path d="M262,162 a7,5 0 0 1 7,-5 l-1,5 Z" fill="#6E583A" />
      <path d="M282,152 q5,7 -1,14" stroke="#6E2A34" strokeWidth="3" fill="none" className="mvSway" />
    </g>),
    well_fouled: (<g>
      {houses}
      <ellipse cx="200" cy="164" rx="56" ry="9" fill="#22301F" opacity="0.8" />
      <path d="M172,158 q-10,4 -18,3 M228,158 q10,4 18,3" stroke="#22301F" strokeWidth="3" fill="none" opacity="0.7" />
      {well}
      <path d="M200,104 v18" stroke="#131022" strokeWidth="1.5" />
      <path d="M194,122 h12 l-2,9 h-8 Z" fill="#131022" />
      <ellipse cx="150" cy="98" rx="4.5" ry="3" fill="#131022" /><path d="M154,98 l6,-2" stroke="#131022" strokeWidth="1.5" />
      <path d="M262,84 q4,-4 8,0" stroke="#131022" strokeWidth="2" fill="none" />
    </g>),
    tavern: (<g>
      <rect x="96" y="86" width="176" height="76" fill="#1E1830" />
      <polygon points="86,86 282,86 184,48" fill="#181328" />
      <rect x="130" y="60" width="10" height="24" fill="#181328" />
      <path d="M135,58 q4,-7 -1,-12" stroke="#D8CBB2" strokeWidth="1.8" fill="none" opacity="0.5" className="mvSmokeWisp" />
      <rect x="172" y="118" width="26" height="44" fill="#0B0814" />
      <rect x="120" y="112" width="15" height="17" fill="#0E0B18" />
      <rect x="236" y="112" width="15" height="17" fill="#0E0B18" />
      <path d="M272,92 h30" stroke="#131022" strokeWidth="3" />
      <g className="mvSway"><path d="M292,95 v7 M300,95 v7" stroke="#131022" strokeWidth="1.5" /><rect x="286" y="102" width="20" height="15" rx="2" fill="#131022" /><circle cx="296" cy="109" r="4" fill="none" stroke="#B4885A" strokeWidth="1.4" /></g>
      <g transform="rotate(-80 152 164)"><rect x="146" y="156" width="12" height="14" rx="2" fill="#131022" /><path d="M158,159 q5,3 0,8" stroke="#131022" strokeWidth="2" fill="none" /></g>
      <ellipse cx="290" cy="168" rx="14" ry="10" fill="#1E1830" />
    </g>),
    tavern_shut: (<g>
      <rect x="96" y="86" width="176" height="76" fill="#1E1830" />
      <polygon points="86,86 282,86 184,48" fill="#181328" />
      <rect x="130" y="60" width="10" height="24" fill="#181328" />
      <rect x="172" y="118" width="26" height="44" fill="#0B0814" />
      <g transform="rotate(-14 185 136)"><rect x="164" y="132" width="42" height="7" fill="#3A2A18" /><circle cx="168" cy="135" r="1" fill="#0C0E14" /><circle cx="202" cy="137" r="1" fill="#0C0E14" /></g>
      <g transform="rotate(11 185 148)"><rect x="164" y="144" width="42" height="7" fill="#332414" /><circle cx="168" cy="149" r="1" fill="#0C0E14" /><circle cx="202" cy="146" r="1" fill="#0C0E14" /></g>
      <rect x="120" y="112" width="15" height="17" fill="#0E0B18" />
      <g transform="rotate(-8 127 120)"><rect x="114" y="117" width="27" height="5" fill="#3A2A18" /></g>
      <rect x="236" y="112" width="15" height="17" fill="#0E0B18" />
      <g transform="rotate(7 243 120)"><rect x="230" y="117" width="27" height="5" fill="#3A2A18" /></g>
      <path d="M272,92 h30" stroke="#131022" strokeWidth="3" />
      <g transform="rotate(12 296 152)"><rect x="286" y="140" width="20" height="15" rx="2" fill="#131022" /><circle cx="296" cy="147" r="4" fill="none" stroke="#6E5A42" strokeWidth="1.4" /></g>
    </g>),
    mill: (<g>
      <rect x="130" y="96" width="100" height="66" fill="#1E1F34" />
      <polygon points="122,96 238,96 180,58" fill="#181828" />
      <rect x="150" y="60" width="10" height="26" fill="#181828" />
      <rect x="204" y="122" width="24" height="40" fill="#0B0A16" />
      <rect x="150" y="116" width="14" height="16" fill="#0E0D1A" />
      {/* the wheel, turning at the mill's flank */}
      <circle cx="258" cy="132" r="30" fill="none" stroke="#181828" strokeWidth="7" />
      <circle cx="258" cy="132" r="5" fill="#181828" />
      <path d="M258,132 L288,132 M258,132 L279,153 M258,132 L258,162 M258,132 L237,153 M258,132 L228,132 M258,132 L237,111 M258,132 L258,102 M258,132 L279,111" stroke="#181828" strokeWidth="5" />
      {/* the millpond, still and dark, catching the sky */}
      <ellipse cx="230" cy="172" rx="150" ry="14" fill="#3A4A56" opacity="0.55" />
      <ellipse cx="230" cy="170" rx="60" ry="4" fill="#E8C87E" opacity="0.28" />
      <path d="M60,150 q6,-6 12,0" stroke="#181828" strokeWidth="2" fill="none" />
    </g>),
    mill_flood: (<g>
      <rect x="130" y="96" width="100" height="66" fill="#171826" />
      <polygon points="122,96 238,96 180,58" fill="#14141F" />
      <rect x="150" y="60" width="10" height="26" fill="#14141F" />
      <rect x="204" y="122" width="24" height="40" fill="#080712" />
      {/* the wheel, broken off its axle, hanging wrong */}
      <g transform="rotate(24 258 132)">
        <circle cx="258" cy="132" r="30" fill="none" stroke="#14141F" strokeWidth="7" strokeDasharray="14 6" />
        <path d="M258,132 L279,153 M258,132 L258,162 M258,132 L228,132 M258,132 L237,111" stroke="#14141F" strokeWidth="5" />
      </g>
      {/* the flood: water climbed the walls, dark and wide */}
      <ellipse cx="220" cy="176" rx="180" ry="20" fill="#26343C" opacity="0.75" />
      <ellipse cx="200" cy="160" rx="70" ry="8" fill="#26343C" opacity="0.6" />
      <path d="M172,150 h56" stroke="#26343C" strokeWidth="4" opacity="0.7" />
    </g>),
  }[key];
  return (
    <svg viewBox="0 0 400 190" style={{ width: "100%", height, display: "block" }} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`dwS-${key}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={SKIES[0]} /><stop offset="42%" stopColor={SKIES[1]} />
          <stop offset="72%" stopColor={SKIES[2]} /><stop offset="100%" stopColor={SKIES[3]} />
        </linearGradient>
        <radialGradient id={`dwSun-${key}`}>
          <stop offset="0%" stopColor="#FFE9BC" /><stop offset="30%" stopColor="#F5C878" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#E8A85A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="190" fill={`url(#dwS-${key})`} />
      <circle cx={SKIES[4]} cy={SKIES[5]} r={SKIES[6]} fill={`url(#dwSun-${key})`} className="mvGlowPulse" />
      <circle cx={SKIES[4]} cy={SKIES[5]} r="14" fill="#FFEFCB" />
      <path d="M96,52 q4,-4 8,0 M112,60 q3,-3 6,0" stroke="#2A2438" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <rect y="160" width="400" height="30" fill="#262038" />
      {els}
      <ellipse className="mvFog" cx="140" cy="152" rx="130" ry="11" fill="#EED8B0" opacity={MIST} />
      <ellipse className="mvFog2" cx="300" cy="162" rx="140" ry="9" fill="#EED8B0" opacity={MIST * 0.75} />
    </svg>
  );
}

/* The night cinematic's hero: a moonlit village, the counterpart to
   DawnScene. Always the same skyline - the night itself is the subject,
   not a place - so it needs no location argument. */
function NightScene({ height = 190 }) {
  return (
    <svg viewBox="0 0 400 190" style={{ width: "100%", height, display: "block" }} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="nsSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A0E20" /><stop offset="55%" stopColor="#141A30" /><stop offset="100%" stopColor="#1C2138" />
        </linearGradient>
        <radialGradient id="nsMoon"><stop offset="0%" stopColor="#EEF0F8" stopOpacity="0.9" /><stop offset="100%" stopColor="#AEB4CC" stopOpacity="0" /></radialGradient>
      </defs>
      <rect width="400" height="190" fill="url(#nsSky)" />
      <circle cx="322" cy="48" r="48" fill="url(#nsMoon)" className="mvGlowPulse" />
      <circle cx="322" cy="48" r="20" fill="#E9ECF6" />
      <circle cx="316" cy="44" r="3.2" fill="#C4C9DA" opacity="0.5" /><circle cx="328" cy="55" r="2.5" fill="#C4C9DA" opacity="0.5" />
      {[[40, 32], [80, 58], [130, 26], [180, 46], [230, 32], [268, 62], [360, 36], [388, 60]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="1.15" fill="#DDE2F0" opacity="0.6" className="mvFlick" style={{ animationDelay: `${i * 0.5}s` }} />
      ))}
      <ellipse className="mvFog" cx="120" cy="158" rx="150" ry="14" fill="#3A4468" opacity="0.16" />
      <rect y="166" width="400" height="24" fill="#0B0E1C" />
      {[[20, 40, 30], [70, 32, 40], [250, 38, 34], [300, 44, 30], [356, 50, 26]].map(([x, w, h]) => (
        <g key={x}><rect x={x} y={166 - h} width={w} height={h} fill="#0C1120" /><polygon points={`${x - 4},${166 - h} ${x + w + 4},${166 - h} ${x + w / 2},${166 - h - 14}`} fill="#0A0E1A" /></g>
      ))}
      <rect x="42" y="158" width="7" height="9" fill="#D9A441" opacity="0.85" className="mvFlick" />
      <rect x="316" y="158" width="7" height="9" fill="#D9A441" opacity="0.7" className="mvFlick" style={{ animationDelay: "1.2s" }} />
      <path d="M150,170 q4,-16 12,-16 q8,0 12,16 Z" fill="#0C1120" />
    </svg>
  );
}

/* A sliver of the village in morning light, behind the day header. */
function DayStrip({ height = 64 }) {
  return (
    <svg viewBox="0 0 400 70" style={{ width: "100%", height, display: "block" }} preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id="dwStrip" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#48507A" /><stop offset="70%" stopColor="#9A7A72" /><stop offset="100%" stopColor="#D0A878" />
        </linearGradient>
        <radialGradient id="dwStripSun">
          <stop offset="0%" stopColor="#FFE9BC" stopOpacity="0.9" /><stop offset="100%" stopColor="#E8A85A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="400" height="70" fill="url(#dwStrip)" />
      <circle cx="330" cy="52" r="38" fill="url(#dwStripSun)" className="mvGlowPulse" />
      <circle cx="330" cy="52" r="9" fill="#FFEFCB" />
      {[[30, 40, 26], [82, 34, 32], [255, 38, 28], [368, 44, 24]].map(([x, w, h]) => (
        <g key={x}><rect x={x} y={70 - h} width={w} height={h} fill="#221C34" /><polygon points={`${x - 4},${70 - h} ${x + w + 4},${70 - h} ${x + w / 2},${70 - h - 13}`} fill="#1C1730" /></g>
      ))}
      <path d="M150,70 q4,-16 12,-16 q8,0 12,16 Z" fill="#221C34" />
      <ellipse className="mvFog" cx="200" cy="66" rx="150" ry="6" fill="#EED8B0" opacity="0.16" />
    </svg>
  );
}

/* Icons for the day's four errands. */
function MvIcon({ k }) {
  const b = {
    invest: <g><path d="M8,19 C8,14 16,14 16,19" /><circle cx="12" cy="9.6" r="3.4" /><path d="M4.5,20.5 h15" strokeWidth="2.2" /></g>,
    search: <g><circle cx="10.4" cy="10.4" r="6" /><path d="M15,15 L20.5,20.5" strokeWidth="2.4" /></g>,
    talk: <g><path d="M4,6.5 h16 v10 h-9 l-4.5,4 v-4 h-2.5 Z" /></g>,
    exam: <g><path d="M2.8,12 q9.2,-10.5 18.4,0 q-9.2,10.5 -18.4,0 Z" /><circle cx="12" cy="12" r="3" /></g>,
    /* the ways of working a place, or a body */
    ground: <g><path d="M3,17 h18 M6,13 l3,4 M12,11 l2,6 M17,13 l1,4" /></g>,
    walls: <g><path d="M12,12 a8,8 0 1 1 0,-0.01 M12,2 v3 M12,19 v3 M2,12 h3 M19,12 h3" /></g>,
    air: <g><path d="M3,9 h11 a3,3 0 1 0 -3,-3 M3,14 h15 a3,3 0 1 1 -3,3" /></g>,
    wounds: <g><path d="M12,3 C9,9 5,11 5,15 a7,7 0 0 0 14,0 C19,11 15,9 12,3 Z" /><path d="M12,9 v8" /></g>,
  }[k];
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" style={{ display: "block" }}>{b}</svg>;
}

/* How they stand with you, worn on the portrait: the ring and the word only
   restate what the reception prose already says out loud. */
const IV_MOOD = {
  hate: { word: "hostile toward you", color: "#C24450" },
  cool: { word: "cold toward you", color: "#7C88B0" },
  neutral: { word: "even with you", color: "#8A8FA8" },
  warm: { word: "warm toward you", color: "#D9A441" },
  fond: { word: "fond of you", color: "#E4C06B" },
};

const IV_CATS = [
  { key: "catN", label: "The Nights", hint: "Where they were, who they saw" },
  { key: "catP", label: "Press Them", hint: "Suspicion, and their craft" },
  { key: "catV", label: "The Village", hint: "Gossip, favours, secrets" },
  { key: "catH", label: "The Person", hint: "Sit with them a while" },
];


function Btn({ children, onClick, disabled, kind = "ghost", full, small, center }) {
  const styles = {
    ghost: { background: "transparent", border: `1px solid ${C.line}`, color: C.text },
    amber: { background: "transparent", border: `1px solid ${C.amber}`, color: C.amber },
    red: { background: C.red, border: `1px solid ${C.red}`, color: "#F3E9E4" },
  }[kind];
  return (
    <button onClick={onClick} disabled={disabled}
      className={`mv-btn mv-body rounded ${full ? "w-full" : ""} ${small ? "px-3 py-1.5 text-sm" : "px-4 py-2.5"}`}
      style={{ ...styles, opacity: disabled ? 0.35 : 1, cursor: disabled ? "default" : "pointer", textAlign: center ? "center" : "left" }}>
      {children}
    </button>
  );
}




function MoonStrip({ s }) {
  const pips = [];
  for (let n = 1; n <= s.nightNum; n++) {
    const slain = s.deaths.find((x) => x.night === n && (x.kind === "slain" || x.kind === "drained"));
    const turned = s.deaths.find((x) => x.night === n && x.kind === "turned");
    const log = s.nightLogs.find((x) => x.night === n);
    let bg = "transparent", border = C.dim;
    if (slain) { bg = C.redBright; border = C.redBright; }
    else if (turned && npcById(s, turned.id) && npcById(s, turned.id).known) { bg = C.turn; border = C.turn; }
    pips.push(
      <span key={n} className="inline-flex flex-col items-center">
        <span className="inline-block rounded-full" style={{ width: 11, height: 11, background: bg, border: `1.5px solid ${border}` }} />
        <span style={{ color: C.amber, fontSize: 9, lineHeight: "9px" }}>{log && log.wail ? "≈" : "\u00A0"}</span>
      </span>
    );
  }
  return <div className="flex gap-1.5 items-end flex-wrap">{pips}</div>;
}


function IvIcon({ k }) {
  const body = {
    catN: <path d="M14,3.4 A8.6,8.6 0 1 0 20.6,13.8 7,7 0 0 1 14,3.4 Z" fill="currentColor" stroke="none" />,
    catP: <g><path d="M12,3.6 L12,13.4" strokeWidth="2.4" /><circle cx="12" cy="19" r="1.8" fill="currentColor" stroke="none" /></g>,
    catV: <g><path d="M3,20 V12.2 L7.4,8.2 L11.8,12.2 V20 Z" /><path d="M12.6,20 V11.2 L16.6,7.6 L20.9,11.2 V20 Z" /></g>,
    catH: <g><circle cx="12" cy="8.2" r="3.8" /><path d="M4.6,20.4 C4.6,14.6 19.4,14.6 19.4,20.4" /></g>,
  }[k];
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" style={{ display: "block" }}>
      {body}
    </svg>
  );
}


function DayStripH(p) { return React.createElement(DayStrip, { height: Number(p.h) || 64 }); }
function SceneH(p) { return React.createElement(Scene, { loc: p.loc, kind: p.kind, height: Number(p.h) || 150 }); }
function NightSceneH(p) { return React.createElement(NightScene, { height: Number(p.h) || 190 }); }
function DawnSceneH(p) { return React.createElement(DawnScene, { loc: p.loc, s: p.s, height: Number(p.h) || 190 }); }
function InterviewSceneH(p) { return React.createElement(InterviewScene, { id: p.id, height: Number(p.h) || 92, afflicted: p.afflicted }); }

/* the shrouded shape that sits low on the death-scene hero (verbatim from
   the build's investModal) */
function ShroudH() {
  return (
    <svg width="58" height="20" viewBox="0 0 58 20" style={{ display: "block" }}>
      <path d="M5,18 C7,8 16,5 29,5 C42,5 51,8 53,18 Z" fill="#C8BFA8" opacity="0.45" />
      <path d="M5,18 L53,18" stroke="#2A0A06" strokeWidth="1.1" />
    </svg>
  );
}

const HollowArt = { C, ShroudH, Scene, Portrait, MonsterArt, MonsterDeath, InterviewScene, DawnScene, NightScene, DayStrip, MvIcon, Btn, MoonStrip, METHOD_FX, DayStripH, SceneH, DawnSceneH, NightSceneH, InterviewSceneH, IvIcon, CSS_ALL: null };
window.HollowArt = HollowArt;
Object.keys(HollowArt).forEach((k) => { window[k] = HollowArt[k]; });
if (typeof module !== "undefined") module.exports = HollowArt;
