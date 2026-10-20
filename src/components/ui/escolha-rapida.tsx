import { useContext, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Minus, Plus } from "lucide-react";
import { UserDataContext } from "@/hooks/use-user-data";
import { entrada, MOV } from "@/lib/movimento";
import "./escolha-rapida.css";

/**
 * ESCOLHA RÁPIDA (1.0.17, dono 19/10: "deixa a pessoa pôr a opção dela — a Dieta tem 3 comidas prontas, e se ela não
 * comeu nenhuma? isso está em vários módulos").
 *
 * UM componente pra toda lista de opções prontas da missão e dos tutoriais:
 *   · os chips de sempre (1 toque escolhe);
 *   · o último chip é tracejado, "+ Outro": tocar abre um campo ALI MESMO (com foco; com `comValor`, também o R$) e
 *     "Adicionar" devolve a opção dela pelo mesmo `aoEscolher` — `{ id: "outro", rotulo: <o que ela escreveu>, sua: true }`;
 *   · o que ela escreveu volta como chip "seu", na frente das sugestões, da próxima vez (memória por `lista`, na CONTA:
 *     `core-escolhas-proprias` no user_data — vale pro 2º aparelho e não depende de localStorage);
 *   · variante NUMÉRICA (`numero`): no lugar do campo, um stepper "− 7 h +" (sono, copos, dias, hora do lembrete).
 * Visual do post-it/folha de cada lugar via `tom` (o chip do Montar Finanças é o modelo: pílula branca, borda fina).
 */
export const ID_OUTRO = "outro";
export const CHAVE_ESCOLHAS_PROPRIAS = "core-escolhas-proprias";
/** Quantas opções "suas" cada lista guarda (as mais recentes primeiro). */
export const MAX_PROPRIAS = 4;

export interface OpcaoRapida {
  id: string;
  rotulo: string;
  emoji?: string;
  /** gasto: o valor em reais (vai no chip: "Café · R$ 12") */
  valor?: number;
  /** a opção foi escrita pela pessoa (agora ou numa vez anterior) */
  sua?: boolean;
}
export interface PropriaGuardada { nome: string; valor?: number }
type MapaDeProprias = Record<string, PropriaGuardada[]>;

const limpar = (t: string) => t.replace(/\s+/g, " ").trim().slice(0, 60);
const reaisCurto = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ","));
/** "12,50" / "R$ 12" → 12.5 (lixo → 0) */
export const lerValorDigitado = (t: string): number => {
  const n = Number(String(t).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};

/** Junta uma opção nova na frente da lista (sem repetir pelo nome, sem caixa), no máximo MAX_PROPRIAS. */
export function juntarPropria(atual: unknown, nova: PropriaGuardada): PropriaGuardada[] {
  const lista = (Array.isArray(atual) ? atual : []).filter((x): x is PropriaGuardada => !!x && typeof (x as PropriaGuardada).nome === "string");
  const nome = limpar(nova.nome);
  if (!nome) return lista.slice(0, MAX_PROPRIAS);
  const resto = lista.filter((x) => x.nome.trim().toLowerCase() !== nome.toLowerCase());
  return [{ nome, ...(typeof nova.valor === "number" && nova.valor > 0 ? { valor: nova.valor } : {}) }, ...resto].slice(0, MAX_PROPRIAS);
}

/**
 * As opções "suas" de uma lista, na CONTA. Sem o provider do user_data (peça solta num teste, a demo), fica só na
 * memória da tela — nunca quebra.
 */
export function useEscolhasProprias(lista?: string): { proprias: PropriaGuardada[]; lembrar: (p: PropriaGuardada) => void } {
  const ctx = useContext(UserDataContext);
  const [local, setLocal] = useState<PropriaGuardada[]>([]);
  if (!lista) return { proprias: [], lembrar: () => {} };
  let proprias: PropriaGuardada[] = local;
  if (ctx) {
    try {
      const mapa = ctx.get<MapaDeProprias>(CHAVE_ESCOLHAS_PROPRIAS, {}) ?? {};
      proprias = (Array.isArray(mapa[lista]) ? mapa[lista] : []).filter((x) => !!x && typeof x.nome === "string").slice(0, MAX_PROPRIAS);
    } catch { proprias = local; }
  }
  const lembrar = (p: PropriaGuardada) => {
    if (!ctx) { setLocal((l) => juntarPropria(l, p)); return; }
    try {
      const mapa = ctx.get<MapaDeProprias>(CHAVE_ESCOLHAS_PROPRIAS, {}) ?? {};
      // escrita de sistema: guardar a opção não é registro do dia (o registro é o que o chip grava no módulo)
      ctx.set(CHAVE_ESCOLHAS_PROPRIAS, { ...mapa, [lista]: juntarPropria(mapa[lista], p) }, { system: true });
    } catch { setLocal((l) => juntarPropria(l, p)); }
  };
  return { proprias, lembrar };
}

export interface OutroDaEscolha {
  /** o rótulo do chip tracejado ("Outro", "Outra") */
  rotulo?: string;
  placeholder?: string;
  /** pede também o valor em reais (gasto) */
  comValor?: boolean;
  /** o texto do botão de confirmar */
  botao?: string;
}
export interface NumeroDaEscolha {
  min: number;
  max: number;
  passo?: number;
  inicial: number;
  /** 7 → "7 h" / "8 copos" / "21h" */
  formatar: (n: number) => string;
  rotulo?: string;
}

export function EscolhaRapida({
  opcoes, aoEscolher, lista, outro, numero, marcado = null, tom = "postit", multi = false, testid = "escolha-rapida", desabilitado = false, classeChip, testidDe, rotulo, radio = false,
}: {
  /** escolha ÚNICA com semântica de rádio (as horas do lembrete): role="radio" + aria-checked */
  radio?: boolean;
  /** o testid de cada chip (as horas do lembrete: `missao-doses-hora-8h`); sem ele, `<testid>-chip` */
  testidDe?: (op: OpcaoRapida) => string | undefined;
  /** o nome do grupo pro leitor de tela ("Hora do lembrete") */
  rotulo?: string;
  opcoes: OpcaoRapida[];
  aoEscolher: (op: OpcaoRapida) => void;
  /** a memória das opções dela (sem `lista`, o que ela escreve não volta) */
  lista?: string;
  /** o "+ Outro" com campo de texto (false = sem) */
  outro?: OutroDaEscolha | false;
  /** a variante numérica: o "+ Outro" vira um stepper */
  numero?: NumeroDaEscolha;
  /** o(s) id(s) marcado(s) agora */
  marcado?: string | string[] | null;
  tom?: "postit" | "folha" | "montar";
  /** várias marcadas (Montar Rotina): o que ela escreve entra marcado */
  multi?: boolean;
  testid?: string;
  desabilitado?: boolean;
  /** a classe do chip do lugar (o Montar usa a dele) */
  classeChip?: string;
}) {
  const reduzir = !!useReducedMotion();
  const { proprias, lembrar } = useEscolhasProprias(lista);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [valor, setValor] = useState("");
  const [n, setN] = useState<number>(numero?.inicial ?? 0);
  /** o que ela escreveu nesta tela (multi: aparece marcado mesmo antes de a memória voltar) */
  const [daTela, setDaTela] = useState<OpcaoRapida[]>([]);
  const campo = useRef<HTMLInputElement>(null);
  useEffect(() => { if (aberto) { try { campo.current?.focus(); } catch { /* noop */ } } }, [aberto]);

  const marcados = Array.isArray(marcado) ? marcado : marcado ? [marcado] : [];
  const ehMarcado = (op: OpcaoRapida) => marcados.includes(op.id) || marcados.includes(op.rotulo);
  const comOutro = outro !== false && (outro !== undefined || !!numero);
  const cfgOutro: OutroDaEscolha = outro || {};

  // as suas primeiro (sem repetir uma sugestão de mesmo nome), depois as sugestões
  const nomesDasSugestoes = new Set(opcoes.map((o) => o.rotulo.toLowerCase()));
  const suas: OpcaoRapida[] = [...daTela, ...proprias.map((p) => ({ id: ID_OUTRO, rotulo: p.nome, valor: p.valor, sua: true }))]
    .filter((o, i, arr) => !nomesDasSugestoes.has(o.rotulo.toLowerCase()) && arr.findIndex((x) => x.rotulo.toLowerCase() === o.rotulo.toLowerCase()) === i);
  const todas = [...suas, ...opcoes];

  const confirmar = () => {
    if (numero) {
      const op: OpcaoRapida = { id: ID_OUTRO, rotulo: numero.formatar(n), valor: n, sua: true };
      setAberto(false);
      aoEscolher(op);
      return;
    }
    const nome = limpar(texto);
    if (!nome) return;
    const v = cfgOutro.comValor ? lerValorDigitado(valor) : undefined;
    if (cfgOutro.comValor && !v) return;
    const op: OpcaoRapida = { id: ID_OUTRO, rotulo: nome, ...(v ? { valor: v } : {}), sua: true };
    lembrar({ nome, valor: v });
    if (multi) setDaTela((l) => [op, ...l.filter((x) => x.rotulo.toLowerCase() !== nome.toLowerCase())]);
    setAberto(false); setTexto(""); setValor("");
    aoEscolher(op);
  };
  const tecla = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { e.preventDefault(); confirmar(); }
    if (e.key === "Escape") { setAberto(false); }
  };
  const passo = numero?.passo ?? 1;
  const podeConfirmar = numero ? true : !!limpar(texto) && (!cfgOutro.comValor || lerValorDigitado(valor) > 0);

  return (
    <div className="er" data-tom={tom} data-testid={testid}>
      <div className="er-chips" role={radio ? "radiogroup" : multi || rotulo ? "group" : undefined} aria-label={rotulo}>
        {todas.map((op, i) => {
          const m = ehMarcado(op);
          return (
            <motion.button
              key={`${op.sua ? "sua" : "op"}-${op.rotulo}`}
              type="button"
              className={classeChip ? `${classeChip} er-chip-lugar` : "er-chip"}
              data-testid={testidDe?.(op) ?? (op.sua ? `${testid}-sua` : `${testid}-chip`)}
              data-sua={op.sua ? "" : undefined}
              data-marcado={m ? "" : undefined}
              {...(radio ? { role: "radio", "aria-checked": m } : { "aria-pressed": m })}
              disabled={desabilitado}
              onClick={() => aoEscolher(op)}
              initial={reduzir ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              transition={entrada(reduzir, MOV.base, reduzir ? 0 : Math.min(i, 4) * 0.05)}
            >
              {m ? <Check className="er-check" strokeWidth={3.5} aria-hidden /> : op.emoji ? <span aria-hidden>{op.emoji}</span> : null}
              <span>{op.rotulo}</span>
              {op.valor != null && !numero && <span className="er-valor">· R$ {reaisCurto(op.valor)}</span>}
              {op.sua && <span className="er-seu" aria-label="sua opção">seu</span>}
            </motion.button>
          );
        })}
        {comOutro && !aberto && (
          <motion.button
            type="button" className={classeChip ? `${classeChip} er-chip-lugar er-outro-lugar` : "er-chip er-outro"} data-outra="" data-outro="" data-testid={`${testid}-outro`} disabled={desabilitado}
            onClick={() => { setAberto(true); if (numero) setN(numero.inicial); }}
            initial={reduzir ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={entrada(reduzir, MOV.base, reduzir ? 0 : Math.min(todas.length, 4) * 0.05)}
          >
            <Plus className="er-mais" aria-hidden /><span>{numero?.rotulo ?? cfgOutro.rotulo ?? "Outro"}</span>
          </motion.button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {comOutro && aberto && (
          <motion.div
            key="campo" className="er-campo" data-testid={`${testid}-campo`} data-escolha-campo=""
            initial={reduzir ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={reduzir ? { opacity: 1 } : { opacity: 1, height: "auto" }} exit={reduzir ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={entrada(reduzir, MOV.base)}
          >
            {numero ? (
              <div className="er-stepper" role="group" aria-label={numero.rotulo ?? "Outro valor"}>
                <button type="button" className="er-step" aria-label="Menos" disabled={n - passo < numero.min} onClick={() => setN((x) => Math.max(numero.min, x - passo))}><Minus aria-hidden /></button>
                <span className="er-step-valor" data-testid={`${testid}-valor`} aria-live="polite">{numero.formatar(n)}</span>
                <button type="button" className="er-step" aria-label="Mais" disabled={n + passo > numero.max} onClick={() => setN((x) => Math.min(numero.max, x + passo))}><Plus aria-hidden /></button>
              </div>
            ) : (
              <div className="er-linha">
                <input ref={campo} className="er-input" data-testid={`${testid}-texto`} value={texto} maxLength={60} enterKeyHint="done"
                  placeholder={cfgOutro.placeholder ?? "Escreva aqui"} aria-label={cfgOutro.placeholder ?? "Sua opção"}
                  onChange={(e) => setTexto(e.target.value)} onKeyDown={tecla} />
                {cfgOutro.comValor && (
                  <label className="er-reais">
                    <small>R$</small>
                    <input inputMode="decimal" enterKeyHint="done" data-testid={`${testid}-reais`} placeholder="0" aria-label="Valor em reais" value={valor}
                      onChange={(e) => setValor(e.target.value.replace(/[^\d,.]/g, "").slice(0, 9))} onKeyDown={tecla} />
                  </label>
                )}
              </div>
            )}
            <div className="er-acoes">
              <button type="button" className="er-cancelar" onClick={() => { setAberto(false); setTexto(""); setValor(""); }}>Cancelar</button>
              <button type="button" className="er-adicionar" data-testid={`${testid}-adicionar`} disabled={!podeConfirmar} onClick={confirmar}>{cfgOutro.botao ?? (numero ? "Pronto" : "Adicionar")}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
