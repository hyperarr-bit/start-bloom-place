/**
 * "VAMOS MONTAR SUAS FINANÇAS" (1.0.16) — a tela. Régua, chave e contas em lib/montar-financas.
 *
 * 3 perguntas até o número da pessoa: renda do mês → contas fixas → cartão de crédito (opcional,
 * 16/10) → "Você pode gastar R$ X por dia" (entre a última e o número, ~2 s de "Montando suas
 * finanças…"). O que ela responde vira dado REAL do módulo (`finance-incomes` +
 * `finance-fixed-expenses`, e com cartão o vencimento no próprio cartão + a fatura como custo fixo
 * no crédito dele — ver o cabeçalho de lib/montar-financas), gravado na entrada do "Montando"
 * (fechar o app na animação não perde nada), e o número é o mesmo do card "QUANTO POSSO GASTAR
 * HOJE" do Dashboard. "Pular" em toda tela de pergunta: na 1ª e na 2ª fecha a tela sem gravar; na
 * do cartão, que é opcional, só pula o cartão (a renda e as contas respondidas ficam).
 *
 * ── ONDE APARECE ────────────────────────────────────────────────────────────────────────────
 *  (a) DESLIGADA em 17/10 (dono: "não quero que a pessoa clique em um módulo e apareça um quiz — é só
 *      se a pessoa escolher primeiro"; lib/montar-financas `MONTAR_FINANCAS_NO_MODULO = false`): era
 *      sozinha, na 1ª abertura de Finanças de uma conta nova sem dado (pages/Index.tsx, hook
 *      `useMontarFinancasNoModulo` abaixo). O código fica, desligado.
 *  (b) PELA MISSÃO — a ÚNICA porta: a dose 1 de Finanças do teste de 3 dias, pra quem escolheu
 *      dinheiro/"tudo" (scratchpad/definitiva/8-trial-desenho.md):
 *      Montar → a tela do número, SÓ o número (17/10, revisão do dono: "o 'quanto posso gastar hoje' deveria
 *      ser o foco"): "VOCÊ PODE GASTAR HOJE / R$ X por dia" subindo de 0 (~0,6 s; sem animação pra quem pediu
 *      menos movimento), a linha curta, A CONTA DO SEU MÊS e "Continuar →". 1.0.17 (dono 20/10): a 1ª pergunta leva o
 *      cartão "Tutorial · Finanças · 3 perguntas"; o "Montando" é a conta dela entrando linha por linha (sem a bola); e
 *      entre o número e o 1º gasto vem a PONTE ("Agora vamos anotar seu primeiro gasto" + a cena número → café → o que
 *      sobra hoje · [Ir pro app] · "Ainda não gastei" → `onAindaNaoGastei`). O 1º gasto é o tutorial guiado no formulário de verdade, que a missão abre logo
 *      depois (PassoDoDia).
 *      Quem cuida da missão liga; nada aqui mexe nela:
 *
 *        import { MontarFinancas, deveMostrarMontarFinancas, EVENTO_MONTAR_FINANCAS_FIM, ATRIBUTO_NA_TELA }
 *          from "@/components/finance/montar/MontarFinancas";
 *
 *        const { user } = useAuth(); const { get, isGuest } = useUserData();
 *        if (deveMostrarMontarFinancas({ criadoEm: user?.created_at, get, isGuest }))   // chave + conta nova + vazia + não decidiu
 *          <MontarFinancas origem="missao"                                               //   (ou: o número ainda não visto, B11)
 *            onPronto={(r: ResumoMontar) => … r.contas, r.porDia, r.semFolga, r.cartao …}   // dado já gravado
 *            onPular={() => …} />
 *        // senão (pulou/fez antes, ou Finanças já tem dado): a dose segue direto pro 1º gasto.
 *
 *      FECHAR O APP ANTES DE VER O NÚMERO (B11): o Montar já decidiu (grava na entrada do "Montando"); se o app
 *      morre no "Montando…", `deveMostrarMontarFinancas` responde true — hoje, nesta conta (`lerTelaDoNumero
 *      (criadoEm)` de lib/montar-financas ≠ null) — e a tela abre direto NO NÚMERO. O número que APARECEU não volta:
 *      a marca passa a apontar pra PONTE (reabrir volta nela); saiu da ponte, reabrir é o tutorial do 1º gasto.
 *
 *      É uma folha fixa por cima de tudo (z 200), que começa abaixo da faixa da missão. UMA TELA POR VEZ:
 *      se a do módulo (a) estiver aberta, ela some quando a da missão monta (`onCeder`), e o módulo não
 *      abre a dele enquanto a da missão estiver na tela. O que já foi respondido passa de uma pra outra
 *      (rascunho no aparelho). Enquanto aberta: <html data-montar-financas="missao|modulo">; no fim,
 *      `window` EVENTO_MONTAR_FINANCAS_FIM (`detail: { resultado: "pronto" | "pulou", contas, cartao }`) —
 *      antes de procurar o "+ Novo gasto" ('[data-spotlight="add-expense"]'), esperar o atributo sair.
 *
 * Fechou o app no meio (sem Pular nem Pronto): volta com as respostas preenchidas (o cartão também),
 * no máximo 1 vez.
 *
 * TECLADO DO IPHONE: o app não usa o plugin de teclado — no WKWebView o teclado cobre a parte de
 * baixo da folha fixa e só a área visível (visualViewport) encolhe. Com teclado aberto a folha passa a
 * ocupar SÓ a área visível (`useFolhaAcimaDoTeclado`): o campo em foco vai pro meio e o botão fica
 * logo acima do teclado; o cabeçalho e o "Pular" saem enquanto se digita.
 *
 * Eventos: montar_financas_view {origem, retomou} · montar_financas_passo {n: 1 renda | 2 contas | 3 cartão
 *          | 4 resultado, origem} · montar_financas_pronto {contas, faixa, sem_folga, origem, cartao (+ cartao_pulou
 *          quando pulou o cartão)} · montar_financas_pular {passo, origem} · (só origem "missao", o passo 1 de
 *          Finanças inteiro — lib/montar-financas EV_PRIMEIRO_GASTO) missao_doses_primeiro_gasto {acao: resultado
 *          (a tela do número apareceu; ms_desde_abertura, retomou) | continuar (ms desde o número)}. Nunca valor em reais.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, ChevronDown, DollarSign, Plus, X } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { trocaDePasso, saidaCalma, MOV_MS } from "@/lib/movimento";
import { MesDoCabecalho } from "@/components/MesDoCabecalho";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { useFolhaAcimaDoTeclado } from "@/hooks/use-folha-acima-do-teclado";
import { useGuardaDeToque } from "@/hooks/use-guarda-de-toque";
import { reais } from "@/lib/dinheiro";
import { marcarCartoesVistos } from "@/lib/tour-home";
import { camposDaMissaoNosEventos, eventoDaMissao } from "@/lib/missao-doses";
import { useFinanceCards } from "@/lib/finance-cards";
import { CHAVE_FATURAS_PAGAS, chaveDaFatura } from "@/lib/finance-faturas";
import { localDayKey } from "@/lib/utils";
import {
  ATRIBUTO_NA_TELA, CHAVE_MONTAR_FINANCAS, CONTAS_SUGERIDAS, EVENTO_MONTAR_FINANCAS_FIM, EV_PASSO, EV_PRONTO, EV_PULAR, EV_VIEW,
  FAIXAS_DE_RENDA, calcularMontar, contaNovaParaMontar, deveMostrarMontarFinancas, guardarForcaMontarDaUrl, itensParaGravar,
  marcarMontarDecidido, montarFinancasLigado, montarJaDecidido, registrarVistaMontar, reaisDigitados,
  EVENTO_MONTAR_ABERTA, guardarRascunhoMontar, lerRascunhoMontar, montarAbertoPelaMissao, registrarTelaAberta,
  BANCOS_DO_CARTAO, BANCO_OUTRO, CARTAO_VAZIO, NOME_DO_CARTAO_SEM_BANCO, cartaoCompleto, configDoCartao, diaDoVencimentoNoMes,
  faturaJaVenceu, fixoDaFatura, mesDe, nomeDaFaturaNaTela, MONTAR_FINANCAS_NO_MODULO,
  EV_PRIMEIRO_GASTO, GASTO_DA_PONTE, exemploDaPonte, fecharTelaDoNumero, guardarTelaDoNumero, marcarPonteDoNumero, lerTelaDoNumero, marcarResultadoVisto, msDesdeOResultado, mesApertado,
  type ContaEscolhida, type OrigemMontar, type RespostaCartao, type Resultado, type TelaDoNumero,
} from "@/lib/montar-financas";
import "./montar-financas.css";

export { deveMostrarMontarFinancas, montarAbertoPelaMissao, EVENTO_MONTAR_FINANCAS_FIM, ATRIBUTO_NA_TELA } from "@/lib/montar-financas";

/** `cartao` (16/10): a fatura do cartão entrou. */
export interface ResumoMontar { contas: number; porDia: number; semFolga: boolean; cartao?: boolean }
export interface PropsMontarFinancas {
  /** De onde abriu (vai nos eventos): a 1ª abertura do módulo ou o passo da missão. */
  origem?: OrigemMontar;
  onPronto?: (r: ResumoMontar) => void;
  /** 1.0.17, só pela missão: "Ainda não gastei" na ponte do número pro 1º gasto (a dose já conta; quem chama faz o mesmo
   *  do "Ainda não" do post-it). Sem isto, a ponte chama `onPronto`. */
  onAindaNaoGastei?: (r: ResumoMontar) => void;
  onPular?: () => void;
  /** Só a do módulo: a missão abriu a dela — esta some (sem decidir nada). */
  onCeder?: () => void;
  /** Só testes/prints: a data "de hoje" (o número depende dos dias que faltam no mês). */
  agora?: Date;
  /** Só testes/prints: duração do "Montando…" em ms (padrão 2200; 0 = pula a espera). */
  esperaMs?: number;
  /** Só /dev e testes: a conta (`created_at`) quando não há login — a volta na tela do número (B11) é por conta. */
  contaCriadaEm?: string;
}

/** "ponte" (1.0.17, só pela missão): depois do número, antes do tutorial do 1º gasto. */
type Etapa = "renda" | "contas" | "cartao" | "montando" | "pronto" | "ponte";
const PASSO_DA_ETAPA: Record<Etapa, number> = { renda: 1, contas: 2, cartao: 3, montando: 3, pronto: 4, ponte: 5 };
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

const nomeDoMesLongo = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });

/** Quanto dura a subida do número na tela do resultado (de 0 até o "por dia" dela). */
export const SUBIDA_DO_NUMERO_MS = 600;
/** 1.0.17 (dono 20/10, mockup c1): no lugar do "Calculando…" com a bola girando, as linhas da conta DELA entram uma por vez
 *  (Entra no mês → Contas fixas (N) → Fatura, se tiver cartão), a cada isto (ms). O tempo total do "Montando" não muda. */
export const LINHA_DA_CONTA_MS = 250;
/** A conta some (cópia por cima) neste tempo e só então o número começa a subir. */
export const CONTA_SAI_MS = 280;
const menosMovimento = (): boolean => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

/** O número da tela do resultado SOBE de 0 até o "por dia" dela (~0,6 s, desacelerando), uma vez, quando a tela
 *  aparece; sem animação pra quem pediu menos movimento (ou sem requestAnimationFrame). Fora da tela (`naTela`
 *  false) só acompanha o valor, sem quadro a quadro — digitar a renda muda o "por dia" a cada tecla. */
function useNumeroQueSobe(alvo: number, naTela: boolean, ms = SUBIDA_DO_NUMERO_MS, atrasoMs = 0): number {
  const [v, setV] = useState(() => (naTela && alvo > 0 && !menosMovimento() && typeof requestAnimationFrame === "function" ? 0 : alvo));
  const subiu = useRef(false);
  useEffect(() => {
    if (!naTela || subiu.current || alvo <= 0 || menosMovimento() || typeof requestAnimationFrame !== "function") {
      if (naTela) subiu.current = true;
      setV(alvo);
      return;
    }
    let raf = 0;
    // o relógio é o mesmo no começo e em cada quadro (o carimbo do rAF pode vir de outra origem em WebView/jsdom)
    const agora = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    // 1.0.17: vindo da conta linha por linha, o número espera a conta sumir (uma coisa se mexe por vez)
    const t0 = agora() + Math.max(0, atrasoMs);
    const passo = () => {
      const p = Math.min(1, Math.max(0, (agora() - t0) / ms));
      setV(Math.round(alvo * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
      else subiu.current = true;
    };
    setV(0);
    raf = requestAnimationFrame(passo);
    // interrompida no meio (remontou): a próxima volta recomeça do 0
    return () => cancelAnimationFrame(raf);
  }, [alvo, naTela, ms, atrasoMs]);
  return v;
}

/** A cena da ponte entra peça por peça (~1,5 s, ease-out): a pílula do número → o tracejado desce → o café CAI no lugar
 *  com um tranco leve → o tracejado → a pílula de hoje, com o número antigo riscando e o novo contando pra baixo. */
export const PONTE_CENA_MS = { linha1: 220, cafe: 400, linha2: 740, hoje: 900, conta: 1020, contaDura: 430 } as const;

/** Conta de `de` até `ate` depois de `atrasoMs` (desacelerando); parado → `ate` direto. */
function useContagem(de: number, ate: number, atrasoMs: number, ms: number, parado: boolean): number {
  const animar = !parado && de !== ate && typeof requestAnimationFrame === "function";
  const [v, setV] = useState(animar ? de : ate);
  useEffect(() => {
    if (!animar) { setV(ate); return; }
    const agora = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
    const t0 = agora() + atrasoMs;
    let raf = 0;
    const passo = () => {
      const p = Math.min(1, Math.max(0, (agora() - t0) / ms));
      setV(Math.round(de + (ate - de) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    setV(de);
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [animar, de, ate, atrasoMs, ms]);
  return v;
}

function CenaDaPonte({ porDia, apertado, parado }: { porDia: number; apertado: boolean; parado: boolean }) {
  const { gasto, depois } = exemploDaPonte(porDia);
  const hoje = useContagem(porDia, depois, PONTE_CENA_MS.conta, PONTE_CENA_MS.contaDura, parado || apertado);
  const rs = (v: number) => `R$\u00a0${reais(v)}`;
  const atraso = (ms: number) => (parado ? undefined : ({ animationDelay: `${ms}ms` } as CSSProperties));
  const cafe = (ms: number, valor: number) => (
    <div className="mf-ponte-cafe" data-testid="montar-ponte-gasto" style={atraso(ms)}>
      <span aria-hidden>☕</span> Café<b>{`− ${rs(valor)}`}</b>
    </div>
  );
  const linha = (ms: number) => <i className="mf-ponte-linha" aria-hidden style={atraso(ms)} />;
  if (apertado) {
    return (
      <div className="mf-ponte-cena" data-testid="montar-ponte-cena" data-parado={parado ? "" : undefined}>
        {cafe(0, GASTO_DA_PONTE)}
        {linha(380)}
        <p className="mf-ponte-pilula" data-testid="montar-ponte-folga" style={atraso(560)}><span aria-hidden>🔍</span>anotar mostra onde tem folga</p>
      </div>
    );
  }
  return (
    <div className="mf-ponte-cena" data-testid="montar-ponte-cena" data-parado={parado ? "" : undefined}>
      <p className="mf-ponte-pilula" data-testid="montar-ponte-numero"><DollarSign size={15} aria-hidden /><b>{rs(porDia)}</b> por dia</p>
      {linha(PONTE_CENA_MS.linha1)}
      {cafe(PONTE_CENA_MS.cafe, gasto)}
      {linha(PONTE_CENA_MS.linha2)}
      <p className="mf-ponte-pilula" data-testid="montar-ponte-hoje" data-valor={depois} style={atraso(PONTE_CENA_MS.hoje)}>
        <DollarSign size={15} aria-hidden />
        <s style={atraso(PONTE_CENA_MS.conta)}>{rs(porDia)}</s>
        <span className="sr-only">{`${rs(depois)} hoje`}</span>
        <b aria-hidden>{rs(hoje)}</b> hoje
      </p>
    </div>
  );
}

/** O que o dia escolhido quer dizer NESTE mês — embaixo dos dias, pra ninguém se surpreender depois. */
export function dicaDoVencimento(dia: number, hoje: Date): string {
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const efetivo = diaDoVencimentoNoMes(dia, hoje);
  const antes = dia > ultimo ? `Este mês não tem dia ${dia}: conta o dia ${ultimo}. ` : "";
  if (faturaJaVenceu(dia, hoje)) return `${antes}Já passou neste mês, então a de ${nomeDoMesLongo(hoje)} entra como paga.`;
  const faltam = efetivo - hoje.getDate();
  if (faltam === 0) return `${antes}Vence hoje.`;
  if (faltam === 1) return `${antes}Vence amanhã.`;
  return `${antes}Faltam ${faltam} dias. O CORE avisa quando estiver perto.`;
}

export function MontarFinancas({ origem = "modulo", onPronto, onAindaNaoGastei, onPular, onCeder, agora, esperaMs = 1400, contaCriadaEm }: PropsMontarFinancas) {
  // 1.0.16: chamada PELA missão, os eventos levam o braço e o id dela (o funil Montar → 1º gasto → olha se lê junto)
  const ev = (dados: Record<string, unknown>) => (origem === "missao" ? { ...dados, ...camposDaMissaoNosEventos() } : dados);
  const { get, set } = useUserData();
  const { user } = useAuth();
  const criadoEm = contaCriadaEm ?? (user as { created_at?: string } | null)?.created_at;
  const { custom: cartoesPersonalizados, addCustom, configOf, setConfig } = useFinanceCards();
  const hoje = useMemo(() => agora ?? new Date(), [agora]);
  const folha = useRef<HTMLDivElement>(null);
  useFolhaAcimaDoTeclado(folha);
  const rolo = useRef<HTMLDivElement>(null);
  /* O app morreu no "Montando…", ANTES de o número aparecer (só pela missão, hoje, nesta conta — B11): volta direto
     no número. Senão, fechou no meio das perguntas: volta com o que já tinha respondido. */
  const [retomada] = useState<TelaDoNumero | null>(() => (origem === "missao" ? lerTelaDoNumero(criadoEm, agora ?? new Date()) : null));
  const [rascunho] = useState(() => (retomada ? null : lerRascunhoMontar()));
  // fechou o app na PONTE (o número já visto): volta nela, nunca no número de novo
  const [etapa, setEtapa] = useState<Etapa>(retomada ? (retomada.ponte ? "ponte" : "pronto") : rascunho?.etapa ?? "renda");
  /** 1.0.17: a troca de passo desliza pro lado certo (avançar → da direita; Voltar → da esquerda) */
  const direcao = useRef(1);
  const voltarPara = (e: Etapa) => { direcao.current = -1; setEtapa(e); };
  /** 1.0.17: o 2º toque rápido no "Continuar" caía no "Continuar" do passo seguinte (mesmo lugar) e pulava as contas —
   *  os botões do rodapé ignoram toques por ~450 ms depois de cada troca de passo (hooks/use-guarda-de-toque) */
  const guardar = useGuardaDeToque(etapa);
  const reduzirMov = !!useReducedMotion();
  const [verConta, setVerConta] = useState(false);
  const [faixa, setFaixa] = useState<string | null>(retomada?.faixa ?? rascunho?.faixa ?? null);
  const [renda, setRenda] = useState(retomada?.renda ?? rascunho?.renda ?? 0);
  const [contas, setContas] = useState<ContaEscolhida[]>(retomada?.contas ?? rascunho?.contas ?? []);
  const [cartao, setCartao] = useState<RespostaCartao>(retomada?.cartao ?? rascunho?.cartao ?? CARTAO_VAZIO);
  const outras = useRef((rascunho?.contas ?? []).filter((c) => c.id.startsWith("outra-")).length);
  const inicio = useRef(false);
  const [cedeu, setCedeu] = useState(() => origem === "modulo" && montarAbertoPelaMissao());
  const resultado = useMemo(() => calcularMontar(renda, contas, hoje, cartao), [renda, contas, hoje, cartao]);

  // uma tela por vez: a do módulo cede pra da missão (abriu antes ou depois)
  useEffect(() => {
    if (origem !== "modulo") return;
    const aoAbrir = (e: Event) => { if ((e as CustomEvent<{ origem?: string }>).detail?.origem === "missao") setCedeu(true); };
    window.addEventListener(EVENTO_MONTAR_ABERTA, aoAbrir);
    return () => window.removeEventListener(EVENTO_MONTAR_ABERTA, aoAbrir);
  }, [origem]);
  useEffect(() => { if (cedeu) onCeder?.(); }, [cedeu]); // eslint-disable-line react-hooks/exhaustive-deps

  // aberta: <html data-montar-financas="missao|modulo"> trava a rolagem do fundo e avisa quem espera (missão/anel)
  useEffect(() => (cedeu ? undefined : registrarTelaAberta(origem)), [origem, cedeu]);

  useEffect(() => {
    if (cedeu || inicio.current) return;
    const contar = () => {
      // a do módulo espera 1 volta: se a da missão montou junto (mesmo render), cede sem contar vista
      if (origem === "modulo" && montarAbertoPelaMissao()) { setCedeu(true); return; }
      inicio.current = true;
      registrarVistaMontar();
      trackEvent(EV_VIEW, ev({ origem, retomou: !!rascunho || !!retomada }));
      trackEvent(EV_PASSO, ev({ n: PASSO_DA_ETAPA[etapa], origem }));
    };
    if (origem !== "modulo") { contar(); return; }
    const t = window.setTimeout(contar, 0);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origem, cedeu]);

  // o rascunho acompanha cada resposta (só até virar dado: "Montando" grava e decide)
  useEffect(() => {
    if (cedeu || (etapa !== "renda" && etapa !== "contas" && etapa !== "cartao")) return;
    guardarRascunhoMontar({ etapa, faixa, renda, contas, cartao });
  }, [cedeu, etapa, faixa, renda, contas, cartao]);

  // o dia escolhido (ou voltando do rascunho) aparece no meio da fileira de dias
  useEffect(() => {
    if (etapa !== "cartao" || cartao.usa !== true || !cartao.dia) return;
    const caixa = rolo.current;
    const botao = caixa?.querySelector<HTMLElement>(`[data-dia="${cartao.dia}"]`);
    if (!caixa || !botao) return;
    const alvo = botao.offsetLeft - caixa.clientWidth / 2 + botao.offsetWidth / 2;
    if (typeof caixa.scrollTo === "function") caixa.scrollTo({ left: Math.max(0, alvo), behavior: "smooth" });
    else caixa.scrollLeft = Math.max(0, alvo);
  }, [etapa, cartao.usa, cartao.dia]);

  const irPara = (e: Etapa) => {
    direcao.current = PASSO_DA_ETAPA[e] >= PASSO_DA_ETAPA[etapa] ? 1 : -1;
    setEtapa(e);
    if (e === "contas" || e === "cartao" || e === "pronto") trackEvent(EV_PASSO, ev({ n: PASSO_DA_ETAPA[e], origem }));
  };

  const decidir = (r: Resultado, nContas = 0, comCartao = false, porDia?: number) => {
    const marca = marcarMontarDecidido(r);
    set(CHAVE_MONTAR_FINANCAS, marca, { system: true });
    // `porDia` (1.0.17): o número que a tela vai mostrar — quem grava o rótulo do dia usa ESTE, não refaz a conta
    try { window.dispatchEvent(new CustomEvent(EVENTO_MONTAR_FINANCAS_FIM, { detail: { resultado: r, contas: nContas, cartao: comCartao, ...(porDia !== undefined ? { porDia } : {}) } })); } catch { /* sem window */ }
  };

  const pular = () => {
    trackEvent(EV_PULAR, ev({ passo: PASSO_DA_ETAPA[etapa], origem }));
    saidaCalma(folha.current, MOV_MS.base, 480);
    decidir("pulou");
    onPular?.();
  };

  /** O cartão onde a fatura vai morar: o banco escolhido, ou o "Cartão" personalizado (o mesmo, se já existir). */
  const cartaoDaFatura = (r: RespostaCartao): string => {
    if (r.banco && r.banco !== BANCO_OUTRO && BANCOS_DO_CARTAO.some((b) => b.value === r.banco)) return r.banco;
    const nome = NOME_DO_CARTAO_SEM_BANCO.toLowerCase();
    const existente = cartoesPersonalizados.find((c) => c.label.trim().toLowerCase() === nome);
    if (existente) return existente.value;
    return addCustom(NOME_DO_CARTAO_SEM_BANCO).value ?? BANCO_OUTRO;
  };

  /** Grava no módulo (as chaves de sempre) — na ENTRADA do "Montando". */
  const gravar = (resposta: RespostaCartao, pulouCartao: boolean) => {
    const { receita, fixos } = itensParaGravar(renda, contas, hoje);
    const juntar = (chave: string, novos: unknown[]) => {
      if (!novos.length) return;
      const atuais = get<unknown[]>(chave, []);
      const lista = [...(Array.isArray(atuais) ? atuais : []), ...novos];
      set(chave, lista);
      avisarEscritaDeFora(chave, lista); // Finanças aberta por baixo adota na hora (não regrava por cima)
    };
    const comCartao = cartaoCompleto(resposta);
    const fixosDaTela: unknown[] = [...fixos];
    if (comCartao) {
      const card = cartaoDaFatura(resposta);
      setConfig(card, configDoCartao(resposta.dia, configOf(card)));
      const fixo = fixoDaFatura(resposta, card, hoje);
      fixosDaTela.push(fixo);
      if (fixo.pagoEm) {
        // o vencimento deste mês já passou: a de agora entra paga (sem "atrasada" no 1º dia)
        const atuais = get<Record<string, boolean>>(CHAVE_FATURAS_PAGAS, {});
        const pagas = { ...(atuais && typeof atuais === "object" ? atuais : {}), [chaveDaFatura(mesDe(hoje), card)]: true };
        set(CHAVE_FATURAS_PAGAS, pagas);
        avisarEscritaDeFora(CHAVE_FATURAS_PAGAS, pagas);
      }
    }
    juntar("finance-incomes", receita);
    juntar("finance-fixed-expenses", fixosDaTela);
    const final = calcularMontar(renda, contas, hoje, resposta);
    decidir("pronto", fixos.length, comCartao, final.semFolga ? 0 : final.porDia);
    // o app morrer daqui até o número APARECER (o "Montando…"): a tela volta no número (B11)
    if (origem === "missao") guardarTelaDoNumero({ conta: criadoEm ?? "", dia: localDayKey(hoje), renda, faixa, contas, cartao: resposta });
    trackEvent(EV_PRONTO, ev({
      contas: fixos.length, faixa: faixa ?? "digitou", sem_folga: final.semFolga, apertado: mesApertado(final), origem, cartao: comCartao,
      ...(pulouCartao ? { cartao_pulou: true } : {}),
    }));
  };

  const montar = (resposta: RespostaCartao = cartao, pulouCartao = false) => {
    if (resposta !== cartao) setCartao(resposta);
    gravar(resposta, pulouCartao);
    irPara("montando");
  };
  /** 1.0.17: o número chegou pela conta linha por linha (não pela retomada) — ele espera a conta sumir pra subir */
  const [deMontando, setDeMontando] = useState(false);
  useEffect(() => {
    if (etapa !== "montando") return;
    const t = window.setTimeout(() => {
      // a conta some devagar por cima (cópia) e o número já está parado embaixo — sem corte nem deslize de tela
      saidaCalma(folha.current?.querySelector(".mf-montando-conta"), CONTA_SAI_MS);
      setDeMontando(true);
      irPara("pronto");
    }, Math.max(0, esperaMs));
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, esperaMs]);

  /* ── contas ── */
  const marcada = (id: string) => contas.some((c) => c.id === id);
  const alternar = (id: string) => {
    if (marcada(id)) { setContas(contas.filter((c) => c.id !== id)); return; }
    const s = CONTAS_SUGERIDAS.find((c) => c.id === id);
    if (s) setContas([...contas, { id: s.id, nome: s.nome, emoji: s.emoji, valor: s.valor, categoria: s.categoria }]);
  };
  const novaOutra = () => {
    outras.current += 1;
    setContas([...contas, { id: `outra-${outras.current}`, nome: "", emoji: "📌", valor: 0, categoria: "outros" }]);
  };
  const mudar = (id: string, campo: Partial<ContaEscolhida>) => setContas(contas.map((c) => (c.id === id ? { ...c, ...campo } : c)));
  const totalContas = contas.reduce((s, c) => s + (c.nome.trim() ? c.valor : 0), 0);
  const nValidas = resultado.contas;

  /* ── cartão ── */
  const mudarCartao = (campo: Partial<RespostaCartao>) => setCartao({ ...cartao, ...campo });
  const faturaNaTela = nomeDaFaturaNaTela(cartao.banco);
  const faturaPaga = cartaoCompleto(cartao) && faturaJaVenceu(cartao.dia, hoje);

  /* ── a tela do número (o resultado) ── */
  const naMissao = origem === "missao";
  const abertura = useRef(Date.now());
  /* APARECEU (pela missão): é tela de uma vez — a marca passa a apontar pra ponte (reabrir volta na PONTE, nunca no
     número) e o relógio do passo 1 começa */
  const resultadoContado = useRef(false);
  useEffect(() => {
    if (!naMissao || etapa !== "pronto" || cedeu || resultadoContado.current) return;
    resultadoContado.current = true;
    marcarPonteDoNumero();
    marcarResultadoVisto();
    trackEvent(EV_PRIMEIRO_GASTO, eventoDaMissao({ acao: "resultado", ms: 0, ms_desde_abertura: Date.now() - abertura.current, ...(retomada ? { retomou: true } : {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naMissao, etapa, cedeu]);
  /* A PONTE pro 1º gasto (1.0.17, dono 20/10 — a copy dele, sem ponto final): "Você já viu quanto pode gastar hoje /
     Agora vamos anotar seu primeiro gasto" com a cena (o número dela → um café → o que sobra hoje), [Ir pro app] (o tutorial do gasto de hoje) e "Ainda não gastei" (a
     dose já conta, vai pra festa). Antes o corte era seco: tela limpa → o módulo inteiro rolando e escurecendo. */
  const ponteContada = useRef(false);
  useEffect(() => {
    if (!naMissao || etapa !== "ponte" || cedeu || ponteContada.current) return;
    ponteContada.current = true;
    marcarPonteDoNumero(); // a retomada direto na ponte já está marcada; vinda do número, garante
    trackEvent(EV_PRIMEIRO_GASTO, eventoDaMissao({ acao: "ponte", ms: msDesdeOResultado(), ...(retomada?.ponte ? { retomou: true } : {}) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [naMissao, etapa, cedeu]);
  /** "Continuar →" (missão) / "Ver minhas Finanças" (módulo). Uma vez só: o toque duplo não chama o `onPronto` duas vezes. */
  const saiu = useRef(false);
  const resumo = (): ResumoMontar => ({ contas: resultado.contas, porDia: resultado.porDia, semFolga: resultado.semFolga, cartao: resultado.cartao });
  const continuar = () => {
    if (naMissao) {
      // pela missão o "Continuar" do número leva pra ponte (o mesmo evento de sempre: tocou "Continuar" no número)
      if (etapa !== "pronto") return;
      trackEvent(EV_PRIMEIRO_GASTO, eventoDaMissao({ acao: "continuar", ms: msDesdeOResultado() }));
      irPara("ponte");
      return;
    }
    if (saiu.current) return;
    saiu.current = true;
    // 1.0.17 (Simulador): o Montar sumia num quadro e o módulo aparecia no meio da página, rolando às pressas até o gasto
    // — a cópia do Montar some devagar por cima enquanto o módulo se ajeita embaixo
    saidaCalma(folha.current, MOV_MS.base, 480); // inteira enquanto o módulo rola até o gasto; some com ele parado
    fecharTelaDoNumero();
    onPronto?.(resumo());
  };
  /** Saiu da ponte (uma vez só): a marca some — reabrir agora é o tutorial do 1º gasto (ou a festa). */
  const sairDaPonte = (via: "ir_pro_app" | "ainda_nao") => {
    if (saiu.current) return;
    saiu.current = true;
    // a cópia da ponte fica inteira enquanto o módulo se ajeita embaixo (rola até o gasto / o MEU MÊS) e some com ele parado
    saidaCalma(folha.current, MOV_MS.base, 480);
    fecharTelaDoNumero();
    trackEvent(EV_PRIMEIRO_GASTO, eventoDaMissao({ acao: "ponte_saiu", via, ms: msDesdeOResultado() }));
    if (via === "ainda_nao" && onAindaNaoGastei) onAindaNaoGastei(resumo());
    else onPronto?.(resumo());
  };
  const numeroNaTela = useNumeroQueSobe(resultado.porDia, etapa === "pronto", SUBIDA_DO_NUMERO_MS, deMontando && !reduzirMov && !menosMovimento() ? CONTA_SAI_MS : 0);
  /** As linhas da conta do "Montando" (as mesmas da "Ver a conta"), na ordem em que entram. */
  const linhasDaConta: Array<{ id: string; rotulo: string; valor: string }> = [
    { id: "renda", rotulo: "Entra no mês", valor: `R$ ${reais(resultado.renda)}` },
    { id: "contas", rotulo: `Contas fixas (${resultado.contas})`, valor: `− R$ ${reais(resultado.fixos)}` },
    ...(resultado.cartao && cartao.dia ? [{ id: "fatura", rotulo: faturaNaTela, valor: `− R$ ${reais(resultado.fatura)}` }] : []),
  ];
  const apertado = mesApertado(resultado);
  /** "R$ 123" que nunca quebra no meio (o "R$" sozinho no fim da linha parecia valor cortado) */
  const rs = (v: number) => `R$\u00a0${reais(v)}`;

  const cabecalho = (
    <header className="mf-cab">
      <DollarSign className="mf-cab-icone" aria-hidden />
      <span className="mf-cab-nome">FINANÇAS</span>
      <MesDoCabecalho data={hoje} className="mf-cab-mes" />
    </header>
  );
  const barra = (n: number) => (
    <div className="mf-barra" aria-hidden>{[1, 2, 3].map((i) => <i key={i} {...(i <= n ? { "data-on": "" } : {})} />)}</div>
  );

  if (cedeu) return null;
  return (
    <div ref={folha} className="mf" role="dialog" aria-modal="true" aria-label="Vamos montar suas finanças" data-testid="montar-financas" data-etapa={etapa} data-folha={`montar-financas:${etapa}`}>
      {cabecalho}
      {/* 1.0.17 (dono: "os cortes entre as telas são bruscos"): cada passo ENTRA deslizando 24 px + fade (260 ms); o de
          antes sai na hora (nada de esperar uma saída animada pra responder ao toque) */}
      <motion.div key={etapa === "montando" || etapa === "pronto" ? "resultado" : etapa} className="mf-corpo" custom={direcao.current} variants={trocaDePasso(reduzirMov)} initial="entra" animate="fica" data-passo={etapa}>
        {etapa === "renda" && (
          <>
            {/* 1.0.17 (dono 20/10, mockup b2): pela missão, a 1ª pergunta diz que isto é o TUTORIAL — curtíssimo, sem toque a
                mais; nas perguntas seguintes fica só a barra de progresso */}
            {naMissao && (
              <div className="mf-contexto" data-testid="montar-contexto">
                <i aria-hidden><DollarSign size={20} /></i>
                <span><b>Tutorial</b> · Finanças · 3 perguntas</span>
              </div>
            )}
            {barra(1)}
            <div className="mf-q">
              <h2>Quanto entra por mês?</h2>
              <p>Pode ser aproximado.</p>
            </div>
            <div className="mf-chips" data-grade="">
              {FAIXAS_DE_RENDA.map((f) => (
                <button key={f.id} type="button" className="mf-chip" aria-pressed={faixa === f.id}
                  onClick={() => { setFaixa(f.id); setRenda(f.valor); }}>
                  {f.rotulo}
                </button>
              ))}
            </div>
            <div className="mf-folha">
              <div className="mf-faixa">💰 Renda do mês</div>
              <div className="mf-renda">
                <label>
                  <small>R$</small>
                  <input
                    aria-label="Renda do mês em reais"
                    inputMode="numeric" enterKeyHint="done" placeholder="0"
                    value={renda ? reais(renda) : ""}
                    onChange={(e) => { setRenda(reaisDigitados(e.target.value)); setFaixa(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                  />
                </label>
              </div>
            </div>
            <div className="mf-rodape" data-teclado-rodape="">
              <button type="button" className="mf-cta" disabled={renda <= 0} onClick={guardar(() => irPara("contas"))}>Continuar</button>
              <button type="button" className="mf-pular" onClick={guardar(pular)}>Pular</button>
            </div>
          </>
        )}

        {etapa === "contas" && (
          <>
            {barra(2)}
            <div className="mf-q">
              <div className="mf-kicker">
                <button type="button" className="mf-voltar" onClick={() => voltarPara("renda")}><ArrowLeft size={14} aria-hidden /><span>Voltar</span></button>
              </div>
              <h2>Quais contas você paga todo mês?</h2>
              <p>Toque para marcar.</p>
            </div>
            {/* chip = escolher (só o nome, cabe tudo na tela); o valor típico já entra na tabela, pra ajustar */}
            <div className="mf-chips" data-compacto="">
              {CONTAS_SUGERIDAS.map((c) => (
                <button key={c.id} type="button" className="mf-chip" aria-pressed={marcada(c.id)} onClick={() => alternar(c.id)}>
                  {c.emoji} {c.nome}
                </button>
              ))}
              <button type="button" className="mf-chip" data-outra="" onClick={novaOutra}><Plus size={16} aria-hidden /><span>Outra</span></button>
            </div>
            {contas.length > 0 && (
              <div className="mf-folha" data-testid="montar-contas">
                <div className="mf-faixa">📋 Contas fixas do mês <b>{contas.length}</b></div>
                {contas.map((c) => (
                  <div key={c.id} className="mf-linha">
                    <span className="mf-linha-emoji" aria-hidden>{c.emoji}</span>
                    {c.id.startsWith("outra-") ? (
                      <input className="mf-linha-nome" aria-label="Nome da conta" placeholder="Nome da conta" autoFocus
                        value={c.nome} maxLength={40} onChange={(e) => mudar(c.id, { nome: e.target.value })} />
                    ) : (
                      <span className="mf-linha-nome">{c.nome}</span>
                    )}
                    <label className="mf-valor">
                      <small>R$</small>
                      <input aria-label={`Valor de ${c.nome || "outra conta"}`} inputMode="numeric" enterKeyHint="done" placeholder="0"
                        value={c.valor ? reais(c.valor) : ""} onChange={(e) => mudar(c.id, { valor: reaisDigitados(e.target.value) })}
                        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }} />
                    </label>
                    <button type="button" className="mf-tirar" aria-label={`Tirar ${c.nome || "outra conta"}`}
                      onClick={() => setContas(contas.filter((x) => x.id !== c.id))}><X size={16} aria-hidden /></button>
                  </div>
                ))}
                <div className="mf-total"><span>Total por mês</span>R$ {reais(totalContas)}</div>
              </div>
            )}
            <div className="mf-rodape" data-teclado-rodape="">
              <button type="button" className="mf-cta" onClick={guardar(() => irPara("cartao"))}>
                {nValidas > 0 ? "Continuar" : "Não tenho conta fixa"}
              </button>
              <button type="button" className="mf-pular" onClick={guardar(pular)}>Pular</button>
            </div>
          </>
        )}

        {etapa === "cartao" && (
          <>
            {barra(3)}
            <div className="mf-q">
              <div className="mf-kicker">
                <button type="button" className="mf-voltar" onClick={() => voltarPara("contas")}><ArrowLeft size={14} aria-hidden /><span>Voltar</span></button>
              </div>
              <h2>Usa cartão de crédito?</h2>
            </div>
            <div className="mf-chips" data-grade="">
              <button type="button" className="mf-chip" aria-pressed={cartao.usa === true} onClick={() => mudarCartao({ usa: true })}>💳 Uso cartão</button>
              <button type="button" className="mf-chip" aria-pressed={cartao.usa === false} onClick={() => montar({ ...cartao, usa: false })}>Não uso cartão</button>
            </div>
            {cartao.usa === true && (
              <div className="mf-folha" data-testid="montar-cartao" data-teclado-junto="">
                <div className="mf-faixa">💳 Cartão de crédito</div>
                <div className="mf-campo">
                  <span className="mf-rotulo" id="mf-qual-cartao">Qual cartão?</span>
                  <div className="mf-rolo" role="group" aria-labelledby="mf-qual-cartao">
                    {[...BANCOS_DO_CARTAO.map((b) => ({ value: b.value, label: b.label })), { value: BANCO_OUTRO, label: "Outro" }].map((b) => (
                      <button key={b.value} type="button" className="mf-banco" aria-pressed={cartao.banco === b.value}
                        onClick={() => mudarCartao({ banco: cartao.banco === b.value ? null : b.value })}>
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="mf-campo">
                  <span className="mf-rotulo" aria-hidden>Fatura deste mês</span>
                  <label className="mf-valor-grande">
                    <small>R$</small>
                    <input
                      aria-label="Fatura deste mês em reais"
                      inputMode="numeric" enterKeyHint="done" placeholder="0"
                      value={cartao.valor ? reais(cartao.valor) : ""}
                      onChange={(e) => mudarCartao({ valor: reaisDigitados(e.target.value) })}
                      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    />
                  </label>
                </div>
                <div className="mf-campo">
                  <span className="mf-rotulo" id="mf-dia-vence">Vence todo dia</span>
                  <div ref={rolo} className="mf-rolo" data-dias="" role="group" aria-labelledby="mf-dia-vence">
                    {DIAS.map((d) => (
                      <button key={d} type="button" className="mf-dia" data-dia={d} aria-label={`Dia ${d}`} aria-pressed={cartao.dia === d}
                        onClick={() => mudarCartao({ dia: d })}>
                        {d}
                      </button>
                    ))}
                  </div>
                  {cartao.dia ? <p className="mf-dica" aria-live="polite">{dicaDoVencimento(cartao.dia, hoje)}</p> : null}
                </div>
              </div>
            )}
            <div className="mf-rodape" data-teclado-rodape="">
              <button type="button" className="mf-cta" disabled={!cartaoCompleto(cartao)} onClick={guardar(() => montar())}>Ver quanto posso gastar</button>
              <button type="button" className="mf-pular" onClick={guardar(() => montar({ ...cartao, usa: null }, true))}>Pular</button>
            </div>
          </>
        )}

        {etapa === "montando" && (
          /* 1.0.17 (dono 20/10, mockup c1): a conta DELA entrando linha por linha (no lugar da bola girando), e o número
             sobe logo depois na tela do resultado. Com "reduzir movimento", as linhas aparecem paradas. */
          <div className="mf-montando-conta" data-testid="montar-montando" aria-live="polite">
            <p className="mf-montando-kicker">Montando seu mês…</p>
            <div className="mf-folha">
              <div className="mf-faixa">📋 Seu mês</div>
              {linhasDaConta.map((l, i) => (
                <div key={l.id} className="mf-conta" data-entra="" data-linha={l.id} style={reduzirMov || menosMovimento() ? undefined : { animationDelay: `${i * LINHA_DA_CONTA_MS}ms` }}>
                  <span>{l.rotulo}</span>{l.valor}
                </div>
              ))}
            </div>
          </div>
        )}

        {etapa === "pronto" && (
          <>
            {/* 17/10 (revisão do dono): SÓ o número — o herói da tela. O 1º gasto é o tutorial no formulário de verdade
                (a missão abre depois do "Continuar →"); nada de post-it aqui. */}
            <div className="mf-pronto" data-testid="montar-pronto" data-heroi={naMissao ? "" : undefined} data-apertado={apertado ? "" : undefined} data-de-montando={deMontando ? "" : undefined}>
              {apertado ? (
                /* 1.0.17: mês apertado (R$ 0 ou < R$ 15/dia) — o herói é o acolhimento, não o número pequeno. O número
                   fica na conta do mês ("Ver a conta" → "÷ N dias" ou "Por dia"). */
                <div className="mf-grande mf-apertado" data-testid="montar-apertado">
                  <small>Seu mês</small>
                  <h2>Seu mês tá apertado.</h2>
                  <p>Vamos achar folga juntos. Anotar o que sai é o primeiro passo.</p>
                </div>
              ) : (
              <div className="mf-grande">
                <small>Você pode gastar</small>
                <strong data-testid="montar-por-dia" data-valor={resultado.porDia}>
                  {/* leitor de tela: o número final, sem a contagem (aria-label num <strong> não é lido no VoiceOver) */}
                  <span className="sr-only">{`R$ ${reais(resultado.porDia)} por dia`}</span>
                  <span aria-hidden>{rs(numeroNaTela)}</span><em aria-hidden>por dia</em>
                </strong>
                <p data-testid="montar-ate-quando">
                  {resultado.semFolga
                    ? "Suas contas já levam a renda do mês."
                    : resultado.dias === 1 ? "Hoje é o último dia do mês." : "até o fim do mês."}
                </p>
              </div>
              )}
              {/* 1.0.17 (dono: "joga informação na cara"): a conta do mês fica FECHADA — quem quiser, abre.
                  No mês apertado o número (R$/dia) mora aqui dentro, na linha "Por dia". */}
              <div className="mf-folha" data-aberta={verConta ? "" : undefined}>
                <button type="button" className="mf-ver-conta" aria-expanded={verConta} data-testid="montar-ver-conta" onClick={() => setVerConta((v) => !v)}>
                  <span>Ver a conta</span><ChevronDown size={16} aria-hidden style={{ transform: verConta ? "rotate(180deg)" : undefined, transition: "transform var(--mov-base)" }} />
                </button>
                {verConta && (
                  <div data-testid="montar-conta">
                    <div className="mf-conta"><span>Entra no mês</span>R$ {reais(resultado.renda)}</div>
                    <div className="mf-conta"><span>Contas fixas ({resultado.contas})</span>− R$ {reais(resultado.fixos)}</div>
                    {resultado.cartao && cartao.dia && (
                      <div className="mf-conta" data-testid="montar-fatura">
                        <span>{faturaNaTela} <small>· {faturaPaga ? "já paga" : `vence dia ${cartao.dia}`}</small></span>− R$ {reais(resultado.fatura)}
                      </div>
                    )}
                    <div className="mf-conta" data-total=""><span>Livre pro mês</span>R$ {reais(Math.max(0, resultado.livre))}</div>
                    {!resultado.semFolga && resultado.dias > 1 && (
                      <div className="mf-conta"><span>÷ {resultado.dias} dias</span>R$ {reais(resultado.porDia)} por dia</div>
                    )}
                    {apertado && (resultado.semFolga || resultado.dias <= 1) && (
                      <div className="mf-conta" data-testid="montar-por-dia-apertado"><span>Por dia</span>R$ {reais(resultado.porDia)}</div>
                    )}
                  </div>
                )}
              </div>
              {!naMissao && <p className="mf-salvo"><i><Check size={15} strokeWidth={3} /></i>Já está nas suas Finanças.</p>}
            </div>
            <div className="mf-rodape" data-teclado-rodape="">
              <button type="button" className="mf-cta" onClick={guardar(continuar)}>{naMissao ? "Continuar" : "Ver minhas Finanças"}</button>
            </div>
          </>
        )}

        {etapa === "ponte" && (
          <>
            {/* 1.0.17 (dono 20/10, ponte "versão 1", mockup ponte2): em cima o que ela viu e o que vem (sem ponto final);
                no meio a CENA — o número dela → um café que cai → o que sobra hoje —, ligada por tracejado; embaixo os botões */}
            <div className="mf-ponte" data-testid="montar-ponte" data-apertado={apertado ? "" : undefined}>
              <p className="mf-ponte-viu" data-testid="montar-ponte-viu">{apertado ? "Você já viu como tá seu mês" : "Você já viu quanto pode gastar hoje"}</p>
              <h2 data-testid="montar-ponte-titulo">Agora vamos anotar seu primeiro gasto</h2>
              <CenaDaPonte porDia={resultado.porDia} apertado={apertado || !(resultado.porDia > 0)} parado={reduzirMov || menosMovimento()} />
            </div>
            <div className="mf-rodape" data-teclado-rodape="">
              <button type="button" className="mf-cta" data-testid="montar-ponte-ir" onClick={guardar(() => sairDaPonte("ir_pro_app"))}>Ir pro app</button>
              <button type="button" className="mf-pular" data-testid="montar-ponte-nao-gastei" onClick={guardar(() => sairDaPonte("ainda_nao"))}>Ainda não gastei</button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

/**
 * A régua no módulo (pages/Index.tsx): decide UMA vez, quando o dado da conta carregou, e
 * segura a decisão (gravar a renda no meio do fluxo não pode fechar a tela).
 *   · "nao"       → Finanças de sempre (cliente antigo nem chega a "decidindo");
 *   · "decidindo" → conta nova esperando o dado da conta (o módulo mostra a tela em branco);
 *   · "mostrar"   → a tela de montar.
 * `abrirNoModulo` (17/10: `MONTAR_FINANCAS_NO_MODULO`, desligado) — `false` = sempre "nao", na hora:
 * nem a tela nem a espera em branco. O `?montar-financas=` de QA continua sendo lido aqui (é ele que
 * deixa testar a tela da missão no navegador).
 */
export function useMontarFinancasNoModulo(isPreview: boolean, abrirNoModulo: boolean = MONTAR_FINANCAS_NO_MODULO) {
  const { user } = useAuth();
  const { get, set, loaded, isGuest } = useUserData();
  const criadoEm = (user as { created_at?: string } | null)?.created_at;
  // `?montar-financas=recomecar` (QA, navegador): lido UMA vez por montagem
  const recomecou = useRef<boolean | null>(null);
  if (recomecou.current === null) recomecou.current = guardarForcaMontarDaUrl();
  const candidato = () => abrirNoModulo && !isPreview && !isGuest && montarFinancasLigado() && contaNovaParaMontar(criadoEm) && !montarJaDecidido();
  const decidir = (): "mostrar" | "nao" => {
    const getSemMarca = recomecou.current ? (<T,>(k: string, f: T): T => (k === CHAVE_MONTAR_FINANCAS ? f : get(k, f))) : get;
    if (montarAbertoPelaMissao()) return "nao"; // a missão está com a tela dela aberta
    return deveMostrarMontarFinancas({ criadoEm, get: getSemMarca, isGuest, isPreview }) ? "mostrar" : "nao";
  };
  const [estado, setEstado] = useState<"decidindo" | "mostrar" | "nao">(() => {
    if (!candidato()) return "nao";
    return loaded ? decidir() : "decidindo";
  });
  useEffect(() => {
    if (recomecou.current) set(CHAVE_MONTAR_FINANCAS, null, { system: true }); // a marca da conta também sai
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (estado !== "decidindo" || !loaded) return;
    setEstado(decidir());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, estado]);
  return {
    estado,
    /** Terminou: os cartões de boas-vindas de Finanças não aparecem mais (a tela os substitui). */
    aoPronto: () => { marcarCartoesVistos("financas"); setEstado("nao"); },
    /** Pulou: Finanças de sempre (com os cartões, se a chave deles estiver ligada). */
    aoPular: () => setEstado("nao"),
    /** A missão abriu a tela dela por cima: a do módulo sai sem decidir (a da missão decide). */
    aoCeder: () => setEstado("nao"),
  };
}
