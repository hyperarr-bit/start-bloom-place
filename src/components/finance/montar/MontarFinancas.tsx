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
 *      Montar → "pode gastar R$ X por dia" + O 1º GASTO ALI MESMO (17/10, D1 do relatório 11, só nesta
 *      porta): o post-it "Já gastou com alguma coisa hoje?" — Café R$ 12 · Uber R$ 23 · Almoço R$ 35 ·
 *      ✎ outro (nome + valor ali, sem sair) · "Ainda não gastei nada hoje →". 1 toque = 1 gasto variável de
 *      verdade (`finance-expenses`, o objeto do "+ Novo gasto", id estável: 2 toques gravam 1), o chip vira ✓,
 *      o número cai (~~R$ 70~~ R$ 58 pra hoje = o do dia − o gasto de hoje) e o botão vira "Ver no meu mês →".
 *      Quem cuida da missão liga; nada aqui mexe nela:
 *
 *        import { MontarFinancas, deveMostrarMontarFinancas, EVENTO_MONTAR_FINANCAS_FIM, ATRIBUTO_NA_TELA }
 *          from "@/components/finance/montar/MontarFinancas";
 *
 *        const { user } = useAuth(); const { get, isGuest } = useUserData();
 *        if (deveMostrarMontarFinancas({ criadoEm: user?.created_at, get, isGuest }))   // chave + conta nova + vazia + não decidiu
 *          <MontarFinancas origem="missao"                                               //   (ou: a tela do número em aberto, B11)
 *            onPronto={(r: ResumoMontar) => … r.contas, r.porDia, r.semFolga, r.cartao, r.primeiroGasto …}   // dado já gravado
 *            onPular={() => …} />
 *        // senão (pulou/fez antes, ou Finanças já tem dado): a dose segue direto pro 1º gasto.
 *
 *      `r.primeiroGasto`: { nome } = anotou na tela do número (a missão pula o anel do 1º gasto: MEU MÊS + festa)
 *      · null = "Ainda não gastei nada hoje" (a dose conta igual) · ausente = saiu pelo botão sem anotar nada (a
 *      missão segue com o 1º gasto dela, como antes).
 *      FECHAR O APP NA TELA DO NÚMERO (B11): o Montar já decidiu (grava na entrada do "Montando"), mas até ela
 *      sair da tela (o botão ou "Ainda não gastei") `deveMostrarMontarFinancas` responde true — hoje, nesta conta
 *      (`lerTelaDoNumero(criadoEm)` de lib/montar-financas ≠ null) — e a tela abre DE NOVO NELA, com os chips já
 *      tocados. Quem abre não pode trocar essa volta pelo passo do gasto só porque a dose já foi gravada.
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
 *          quando pulou o cartão)} · montar_financas_pular {passo, origem} · (só origem "missao")
 *          missao_doses_gasto_no_numero {acao: view | chip | outro | ainda_nao, ms (view: desde a abertura da tela;
 *          os outros: desde o view), chip: nome do chip, retomou (view depois de fechar o app ali)}. Nunca valor em
 *          reais (nem o nome digitado no "✎ outro").
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Check, DollarSign, Plus, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { reais } from "@/lib/dinheiro";
import { marcarCartoesVistos } from "@/lib/tour-home";
import { camposDaMissaoNosEventos } from "@/lib/missao-doses";
import { useFinanceCards } from "@/lib/finance-cards";
import { CHAVE_FATURAS_PAGAS, chaveDaFatura } from "@/lib/finance-faturas";
import { alvoDaMissao, gravacoesDoChip, itemDoChip, type ChipDaMissao } from "@/components/demo-guiada/alvos";
import { normalizarItem } from "@/lib/demo-guiada";
import { gravacoesDoItem, idDoItem, type Gravacao } from "@/lib/demo-guiada-registro";
import { localDayKey } from "@/lib/utils";
import { eventoDaMissao } from "@/lib/missao-doses";
import {
  ATRIBUTO_NA_TELA, CHAVE_MONTAR_FINANCAS, CONTAS_SUGERIDAS, EVENTO_MONTAR_FINANCAS_FIM, EV_PASSO, EV_PRONTO, EV_PULAR, EV_VIEW,
  FAIXAS_DE_RENDA, calcularMontar, contaNovaParaMontar, deveMostrarMontarFinancas, guardarForcaMontarDaUrl, itensParaGravar,
  marcarMontarDecidido, montarFinancasLigado, montarJaDecidido, registrarVistaMontar, reaisDigitados,
  EVENTO_MONTAR_ABERTA, guardarRascunhoMontar, lerRascunhoMontar, montarAbertoPelaMissao, registrarTelaAberta,
  BANCOS_DO_CARTAO, BANCO_OUTRO, CARTAO_VAZIO, NOME_DO_CARTAO_SEM_BANCO, cartaoCompleto, configDoCartao, diaDoVencimentoNoMes,
  faturaJaVenceu, fixoDaFatura, mesDe, nomeDaFaturaNaTela, MONTAR_FINANCAS_NO_MODULO,
  EV_GASTO_NO_NUMERO, fecharTelaDoNumero, guardarTelaDoNumero, lerTelaDoNumero, sobraPraHoje,
  type ContaEscolhida, type GastoDoNumero, type OrigemMontar, type RespostaCartao, type Resultado, type TelaDoNumero,
} from "@/lib/montar-financas";
import "./montar-financas.css";

export { deveMostrarMontarFinancas, montarAbertoPelaMissao, EVENTO_MONTAR_FINANCAS_FIM, ATRIBUTO_NA_TELA } from "@/lib/montar-financas";

/** `cartao` (16/10): a fatura do cartão entrou. `primeiroGasto` (17/10, só origem "missao"): o 1º gasto que
 *  ela anotou NA tela do número (`{ nome }` — sem valor) → a missão pula o anel do 1º gasto e vai direto pro
 *  MEU MÊS + festa; `null` = "Ainda não gastei nada hoje" (a dose conta igual: o Montar gravou); ausente = saiu
 *  pelo botão sem tocar em nada (a missão segue com o 1º gasto dela, como antes). Campos novos, opcionais. */
export interface ResumoMontar { contas: number; porDia: number; semFolga: boolean; cartao?: boolean; primeiroGasto?: { nome: string } | null }
export interface PropsMontarFinancas {
  /** De onde abriu (vai nos eventos): a 1ª abertura do módulo ou o passo da missão. */
  origem?: OrigemMontar;
  onPronto?: (r: ResumoMontar) => void;
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

type Etapa = "renda" | "contas" | "cartao" | "montando" | "pronto";
const PASSO_DA_ETAPA: Record<Etapa, number> = { renda: 1, contas: 2, cartao: 3, montando: 3, pronto: 4 };
const DIAS = Array.from({ length: 31 }, (_, i) => i + 1);

const mesCurto = (d: Date) => d.toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(/\.?\s*de\s*/i, " ").replace(".", "");
const nomeDoMesLongo = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });

/** Os chips do 1º gasto na tela do número: os MESMOS da missão (Café R$ 12 · Uber R$ 23 · Almoço R$ 35). */
const CHIPS_DO_NUMERO: ChipDaMissao[] = alvoDaMissao("gasto").chips;

/** O número que cai na frente dela (~1 s, desacelerando); sem animação pra quem pediu menos movimento.
 *  `animar` = o número está na tela ("pra hoje"): fora disso só acompanha o valor, sem quadro a quadro (digitar a
 *  renda mudava o "por dia" a cada tecla e redesenhava a tela inteira ~60 vezes por segundo). */
function useNumeroQueCai(alvo: number, animar: boolean, ms = 1100): number {
  const [v, setV] = useState(alvo);
  const atual = useRef(alvo);
  useEffect(() => {
    const de = atual.current;
    if (de === alvo) return;
    const reduzir = typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (!animar || reduzir || typeof requestAnimationFrame !== "function") { atual.current = alvo; setV(alvo); return; }
    let raf = 0;
    const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const n = Math.round(de + (alvo - de) * (1 - Math.pow(1 - p, 3)));
      atual.current = n;
      setV(n);
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, animar, ms]);
  return v;
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

/**
 * Com o teclado do iPhone aberto, a folha (fixa, tela inteira) passa a ocupar só a área VISÍVEL
 * (visualViewport): o campo em foco vai pro meio e o botão fica logo acima do teclado. Fora do
 * iPhone (sem visualViewport encolhendo) nada muda. A faixa da missão, se estiver visível em cima,
 * continua por cima: a folha começa embaixo dela.
 */
function useFolhaAcimaDoTeclado(ref: RefObject<HTMLDivElement>) {
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const el = ref.current;
    if (!vv || !el) return;
    let aberto = false;
    let t = 0;
    const centralizarCampo = () => {
      const ativo = document.activeElement as HTMLElement | null;
      if (ativo && el.contains(ativo) && /^(INPUT|TEXTAREA)$/.test(ativo.tagName)) ativo.scrollIntoView?.({ block: "center" });
    };
    const soltar = () => {
      el.style.removeProperty("top");
      el.style.removeProperty("bottom");
      el.style.removeProperty("height");
      el.removeAttribute("data-teclado");
    };
    const aplicar = () => {
      t = 0;
      const agoraAberto = vv.height < window.innerHeight - 140;
      if (!agoraAberto) { if (aberto) soltar(); aberto = false; return; }
      const html = document.documentElement;
      const faixa = html.hasAttribute("data-missao-doses-faixa")
        ? (parseFloat(getComputedStyle(html).getPropertyValue("--missao-doses-faixa-h")) || 40)
        : 0;
      const topo = Math.max(vv.offsetTop, faixa);
      el.style.top = `${topo}px`;
      el.style.bottom = "auto";
      el.style.height = `${Math.max(0, vv.offsetTop + vv.height - topo)}px`;
      el.setAttribute("data-teclado", "");
      if (!aberto) window.setTimeout(centralizarCampo, 30); // acabou de abrir: o campo vai pro meio
      aberto = true;
    };
    const agendar = () => { if (!t) t = window.setTimeout(aplicar, 0); };
    // trocou de campo com o teclado já aberto: centraliza o novo
    const aoFocar = () => { if (aberto) window.setTimeout(centralizarCampo, 30); };
    vv.addEventListener("resize", agendar);
    vv.addEventListener("scroll", agendar);
    el.addEventListener("focusin", aoFocar);
    aplicar();
    return () => {
      vv.removeEventListener("resize", agendar);
      vv.removeEventListener("scroll", agendar);
      el.removeEventListener("focusin", aoFocar);
      if (t) window.clearTimeout(t);
      soltar();
    };
  }, [ref]);
}

export function MontarFinancas({ origem = "modulo", onPronto, onPular, onCeder, agora, esperaMs = 2200, contaCriadaEm }: PropsMontarFinancas) {
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
  /* Fechou o app NA TELA DO NÚMERO (só pela missão, hoje, nesta conta — B11): volta nela, com os chips já
     tocados. Senão, fechou no meio das perguntas: volta com o que já tinha respondido. */
  const [retomada] = useState<TelaDoNumero | null>(() => (origem === "missao" ? lerTelaDoNumero(criadoEm, agora ?? new Date()) : null));
  const [rascunho] = useState(() => (retomada ? null : lerRascunhoMontar()));
  const [etapa, setEtapa] = useState<Etapa>(retomada ? "pronto" : rascunho?.etapa ?? "renda");
  const [faixa, setFaixa] = useState<string | null>(retomada?.faixa ?? rascunho?.faixa ?? null);
  const [renda, setRenda] = useState(retomada?.renda ?? rascunho?.renda ?? 0);
  const [contas, setContas] = useState<ContaEscolhida[]>(retomada?.contas ?? rascunho?.contas ?? []);
  const [cartao, setCartao] = useState<RespostaCartao>(retomada?.cartao ?? rascunho?.cartao ?? CARTAO_VAZIO);
  /** os gastos que ela anotou na tela do número (chip ou "✎ outro") */
  const [gastos, setGastos] = useState<GastoDoNumero[]>(retomada?.gastos ?? []);
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
    setEtapa(e);
    if (e === "contas" || e === "cartao" || e === "pronto") trackEvent(EV_PASSO, ev({ n: PASSO_DA_ETAPA[e], origem }));
  };

  const decidir = (r: Resultado, nContas = 0, comCartao = false) => {
    const marca = marcarMontarDecidido(r);
    set(CHAVE_MONTAR_FINANCAS, marca, { system: true });
    try { window.dispatchEvent(new CustomEvent(EVENTO_MONTAR_FINANCAS_FIM, { detail: { resultado: r, contas: nContas, cartao: comCartao } })); } catch { /* sem window */ }
  };

  const pular = () => {
    trackEvent(EV_PULAR, ev({ passo: PASSO_DA_ETAPA[etapa], origem }));
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
    decidir("pronto", fixos.length, comCartao);
    // fechar o app daqui até ela sair da tela do número: a tela volta lá (B11)
    if (origem === "missao") guardarTelaDoNumero({ conta: criadoEm ?? "", dia: localDayKey(hoje), renda, faixa, contas, cartao: resposta, gastos: [] });
    const final = calcularMontar(renda, contas, hoje, resposta);
    trackEvent(EV_PRONTO, ev({
      contas: fixos.length, faixa: faixa ?? "digitou", sem_folga: final.semFolga, origem, cartao: comCartao,
      ...(pulouCartao ? { cartao_pulou: true } : {}),
    }));
  };

  const montar = (resposta: RespostaCartao = cartao, pulouCartao = false) => {
    if (resposta !== cartao) setCartao(resposta);
    gravar(resposta, pulouCartao);
    irPara("montando");
  };
  useEffect(() => {
    if (etapa !== "montando") return;
    const t = window.setTimeout(() => irPara("pronto"), Math.max(0, esperaMs));
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

  /* ── o 1º gasto na tela do número (só origem "missao") ── */
  const comPostIt = origem === "missao";
  const abertura = useRef(Date.now());
  const vistoEm = useRef<number | null>(null);
  const anotando = useRef(new Set<string>());
  const [abrirOutro, setAbrirOutro] = useState(false);
  const [outroNome, setOutroNome] = useState("");
  const [outroValor, setOutroValor] = useState(0);
  useEffect(() => {
    if (!comPostIt || etapa !== "pronto" || vistoEm.current !== null) return;
    vistoEm.current = Date.now();
    evNumero({ acao: "view", ms: vistoEm.current - abertura.current, ...(retomada ? { retomou: true } : {}) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comPostIt, etapa]);
  const msDesdeOView = () => (vistoEm.current === null ? 0 : Date.now() - vistoEm.current);
  /** Evento da missão (o mesmo envelope dos outros `missao_doses_*`: protótipo, versão, braço do Dia 1). */
  const evNumero = (dados: Record<string, unknown>) => trackEvent(EV_GASTO_NO_NUMERO, eventoDaMissao(dados));
  /** Grava pelo `set` do app, no formato que o módulo já lê (as gravações da missão), e avisa o módulo aberto por baixo. */
  const aplicar = (gravacoes: Gravacao[]) => {
    for (const g of gravacoes) {
      const proximo = g.proximo(get<unknown>(g.chave, undefined));
      if (proximo === undefined) continue;
      set(g.chave, proximo);
      avisarEscritaDeFora(g.chave, proximo);
    }
  };
  /** 1 gasto, 1 vez: o mesmo item (mesmo id) tocado de novo — ou o 2º toque de um toque duplo — não grava.
   *  Devolve a lista nova, ou null quando não anotou. */
  const anotar = (g: GastoDoNumero, gravacoes: Gravacao[], acao: "chip" | "outro"): GastoDoNumero[] | null => {
    if (anotando.current.has(g.id) || gastos.some((x) => x.id === g.id)) return null;
    anotando.current.add(g.id);
    try { aplicar(gravacoes); } catch { anotando.current.delete(g.id); return null; } // a tela nunca derruba o módulo
    const novos = [...gastos, g];
    setGastos(novos);
    guardarTelaDoNumero({ conta: criadoEm ?? "", dia: localDayKey(hoje), renda, faixa, contas, cartao, gastos: novos });
    evNumero({ acao, ms: msDesdeOView(), ...(acao === "chip" ? { chip: g.nome } : {}) });
    return novos;
  };
  const tocarChipDoNumero = (c: ChipDaMissao) => {
    const item = itemDoChip("gasto", c);
    if (!item) return;
    anotar({ id: idDoItem(item), nome: item.nome, emoji: c.emoji, valor: item.valor ?? 0 }, gravacoesDoChip(item, c, hoje), "chip");
  };
  const itemDoOutro = normalizarItem({ tipo: "gasto", nome: outroNome, valor: outroValor });
  const campoDoValor = useRef<HTMLInputElement>(null);
  const fecharOutro = () => { setAbrirOutro(false); setOutroNome(""); setOutroValor(0); };
  const anotarOutro = (): GastoDoNumero[] | null => {
    if (!itemDoOutro) return null;
    const novos = anotar({ id: idDoItem(itemDoOutro), nome: itemDoOutro.nome, emoji: "🧾", valor: itemDoOutro.valor ?? 0 }, gravacoesDoItem(itemDoOutro, hoje, "conta"), "outro");
    if (novos) fecharOutro();
    return novos;
  };
  /** "Ver no meu mês →" / "Ver minhas Finanças". Com o "✎ outro" preenchido e o botão grande tocado direto (o
   *  "Anotar" ficou pra trás — com o teclado aberto, o botão grande fica logo acima dele): anota antes de sair. */
  const verFinancas = () => {
    if (saiu.current) return;
    const lista = abrirOutro && itemDoOutro ? anotarOutro() ?? gastos : gastos;
    sair(lista.length ? { nome: lista[0].nome } : undefined);
  };
  /** Saiu da tela do número (o botão ou "Ainda não gastei"): ela não volta mais. Uma vez só (toque duplo no
   *  botão não chama o `onPronto` duas vezes). */
  const saiu = useRef(false);
  const sair = (primeiroGasto?: { nome: string } | null) => {
    if (saiu.current) return;
    saiu.current = true;
    fecharTelaDoNumero();
    onPronto?.({
      contas: resultado.contas, porDia: resultado.porDia, semFolga: resultado.semFolga, cartao: resultado.cartao,
      ...(primeiroGasto !== undefined ? { primeiroGasto } : {}),
    });
  };
  const aindaNaoGastei = () => {
    if (saiu.current) return;
    evNumero({ acao: "ainda_nao", ms: msDesdeOView() });
    sair(null);
  };
  const gastoDeHoje = gastos.reduce((t, g) => t + g.valor, 0);
  const praHoje = comPostIt && gastos.length > 0 && !resultado.semFolga;
  const sobra = sobraPraHoje(resultado.porDia, gastoDeHoje);
  const numeroNaTela = useNumeroQueCai(praHoje ? Math.max(0, sobra) : resultado.porDia, praHoje);
  const idsDosChips = new Set(CHIPS_DO_NUMERO.map((c) => { const i = itemDoChip("gasto", c); return i ? idDoItem(i) : c.nome; }));
  const anotadosAMao = gastos.filter((g) => !idsDosChips.has(g.id));
  /** "R$ 58" que nunca quebra no meio (o "R$" sozinho no fim da linha parecia valor cortado) */
  const rs = (v: number) => `R$\u00a0${reais(v)}`;
  const fraseDosGastos = gastos.length === 0 ? null : (
    <>
      {gastos.length === 1 ? <span aria-hidden>{gastos[0].emoji} </span> : null}
      <b>
        {gastos.length === 1
          ? `${gastos[0].nome} · ${rs(gastos[0].valor)}`
          : `${gastos.slice(0, -1).map((g) => g.nome).join(", ")} e ${gastos[gastos.length - 1].nome} · ${rs(gastoDeHoje)}`}
      </b>
      {gastos.length === 1 ? " já está nas suas Finanças." : " já estão nas suas Finanças."}
      {!resultado.semFolga && (
        sobra > 0 ? ` Era ${rs(resultado.porDia)} por dia — hoje sobram ${rs(sobra)}.`
          : sobra === 0 ? ` Era ${rs(resultado.porDia)} por dia — hoje já foi tudo.`
            : ` Era ${rs(resultado.porDia)} por dia — hoje já passou ${rs(-sobra)}.`
      )}
    </>
  );

  const cabecalho = (
    <header className="mf-cab">
      <DollarSign className="mf-cab-icone" aria-hidden />
      <span className="mf-cab-nome">FINANÇAS</span>
      <span className="mf-cab-mes">{mesCurto(hoje)}</span>
    </header>
  );
  const barra = (n: number) => (
    <div className="mf-barra" aria-hidden>{[1, 2, 3].map((i) => <i key={i} {...(i <= n ? { "data-on": "" } : {})} />)}</div>
  );

  if (cedeu) return null;
  return (
    <div ref={folha} className="mf" role="dialog" aria-modal="true" aria-label="Vamos montar suas finanças" data-testid="montar-financas" data-etapa={etapa} data-folha={`montar-financas:${etapa}`}>
      {cabecalho}
      <div className="mf-corpo">
        {etapa === "renda" && (
          <>
            {barra(1)}
            <div className="mf-q">
              <div className="mf-kicker">Vamos montar suas finanças · 1 de 3</div>
              <h2>Quanto entra por mês, mais ou menos?</h2>
              <p>Só pra calcular quanto dá pra gastar por dia. Dá pra mudar depois.</p>
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
                <p>{faixa ? "Um valor de partida — ajusta pro número certo se quiser." : "Salário, freela, pensão… o que entra no mês."}</p>
              </div>
            </div>
            <div className="mf-rodape">
              <button type="button" className="mf-cta" disabled={renda <= 0} onClick={() => irPara("contas")}>Continuar</button>
              <button type="button" className="mf-pular" onClick={pular}>Pular</button>
            </div>
          </>
        )}

        {etapa === "contas" && (
          <>
            {barra(2)}
            <div className="mf-q">
              <div className="mf-kicker">2 de 3
                <button type="button" className="mf-voltar" onClick={() => setEtapa("renda")}><ArrowLeft size={14} aria-hidden /><span>Voltar</span></button>
              </div>
              <h2>Quais contas chegam todo mês?</h2>
              <p>Toca nas que você tem. Cada uma já vem com um valor típico, que você ajusta. A fatura do cartão vem depois.</p>
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
            <div className="mf-rodape">
              <button type="button" className="mf-cta" onClick={() => irPara("cartao")}>
                {nValidas > 0 ? "Continuar" : "Não tenho conta fixa"}
              </button>
              <button type="button" className="mf-pular" onClick={pular}>Pular</button>
            </div>
          </>
        )}

        {etapa === "cartao" && (
          <>
            {barra(3)}
            <div className="mf-q">
              <div className="mf-kicker">3 de 3
                <button type="button" className="mf-voltar" onClick={() => setEtapa("contas")}><ArrowLeft size={14} aria-hidden /><span>Voltar</span></button>
              </div>
              <h2>Você usa cartão de crédito?</h2>
              <p>Assim a fatura já entra na conta e o CORE te avisa antes de vencer.</p>
            </div>
            <div className="mf-chips" data-grade="">
              <button type="button" className="mf-chip" aria-pressed={cartao.usa === true} onClick={() => mudarCartao({ usa: true })}>💳 Uso cartão</button>
              <button type="button" className="mf-chip" aria-pressed={cartao.usa === false} onClick={() => montar({ ...cartao, usa: false })}>Não uso cartão</button>
            </div>
            {cartao.usa === true && (
              <div className="mf-folha" data-testid="montar-cartao">
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
                  <span className="mf-rotulo" aria-hidden>Fatura deste mês, mais ou menos</span>
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
            <div className="mf-rodape">
              <button type="button" className="mf-cta" disabled={!cartaoCompleto(cartao)} onClick={() => montar()}>Ver quanto posso gastar</button>
              <button type="button" className="mf-pular" onClick={() => montar({ ...cartao, usa: null }, true)}>Pular</button>
            </div>
          </>
        )}

        {etapa === "montando" && (
          <div className="mf-montando" aria-live="polite">
            <div className="mf-orbe" aria-hidden><div><DollarSign size={38} /></div></div>
            <h2>Montando suas finanças…</h2>
            <div className="mf-passos">
              <div className="mf-passo" style={{ animationDelay: "150ms" }}><i><Check size={13} strokeWidth={3} /></i>Renda de R$ {reais(renda)} no mês</div>
              <div className="mf-passo" style={{ animationDelay: "600ms" }}><i><Check size={13} strokeWidth={3} /></i>
                {nValidas === 0 ? "Sem contas fixas por enquanto" : nValidas === 1 ? "1 conta fixa anotada" : `${nValidas} contas fixas anotadas`}
              </div>
              {resultado.cartao && cartao.dia && (
                <div className="mf-passo" style={{ animationDelay: "1050ms" }}><i><Check size={13} strokeWidth={3} /></i>
                  {faturaPaga ? `${faturaNaTela}: paga este mês` : `${faturaNaTela}: dia ${cartao.dia}`}
                </div>
              )}
              <div className="mf-passo" data-esperando="" style={{ animationDelay: resultado.cartao ? "1500ms" : "1050ms" }}><i />Calculando quanto dá por dia</div>
            </div>
          </div>
        )}

        {etapa === "pronto" && (
          <>
            <div className="mf-pronto" data-testid="montar-pronto">
              <div className="mf-grande" data-pra-hoje={praHoje ? "" : undefined}>
                <small>VOCÊ PODE GASTAR HOJE</small>
                {praHoje ? (
                  <strong data-testid="montar-pra-hoje" data-valor={Math.max(0, sobra)}>
                    {/* leitor de tela: a frase inteira (aria-label num <strong> não é lido no VoiceOver) */}
                    <span className="sr-only">{`Era R$ ${reais(resultado.porDia)} por dia; sobram R$ ${reais(Math.max(0, sobra))} pra hoje`}</span>
                    <s className="mf-antes" aria-hidden>{rs(resultado.porDia)}</s>
                    <span aria-hidden>{rs(numeroNaTela)}</span><em aria-hidden>pra hoje</em>
                  </strong>
                ) : (
                  <strong data-testid="montar-por-dia">R$ {reais(resultado.porDia)}<em>por dia</em></strong>
                )}
                <p>
                  {praHoje ? fraseDosGastos : resultado.semFolga
                    ? resultado.cartao
                      ? "Suas contas fixas e a fatura já levam a renda do mês inteira. Nas suas Finanças dá pra ver onde apertar."
                      : "Suas contas fixas já levam a renda do mês inteira. Nas suas Finanças dá pra ver onde apertar."
                    : resultado.dias === 1
                      ? `Hoje é o último dia do mês — já tirando as contas fixas${resultado.cartao ? " e a fatura" : ""}.`
                      : `até o fim do mês (${resultado.dias} dias, contando hoje), já tirando as contas fixas${resultado.cartao ? " e a fatura" : ""}.`}
                </p>
              </div>
              {comPostIt && (
                <div className="mf-postit" data-testid="montar-postit-gasto" data-anotado={gastos.length ? "" : undefined}>
                  <span className="mf-postit-fita" aria-hidden />
                  <div className="mf-postit-papel">
                    <span className="mf-postit-rotulo">{gastos.length ? "Anotado ✓" : "E hoje · 1 toque"}</span>
                    <span className="mf-postit-pergunta">{gastos.length > 1 ? "Gastos de hoje no lugar." : gastos.length ? "Primeiro gasto no lugar." : "Já gastou com alguma coisa hoje?"}</span>
                    <span className="mf-postit-texto">
                      {gastos.length
                        ? resultado.semFolga ? fraseDosGastos : "A cada gasto que você anota, o quanto sobra pra hoje se ajusta sozinho."
                        : "Toca num e ele já entra nas suas Finanças. Dá pra mudar depois."}
                    </span>
                    <div className="mf-postit-chips">
                      {CHIPS_DO_NUMERO.map((c) => {
                        const item = itemDoChip("gasto", c);
                        const feito = !!item && gastos.some((g) => g.id === idDoItem(item));
                        return (
                          <button key={c.nome} type="button" className="mf-postit-chip" aria-pressed={feito} data-feito={feito ? "" : undefined}
                            aria-label={`${c.nome}, R$ ${reais(c.valor ?? 0)}${feito ? ", anotado" : ""}`} onClick={() => tocarChipDoNumero(c)}>
                            {feito ? <Check size={16} strokeWidth={3.5} aria-hidden /> : <span aria-hidden>{c.emoji}</span>}
                            <span>{c.nome}</span><span className="mf-postit-valor">· {rs(c.valor ?? 0)}</span>
                          </button>
                        );
                      })}
                      {anotadosAMao.map((g) => (
                        <span key={g.id} className="mf-postit-chip" data-feito="" aria-label={`${g.nome}, R$ ${reais(g.valor)}, anotado`}>
                          <Check size={16} strokeWidth={3.5} aria-hidden /><span>{g.nome}</span><span className="mf-postit-valor">· {rs(g.valor)}</span>
                        </span>
                      ))}
                      {!abrirOutro && (
                        <button type="button" className="mf-postit-outro" onClick={() => setAbrirOutro(true)}>✎ outro</button>
                      )}
                    </div>
                    {abrirOutro && (
                      <div className="mf-postit-form" data-testid="montar-outro-gasto">
                        <input className="mf-postit-nome" aria-label="Com o que você gastou" placeholder="Com o quê?" maxLength={40} autoFocus
                          value={outroNome} onChange={(e) => setOutroNome(e.target.value)} enterKeyHint="next"
                          onKeyDown={(e) => { if (e.key === "Enter") { if (itemDoOutro) anotarOutro(); else campoDoValor.current?.focus(); } }} />
                        <label className="mf-postit-quanto">
                          <small>R$</small>
                          <input ref={campoDoValor} aria-label="Quanto foi, em reais" inputMode="numeric" enterKeyHint="done" placeholder="0"
                            value={outroValor ? reais(outroValor) : ""} onChange={(e) => setOutroValor(reaisDigitados(e.target.value))}
                            onKeyDown={(e) => { if (e.key === "Enter") anotarOutro(); }} />
                        </label>
                        <button type="button" className="mf-postit-anotar" disabled={!itemDoOutro} onClick={() => anotarOutro()}>Anotar</button>
                        <button type="button" className="mf-postit-fechar" aria-label="Fechar" onClick={fecharOutro}><X size={15} aria-hidden /></button>
                      </div>
                    )}
                    {gastos.length === 0 && (
                      <button type="button" className="mf-postit-ainda-nao" onClick={aindaNaoGastei}>Ainda não gastei nada hoje →</button>
                    )}
                  </div>
                </div>
              )}
              <div className="mf-folha">
                <div className="mf-faixa">🧾 A conta do seu mês</div>
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
              </div>
              <p className="mf-salvo"><i><Check size={15} strokeWidth={3} /></i>Já está tudo nas suas Finanças. Dá pra mudar quando quiser.</p>
            </div>
            <div className="mf-rodape">
              <button type="button" className="mf-cta" onClick={verFinancas}>
                {gastos.length || (abrirOutro && itemDoOutro) ? "Ver no meu mês →" : "Ver minhas Finanças"}
              </button>
            </div>
          </>
        )}
      </div>
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
