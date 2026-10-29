import { useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { entrada, MOV } from "@/lib/movimento";
import { Quadradinho } from "@/components/demo-guiada/Quadradinho";
import { Confete } from "@/components/demo-guiada/pecas";
import { useUserData } from "@/hooks/use-user-data";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { useConquistas, useSequencia } from "@/components/conquistas/use-conquistas";
import { Adesivo, temArte } from "@/components/conquistas/adesivos-arte";
import { trackEvent } from "@/lib/analytics";
import { acaoDoDia, type Leitor } from "@/lib/acao-do-dia";
import { somarDias } from "@/lib/sequencia";
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { bracoConstruiu, type BracoConstruiu } from "@/lib/construiu-ab";
import {
  MODULOS, diaDaMissao, dosesFeitas, eventoDaMissao, passoPendente,
  type DiaDaMissao, type EstadoMissaoDoses, type ModuloDaMissao,
} from "@/lib/missao-doses";
import { ChevronRight } from "lucide-react";
import "./missao-doses.css";

/**
 * O RESUMO DOS 3 DIAS ("O que você construiu", D8) — 29/10, A/B do dono (lib/construiu-ab; mockups em
 * novidades-guardadas/2026-10-29/construiu-3-dias/):
 *   · A "página do planner": a semana em quadradinhos (só com sequência ≥ 2), O QUE VOCÊ MONTOU (cada dose com o que ela
 *     fez), as figurinhas dela coladas e o post-it com o próximo passo;
 *   · B "colagem": as figurinhas DELA espalhadas no topo (a linguagem do "Parabéns" do começo do teste), o título com o
 *     nome, 1 linha por dose e o próximo passo.
 * Regras das duas (o print de 29/10 do dono: "feia", meia tela vazia, "2 score de hoje", "4 dias seguidos" × "em 3 dias"):
 *   · SEM score; o título sai dos números ("4 dias seguidos" · "2 dias seguidos. Hoje vira 3." · "Seu CORE começou.");
 *   · nada de "0" (sem sequência, sem figurinha: a peça some);
 *   · 1 próximo passo concreto; no dia 3 (aoAbrir) com dose por fazer e nada feito hoje, o botão É a dose de hoje
 *     ("Marcar 1 copo d'água") — `aoFazerDose` leva direto pro módulo;
 *   · nada de preço/cobrança.
 * O botão fica colado embaixo (md-fim-rodape, sticky). Eventos: `missao_doses_fim` e `dia3_construiu_view` levam
 * `braco_construiu`; o toque no botão é contado por quem chama (`missao_doses_fim_fechou` com `botao`).
 */

/** 1.0.18 (dias23): a linha de cada dose feita no resumo — "R$ 61 por dia" (Finanças), senão o rótulo do feito. */
export function linhaDoFeitoNoResumo(m: EstadoMissaoDoses, n: DiaDaMissao): string | null {
  const f = m.feitos[n];
  if (!f) return null;
  const porDia = /^Pode gastar (R\$ [\d.,]+ por dia)$/.exec(String(f.rotulo ?? "").trim());
  return porDia ? porDia[1] : String(f.rotulo ?? "").trim() || "feito";
}

/** O botão da dose de hoje: o pedido do módulo no infinitivo, curto. */
export const BOTAO_DA_DOSE: Record<ModuloDaMissao, string> = {
  financas: "Anotar 1 gasto", rotina: "Marcar 1 hábito", saude: "Marcar 1 copo d'água", treino: "Anotar 1 exercício",
  dieta: "Anotar 1 refeição", desenvolvimento: "Escolher 1 meta", hiperfoco: "Anotar 1 pensamento", estudos: "Anotar 1 matéria",
  carreira: "Anotar 1 tarefa", biblioteca: "Anotar 1 livro", casa: "Anotar 1 item da compra", beleza: "Marcar 1 passo",
  viagens: "Anotar 1 destino", relacionamentos: "Anotar 1 pessoa", pet: "Cadastrar o seu pet", detox: "Criar 1 hábito de detox",
};

const DIAS_CURTOS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
const DIAS_LONGOS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

/** "Lucas Andrade" → "Lucas"; nunca o começo de um e-mail (a mesma regra da TelaParabens). */
const primeiroNome = (nome: unknown): string => {
  const t = String(nome ?? "").trim();
  if (!t || t.includes("@")) return "";
  const p = t.split(/\s+/)[0] ?? "";
  return p.length > 20 ? "" : p.charAt(0).toUpperCase() + p.slice(1);
};
const maiuscula = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** O título pelos números (puro, pros testes): [linha 1, linha 2 em magenta | null]. */
export function tituloDoResumo(seq: { dias: number; hojeFeito: boolean }): [string, string | null] {
  if (seq.dias >= 2 && !seq.hojeFeito) return [`${seq.dias} dias seguidos.`, `Hoje vira ${seq.dias + 1}.`];
  if (seq.dias >= 2) return [`${seq.dias} dias seguidos`, null];
  return ["Seu CORE", "começou."];
}

export interface ResumoDosTresDias {
  braco: BracoConstruiu;
  titulo: [string, string | null];
  nome: string;
  seq: number;
  /** os 7 dias da faixa (hoje na 5ª coluna), com marcado/hoje */
  semana: Array<{ dia: string; curto: string; numero: number; marcado: boolean; hoje: boolean }>;
  doses: Array<{ n: DiaDaMissao; modulo: ModuloDaMissao; texto: string }>;
  /** a dose de hoje, quando o botão É ela (aoAbrir, dose por fazer, nada da missão feito hoje) */
  doseDeHoje: { n: DiaDaMissao; modulo: ModuloDaMissao; botao: string } | null;
  /** o próximo passo quando o botão não é a dose: "Amanhã, sexta" · "Anote o gasto" */
  proximo: { quando: string; texto: string } | null;
  figurinhas: string[];
  totalFigurinhas: number;
  mes: string;
}

function useResumo(missao: EstadoMissaoDoses, aoAbrir: boolean, bracoDado?: BracoConstruiu, nomeDaConta?: string | null): ResumoDosTresDias {
  const { get } = useUserData();
  const seq = useSequencia();
  const conq = useConquistas();
  const hoje = localDayKey();
  const braco = useMemo(() => bracoDado ?? bracoConstruiu(null), [bracoDado]);
  return useMemo(() => {
    const anotados = new Set(seq.lista);
    const semana = Array.from({ length: 7 }, (_, i) => {
      const dia = somarDias(hoje, i - 4);
      const d = parseLocalDay(dia);
      return { dia, curto: DIAS_CURTOS[d.getDay()], numero: d.getDate(), marcado: anotados.has(dia), hoje: dia === hoje };
    });
    const doses = ([1, 2, 3] as DiaDaMissao[]).filter((n) => missao.feitos[n]).map((n) => ({ n, modulo: missao.modulos[n - 1], texto: linhaDoFeitoNoResumo(missao, n) ?? "feito" }));
    const fezDoseHoje = ([1, 2, 3] as DiaDaMissao[]).some((n) => missao.feitos[n]?.dia === hoje);
    const p = aoAbrir && !fezDoseHoje ? passoPendente(missao) : null;
    const doseDeHoje = p ? { ...p, botao: BOTAO_DA_DOSE[p.modulo] ?? MODULOS[p.modulo].pedido } : null;
    let proximo: ResumoDosTresDias["proximo"] = null;
    if (!doseDeHoje) {
      const amanha = seq.hojeFeito || fezDoseHoje;
      const dia = amanha ? somarDias(hoje, 1) : hoje;
      let texto = "anote 1 coisa do seu dia";
      try { texto = acaoDoDia(get as Leitor, dia).texto || texto; } catch { /* a frase padrão */ }
      texto = maiuscula(texto.replace(/\s+de hoje$/, "").replace(/\s+hoje$/, ""));
      proximo = { quando: amanha ? `Amanhã, ${DIAS_LONGOS[parseLocalDay(dia).getDay()]}` : "Hoje", texto };
    }
    const figurinhas = Object.entries(conq.desbloqueadas ?? {})
      .filter(([id]) => temArte(id))
      .sort((a, b) => (b[1] ?? "").localeCompare(a[1] ?? "") || a[0].localeCompare(b[0]))
      .map(([id]) => id);
    const nome = primeiroNome(get<string>("core-user-name", "") || get<string>("user-name", "") || nomeDaConta);
    const mesDe = parseLocalDay(hoje);
    return {
      braco, titulo: tituloDoResumo(seq), nome, seq: seq.dias, semana, doses, doseDeHoje, proximo,
      figurinhas, totalFigurinhas: Math.max(conq.abertos, figurinhas.length), mes: `${MESES[mesDe.getMonth()]} de ${mesDe.getFullYear()}`,
    };
  }, [missao, aoAbrir, braco, seq, conq.desbloqueadas, conq.abertos, get, hoje, nomeDaConta]);
}

const nFigurinhas = (n: number) => `${n} ${n === 1 ? "figurinha" : "figurinhas"}`;

/* ------------------------------------------------------------------ A · a página do planner */
function BracoA({ r }: { r: ResumoDosTresDias }) {
  const [t1, t2] = r.titulo;
  const coladas = r.figurinhas.slice(0, 4);
  const poucas = r.figurinhas.length <= 2;
  return (
    <>
      <span className="cr-mes">{r.mes}</span>
      <h1 className="cr-h1 mt-1.5" data-testid="missao-doses-fim-titulo">{t1}{t2 && <>{" "}<br /><span className="cr-mag">{t2}</span></>}</h1>
      <div className="mt-[18px] flex flex-col gap-3">
        {r.seq >= 2 && (
          <section className="cr-sec" data-testid="missao-doses-fim-semana">
            <div className="md-secao" data-cor="verde">Sua semana <b>{r.seq} seguidos</b></div>
            <div className="cr-semana">
              {r.semana.map((d) => (
                <div key={d.dia} className="cr-sem-dia" data-hoje={d.hoje ? "" : undefined} data-marcado={d.marcado ? "" : undefined}>
                  <small>{d.curto}</small><b>{d.numero}</b>
                  <span className="cr-qd" data-hoje-vazio={d.hoje && !d.marcado ? "" : undefined}><Quadradinho marcado={d.marcado} tam={20} /></span>
                </div>
              ))}
            </div>
          </section>
        )}
        <section className="cr-sec" data-testid="missao-doses-fim-modulos">
          <div className="md-secao" data-cor="grafite">O que você montou <b>{r.doses.length} de 3</b></div>
          {r.doses.map((d) => (
            <div key={d.n} className="md-linha cr-linha" data-testid={`missao-doses-fim-modulo-${d.modulo}`}>
              <span className="md-plano-icone cr-icone" style={{ background: MODULOS[d.modulo].cor }} aria-hidden>{MODULOS[d.modulo].emoji}</span>
              <span className="flex-1 min-w-0"><span className="md-plano-nome">{MODULOS[d.modulo].nome}</span><span className="md-plano-entrega truncate">{d.texto}</span></span>
              <Quadradinho marcado tam={20} />
            </div>
          ))}
          {r.doseDeHoje && (
            <div className="md-linha cr-linha" data-hoje="" data-testid={`missao-doses-fim-hoje-${r.doseDeHoje.modulo}`}>
              <span className="md-plano-icone cr-icone" style={{ background: MODULOS[r.doseDeHoje.modulo].cor }} aria-hidden>{MODULOS[r.doseDeHoje.modulo].emoji}</span>
              <span className="flex-1 min-w-0"><span className="md-plano-nome">{MODULOS[r.doseDeHoje.modulo].nome}</span><span className="md-plano-entrega truncate">{r.doseDeHoje.botao}</span></span>
              <span className="md-pill" data-tom="hoje">Hoje</span>
            </div>
          )}
        </section>
        {coladas.length > 0 && (
          <div className="flex items-center px-1" data-testid="missao-doses-fim-figurinhas">
            {coladas.map((id, i) => (
              <Adesivo key={id} id={id} tamanho={poucas ? 88 : 60} className="cr-fig" style={{ transform: `rotate(${[-6, 5, -3, 7][i]}deg)`, marginLeft: i && !poucas ? -10 : i ? 4 : 0 }} />
            ))}
            <span className="cr-cola-n">{nFigurinhas(r.totalFigurinhas)}{" "}<br /><small>no seu álbum</small></span>
          </div>
        )}
      </div>
      {r.proximo && (
        <div className="cr-postit" data-testid="missao-doses-fim-proximo"><small>{r.proximo.quando}</small><b>{r.proximo.texto}</b></div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ B · a colagem */
/** Onde cada figurinha cola (% da largura, px do topo, lado, giro) — as maiores primeiro; poucas = grandes. */
const LUGARES: Record<number, Array<[number, number, number, number]>> = {
  1: [[50, 18, 156, -5]],
  2: [[30, 22, 140, -6], [70, 48, 132, 6]],
  3: [[22, 30, 116, -6], [52, 0, 110, 4], [80, 40, 108, -4]],
};
const LUGARES_MUITAS: Array<[number, number, number, number]> = [
  [20, 10, 108, -7], [50, -4, 102, 5], [80, 22, 98, -4], [12, 128, 88, 6], [84, 140, 86, -6], [40, 120, 82, 3], [62, 130, 76, -3],
];
function BracoB({ r }: { r: ResumoDosTresDias }) {
  const [t1, t2] = r.titulo;
  const lugares = LUGARES[r.figurinhas.length] ?? LUGARES_MUITAS;
  const coladas = r.figurinhas.slice(0, lugares.length);
  const comNome = !t2 && r.nome;
  return (
    <div className="flex-1 flex flex-col justify-center pb-2">
      {coladas.length > 0 && (
        <div className="cr-colagem" style={{ height: r.figurinhas.length <= 3 ? 196 : 236 }} data-testid="missao-doses-fim-figurinhas" aria-hidden>
          {coladas.map((id, i) => {
            const [x, y, t, g] = lugares[i];
            return <Adesivo key={id} id={id} tamanho={t} className="cr-fig" style={{ position: "absolute", left: `calc(${x}% - ${t / 2}px)`, top: y, transform: `rotate(${g}deg)` }} />;
          })}
        </div>
      )}
      <h1 className="cr-h1 cr-h1-b" data-testid="missao-doses-fim-titulo">
        {t2 ? <>{t1}{" "}<br /><span className="cr-mag">{t2}</span></> : comNome ? <>{t1},{" "}<br /><span className="cr-mag">{r.nome}!</span></> : <>{t1}!</>}
      </h1>
      {r.totalFigurinhas > 0 && <p className="cr-sub">{nFigurinhas(r.totalFigurinhas)} no seu álbum</p>}
      <div className="cr-lista" data-testid="missao-doses-fim-modulos">
        {r.doses.map((d) => (
          <div key={d.n} className="cr-l" data-testid={`missao-doses-fim-modulo-${d.modulo}`}><Quadradinho marcado tam={18} /><b>{MODULOS[d.modulo].nome}</b><span>{d.texto}</span></div>
        ))}
        {r.doseDeHoje && (
          <div className="cr-l" data-testid={`missao-doses-fim-hoje-${r.doseDeHoje.modulo}`}><span className="cr-qd" data-hoje-vazio=""><Quadradinho marcado={false} tam={18} /></span><b>{MODULOS[r.doseDeHoje.modulo].nome}</b><span>hoje</span></div>
        )}
        {r.proximo && (
          <div className="cr-l cr-l-prox" data-testid="missao-doses-fim-proximo"><span className="cr-seta" aria-hidden><ChevronRight width={14} height={14} strokeWidth={3} /></span><b>{r.proximo.quando}</b><span>{r.proximo.texto.charAt(0).toLowerCase() + r.proximo.texto.slice(1)}</span></div>
        )}
      </div>
    </div>
  );
}

export function ConstruiuEm3Dias({ missao, aoContinuar, aoAbrir = false, aoVer, aoFazerDose, braco: bracoDado, nome }: {
  missao: EstadoMissaoDoses;
  aoContinuar: () => void;
  /** 1.0.18 (chave `dias23`): abriu SOZINHO ao abrir o app no dia 3 (não depois da 3ª dose) — manda `dia3_construiu_view`
   *  e, com dose por fazer, o botão é a dose de hoje */
  aoAbrir?: boolean;
  /** chamado 1x quando a tela aparece (quem chama conta a vista) */
  aoVer?: () => void;
  /** 29/10: o botão da dose de hoje (aoAbrir) — quem chama grava e leva pro módulo. Sem ele, o botão é "Continuar". */
  aoFazerDose?: (p: { n: DiaDaMissao; modulo: ModuloDaMissao }) => void;
  /** o braço do A/B (lib/construiu-ab) — quem chama passa o da conta (bracoConstruiu(user.id)) */
  braco?: BracoConstruiu;
  /** o nome da conta (metadata), se o perfil não tiver `core-user-name` */
  nome?: string | null;
}) {
  const dados = useLifeHubData();
  const reduzir = !!useReducedMotion();
  const { get } = useUserData();
  const r = useResumo(missao, aoAbrir, bracoDado, nome);
  const pend = useMemo(() => pendenciasDeHoje(dados, get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date()), [dados, get]);
  const doseNoBotao = r.doseDeHoje && aoFazerDose ? r.doseDeHoje : null;
  useEffect(() => {
    trackEvent("missao_doses_fim", eventoDaMissao({ score_antes: missao.scoreNoInicio ?? 0, score_hoje: dados.dayScore, sequencia: r.seq, adesivos: r.totalFigurinhas, pendencias_amanha: pend.pending.length, modulos: missao.modulos, braco_construiu: r.braco, ao_abrir: aoAbrir, botao_dose: !!doseNoBotao }));
    aoVer?.();
    if (aoAbrir) trackEvent("dia3_construiu_view", eventoDaMissao({ dia_do_teste: diaDaMissao(missao), doses: dosesFeitas(missao), sequencia: r.seq, adesivos: r.totalFigurinhas, braco_construiu: r.braco }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <motion.div className="fixed inset-0 z-[240] overflow-y-auto bg-background text-foreground cr-tela" data-braco={r.braco} data-camada-guia="missao-doses-fim" data-testid="missao-doses-fim" style={{ paddingTop: "var(--app-safe-top)" }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={entrada(reduzir, MOV.calmo)}>
      {r.braco === "b" && <div className="cr-veu-b" aria-hidden />}
      <Confete atraso={reduzir ? 0 : 0.9} />
      <motion.div className="relative min-h-full max-w-[420px] mx-auto flex flex-col px-5 pt-4"
        initial={reduzir ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={entrada(reduzir, MOV.calmo, 0.15)}>
        {r.braco === "a" ? <><BracoA r={r} /><div className="flex-1" /></> : <BracoB r={r} />}
        <div className="md-fim-rodape" data-testid="missao-doses-fim-rodape">
          <button type="button" className="md-botao md-botao-56" data-tom="e" data-testid="missao-doses-continuar" data-botao={doseNoBotao ? "dose" : "continuar"}
            onClick={() => (doseNoBotao ? aoFazerDose!({ n: doseNoBotao.n, modulo: doseNoBotao.modulo }) : aoContinuar())}>
            {doseNoBotao ? doseNoBotao.botao : "Continuar"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
