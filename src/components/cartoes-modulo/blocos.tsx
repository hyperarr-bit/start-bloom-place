import { Fragment, type ReactNode } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { CHAVE_DEDINHO, type Quadro } from "./Miniatura";

/**
 * BLOCOS VIVOS PRAS MINIATURAS (10/10 v2, dono: "cada card com uma imagem viva da
 * parte do app, mostrando uma coisa de cada vez"). São réplicas do desenho dos cards
 * do planner (mesma hierarquia: faixa de título em CAIXA ALTA, linhas, quadradinho
 * de marcar, "+") que LEEM o store de exemplo da Miniatura via useUserData — por isso
 * os quadros da mini-animação (lib Miniatura) conseguem mexer neles: o que está
 * sendo digitado (`mini:digitando`), a lista (`mini:itens`), os marcados
 * (`mini:marcados`), o valor de um medidor (`mini:valor`). Nenhum deles toca a
 * conta da pessoa: o store é da miniatura.
 *
 * Chaves que os blocos leem (todas opcionais; sem elas, o que vier em `props`):
 *   mini:digitando  string   — o texto no campo de entrada
 *   mini:itens      string[] — as linhas da lista (MiniAcao/MiniLinhas)
 *   mini:marcados   number[] — índices marcados (MiniLinhas/MiniSemana)
 *   mini:valor      number   — o valor do medidor (MiniMeta)
 */

export const CHAVE_DIGITANDO = "mini:digitando";
export const CHAVE_ITENS = "mini:itens";
export const CHAVE_MARCADOS = "mini:marcados";
export const CHAVE_VALOR = "mini:valor";

/** Um card do planner: faixa colorida com o título em caixa alta e um emoji. */
export const Caixa = ({ titulo, emoji, cor, children, rodape }: { titulo: string; emoji?: string; cor: string; children: ReactNode; rodape?: ReactNode }) => (
  <div className="bg-card rounded-lg border border-border overflow-hidden text-foreground">
    <div className={`${cor} border-b border-border px-4 py-2.5 flex items-center justify-between`}>
      <span className="font-bold text-[13px] tracking-wide">{titulo}</span>{emoji && <span>{emoji}</span>}
    </div>
    {children}
    {rodape && <div className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">{rodape}</div>}
  </div>
);

/** O campo de entrada do card, com o que está sendo digitado e o botão de salvar. */
export const Entrada = ({ placeholder, botao = "+", corBotao, digitando }: { placeholder: string; botao?: string; corBotao: string; digitando?: string }) => (
  <div className="flex gap-2">
    <span className={`flex-1 min-w-0 h-9 rounded-lg border bg-background text-[12px] px-2.5 grid items-center truncate ${digitando ? "border-foreground/40 text-foreground" : "border-border text-muted-foreground"}`}>
      {digitando ? <span>{digitando}<span className="ct-cursor" aria-hidden="true">|</span></span> : placeholder}
    </span>
    <span className={`h-9 px-3 rounded-lg ${corBotao} text-white text-[12px] grid items-center font-bold shrink-0`}>{botao}</span>
  </div>
);

/** Um item da lista, com quadradinho opcional. */
const Linha = ({ texto, sub, marcado, caixa, novo, cor }: { texto: string; sub?: string; marcado?: boolean; caixa?: boolean; novo?: boolean; cor: string }) => (
  <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${novo ? "ct-linha-nova border-foreground/25" : "border-border"}`}>
    {caixa && <span className={`h-5 w-5 rounded-md border grid place-items-center text-[11px] shrink-0 ${marcado ? `${cor} border-transparent text-white` : "border-border bg-background"}`}>{marcado ? "✓" : ""}</span>}
    <span className="min-w-0 flex-1">
      <span className={`block text-[12.5px] font-medium truncate ${marcado ? "line-through text-muted-foreground" : ""}`}>{texto}</span>
      {sub && <span className="block text-[10.5px] text-muted-foreground truncate">{sub}</span>}
    </span>
  </div>
);

/**
 * AÇÃO: digita → aparece. Uma lista com campo de entrada; os quadros mandam o
 * `mini:digitando` e a `mini:itens` — a última linha, quando é nova, acende.
 */
export const MiniAcao = ({ titulo, emoji, cor, corBotao, placeholder, botao, itens, subtitulos, caixa, rodape }: {
  titulo: string; emoji?: string; cor: string; corBotao: string; placeholder: string; botao?: string;
  /** a lista de partida (os quadros trocam pela `mini:itens`) */
  itens: string[]; subtitulos?: Record<string, string>; caixa?: boolean; rodape?: ReactNode;
}) => {
  const { get } = useUserData();
  const digitando = get<string>(CHAVE_DIGITANDO, "");
  const lista = get<string[]>(CHAVE_ITENS, itens);
  const marcados = get<number[]>(CHAVE_MARCADOS, []);
  const nova = lista.length > itens.length ? lista.length - 1 : -1;
  return (
    <div className="p-3">
      <Caixa titulo={titulo} emoji={emoji} cor={cor} rodape={rodape}>
        <div className="p-3 space-y-2">
          <Entrada placeholder={placeholder} botao={botao} corBotao={corBotao} digitando={digitando} />
          {lista.map((t, i) => <Linha key={`${t}-${i}`} texto={t} sub={subtitulos?.[t]} caixa={caixa} marcado={marcados.includes(i)} novo={i === nova} cor={corBotao} />)}
        </div>
      </Caixa>
    </div>
  );
};

/** LISTA com quadradinhos: os quadros marcam pelo `mini:marcados`. */
export const MiniLinhas = ({ titulo, emoji, cor, corBotao, itens, subtitulos, caixa = true, rodape }: {
  titulo: string; emoji?: string; cor: string; corBotao: string; itens: string[]; subtitulos?: Record<string, string>; caixa?: boolean; rodape?: ReactNode;
}) => {
  const { get } = useUserData();
  const lista = get<string[]>(CHAVE_ITENS, itens);
  const marcados = get<number[]>(CHAVE_MARCADOS, []);
  return (
    <div className="p-3">
      <Caixa titulo={titulo} emoji={emoji} cor={cor} rodape={rodape}>
        <div className="p-3 space-y-2">
          {lista.map((t, i) => <Linha key={`${t}-${i}`} texto={t} sub={subtitulos?.[t]} caixa={caixa} marcado={marcados.includes(i)} cor={corBotao} />)}
        </div>
      </Caixa>
    </div>
  );
};

const DIAS = ["S", "T", "Q", "Q", "S", "S", "D"];

/** SEMANA: linhas × 7 dias, com os marcados (`mini:marcados` = índices linha*7+dia). */
export const MiniSemana = ({ titulo, emoji, cor, corMarca, linhas, marcados: base = [], rodape }: {
  titulo: string; emoji?: string; cor: string; corMarca: string; linhas: string[]; marcados?: number[]; rodape?: ReactNode;
}) => {
  const { get } = useUserData();
  const marcados = get<number[]>(CHAVE_MARCADOS, base);
  return (
    <div className="p-3">
      <Caixa titulo={titulo} emoji={emoji} cor={cor} rodape={rodape}>
        <div className="p-3">
          <div className="grid grid-cols-[1fr_repeat(7,22px)] gap-1 items-center text-[11px]">
            <span />
            {DIAS.map((d, i) => <span key={i} className="text-center font-bold text-muted-foreground">{d}</span>)}
            {linhas.map((h, hi) => (
              <Fragment key={`${h}-${hi}`}>
                <span className="truncate font-medium">{h}</span>
                {DIAS.map((_, di) => {
                  const ok = marcados.includes(hi * 7 + di);
                  return <span key={di} className={`h-5 w-5 rounded-md border grid place-items-center text-[10px] ${ok ? `${corMarca} border-transparent text-white` : "border-border bg-background"}`}>{ok ? "✓" : ""}</span>;
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </Caixa>
    </div>
  );
};

/** BARRAS: um gráfico simples de barras com rótulo e valor (a imagem do Dashboard). */
export const MiniBarras = ({ titulo, emoji, cor, corBarra, barras, unidade = "", rodape }: {
  titulo: string; emoji?: string; cor: string; corBarra: string; barras: Array<{ rotulo: string; valor: number }>; unidade?: string; rodape?: ReactNode;
}) => {
  const max = Math.max(1, ...barras.map((b) => b.valor));
  return (
    <div className="p-3">
      <Caixa titulo={titulo} emoji={emoji} cor={cor} rodape={rodape}>
        <div className="p-3 space-y-2">
          {barras.map((b) => (
            <div key={b.rotulo} className="grid grid-cols-[72px_1fr_auto] items-center gap-2 text-[11px]">
              <span className="truncate font-medium">{b.rotulo}</span>
              <span className="h-2.5 rounded-full bg-muted overflow-hidden"><span className={`block h-full ${corBarra} ct-barra`} style={{ width: `${Math.round((b.valor / max) * 100)}%` }} /></span>
              <span className="tabular-nums text-muted-foreground">{unidade}{b.valor.toLocaleString("pt-BR")}</span>
            </div>
          ))}
        </div>
      </Caixa>
    </div>
  );
};

/** META: um medidor (valor / alvo) com barra — água, calorias, meta do ano. `mini:valor` move. */
export const MiniMeta = ({ titulo, emoji, cor, corBarra, valor: base, alvo, unidade, legenda, rodape }: {
  titulo: string; emoji?: string; cor: string; corBarra: string; valor: number; alvo: number; unidade: string; legenda?: string; rodape?: ReactNode;
}) => {
  const { get } = useUserData();
  const valor = get<number>(CHAVE_VALOR, base);
  const pct = Math.min(100, Math.round((valor / alvo) * 100));
  return (
    <div className="p-3">
      <Caixa titulo={titulo} emoji={emoji} cor={cor} rodape={rodape}>
        <div className="p-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[22px] font-black tabular-nums">{valor.toLocaleString("pt-BR")} <span className="text-[12px] font-semibold text-muted-foreground">/ {alvo.toLocaleString("pt-BR")} {unidade}</span></span>
            <span className="text-[12px] font-bold tabular-nums">{pct}%</span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-muted overflow-hidden"><div className={`h-full ${corBarra} ct-barra`} style={{ width: `${pct}%` }} /></div>
          {legenda && <p className="mt-2 text-[11px] text-muted-foreground">{legenda}</p>}
        </div>
      </Caixa>
    </div>
  );
};

/** CALENDÁRIO: um mês com dias marcados (contas, aniversários, lavagens) — `mini:marcados` = dias. */
export const MiniCalendario = ({ titulo, emoji, cor, corMarca, marcados: base, legendas, rodape }: {
  titulo: string; emoji?: string; cor: string; corMarca: string; marcados: number[]; legendas?: Record<number, string>; rodape?: ReactNode;
}) => {
  const { get } = useUserData();
  const marcados = get<number[]>(CHAVE_MARCADOS, base);
  return (
    <div className="p-3">
      <Caixa titulo={titulo} emoji={emoji} cor={cor} rodape={rodape}>
        <div className="p-3">
          <div className="grid grid-cols-7 gap-1 text-center text-[10.5px]">
            {DIAS.map((d, i) => <span key={i} className="font-bold text-muted-foreground">{d}</span>)}
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <span key={d} className={`h-7 rounded-md grid place-items-center ${marcados.includes(d) ? `${corMarca} text-white font-bold` : "bg-muted/40"}`}>{d}</span>
            ))}
          </div>
          {legendas && (
            <div className="mt-2 space-y-1">
              {Object.entries(legendas).map(([d, t]) => <div key={d} className="flex items-center gap-2 text-[11px]"><span className={`h-2 w-2 rounded-full ${corMarca}`} /><span className="font-semibold tabular-nums">dia {d}</span><span className="text-muted-foreground truncate">{t}</span></div>)}
            </div>
          )}
        </div>
      </Caixa>
    </div>
  );
};

/** CHIPS: pílulas de escolha (modelos de treino, categorias) com uma acesa. */
export const MiniChips = ({ titulo, emoji, cor, corAcesa, chips, acesa = 0, abaixo, rodape }: {
  titulo: string; emoji?: string; cor: string; corAcesa: string; chips: string[]; acesa?: number; abaixo?: ReactNode; rodape?: ReactNode;
}) => {
  const { get } = useUserData();
  const i = get<number>(CHAVE_VALOR, acesa);
  return (
    <div className="p-3">
      <Caixa titulo={titulo} emoji={emoji} cor={cor} rodape={rodape}>
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {chips.map((c, k) => <span key={c} className={`h-8 px-3 rounded-full text-[11.5px] font-bold grid items-center ${k === i ? `${corAcesa} text-white` : "border border-border"}`}>{c}</span>)}
          </div>
          {abaixo}
        </div>
      </Caixa>
    </div>
  );
};

/* ------------------------------------------------------------ os quadros prontos */

/** "digita → aparece": campo vazio (dedinho no campo) → texto digitado → a linha nova na lista (dedinho nela). */
export const quadrosDigitar = (itens: string[], novo: string, campo: { x: string; y: string }, linhaNova: { x: string; y: string }, botao?: { x: string; y: string }): Quadro[] => [
  { [CHAVE_DIGITANDO]: "", [CHAVE_ITENS]: itens, [CHAVE_DEDINHO]: campo },
  { [CHAVE_DIGITANDO]: novo, [CHAVE_ITENS]: itens, [CHAVE_DEDINHO]: botao ?? campo },
  { [CHAVE_DIGITANDO]: "", [CHAVE_ITENS]: [...itens, novo], [CHAVE_DEDINHO]: linhaNova },
];

/** "marca um a um": os marcados crescem a cada quadro (o dedinho acompanha, se vier). */
export const quadrosMarcar = (passos: number[][], dedinhos?: Array<{ x: string; y: string }>): Quadro[] =>
  passos.map((m, i) => ({ [CHAVE_MARCADOS]: m, ...(dedinhos?.[i] ? { [CHAVE_DEDINHO]: dedinhos[i] } : {}) }));

/** "o medidor sobe": os valores de um quadro a outro. */
export const quadrosValor = (valores: number[], dedinho?: { x: string; y: string }): Quadro[] =>
  valores.map((v) => ({ [CHAVE_VALOR]: v, ...(dedinho ? { [CHAVE_DEDINHO]: dedinho } : {}) }));

/** A semana de treino (ou de cardápio) em 7 cartõezinhos. */
export const SemanaEmCartoes = ({ dias, corCheio }: { dias: Array<{ dia: string; texto: string }>; corCheio: string }) => (
  <div className="grid grid-cols-7 gap-1">
    {dias.map((d) => {
      const vazio = !d.texto || d.texto === "Descanso";
      return (
        <div key={d.dia} className={`rounded-lg border px-0.5 py-1.5 text-center ${vazio ? "border-dashed border-border text-muted-foreground" : `${corCheio}`}`}>
          <div className="text-[9.5px] font-bold">{d.dia}</div>
          <div className="text-[8.5px] leading-tight mt-0.5">{d.texto || "—"}</div>
        </div>
      );
    })}
  </div>
);
