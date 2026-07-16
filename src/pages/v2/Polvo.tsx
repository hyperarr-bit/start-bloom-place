// Mascote do funil v2: polvo sticker-style (contorno de tinta + gradiente +
// ventosas + olhos glossy). Desenhado por iteração visual no polvo-lab
// (scratchpad) — 3 rodadas de screenshot até a versão atual.
// Humores: neutro · serio · feliz · arregalado · festa.

export type PolvoMood = "neutro" | "serio" | "feliz" | "arregalado" | "festa";

const TINTA = "#2E1B29";

const Defs = ({ uid }: { uid: string }) => (
  <defs>
    <radialGradient id={`corpo-${uid}`} cx="0.42" cy="0.3" r="1">
      <stop offset="0%" stopColor="#FF97C6" />
      <stop offset="55%" stopColor="#F566A8" />
      <stop offset="100%" stopColor="#E4468F" />
    </radialGradient>
    <linearGradient id={`tent-${uid}`} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor="#F566A8" />
      <stop offset="100%" stopColor="#D63B84" />
    </linearGradient>
    <radialGradient id={`blush-${uid}`} cx="0.5" cy="0.5" r="0.5">
      <stop offset="0%" stopColor="#FF7DB4" stopOpacity=".9" />
      <stop offset="100%" stopColor="#FF7DB4" stopOpacity="0" />
    </radialGradient>
  </defs>
);

const Tentaculos = ({ uid }: { uid: string }) => (
  <>
    <g stroke={TINTA} strokeWidth="4.5" strokeLinejoin="round" fill={`url(#tent-${uid})`}>
      <path d="M76 152 C62 176 44 188 26 184 C18 182 16 172 24 170 C36 168 48 158 56 140 Z" />
      <path d="M97 162 C92 190 78 206 58 208 C48 208 46 197 55 194 C68 190 78 176 80 156 Z" />
      <path d="M124 166 C124 196 116 212 100 220 C91 224 86 214 94 209 C104 202 108 188 106 164 Z" />
      <path d="M144 164 C150 192 162 206 180 210 C190 212 192 201 184 197 C172 192 162 178 160 158 Z" />
      <path d="M166 154 C180 176 198 186 216 182 C225 179 222 169 214 168 C202 167 190 156 184 138 Z" />
      <path d="M181 138 C198 152 214 154 228 144 C235 138 229 130 222 132 C212 136 200 132 192 120 Z" />
    </g>
    <g fill="#FFB7D6">
      <circle cx="38" cy="177" r="3.2" /><circle cx="52" cy="166" r="2.6" />
      <circle cx="68" cy="198" r="3.2" /><circle cx="80" cy="184" r="2.6" />
      <circle cx="104" cy="209" r="3.2" /><circle cx="110" cy="192" r="2.6" />
      <circle cx="172" cy="199" r="3.2" /><circle cx="163" cy="183" r="2.6" />
      <circle cx="207" cy="174" r="3.2" /><circle cx="193" cy="162" r="2.6" />
      <circle cx="217" cy="139" r="2.8" />
    </g>
  </>
);

const OlhosAbertos = ({ px = 0, py = 0, r = 11 }: { px?: number; py?: number; r?: number }) => (
  <g>
    <ellipse cx="100" cy="92" rx="21" ry="23" fill="#fff" stroke={TINTA} strokeWidth="4" />
    <ellipse cx="158" cy="92" rx="21" ry="23" fill="#fff" stroke={TINTA} strokeWidth="4" />
    <circle cx={103 + px} cy={94 + py} r={r} fill={TINTA} />
    <circle cx={161 + px} cy={94 + py} r={r} fill={TINTA} />
    <circle cx={106 + px} cy={90 + py} r="3" fill="#fff" />
    <circle cx={164 + px} cy={90 + py} r="3" fill="#fff" />
    <circle cx={100 + px} cy={98 + py} r="1.6" fill="#fff" opacity=".8" />
    <circle cx={158 + px} cy={98 + py} r="1.6" fill="#fff" opacity=".8" />
  </g>
);

const OlhosFelizes = () => (
  <>
    <path d="M88 92 Q100 78 112 92" stroke={TINTA} strokeWidth="5.5" fill="none" strokeLinecap="round" />
    <path d="M146 92 Q158 78 170 92" stroke={TINTA} strokeWidth="5.5" fill="none" strokeLinecap="round" />
  </>
);

const Blush = ({ uid }: { uid: string }) => (
  <>
    <ellipse cx="82" cy="116" rx="12" ry="8" fill={`url(#blush-${uid})`} />
    <ellipse cx="174" cy="116" rx="12" ry="8" fill={`url(#blush-${uid})`} />
  </>
);

let seq = 0;

export function Polvo({ mood = "neutro", size = 150 }: { mood?: PolvoMood; size?: number }) {
  // ids únicos por instância — dois polvos na mesma tela não podem dividir gradiente
  const uid = String(seq++ % 1000);
  return (
    <svg width={size} height={size * 0.92} viewBox="0 0 256 236" role="img" aria-label="Polvo do CORE">
      <Defs uid={uid} />
      <ellipse cx="128" cy="228" rx="76" ry="10" fill="rgba(46,27,41,.10)" />
      <Tentaculos uid={uid} />
      <ellipse cx="128" cy="98" rx="74" ry="70" fill={`url(#corpo-${uid})`} stroke={TINTA} strokeWidth="5" />
      <path d="M74 62 C86 40 108 28 128 28 C138 28 142 36 132 40 C114 46 100 56 92 72 Z" fill="#FF9FCB" opacity=".55" />

      {mood === "neutro" && (
        <>
          <OlhosAbertos />
          <Blush uid={uid} />
          <path d="M113 124 C121 133 135 133 143 124" stroke={TINTA} strokeWidth="4.5" fill="none" strokeLinecap="round" />
        </>
      )}
      {mood === "feliz" && (
        <>
          <OlhosFelizes />
          <Blush uid={uid} />
          <path d="M112 116 C120 128 136 128 144 116" stroke={TINTA} strokeWidth="5" fill="none" strokeLinecap="round" />
        </>
      )}
      {mood === "serio" && (
        <>
          <OlhosAbertos py={2} r={9.5} />
          <path d="M86 74 L112 76" stroke={TINTA} strokeWidth="5" strokeLinecap="round" />
          <path d="M170 74 L144 76" stroke={TINTA} strokeWidth="5" strokeLinecap="round" />
          <Blush uid={uid} />
          <path d="M118 124 h20" stroke={TINTA} strokeWidth="4.5" strokeLinecap="round" />
        </>
      )}
      {mood === "arregalado" && (
        <>
          <ellipse cx="100" cy="92" rx="21" ry="23" fill="#fff" stroke={TINTA} strokeWidth="4" />
          <ellipse cx="158" cy="92" rx="21" ry="23" fill="#fff" stroke={TINTA} strokeWidth="4" />
          <circle cx="102" cy="94" r="12" fill={TINTA} />
          <circle cx="160" cy="94" r="12" fill={TINTA} />
          <circle cx="106" cy="89" r="3.5" fill="#fff" />
          <circle cx="164" cy="89" r="3.5" fill="#fff" />
          <Blush uid={uid} />
          <ellipse cx="128" cy="124" rx="9" ry="11" fill={TINTA} />
          <ellipse cx="128" cy="129" rx="5" ry="5" fill="#B8497F" />
          <path d="M196 52 C199 60 194 66 189 63 C185 61 187 54 191 50 Z" fill="#8FC7EE" stroke={TINTA} strokeWidth="3" />
        </>
      )}
      {mood === "festa" && (
        <>
          <OlhosFelizes />
          <Blush uid={uid} />
          <path d="M106 114 Q128 144 150 114 Z" fill={TINTA} />
          <path d="M117 125 Q128 138 139 125 Z" fill="#FF7DB4" />
          <g stroke={TINTA} strokeWidth="3">
            <circle cx="42" cy="34" r="5" fill="#FFD35C" />
            <circle cx="216" cy="30" r="6" fill="#8FC7EE" />
            <circle cx="238" cy="96" r="4.5" fill="#7ED9A2" />
            <circle cx="18" cy="100" r="4.5" fill="#FFD35C" />
          </g>
        </>
      )}
    </svg>
  );
}

/**
 * Polvo ESPIANDO por cima de uma borda (o frame do guaxinim no card de
 * Peso/Progresso do BitePal): só o topo da cabeça + olhos + duas patas
 * agarrando a borda. Posicionar com o bottom alinhado ao topo do card.
 */
export function PolvoEspiando({ width = 160, mood = "feliz" }: { width?: number; mood?: "feliz" | "serio" }) {
  const uid = `esp${seq++ % 1000}`;
  return (
    <svg width={width} height={width * 0.56} viewBox="0 0 240 134" aria-hidden="true">
      <defs>
        <radialGradient id={`corpo-${uid}`} cx="0.42" cy="0.3" r="1">
          <stop offset="0%" stopColor="#FF97C6" />
          <stop offset="55%" stopColor="#F566A8" />
          <stop offset="100%" stopColor="#E4468F" />
        </radialGradient>
      </defs>
      {/* topo da cabeça — o corpo continua "atrás" da borda */}
      <path
        d="M46 134 C46 66 78 26 120 26 C162 26 194 66 194 134 Z"
        fill={`url(#corpo-${uid})`} stroke={TINTA} strokeWidth="5"
      />
      <path d="M70 62 C82 42 102 32 120 32 C130 32 133 40 124 44 C108 50 94 58 88 72 Z" fill="#FF9FCB" opacity=".55" />
      {/* olhos */}
      {mood === "feliz" ? (
        <>
          <path d="M84 88 Q96 74 108 88" stroke={TINTA} strokeWidth="5.5" fill="none" strokeLinecap="round" />
          <path d="M132 88 Q144 74 156 88" stroke={TINTA} strokeWidth="5.5" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <ellipse cx="96" cy="88" rx="18" ry="19" fill="#fff" stroke={TINTA} strokeWidth="4" />
          <ellipse cx="144" cy="88" rx="18" ry="19" fill="#fff" stroke={TINTA} strokeWidth="4" />
          <circle cx="98" cy="91" r="8.5" fill={TINTA} />
          <circle cx="146" cy="91" r="8.5" fill={TINTA} />
          <circle cx="101" cy="87" r="2.6" fill="#fff" />
          <circle cx="149" cy="87" r="2.6" fill="#fff" />
          <path d="M82 70 L106 73" stroke={TINTA} strokeWidth="5" strokeLinecap="round" />
          <path d="M158 70 L134 73" stroke={TINTA} strokeWidth="5" strokeLinecap="round" />
        </>
      )}
      {/* bochechas */}
      <circle cx="70" cy="104" r="7" fill="#F9A8CB" />
      <circle cx="170" cy="104" r="7" fill="#F9A8CB" />
      {/* patas agarrando a borda */}
      <g fill={`url(#corpo-${uid})`} stroke={TINTA} strokeWidth="4.5">
        <path d="M52 134 C52 120 66 114 76 122 C82 127 82 134 78 134 Z" />
        <path d="M162 134 C162 120 176 114 186 122 C192 127 192 134 188 134 Z" />
      </g>
      <g fill="#FFB7D6">
        <circle cx="66" cy="127" r="2.6" />
        <circle cx="176" cy="127" r="2.6" />
      </g>
    </svg>
  );
}

/**
 * Tentáculo GIGANTE entrando de fora da tela (T8, o pacto): braço estendido
 * pro leitor, com ventosas. Posicionar no canto inferior-direito, cortado.
 */
export function TentaculoGigante({ width = 250 }: { width?: number }) {
  return (
    <svg width={width} height={width * 0.92} viewBox="0 0 280 258" aria-hidden="true">
      <path d="M262 244 C200 214 162 168 156 118 C152 86 170 62 198 66 C222 70 230 96 214 108 C202 116 188 110 186 98"
        fill="none" stroke={TINTA} strokeWidth="44" strokeLinecap="round" />
      <path d="M262 244 C200 214 162 168 156 118 C152 86 170 62 198 66 C222 70 230 96 214 108 C202 116 188 110 186 98"
        fill="none" stroke="#F566A8" strokeWidth="34" strokeLinecap="round" />
      <path d="M262 244 C200 214 162 168 156 118"
        fill="none" stroke="#FF97C6" strokeWidth="11" strokeLinecap="round" opacity=".55" />
      <g fill="#FFB7D6" stroke={TINTA} strokeWidth="2">
        <circle cx="226" cy="212" r="7" />
        <circle cx="196" cy="180" r="6.5" />
        <circle cx="178" cy="146" r="6" />
        <circle cx="174" cy="112" r="5.5" />
        <circle cx="192" cy="82" r="5" />
      </g>
    </svg>
  );
}

/** Avatar redondo pro cabeçalho/balões. */
export function PolvoAvatar({ size = 30 }: { size?: number }) {
  const uid = `av${seq++ % 1000}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id={`corpo-${uid}`} cx="0.42" cy="0.3" r="1">
          <stop offset="0%" stopColor="#FF97C6" />
          <stop offset="60%" stopColor="#F566A8" />
          <stop offset="100%" stopColor="#E4468F" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="#FBE7F0" />
      <g stroke={TINTA} strokeWidth="6.5" strokeLinecap="round" fill="none">
        <path d="M28 74 C24 84 16 88 10 84" stroke="#E4468F" />
        <path d="M50 78 C50 88 46 94 40 96" stroke="#E4468F" />
        <path d="M72 74 C76 84 84 88 90 84" stroke="#E4468F" />
      </g>
      <ellipse cx="50" cy="48" rx="33" ry="31" fill={`url(#corpo-${uid})`} stroke={TINTA} strokeWidth="4" />
      <ellipse cx="39" cy="46" rx="9" ry="10" fill="#fff" stroke={TINTA} strokeWidth="2.5" />
      <ellipse cx="62" cy="46" rx="9" ry="10" fill="#fff" stroke={TINTA} strokeWidth="2.5" />
      <circle cx="40.5" cy="47" r="4.6" fill={TINTA} />
      <circle cx="63.5" cy="47" r="4.6" fill={TINTA} />
      <circle cx="42" cy="45" r="1.5" fill="#fff" />
      <circle cx="65" cy="45" r="1.5" fill="#fff" />
      <path d="M44 62 C47 66 54 66 57 62" stroke={TINTA} strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
