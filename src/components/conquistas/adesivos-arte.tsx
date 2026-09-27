import { useId, type CSSProperties, type ReactNode } from "react";
import { Award } from "lucide-react";

/**
 * ADESIVOS PRÓPRIOS (26/09) — no lugar dos emojis das insígnias.
 *
 * Estilo único (o da folha aprovada do Fable): desenho chapado em tons
 * pastel, contorno grafite, borda branca de adesivo recortado ("die-cut",
 * feita pelo filtro feMorphology) e sombra curta. Tudo em viewBox 100×100,
 * formas simples que leem em 64 px. Os 6 primeiros vieram prontos da folha
 * (chama, cofrinho, halter, livro, gota, semana); os outros foram desenhados
 * na mesma régua. Cada SVG leva o PRÓPRIO filtro (id único): o gerador de
 * imagem dos Stories clona só o nó do adesivo, e um filtro definido fora dele
 * sumiria na foto.
 */

const TRACO = "#2b2b2f";
const FONTE = "Inter, -apple-system, sans-serif";

/** Estrelinha de 4 pontas (brilho). */
const Brilho = ({ x, y, r, cor = "#fde047" }: { x: number; y: number; r: number; cor?: string }) => (
  <path
    d={`M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r} Z`}
    fill={cor}
    strokeWidth={1.6}
  />
);

/** Estrela de 5 pontas centrada em (0,0), raio ~7 — escalar com transform. */
const ESTRELA = "0,-7 2.1,-2.2 7.1,-2.2 3,1 4.4,6 0,3.2 -4.4,6 -3,1 -7.1,-2.2 -2.1,-2.2";

/** Moeda com texto (o "10", o "$"…). */
const Moeda = ({ x, y, r, texto, cor = "#fde047", tam }: { x: number; y: number; r: number; texto: string; cor?: string; tam?: number }) => (
  <>
    <circle cx={x} cy={y} r={r} fill={cor} />
    <text x={x} y={y + (tam ?? r) * 0.36} textAnchor="middle" fontFamily={FONTE} fontSize={tam ?? r} fontWeight={900} fill={TRACO} stroke="none">
      {texto}
    </text>
  </>
);

/** Check branco (em cima de um círculo colorido). */
const Check = ({ x, y, s = 1 }: { x: number; y: number; s?: number }) => (
  <path
    d={`M${x - 9 * s},${y} l${6 * s},${6 * s} l${11 * s},${-12 * s}`}
    fill="none"
    stroke="#fff"
    strokeWidth={4.5 * s}
    strokeLinecap="round"
    strokeLinejoin="round"
  />
);

/** Anel contornado: traço grosso grafite + traço mais fino colorido por cima. */
const Contornado = ({ d, cor, largura = 4 }: { d: string; cor: string; largura?: number }) => (
  <>
    <path d={d} fill="none" stroke={TRACO} strokeWidth={largura + 4.4} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke={cor} strokeWidth={largura} strokeLinecap="round" strokeLinejoin="round" />
  </>
);

/* Chama + fita "N DIAS" (sequência) — a chama e a fita de 7 são as do Fable. */
const chama = (rotulo: string, fita: string, texto = "#fff", extras?: ReactNode) => (
  <>
    <path d="M50,12 C56,26 70,30 70,50 C70,64 61,74 50,76 C39,74 30,64 30,50 C30,44 33,38 37,34 C37,42 42,45 44,45 C42,36 46,22 50,12 Z" fill="#fb923c" />
    <path d="M50,42 C54,50 60,52 60,60 C60,67 55,72 50,73 C45,72 40,67 40,60 C40,56 42,52 45,50 C45,54 48,56 49,56 C48,52 49,46 50,42 Z" fill="#fde047" stroke="none" />
    {extras}
    {rotulo.length <= 6 ? (
      <rect x="22" y="72" width="56" height="18" rx="4" fill={fita} />
    ) : (
      <rect x={rotulo.length <= 7 ? 17 : 13} y="72" width={rotulo.length <= 7 ? 66 : 74} height="18" rx="4" fill={fita} />
    )}
    <text x="50" y="85" textAnchor="middle" fontFamily={FONTE} fontSize="10.5" fontWeight={900} letterSpacing="1" fill={texto} stroke="none">
      {rotulo}
    </text>
  </>
);

/** Ângulos (tela, y pra baixo) das folhas do louro: de baixo-esquerda até o alto. */
const FOLHAS_LOURO = [120, 140, 160, 180, 200, 220, 240];

/** id da insígnia → desenho (o conteúdo do grupo com contorno e recorte). */
const ARTES: Record<string, ReactNode> = {
  /* ---------------- Sequência ---------------- */
  "sequencia-7": chama("7 DIAS", "#d22d80"),
  "sequencia-30": chama("30 DIAS", "#7c3aed", "#fff", <><Brilho x={80} y={26} r={7} /><Brilho x={21} y={38} r={5} /></>),
  "sequencia-100": chama("100 DIAS", "#facc15", TRACO, <><Brilho x={80} y={24} r={8} /><Brilho x={20} y={30} r={6} /><Brilho x={84} y={52} r={4.5} cor="#fb923c" /></>),

  /* ---------------- Finanças ---------------- */
  // cédula (+ moeda "1º")
  "first-income": (
    <>
      <g transform="rotate(-8 50 48)">
        <rect x="12" y="28" width="74" height="40" rx="6" fill="#86efac" />
        <rect x="19" y="35" width="60" height="26" rx="4" fill="#bbf7d0" strokeWidth={1.6} />
        <circle cx="49" cy="48" r="10" fill="#4ade80" />
        <text x="49" y="53" textAnchor="middle" fontFamily={FONTE} fontSize="13" fontWeight={900} fill="#14532d" stroke="none">$</text>
        <circle cx="28" cy="48" r="2.6" fill="#16a34a" stroke="none" />
        <circle cx="70" cy="48" r="2.6" fill="#16a34a" stroke="none" />
      </g>
      <Moeda x={76} y={74} r={12} texto="1º" tam={10.5} />
    </>
  ),
  // maleta + moedas entrando
  "multi-income": (
    <>
      <path d="M34,38 V31 a5,5 0 0 1 5,-5 H53 a5,5 0 0 1 5,5 V38" fill="none" strokeWidth={3.2} />
      <rect x="14" y="38" width="64" height="44" rx="7" fill="#fbbf24" />
      <path d="M14,54 H78" fill="none" />
      <rect x="40" y="49" width="12" height="10" rx="2.5" fill="#fef3c7" />
      <Moeda x={80} y={22} r={9} texto="$" tam={10} />
      <Moeda x={88} y={42} r={7} texto="$" tam={8} />
      <Moeda x={66} y={12} r={6} texto="$" tam={7} />
    </>
  ),
  // notinha fiscal
  "first-expense": (
    <g transform="rotate(-6 50 50)">
      <path d="M26,12 H74 V86 L68,81 L62,86 L56,81 L50,86 L44,81 L38,86 L32,81 L26,86 Z" fill="#fff" />
      <path d="M34,26 H66 M34,36 H58 M34,46 H62" fill="none" stroke="#a3a3a3" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M34,58 H66" fill="none" strokeWidth={1.6} strokeDasharray="3 3" />
      <rect x="34" y="63" width="32" height="9" rx="2.5" fill="#f9a8d4" strokeWidth={1.8} />
    </g>
  ),
  // pasta com separadores coloridos
  "organizer": (
    <>
      <path d="M12,30 a6,6 0 0 1 6,-6 H38 L45,32 H82 a6,6 0 0 1 6,6 V78 a6,6 0 0 1 -6,6 H18 a6,6 0 0 1 -6,-6 Z" fill="#fbbf24" />
      <rect x="24" y="22" width="12" height="12" rx="2" fill="#f472b6" />
      <rect x="42" y="18" width="12" height="14" rx="2" fill="#60a5fa" />
      <rect x="60" y="22" width="12" height="12" rx="2" fill="#4ade80" />
      <rect x="20" y="28" width="60" height="30" rx="3" fill="#fff" strokeWidth={1.8} />
      <path d="M16,44 a5,5 0 0 1 5,-5 H79 a5,5 0 0 1 5,5 V78 a6,6 0 0 1 -6,6 H22 a6,6 0 0 1 -6,-6 Z" fill="#fde047" />
    </>
  ),
  // cartão com barras
  "budget-master": (
    <>
      <rect x="14" y="14" width="72" height="72" rx="12" fill="#fff" />
      <rect x="25" y="52" width="13" height="24" rx="2.5" fill="#f9a8d4" />
      <rect x="43.5" y="38" width="13" height="38" rx="2.5" fill="#93c5fd" />
      <rect x="62" y="26" width="13" height="50" rx="2.5" fill="#86efac" />
      <path d="M22,76 H78" fill="none" />
      <Brilho x={30} y={30} r={7} />
    </>
  ),
  // cofrinho (Fable: "1º mês no azul")
  "saver-20": (
    <>
      <ellipse cx="50" cy="58" rx="30" ry="22" fill="#60a5fa" />
      <path d="M34,42 L30,32 L42,38 Z" fill="#60a5fa" />
      <ellipse cx="80" cy="60" rx="7" ry="6" fill="#93c5fd" />
      <circle cx="78" cy="59" r="1.4" fill={TRACO} stroke="none" />
      <circle cx="82" cy="59" r="1.4" fill={TRACO} stroke="none" />
      <rect x="30" y="76" width="9" height="9" rx="2" fill="#60a5fa" />
      <rect x="60" y="76" width="9" height="9" rx="2" fill="#60a5fa" />
      <circle cx="64" cy="52" r="2" fill={TRACO} stroke="none" />
      <rect x="43" y="34" width="14" height="4" rx="2" fill={TRACO} stroke="none" />
      <circle cx="50" cy="20" r="9" fill="#fde047" />
      <text x="50" y="24" textAnchor="middle" fontFamily={FONTE} fontSize="10" fontWeight={900} fill={TRACO} stroke="none">$</text>
      <path d="M20,60 C16,56 17,50 22,49" fill="none" strokeLinecap="round" />
    </>
  ),
  // saco de dinheiro
  "saver-40": (
    <>
      <path d="M38,32 C28,42 18,54 18,66 C18,80 31,88 50,88 C69,88 82,80 82,66 C82,54 72,42 62,32 Z" fill="#fcd34d" />
      <path d="M38,32 L32,16 C39,20 44,13 50,18 C56,13 61,20 68,16 L62,32 Z" fill="#fcd34d" />
      <path d="M36,32 H64" fill="none" stroke="#b45309" strokeWidth={4} strokeLinecap="round" />
      <text x="50" y="74" textAnchor="middle" fontFamily={FONTE} fontSize="26" fontWeight={900} fill="#92400e" stroke="none">$</text>
      <Brilho x={82} y={30} r={6} cor="#fff7cc" />
    </>
  ),
  // formiguinha carregando a moeda
  "saver-60": (
    <>
      <path d="M50,67 L42,82 M55,68 L55,84 M60,67 L68,82" fill="none" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M72,50 C74,41 80,38 85,40 M67,50 C66,41 69,35 74,34" fill="none" strokeWidth={2.2} strokeLinecap="round" />
      <ellipse cx="34" cy="64" rx="15" ry="11" fill="#f87171" />
      <ellipse cx="55" cy="62" rx="8" ry="7" fill="#f87171" />
      <circle cx="71" cy="57" r="10" fill="#f87171" />
      <circle cx="74" cy="55" r="2" fill={TRACO} stroke="none" />
      <path d="M68,62 C70,64 73,64 75,62" fill="none" strokeWidth={1.8} strokeLinecap="round" />
      <Moeda x={46} y={36} r={14} texto="$" tam={15} />
    </>
  ),
  // gráfico subindo
  "investor-1k": (
    <>
      <rect x="12" y="16" width="76" height="68" rx="12" fill="#fff" />
      <path d="M24,70 H78" fill="none" stroke="#d4d4d4" strokeWidth={2} />
      <path d="M24,64 L40,50 L52,57 L74,32" fill="none" stroke="#22c55e" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M62,31 L75,31 L75,44" fill="none" stroke="#22c55e" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  // banco
  "investor-10k": (
    <>
      <path d="M50,12 L88,32 H12 Z" fill="#93c5fd" />
      <circle cx="50" cy="24" r="4.5" fill="#fde047" strokeWidth={1.6} />
      <rect x="16" y="32" width="68" height="7" rx="1.5" fill="#bfdbfe" />
      <rect x="21" y="41" width="9" height="30" rx="1.5" fill="#fff" />
      <rect x="36" y="41" width="9" height="30" rx="1.5" fill="#fff" />
      <rect x="55" y="41" width="9" height="30" rx="1.5" fill="#fff" />
      <rect x="70" y="41" width="9" height="30" rx="1.5" fill="#fff" />
      <rect x="12" y="71" width="76" height="12" rx="3" fill="#93c5fd" />
    </>
  ),
  // pilha de moedas + etiqueta 50k
  "investor-50k": (
    <>
      <rect x="20" y="68" width="54" height="12" rx="6" fill="#facc15" />
      <rect x="25" y="57" width="54" height="12" rx="6" fill="#fde047" />
      <rect x="19" y="46" width="54" height="12" rx="6" fill="#facc15" />
      <rect x="24" y="35" width="54" height="12" rx="6" fill="#fde047" />
      <ellipse cx="51" cy="30" rx="27" ry="8" fill="#fef08a" />
      <g transform="rotate(-8 74 80)">
        <rect x="56" y="71" width="36" height="19" rx="4" fill="#d22d80" />
        <text x="74" y="85" textAnchor="middle" fontFamily={FONTE} fontSize="12" fontWeight={900} fill="#fff" stroke="none">50k</text>
      </g>
    </>
  ),
  // troféu 100k
  "investor-100k": (
    <>
      <Contornado d="M31,24 C17,24 17,46 34,46" cor="#fcd34d" largura={3.6} />
      <Contornado d="M69,24 C83,24 83,46 66,46" cor="#fcd34d" largura={3.6} />
      <path d="M30,14 H70 V32 C70,47 61,57 50,57 C39,57 30,47 30,32 Z" fill="#fcd34d" />
      <polygon points={ESTRELA} transform="translate(50,33) scale(1.5)" fill="#f59e0b" strokeWidth={1.2} />
      <rect x="45" y="57" width="10" height="11" fill="#fbbf24" />
      <rect x="28" y="67" width="44" height="18" rx="4" fill="#a16207" />
      <text x="50" y="80.5" textAnchor="middle" fontFamily={FONTE} fontSize="11.5" fontWeight={900} fill="#fff" stroke="none">100k</text>
    </>
  ),
  // pizza com fatia saindo
  "diversified": (
    <>
      <path d="M50,52 L50,18 A34,34 0 1 0 83.4,58.6 Z" fill="#93c5fd" />
      <path d="M50,52 L83.4,58.6 A34,34 0 0 1 33,81.4 Z" fill="#fde047" />
      <g transform="translate(4,-4)">
        <path d="M50,52 L50,18 A34,34 0 0 1 83.4,58.6 Z" fill="#f9a8d4" />
      </g>
    </>
  ),
  // conta com check
  "bills-ok": (
    <>
      <rect x="10" y="22" width="62" height="46" rx="7" fill="#fff" />
      <path d="M20,35 H52 M20,45 H46 M20,55 H38" fill="none" stroke="#a3a3a3" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx="70" cy="66" r="19" fill="#4ade80" />
      <Check x={71} y={66} />
    </>
  ),
  // corrente partida
  "debt-free": (
    <>
      <g transform="rotate(-20 30 58)">
        <Contornado d="M18,50 H34 a8,8 0 0 1 0,16 H18 a8,8 0 0 1 0,-16 Z" cor="#cbd5e1" largura={5} />
      </g>
      <g transform="rotate(-20 70 42)">
        <Contornado d="M60,34 H78 a8,8 0 0 1 0,16 H64" cor="#cbd5e1" largura={5} />
      </g>
      <path d="M46,38 L42,30 M52,46 L60,44 M44,48 L36,50" fill="none" stroke="#f59e0b" strokeWidth={3} strokeLinecap="round" />
      <Brilho x={80} y={76} r={8} />
      <Brilho x={22} y={24} r={6} cor="#86efac" />
    </>
  ),
  // documento com carimbo PAGO
  "quitador": (
    <>
      <rect x="20" y="12" width="56" height="72" rx="7" fill="#fff" />
      <path d="M29,26 H67 M29,35 H60 M29,44 H64" fill="none" stroke="#a3a3a3" strokeWidth={2.4} strokeLinecap="round" />
      <g transform="rotate(-14 52 62)">
        <rect x="25" y="52" width="56" height="21" rx="4" fill="#fdf2f8" stroke="#d22d80" strokeWidth={3} />
        <text x="53" y="67.5" textAnchor="middle" fontFamily={FONTE} fontSize="13.5" fontWeight={900} letterSpacing="1.5" fill="#d22d80" stroke="none">PAGO</text>
      </g>
    </>
  ),
  // guarda-chuva sobre as moedas
  "emergency-fund": (
    <>
      <path d="M50,50 V76 a6.5,6.5 0 0 1 -13,0" fill="none" strokeWidth={3.4} strokeLinecap="round" />
      <path d="M12,50 C12,27 30,14 50,14 C70,14 88,27 88,50 C82,44 75,44 69,50 C63,44 56,44 50,50 C44,44 37,44 31,50 C25,44 18,44 12,50 Z" fill="#f472b6" />
      <path d="M50,14 C42,24 38,36 38,48 M50,14 C58,24 62,36 62,48" fill="none" strokeWidth={1.8} />
      <Moeda x={72} y={78} r={10} texto="$" tam={11} />
      <Moeda x={84} y={66} r={7} texto="$" tam={8} />
    </>
  ),
  // lista com coração
  "wishlist": (
    <>
      <rect x="16" y="12" width="58" height="74" rx="9" fill="#fff" />
      <circle cx="28" cy="30" r="3.5" fill="#f9a8d4" strokeWidth={1.4} />
      <circle cx="28" cy="45" r="3.5" fill="#f9a8d4" strokeWidth={1.4} />
      <circle cx="28" cy="60" r="3.5" fill="#f9a8d4" strokeWidth={1.4} />
      <path d="M36,30 H62 M36,45 H58 M36,60 H52" fill="none" stroke="#a3a3a3" strokeWidth={2.4} strokeLinecap="round" />
      <path d="M72,90 C57,80 54,71 58,65 C61,60 68,60 72,66 C76,60 83,60 86,65 C90,71 87,80 72,90 Z" fill="#f43f5e" />
    </>
  ),
  // sacola com check
  "conscious-buyer": (
    <>
      <path d="M37,40 V30 a13,13 0 0 1 26,0 V40" fill="none" strokeWidth={3.2} strokeLinecap="round" />
      <path d="M20,34 H80 L75,88 H25 Z" fill="#f9a8d4" />
      <circle cx="37" cy="44" r="2.6" fill={TRACO} stroke="none" />
      <circle cx="63" cy="44" r="2.6" fill={TRACO} stroke="none" />
      <circle cx="70" cy="72" r="14" fill="#4ade80" />
      <Check x={71} y={72} s={0.8} />
    </>
  ),
  // alvo com flecha
  "challenger": (
    <>
      <circle cx="44" cy="56" r="33" fill="#fff" />
      <circle cx="44" cy="56" r="25" fill="#f87171" />
      <circle cx="44" cy="56" r="16" fill="#fff" />
      <circle cx="44" cy="56" r="7.5" fill="#f87171" />
      <path d="M44,56 L80,20" fill="none" strokeWidth={3.4} strokeLinecap="round" />
      <path d="M76,12 L88,10 L84,20 L80,20 L80,16 Z" fill="#fde047" strokeWidth={1.8} />
    </>
  ),
  // luva de boxe + 5
  "challenger-5": (
    <>
      <path d="M30,28 C30,18 40,12 52,12 H60 C72,12 80,22 80,34 V50 C80,61 72,68 61,68 H40 C34,68 30,64 30,58 Z" fill="#f87171" />
      <path d="M30,38 C21,38 18,47 22,54 C25,59 30,59 33,56" fill="#f87171" />
      <path d="M44,24 C50,20 60,20 66,24" fill="none" stroke="#fecaca" strokeWidth={3.4} strokeLinecap="round" />
      <rect x="35" y="66" width="40" height="18" rx="4" fill="#fff" />
      <path d="M35,75 H75" fill="none" stroke="#f87171" strokeWidth={2.4} />
      <Moeda x={80} y={80} r={12} texto="5" tam={14} />
    </>
  ),
  // coroa de louros + 15
  "challenger-15": (
    <>
      {FOLHAS_LOURO.map((g, i) => {
        // folhas no arco da esquerda (de baixo pra cima) e o espelho na direita
        const rad = (g * Math.PI) / 180;
        const x = 50 + 32 * Math.cos(rad), y = 52 + 32 * Math.sin(rad);
        return (
          <g key={i}>
            <ellipse cx={x} cy={y} rx="8" ry="4.2" fill="#86efac" transform={`rotate(${g - 90} ${x} ${y})`} strokeWidth={1.8} />
            <ellipse cx={100 - x} cy={y} rx="8" ry="4.2" fill="#86efac" transform={`rotate(${-(g - 90)} ${100 - x} ${y})`} strokeWidth={1.8} />
          </g>
        );
      })}
      <Moeda x={50} y={52} r={18} texto="15" tam={17} cor="#fcd34d" />
      <path d="M44,86 L50,80 L56,86" fill="none" stroke="#16a34a" strokeWidth={3} strokeLinecap="round" />
    </>
  ),

  /* ---------------- Rotina ---------------- */
  // broto no vasinho
  "rotina-1": (
    <>
      <path d="M50,54 V36" fill="none" stroke="#16a34a" strokeWidth={3.6} strokeLinecap="round" />
      <path d="M50,42 C41,42 32,36 32,25 C43,25 50,31 50,42 Z" fill="#86efac" />
      <path d="M50,38 C59,38 68,32 68,21 C57,21 50,27 50,38 Z" fill="#4ade80" />
      <path d="M31,58 H69 L64,86 H36 Z" fill="#fb923c" />
      <rect x="26" y="52" width="48" height="11" rx="3.5" fill="#fdba74" />
    </>
  ),
  // semana completa (Fable)
  "rotina-7": (
    <>
      <rect x="12" y="18" width="76" height="66" rx="8" fill="#fff" />
      <path d="M12,34 H88" fill="none" />
      <rect x="12" y="18" width="76" height="16" rx="8" fill="#22c55e" />
      <rect x="12" y="26" width="76" height="8" fill="#22c55e" stroke="none" />
      <g fill="#fff" stroke="none">
        <rect x="20" y="24" width="8" height="4" rx="1" /><rect x="32" y="24" width="8" height="4" rx="1" />
        <rect x="44" y="24" width="8" height="4" rx="1" /><rect x="56" y="24" width="8" height="4" rx="1" />
        <rect x="68" y="24" width="12" height="4" rx="1" />
      </g>
      <g fill="#bbf7d0" stroke={TRACO} strokeWidth={1.8}>
        <rect x="19" y="41" width="12" height="12" rx="3" /><rect x="37" y="41" width="12" height="12" rx="3" />
        <rect x="55" y="41" width="12" height="12" rx="3" /><rect x="73" y="41" width="8" height="12" rx="3" />
        <rect x="19" y="62" width="12" height="12" rx="3" /><rect x="37" y="62" width="12" height="12" rx="3" />
        <rect x="55" y="62" width="12" height="12" rx="3" />
      </g>
      <g fill="none" stroke="#16a34a" strokeWidth={2.6} strokeLinecap="round">
        <path d="M22,47 l3,3 l5,-6" /><path d="M40,47 l3,3 l5,-6" /><path d="M58,47 l3,3 l5,-6" />
        <path d="M22,68 l3,3 l5,-6" /><path d="M40,68 l3,3 l5,-6" /><path d="M58,68 l3,3 l5,-6" />
      </g>
      <circle cx="80" cy="70" r="10" fill="#fde047" />
      <polygon transform="translate(80,70) scale(1.1)" points={ESTRELA} fill={TRACO} stroke="none" />
    </>
  ),
  // árvore crescida + 21
  "rotina-21": (
    <>
      <path d="M45,58 H55 L57,86 H43 Z" fill="#c2803a" />
      <path d="M30,58 C17,56 14,40 25,33 C23,20 37,11 48,17 C57,9 73,13 73,26 C85,28 88,46 77,53 C75,62 62,64 56,59 C50,66 36,64 30,58 Z" fill="#4ade80" />
      <path d="M36,40 C38,34 44,31 49,32" fill="none" stroke="#bbf7d0" strokeWidth={3.4} strokeLinecap="round" />
      <circle cx="40" cy="48" r="4" fill="#f87171" strokeWidth={1.6} />
      <circle cx="62" cy="30" r="4" fill="#f87171" strokeWidth={1.6} />
      <circle cx="66" cy="47" r="4" fill="#f87171" strokeWidth={1.6} />
      <Moeda x={78} y={78} r={12} texto="21" tam={12} />
    </>
  ),
  // diário com caneta
  "diario-7": (
    <>
      <rect x="18" y="14" width="52" height="72" rx="7" fill="#c4b5fd" />
      <path d="M29,14 V86" fill="none" />
      <rect x="37" y="28" width="24" height="13" rx="2.5" fill="#fff" strokeWidth={1.8} />
      <rect x="59" y="14" width="6" height="72" fill="#d22d80" strokeWidth={1.8} />
      <g transform="rotate(32 76 56)">
        <rect x="71" y="26" width="10" height="44" rx="2.5" fill="#fde047" />
        <path d="M71,70 L76,82 L81,70 Z" fill="#fef3c7" />
        <rect x="71" y="26" width="10" height="7" rx="2" fill="#f472b6" />
      </g>
      <Brilho x={86} y={18} r={7} />
    </>
  ),

  /* ---------------- Leitura ---------------- */
  // livros na prateleira
  "leitura-estante": (
    <>
      <rect x="18" y="30" width="16" height="48" rx="2.5" fill="#60a5fa" />
      <path d="M18,40 H34 M18,68 H34" fill="none" strokeWidth={1.8} />
      <rect x="36" y="20" width="15" height="58" rx="2.5" fill="#fde047" />
      <path d="M36,32 H51" fill="none" strokeWidth={1.8} />
      <g transform="rotate(14 60 78)">
        <rect x="53" y="30" width="15" height="48" rx="2.5" fill="#f472b6" />
        <path d="M53,42 H68" fill="none" strokeWidth={1.8} />
      </g>
      <rect x="10" y="78" width="80" height="8" rx="2.5" fill="#d6a86c" />
    </>
  ),
  // livro aberto com marcador (Fable)
  "leitura-1": (
    <>
      <path d="M14,30 C26,24 40,26 50,34 C60,26 74,24 86,30 V76 C74,70 60,72 50,80 C40,72 26,70 14,76 Z" fill="#c4b5fd" />
      <path d="M50,34 V80" fill="none" />
      <path d="M20,38 C28,35 38,36 46,42 M20,48 C28,45 38,46 46,52 M20,58 C28,55 38,56 46,62" fill="none" stroke="#7c3aed" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M54,42 C62,36 72,35 80,38 M54,52 C62,46 72,45 80,48 M54,62 C62,56 72,55 80,58" fill="none" stroke="#7c3aed" strokeWidth={1.8} strokeLinecap="round" />
      <path d="M62,14 H72 V40 L67,36 L62,40 Z" fill="#d22d80" />
    </>
  ),
  // traça de livro (lagartinha de óculos)
  "leitura-10": (
    <>
      <rect x="10" y="70" width="80" height="16" rx="3.5" fill="#c4b5fd" />
      <path d="M16,78 H84" fill="none" stroke="#7c3aed" strokeWidth={1.6} strokeLinecap="round" />
      <circle cx="24" cy="60" r="10" fill="#86efac" />
      <circle cx="39" cy="56" r="11" fill="#86efac" />
      <circle cx="55" cy="54" r="11" fill="#86efac" />
      <path d="M67,32 L63,22 M77,31 L81,21" fill="none" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx="63" cy="21" r="2.6" fill="#f472b6" strokeWidth={1.4} />
      <circle cx="81" cy="20" r="2.6" fill="#f472b6" strokeWidth={1.4} />
      <circle cx="72" cy="45" r="14" fill="#4ade80" />
      <circle cx="66.5" cy="43" r="5" fill="#fff" strokeWidth={1.8} />
      <circle cx="78" cy="43" r="5" fill="#fff" strokeWidth={1.8} />
      <path d="M71.5,43 H73" fill="none" strokeWidth={1.8} />
      <circle cx="67" cy="43.5" r="1.6" fill={TRACO} stroke="none" />
      <circle cx="78.5" cy="43.5" r="1.6" fill={TRACO} stroke="none" />
      <path d="M67,51 C70,54 75,54 78,51" fill="none" strokeWidth={1.8} strokeLinecap="round" />
    </>
  ),

  /* ---------------- Treino ---------------- */
  // tênis de corrida "1º" (o kettlebell do 1º rascunho lia como cadeado — e cadeado é o que falta)
  "treino-1": (
    <>
      <path d="M31,42 C30,33 36,27 44,29 L47,38" fill="#fbcfe8" />
      <path d="M12,72 C12,58 18,46 30,41 L46,36 C50,45 60,49 70,51 C82,53 89,60 89,72 Z" fill="#f472b6" />
      <path d="M40,47 L48,41 M46,51 L54,45 M52,54 L60,48" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
      <path d="M48,64 C58,59 70,59 82,64" fill="none" stroke="#fde047" strokeWidth={4} strokeLinecap="round" />
      <path d="M10,72 H90 V77 a6,6 0 0 1 -6,6 H16 a6,6 0 0 1 -6,-6 Z" fill="#fff" />
      <path d="M22,77 H34 M42,77 H54 M62,77 H74" fill="none" stroke="#d4d4d4" strokeWidth={2} strokeLinecap="round" />
      <Moeda x={78} y={24} r={12} texto="1º" tam={10.5} />
    </>
  ),
  // halter + moeda 12 (Fable, com o número da insígnia)
  "treino-12": (
    <>
      <g transform="rotate(-30 50 50)">
        <rect x="30" y="46" width="40" height="8" rx="3" fill="#a3a3a3" />
        <rect x="16" y="34" width="12" height="32" rx="4" fill="#3b82f6" />
        <rect x="72" y="34" width="12" height="32" rx="4" fill="#3b82f6" />
        <rect x="8" y="39" width="8" height="22" rx="3" fill="#60a5fa" />
        <rect x="84" y="39" width="8" height="22" rx="3" fill="#60a5fa" />
      </g>
      <circle cx="74" cy="76" r="14" fill="#fde047" />
      <text x="74" y="81" textAnchor="middle" fontFamily={FONTE} fontSize="14" fontWeight={900} fill={TRACO} stroke="none">12</text>
    </>
  ),
  // medalha PR
  "treino-pr": (
    <>
      <path d="M30,10 H45 L57,40 H42 Z" fill="#60a5fa" />
      <path d="M70,10 H55 L43,40 H58 Z" fill="#f472b6" />
      <circle cx="50" cy="62" r="25" fill="#fcd34d" />
      <circle cx="50" cy="62" r="18" fill="#fde68a" strokeWidth={1.6} />
      <text x="50" y="68" textAnchor="middle" fontFamily={FONTE} fontSize="16" fontWeight={900} fill="#92400e" stroke="none">PR</text>
    </>
  ),

  /* ---------------- Dieta ---------------- */
  // tigela de salada
  "dieta-1": (
    <>
      <path d="M22,54 C19,41 30,32 39,38 C41,27 57,24 61,35 C70,29 83,36 79,52 Z" fill="#86efac" />
      <path d="M34,46 C38,40 44,38 50,40" fill="none" stroke="#16a34a" strokeWidth={2.2} strokeLinecap="round" />
      <circle cx="62" cy="44" r="6.5" fill="#f87171" strokeWidth={1.8} />
      <circle cx="42" cy="46" r="5" fill="#fde047" strokeWidth={1.8} />
      <path d="M14,52 H86 C86,71 71,84 50,84 C29,84 14,71 14,52 Z" fill="#fff" />
      <path d="M20,63 H80" fill="none" stroke="#5eead4" strokeWidth={4.5} />
    </>
  ),
  // maçã com brilho
  "dieta-7": (
    <>
      <path d="M50,31 C50,24 52,18 57,14" fill="none" strokeWidth={3} strokeLinecap="round" />
      <path d="M50,31 C42,24 25,26 23,45 C21,64 34,84 44,84 C47,84 48,82 50,82 C52,82 53,84 56,84 C66,84 79,64 77,45 C75,26 58,24 50,31 Z" fill="#f87171" />
      <path d="M55,22 C61,13 72,13 76,18 C72,27 61,29 55,22 Z" fill="#4ade80" />
      <path d="M33,46 C33,39 37,35 42,34" fill="none" stroke="#fee2e2" strokeWidth={3.6} strokeLinecap="round" />
      <Brilho x={84} y={70} r={8} />
      <Brilho x={17} y={24} r={5} />
    </>
  ),

  /* ---------------- Saúde ---------------- */
  // gota (Fable)
  "agua-7": (
    <>
      <path d="M50,12 C60,30 74,42 74,58 A24,24 0 0 1 26,58 C26,42 40,30 50,12 Z" fill="#38bdf8" />
      <path d="M36,60 C36,52 40,46 44,42" fill="none" stroke="#e0f2fe" strokeWidth={3.5} strokeLinecap="round" />
      <path d="M28,86 C36,80 44,92 52,86 C60,80 68,92 76,86" fill="none" stroke="#0ea5e9" strokeWidth={3} strokeLinecap="round" />
      <circle cx="76" cy="30" r="5" fill="#bae6fd" />
    </>
  ),

  /* ---------------- Geral ---------------- */
  // coroa
  "master": (
    <>
      <path d="M14,38 L32,56 L50,22 L68,56 L86,38 L79,76 H21 Z" fill="#fcd34d" />
      <rect x="20" y="74" width="60" height="11" rx="3.5" fill="#fbbf24" />
      <circle cx="50" cy="61" r="6.5" fill="#d22d80" />
      <circle cx="33" cy="65" r="4.2" fill="#60a5fa" />
      <circle cx="67" cy="65" r="4.2" fill="#4ade80" />
      <circle cx="14" cy="36" r="4.5" fill="#fde047" />
      <circle cx="50" cy="20" r="4.5" fill="#fde047" />
      <circle cx="86" cy="36" r="4.5" fill="#fde047" />
    </>
  ),
};

/** Adesivos que usam a reserva (círculo com ícone) — vazio hoje: todos têm arte. */
export const temArte = (id: string) => id in ARTES;

/** Reserva: o mesmo recorte de adesivo com um ícone dentro (insígnia nova sem desenho ainda). */
const reserva = (
  <>
    <circle cx="50" cy="50" r="34" fill="#fde68a" />
    <Award x={24} y={24} width={52} height={52} strokeWidth={2.2} color={TRACO} />
  </>
);

interface AdesivoProps {
  id: string;
  /** Lado em px (o desenho é quadrado). */
  tamanho?: number;
  className?: string;
  style?: CSSProperties;
  /** Nome pra leitor de tela; sem ele o adesivo é decorativo. */
  titulo?: string;
  /** Borda de recorte mais grossa (tamanhos grandes: detalhe, Stories). */
  bordaGrossa?: boolean;
}

/** O adesivo conquistado, colorido, com borda branca de recorte e sombra. */
export const Adesivo = ({ id, tamanho = 72, className, style, titulo, bordaGrossa }: AdesivoProps) => {
  const uid = `dc${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const raio = bordaGrossa ? 4.5 : 3;
  return (
    <svg
      viewBox="0 0 100 100"
      width={tamanho}
      height={tamanho}
      className={className}
      style={{ overflow: "visible", ...style }}
      role={titulo ? "img" : undefined}
      aria-label={titulo}
      aria-hidden={titulo ? undefined : true}
      data-adesivo={id}
    >
      <defs>
        <filter id={uid} x="-20%" y="-20%" width="140%" height="140%" colorInterpolationFilters="sRGB">
          <feMorphology in="SourceAlpha" operator="dilate" radius={raio} result="dil" />
          <feFlood floodColor="#ffffff" result="w" />
          <feComposite in="w" in2="dil" operator="in" result="borda" />
          <feGaussianBlur in="dil" stdDeviation={bordaGrossa ? 2.5 : 2} result="bl" />
          <feOffset in="bl" dx="0" dy={bordaGrossa ? 3 : 2} result="off" />
          <feFlood floodColor="#000" floodOpacity={bordaGrossa ? 0.28 : 0.25} result="sc" />
          <feComposite in="sc" in2="off" operator="in" result="sombra" />
          <feMerge>
            <feMergeNode in="sombra" />
            <feMergeNode in="borda" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g filter={`url(#${uid})`} stroke={TRACO} strokeWidth={2.2} strokeLinejoin="round">
        {ARTES[id] ?? reserva}
      </g>
    </svg>
  );
};

/** Rotação leve de cada adesivo na folha (colado à mão, nunca reto). */
const GIROS = [-5, 4, -3, 6, -4, 3, -6, 2];
export const giroDoAdesivo = (i: number) => GIROS[i % GIROS.length];

/** Todos os ids com arte própria (pra conferência e testes). */
export const IDS_COM_ARTE = Object.keys(ARTES);
