import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useUserData } from "@/hooks/use-user-data";
import { entrada, MOV, saidaCalmaDe } from "@/lib/movimento";
import { tourHomeQuando } from "@/lib/dia1-cheio";
import { trackEvent } from "@/lib/analytics";
import type { LifeHubData } from "@/hooks/use-life-hub-data";
import { WIDGET_CATALOG, type WidgetId } from "@/hooks/use-home-widgets";
import { MODULOS } from "@/lib/modulos";
import { CATALOGO_PENDENCIAS, CHAVE_PENDENCIAS_PREFS, PREFS_PADRAO, ocultar, type TipoPendencia } from "@/lib/home-pendencias";
import { EVENTO_MISSAO_COMPLETA, EVENTO_MISSAO_DOSES, MODULOS as MODULOS_DA_MISSAO, ehUmPorDia, lerMissao, passoPendente, type EstadoMissaoDoses } from "@/lib/missao-doses";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import { abrirAcaoRapida } from "@/components/home/QuickActions";
import { anotarAcaoRapida } from "@/lib/intro-modulo";
import { alvoDaMissao, gravacoesDoChip, itemDoChip, type ChipDaMissao } from "@/components/demo-guiada/alvos";
import { avisarEscritaDeFora } from "@/hooks/use-persisted-state";
import { CHAVE_TOUR_FEITO, EVENTO_MODULOS_EDITAR, EVENTO_MODULOS_OCULTAR, EVENTO_PENDENCIAS_ABRIR, EVENTO_TOUR_HOME_FIM, avisar, deveMostrarTourHome, marcarTourFeito, registrarTourVisto, tourFeito, tourFeitoNesteAparelho, tourHomeLigado } from "@/lib/tour-home";

/**
 * O ENCAIXE DO TOUR (1.0.14): a Home pergunta "mostro o tour agora?" e a resposta
 * muda quando a missão em doses anda — a 3ª dose feita, a folha "Plano de amanhã"
 * combinada, "O que você construiu" fechado. Este hook relê `deveMostrarTourHome`
 * nesses eventos (`missao-doses:mudou`, `missao-doses:completa`) e quando outra
 * guia sai da tela, e só diz "sim" quando NÃO há outra camada de guia montada
 * (`[data-camada-guia]`: a folha do plano, a festa da dose, o holofote) — a folha
 * "Plano de amanhã" tem prioridade sobre o tour. Fluxo esperado na conta nova:
 * funil → paywall → teste → missão (3 doses) → plano de amanhã → tour (5 passos) →
 * festa "Casa arrumada". Quem pulou a missão: tour direto.
 */
const OUTRA_CAMADA = '[data-camada-guia]:not([data-camada-guia="tour-home"])';
/** 1.0.17 (dono 19/10): o tour nunca entra colado em outra tela — a Home tem que ficar parada, SEM outra camada de guia
 *  (festa, véu da passagem, folha, intro), por este tempo antes de ele entrar. */
export const RESPIRO_ANTES_DO_TOUR_MS = 1500;
export function useTourDaHome(criadoEm: string | null | undefined, ligado = true): boolean {
  const [tick, setTick] = useState(0);
  /** a Home está quieta (nenhuma outra camada) há RESPIRO_ANTES_DO_TOUR_MS — só aí o tour pode entrar */
  const [quieta, setQuieta] = useState(false);
  const { get, loaded } = useUserData();
  // 1.0.16 (4.8): a marca da CONTA também vale — reinstalou ou trocou de aparelho, o tour não volta. Vista a marca
  // da conta, o aparelho guarda a dele (a próxima abertura nem precisa esperar o dado da conta).
  const feitoNaConta = loaded && tourFeito(get) && !tourFeitoNesteAparelho();
  useEffect(() => { if (feitoNaConta) marcarTourFeito(); }, [feitoNaConta]);
  // com a chave desligada (ou o tour já feito aqui) o hook não escuta nada: custo zero pra quem não vai ver o tour.
  // Sem o dado da conta carregado ainda, espera (a marca da conta pode estar a caminho)
  const pertinente = ligado && tourHomeLigado() && !tourFeitoNesteAparelho() && !feitoNaConta && loaded;
  useEffect(() => {
    if (!pertinente) return;
    const reler = () => setTick((t) => t + 1);
    window.addEventListener(EVENTO_MISSAO_DOSES, reler);
    window.addEventListener(EVENTO_MISSAO_COMPLETA, reler);
    // a folha do plano / a festa desmontam sem evento próprio: um relógio curto confere a camada —
    // e só re-renderiza a Home quando a camada APARECE ou SOME (nunca a cada tique)
    let bloqueado = !!document.querySelector(OUTRA_CAMADA);
    let livreDesde = bloqueado ? null as number | null : Date.now();
    const relogio = window.setInterval(() => {
      const agora = !!document.querySelector(OUTRA_CAMADA);
      if (agora) { livreDesde = null; setQuieta(false); } else if (livreDesde === null) livreDesde = Date.now();
      if (livreDesde !== null && Date.now() - livreDesde >= RESPIRO_ANTES_DO_TOUR_MS) setQuieta(true);
      if (agora !== bloqueado) { bloqueado = agora; reler(); }
    }, 250);
    return () => { window.removeEventListener(EVENTO_MISSAO_DOSES, reler); window.removeEventListener(EVENTO_MISSAO_COMPLETA, reler); window.clearInterval(relogio); };
  }, [pertinente]);
  if (!pertinente || !quieta) return false;
  void tick;
  if (!deveMostrarTourHome(criadoEm)) return false;
  try { if (document.querySelector(OUTRA_CAMADA)) return false; } catch { /* sem DOM */ }
  return true;
}
import { FigurinhaPlaceholder } from "@/components/cartoes-modulo/CartoesDoModulo";

/**
 * "SUA HOME EM 5 PASSOS" (10/10, protótipo atrás de `TOUR_HOME`, lib/tour-home).
 *
 * Overlay por cima da Home REAL — sem véu (o foco é o app, não o botão: a lição
 * do holofote de 27/07): o anel fino (o do holofote, grafite) acende a área do
 * passo e o balão MAGENTA (--accent, a cor da marca) explica em uma frase e oferece UMA ação de 1 toque ou "Deixar como está". Não
 * existe "pular tudo": são 5 toques e acabou. Bolinhas "2 de 5" e o canto da
 * figurinha (placeholder). Quando aparece é decisão de `deveMostrarTourHome`
 * (a Home chama); aqui só o tour em si.
 *
 *   1. Seu score — anel aceso; "O que conta ponto" abre a tabela dos 12 blocos;
 *   2. Pendências de hoje — a lista abre (acende o "⋯"); esconder um tipo grava
 *      em `home-pendencias-prefs` (a mesma chave do "Não mostrar isso");
 *   3. Ações rápidas — "+1 copo d'água" é a MESMA ação do botão (abrirAcaoRapida);
 *   4. Widgets — "Adicionar widget" aceso; adiciona 1 (addWidget da Home);
 *   5. Módulos — a engrenagem abre por evento; esconder um módulo vai pelo
 *      ModuleDrawer (uma fonte só da preferência). Módulo oculto deixa de cobrar
 *      pendência (regra derivada, MODULO_OCULTA_PENDENCIAS).
 *
 * No fim: `core-home-tour-done` no aparelho (1x) e na conta (o adesivo comum
 * "Casa arrumada" abre pelo caminho de sempre dos Momentos — a festa espera o
 * overlay sair, porque ele leva `data-camada-guia`).
 *
 * Eventos: home_tour_visto · home_tour_passo {indice, total, acao} · home_tour_concluido.
 */

interface Rect { top: number; left: number; width: number; height: number }
/* 10/10 (dono: "o balão parece só informativo, a pessoa não sabe como ir pro próximo passo"): cada passo
 * termina com a INSTRUÇÃO de ação em negrito, no imperativo (`faca`), o alvo pulsa com um dedinho 👆, o
 * balão sempre tem um botão primário ("Fazer isso" acende o alvo; no último, "Concluir missão") e o
 * resto da Home fica escurecido (55%) com só o alvo e o balão nítidos. */
/* 10/10, dono: o passo do SCORE é só de LEITURA (tocar no anel abre Conquistas — não é o caminho); o botão
 * primário de TODOS os passos é "Continuar" e sempre avança (ninguém fica preso); fazer a ação de verdade
 * também avança, com "✓ Pronto!"; no último, "Concluir missão". */
const PASSOS_LONGO = [
  { alvo: "score", titulo: "Seu score do dia", texto: "O anel soma o que você já fez hoje. Cada registro conta ponto — e 100 é dia fechado.", faca: "" },
  { alvo: "pendencias", titulo: "Pendências de hoje", texto: "É a lista do que falta — e o score só cobra o que está nela.", faca: "Toque no ⋯ de uma linha e esconda o que não usa" },
  { alvo: "acoes-rapidas", titulo: "Ações rápidas", texto: "Um toque registra água, humor, gasto, sono… sem entrar no módulo.", faca: "Toque em +1 copo d'água" },
  { alvo: "adicionar-widget", titulo: "Widgets", texto: "Mostre na Home o que você olha todo dia (saldo, hábitos, água).", faca: "Toque em + Adicionar widget e escolha um" },
  { alvo: "modulos", titulo: "Módulos", texto: "Na engrenagem você esconde o que não usa. Módulo escondido não cobra pendência.", faca: "Toque na engrenagem e esconda um módulo" },
] as const;
/**
 * 1.0.16 — O TOUR CURTO (braço A, desenho 8 seção 7c): 3 passos, ~30 s, logo depois da dose 1. 2 de 3 são
 * "faz isso": o gasto pelo chip das ações rápidas é um registro de verdade (ou pelo botão real "Registrar
 * Gasto" — conta igual); esconder módulos ataca o "informação demais". Cada passo tem a saída de texto
 * ("Deixar como está" / "Deixar todos"); sem "pular tudo". Score e widgets viram as dicas de 1 balão dos
 * dias 2 e 3 (components/missao-doses/DicaDoDia).
 *
 * Passo 1 com a VERDADE: o que o Montar grava (renda, contas fixas) não vira pendência — então o balão não diz
 * "o que você montou já está aí". Ele mostra a lista e conta o que vem: a dose de amanhã aparece NESSA lista.
 */
export function passosDoTourCurto(m: EstadoMissaoDoses | null): PassoDoTour[] {
  const prox = m && ehUmPorDia(m) && !m.explorou ? passoPendente(m) : null;
  const cfg = prox ? MODULOS_DA_MISSAO[prox.modulo] : null;
  return [
    {
      alvo: "pendencias",
      // 1.0.17 (dono: "minimalista"): título de uma linha + no máximo uma frase curta
      titulo: "O que falta hoje.",
      texto: cfg ? `Amanhã, ${cfg.emoji} ${cfg.nome} aparece aqui.` : "Tocou, resolveu.",
      faca: "",
    },
    { alvo: "acoes-rapidas", titulo: "Anote sem abrir o módulo.", texto: "Um toque e o gasto entra.", faca: "Toque no gasto de agora" },
    { alvo: "modulos", titulo: "Esconda o que não usa.", texto: "Dá pra trazer de volta.", faca: "Toque nos que quer esconder" },
  ];
}
type PassoDoTour = { alvo: string; titulo: string; texto: string; faca: string };
/** Os mesmos 3 gastos prontos da dose de Finanças (alvos.ts). */
const CHIPS_DO_TOUR: ChipDaMissao[] = alvoDaMissao("gasto").chips;
/** "✓ Pronto!" fica na tela por isto depois de uma ação feita (o passo já avançou). */
export const PRONTO_MS = 600;
/** 1.0.17: o alvo do passo parado por este tempo = assentou (a lista abriu, a rolagem acabou) → o balão entra */
export const ASSENTA_MS = 240;
export const ASSENTA_TETO_MS = 1600;
export const TOTAL_PASSOS = PASSOS_LONGO.length;
export const TOTAL_PASSOS_CURTO = 3;
const PADDING = 8;

export const TourDaHome = ({ lifeData, widgetsAtivos, adicionarWidget, onFim, variante = "longo" }: {
  lifeData: LifeHubData;
  widgetsAtivos: WidgetId[];
  adicionarWidget: (id: WidgetId) => void;
  onFim?: () => void;
  /** 1.0.16: "curto" = 3 passos (braço A); "longo" = os 5 de sempre */
  variante?: "curto" | "longo";
}) => {
  // o curto lê a missão UMA vez (o texto do passo 1 não muda no meio do tour)
  const [passosCurto] = useState(() => passosDoTourCurto((() => { try { return lerMissao(); } catch { return null; } })()));
  const PASSOS: readonly PassoDoTour[] = variante === "curto" ? passosCurto : PASSOS_LONGO;
  const TOTAL = PASSOS.length;
  const { get, set } = useUserData();
  const reduzir = useReducedMotion();
  const [passo, setPasso] = useState(0);
  const [ativo, setAtivo] = useState(true);
  const [rect, setRect] = useState<Rect | null>(null);
  const [verPontos, setVerPontos] = useState(false);
  const balaoRef = useRef<HTMLDivElement>(null);
  const [alturaBalao, setAlturaBalao] = useState(0);
  /** "✓ Pronto!" (600 ms) depois de uma ação feita — o passo já avançou por baixo */
  const [pronto, setPronto] = useState(false);
  /** 17/10: o relógio do "✓ Pronto!" — desligado ao desmontar (antes disparava com o tour já fora da tela) */
  const timerPronto = useRef<number | null>(null);
  useEffect(() => () => { if (timerPronto.current !== null) window.clearTimeout(timerPronto.current); }, []);
  /** uma folha/modal do app aberta (ex.: "Widgets da Home" pelo botão real): o tour se esconde e volta ao fechar */
  const [folhaAberta, setFolhaAberta] = useState(false);
  const widgetsAoEntrar = useRef(widgetsAtivos.length);
  const prefsRef = useRef<string | null>(null);
  const ocultosRef = useRef<number | null>(null);

  /* 1.0.16 (defeito 13): `home_tour_visto` disparava no mount, antes de o tour aparecer (135 "viram" × 44
     começaram). Agora sai só quando a camada está VISÍVEL de fato: o alvo medido e nenhuma folha por cima. */
  const vistoRef = useRef(false);
  useEffect(() => { widgetsAoEntrar.current = widgetsAtivos.length; }, [passo]); // eslint-disable-line react-hooks/exhaustive-deps

  // a ação feita NO APP (pelo ⋯ real, pela engrenagem real) avança o passo como se fosse pelo balão
  const prefsTxt = JSON.stringify(lifeData.pendenciasPrefs ?? null);
  const ocultosN = ((get<{ hidden?: unknown } | null>("core-module-prefs", null)?.hidden ?? []) as unknown[]).length;
  // 1.0.16 (curto): o gasto pelo botão REAL "Registrar Gasto" conta como o passo feito (a folha fecha → avança)
  const gastosN = (() => { const g = get<unknown>("finance-expenses", []); return Array.isArray(g) ? g.length : 0; })();
  const gastosRef = useRef<number | null>(null);
  useEffect(() => {
    if (!ativo) return;
    const alvo = PASSOS[passo].alvo;
    if (alvo === "pendencias" && prefsRef.current !== null && prefsRef.current !== prefsTxt) avancarRef.current("ocultar:app");
    if (alvo === "modulos" && ocultosRef.current !== null && ocultosN > ocultosRef.current) avancarRef.current("modulo:app");
    if (alvo === "adicionar-widget" && widgetsAtivos.length > widgetsAoEntrar.current && !folhaAberta) avancarRef.current("widget:app");
    if (variante === "curto" && alvo === "acoes-rapidas" && gastosRef.current !== null && gastosN > gastosRef.current && !folhaAberta) avancarRef.current("gasto:app");
    prefsRef.current = prefsTxt;
    ocultosRef.current = ocultosN;
    if (!(variante === "curto" && alvo === "acoes-rapidas" && folhaAberta)) gastosRef.current = gastosN;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ativo, passo, prefsTxt, ocultosN, widgetsAtivos.length, folhaAberta, gastosN]);
  useEffect(() => { prefsRef.current = prefsTxt; ocultosRef.current = ocultosN; gastosRef.current = gastosN; }, [passo]); // eslint-disable-line react-hooks/exhaustive-deps

  // o tour NUNCA fica por cima de uma folha/modal do app (Radix/vaul abertos): some enquanto ela estiver
  // aberta e volta ao fechar — já no passo seguinte se ela fez a ação lá dentro (adicionou um widget)
  useEffect(() => {
    if (!ativo) return;
    const aberta = () => !!document.querySelector('[data-state="open"][role="dialog"]:not([data-testid="tour-balao"]), [data-vaul-drawer][data-state="open"]');
    let estava = aberta();
    setFolhaAberta(estava);
    const t = setInterval(() => {
      const agora = aberta();
      if (agora === estava) return;
      estava = agora;
      setFolhaAberta(agora);
      if (!agora && PASSOS[passo].alvo === "adicionar-widget" && widgetsAtivos.length > widgetsAoEntrar.current) avancarRef.current("widget:folha");
    }, 400);
    return () => clearInterval(t);
  }, [ativo, passo, widgetsAtivos.length]);

  // ao entrar no passo: abre o que precisa estar aberto e rola o alvo pro centro
  useEffect(() => {
    if (!ativo) return;
    const atual = PASSOS[passo];
    if (atual.alvo === "pendencias") avisar(EVENTO_PENDENCIAS_ABRIR);
    if (atual.alvo === "modulos") avisar(EVENTO_MODULOS_EDITAR, { editar: true });
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-tour="${atual.alvo}"]`) as HTMLElement | null;
      try { el?.scrollIntoView({ block: "center", behavior: reduzir ? "auto" : "smooth" }); } catch { /* jsdom */ }
    }, 80);
    // 1.0.16 (curto): no passo das ações rápidas, a faixa rola pro lado até o "Registrar Gasto" aparecer inteiro
    const t2 = variante === "curto" && atual.alvo === "acoes-rapidas" ? setTimeout(() => {
      const gasto = document.querySelector('[data-acao-rapida="expense"]') as HTMLElement | null;
      const faixa = gasto?.parentElement;
      try { if (gasto && faixa) faixa.scrollTo({ left: Math.max(0, gasto.offsetLeft - 16), behavior: reduzir ? "auto" : "smooth" }); } catch { /* jsdom */ }
    }, 450) : undefined;
    return () => { clearTimeout(t); if (t2) clearTimeout(t2); };
  }, [passo, ativo, reduzir]);

  // mede o alvo: no máximo 1x por quadro durante a rolagem + relógio de 250 ms (a receita do holofote)
  useEffect(() => {
    if (!ativo) return;
    const sel = `[data-tour="${PASSOS[passo].alvo}"]`;
    let raf = 0;
    const medir = () => {
      const el = document.querySelector(sel) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      setRect((a) => (a && a.top === r.top && a.left === r.left && a.width === r.width && a.height === r.height ? a : { top: r.top, left: r.left, width: r.width, height: r.height }));
    };
    const aoRolar = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; medir(); }); };
    medir();
    const relogio = setInterval(medir, 250);
    window.addEventListener("scroll", aoRolar, true);
    window.addEventListener("resize", aoRolar);
    return () => { clearInterval(relogio); if (raf) cancelAnimationFrame(raf); window.removeEventListener("scroll", aoRolar, true); window.removeEventListener("resize", aoRolar); };
  }, [passo, ativo]);

  /* 1.0.17 (gravação no Simulador, 20/10): no passo 1 a lista de Pendências abre e a página rola até ela — o balão entrava
     NO MEIO disso, desenhado por cima do cabeçalho da lista, e pulava pro lugar ~0,2 s depois. Agora o balão (e, no 1º
     passo, o tour inteiro) só aparece quando o alvo ASSENTA: a mesma posição por ASSENTA_MS (teto de ASSENTA_TETO_MS). */
  const [assentado, setAssentado] = useState(false);
  useEffect(() => {
    if (!ativo) return;
    setAssentado(false);
    const sel = `[data-tour="${PASSOS[passo].alvo}"]`;
    const t0 = Date.now();
    let ult = "", desde = t0;
    const relogio = window.setInterval(() => {
      const el = document.querySelector(sel) as HTMLElement | null;
      const agora = Date.now();
      if (el) {
        const r = el.getBoundingClientRect();
        const k = `${Math.round(r.top)}|${Math.round(r.left)}|${Math.round(r.width)}|${Math.round(r.height)}`;
        if (k !== ult) { ult = k; desde = agora; }
      } else desde = agora;
      if ((el && agora - desde >= ASSENTA_MS) || agora - t0 >= ASSENTA_TETO_MS) { window.clearInterval(relogio); setAssentado(true); }
    }, 60);
    return () => window.clearInterval(relogio);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passo, ativo]);

  useLayoutEffect(() => {
    const h = balaoRef.current?.getBoundingClientRect().height ?? 0;
    if (h && Math.abs(h - alturaBalao) > 1) setAlturaBalao(h);
  });

  const terminar = useCallback(() => {
    saidaCalmaDe('[data-testid="tour-home"]'); // 1.0.17: o tour sumia num quadro
    avisar(EVENTO_MODULOS_EDITAR, { editar: false });
    marcarTourFeito();
    set(CHAVE_TOUR_FEITO, new Date().toISOString());
    trackEvent("home_tour_concluido", { total: TOTAL, variante, tour_quando: tourHomeQuando() });
    setAtivo(false);
    onFim?.();
    // 10/10: a missão em doses (braço B) fecha o 4º passo dela com isto
    avisar(EVENTO_TOUR_HOME_FIM, { total: TOTAL });
  }, [set, onFim]);

  const avancar = useCallback((acao: string) => {
    trackEvent("home_tour_passo", { indice: passo, total: TOTAL, acao, variante, tour_quando: tourHomeQuando() });
    setVerPontos(false);
    // ação feita (não "Continuar"/"Concluir"): ✓ Pronto! por 600 ms — o passo avança JÁ, o selo só confirma
    if (acao !== "continuar" && acao !== "concluir" && acao !== "deixar") {
      setPronto(true);
      if (timerPronto.current !== null) window.clearTimeout(timerPronto.current);
      timerPronto.current = window.setTimeout(() => { timerPronto.current = null; setPronto(false); }, PRONTO_MS);
    }
    if (passo >= TOTAL - 1) terminar();
    else setPasso((p) => p + 1);
  }, [passo, terminar]);
  const avancarRef = useRef(avancar);
  avancarRef.current = avancar;

  useEffect(() => {
    if (vistoRef.current || !ativo || !rect || folhaAberta) return;
    vistoRef.current = true;
    registrarTourVisto(); // fechou o app no meio: volta no máximo em 2 aberturas
    trackEvent("home_tour_visto", { total: TOTAL, variante, tour_quando: tourHomeQuando() });
  }, [ativo, rect, folhaAberta, TOTAL, variante]);

  if (!ativo) return null;
  const atual = PASSOS[passo];

  /* ---- a ação de cada passo ---- */
  const prefs = lifeData.pendenciasPrefs ?? PREFS_PADRAO;
  const cobrados = new Set(lifeData.pendenciasCobradas ?? CATALOGO_PENDENCIAS.map((c) => c.tipo));
  const pendentes = (() => {
    try {
      return pendenciasDeHoje(lifeData, [], new Date()).pending.filter((p) => p.tipo).map((p) => p.tipo as TipoPendencia).slice(0, 4);
    } catch { return [] as TipoPendencia[]; }
  })();
  const widgetsLivres = WIDGET_CATALOG.filter((w) => !widgetsAtivos.includes(w.id)).slice(0, 3);
  const modulosOcultos = (get<{ hidden?: unknown } | null>("core-module-prefs", null)?.hidden ?? []) as unknown[];
  // 1.0.16 (curto): os 3 módulos da missão nunca aparecem pra esconder — esconder a Rotina na véspera da dose dela
  // seria pedir pra pessoa sumir com o plano de amanhã
  const daMissao = variante === "curto" ? ((() => { try { const m = lerMissao(); return m && !m.explorou ? (m.modulos as string[]) : []; } catch { return []; } })()) : [];
  // os 6 primeiros da grade bastam: o resto a pessoa esconde na própria engrenagem (já aberta)
  const modulosVisiveis = MODULOS.filter((m) => !modulosOcultos.includes(m.id) && !daMissao.includes(m.id)).slice(0, 6);

  const chip = "h-8 px-2.5 rounded-full text-[11.5px] font-semibold bg-white/15 border border-white/30 active:scale-95 transition whitespace-nowrap";
  const principal = "h-10 px-4 rounded-full text-[13px] font-bold bg-white text-accent active:scale-95 transition";
  const ultimo = passo >= TOTAL - 1;

  const acao = (() => {
    switch (atual.alvo) {
      case "score":
        return verPontos ? (
          <div data-testid="tour-pontos">
            <ul className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px]">
              {CATALOGO_PENDENCIAS.map((c) => (
                <li key={c.tipo} className={`flex items-center justify-between gap-2 ${cobrados.has(c.tipo) ? "" : "opacity-50 line-through"}`}>
                  <span>{c.emoji} {c.nome}</span><span className="tabular-nums font-bold">{c.pontos}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[10.5px] opacity-80">O que você escondeu sai da conta; o resto fecha em 100.</p>
            <button type="button" onClick={() => avancar("ver_pontos")} className={`${principal} mt-2.5`} data-testid="tour-entendi">Entendi</button>
          </div>
        ) : (
          <button type="button" onClick={() => setVerPontos(true)} className={principal} data-testid="tour-ver-pontos">O que conta ponto</button>
        );
      case "pendencias":
        if (variante === "curto") return null;
        return pendentes.length ? (
          <div className="flex flex-wrap gap-1.5">
            {pendentes.map((t) => {
              const c = CATALOGO_PENDENCIAS.find((x) => x.tipo === t)!;
              return (
                <button key={t} type="button" className={chip} data-testid={`tour-ocultar-${t}`}
                  onClick={() => { set(CHAVE_PENDENCIAS_PREFS, ocultar(prefs, t)); avancar(`ocultar:${t}`); }}>
                  Esconder {c.emoji} {c.nome}
                </button>
              );
            })}
          </div>
        ) : <p className="text-[12px] opacity-85">Nada pendente agora — a lista fica aqui quando precisar.</p>;
      case "acoes-rapidas":
        if (variante === "curto") {
          // os 3 gastos prontos da dose (registro de verdade, pelo mesmo caminho dos chips da missão)
          return (
            <div className="flex flex-wrap gap-1.5" data-testid="tour-gastos">
              {CHIPS_DO_TOUR.map((c) => (
                <button key={c.nome} type="button" className={chip} data-testid={`tour-gasto-${c.nome}`} onClick={() => {
                  try {
                    anotarAcaoRapida("expense", get, set); // 1.0.17: o gasto do tour não tira o tutorial de Finanças
                    const item = itemDoChip("gasto", c);
                    if (item) for (const g of gravacoesDoChip(item, c)) {
                      const prox = g.proximo(get<unknown>(g.chave, undefined));
                      if (prox === undefined) continue;
                      set(g.chave, prox); avisarEscritaDeFora(g.chave, prox);
                    }
                  } catch { /* o tour nunca derruba a Home */ }
                  avancar(`gasto:${c.nome}`);
                }}>
                  {c.emoji} {c.nome} · R$ {c.valor}
                </button>
              ))}
            </div>
          );
        }
        return (
          <button type="button" className={principal} data-testid="tour-agua" onClick={() => { abrirAcaoRapida("water"); avancar("agua"); }}>
            💧 +1 copo d'água agora
          </button>
        );
      case "adicionar-widget":
        return widgetsLivres.length ? (
          <div className="flex flex-wrap gap-1.5">
            {widgetsLivres.map((w) => (
              <button key={w.id} type="button" className={chip} data-testid={`tour-widget-${w.id}`} onClick={() => { adicionarWidget(w.id); avancar(`widget:${w.id}`); }}>
                + {w.emoji} {w.label}
              </button>
            ))}
          </div>
        ) : <p className="text-[12px] opacity-85">Sua Home já tem widgets — dá pra trocar quando quiser.</p>;
      case "modulos":
        return (
          <div data-testid="tour-modulos">
            <div className="flex flex-wrap gap-1">
              {modulosVisiveis.map((m) => (
                <button key={m.id} type="button" className={`${chip} h-7 px-2 text-[11px]`} data-testid={`tour-ocultar-modulo-${m.id}`}
                  onClick={() => { avisar(EVENTO_MODULOS_OCULTAR, { id: m.id }); avancar(`modulo:${m.id}`); }}>
                  Esconder {m.label}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[10.5px] opacity-80">Os outros: no 👁 de cada módulo, ali na grade.</p>
          </div>
        );
    }
  })();

  /* ---- posição do balão: medida, nunca por cima do alvo ---- */
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 390;
  const LARG = Math.min(330, vw - 24);
  const ESPACO = 14;
  const alt = alturaBalao || 190;
  const cabeAbaixo = rect ? rect.top + rect.height + ESPACO + alt <= vh - 8 : true;
  const cabeAcima = rect ? rect.top - alt - ESPACO >= 8 : false;
  const abaixo = rect ? (cabeAbaixo || !cabeAcima) : false;
  const topo = rect
    ? abaixo ? Math.min(vh - alt - 8, rect.top + rect.height + ESPACO) : Math.max(8, rect.top - alt - ESPACO)
    : vh - alt - 16;
  const esquerda = rect ? Math.max(12, Math.min(rect.left + rect.width / 2 - LARG / 2, vw - LARG - 12)) : (vw - LARG) / 2;
  const bicoX = rect ? Math.max(18, Math.min(rect.left + rect.width / 2 - esquerda, LARG - 18)) : LARG / 2;

  // a folha/modal do app está aberta: o tour some (volta ao fechar) — nunca um balão por cima de uma folha
  if (folhaAberta) return <div data-testid="tour-home" data-camada-guia="tour-home" data-passo={passo + 1} data-escondido="" className="hidden" />;

  return (
    <AnimatePresence>
      <motion.div key="tour-home" className="fixed inset-0 z-[200] pointer-events-none" data-camada-guia="tour-home" data-testid="tour-home" data-passo={passo + 1}
        initial={{ opacity: 0 }} animate={{ opacity: passo === 0 && !assentado ? 0 : 1 }} exit={{ opacity: 0 }} transition={entrada(reduzir, MOV.calmo)}
        data-assentado={assentado ? "" : undefined}>
        {rect && (
          <>
            {/* o escuro (55%) com o ALVO recortado: só o alvo e o balão ficam nítidos (não parece um aviso solto) */}
            <div
              className="absolute rounded-xl pointer-events-none"
              style={{ top: rect.top - PADDING, left: rect.left - PADDING, width: rect.width + PADDING * 2, height: rect.height + PADDING * 2, boxShadow: "0 0 0 9999px rgba(15,12,20,.55)" }}
              data-testid="tour-escuro"
              aria-hidden="true"
            />
            <motion.div
              key={`anel-${passo}`}
              className="absolute rounded-xl pointer-events-none"
              initial={reduzir ? false : { opacity: 0, scale: 1.03 }}
              animate={reduzir ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [1.03, 1, 1.02, 1] }}
              transition={{ duration: reduzir ? 0 : 1.1, ease: "easeOut", times: [0, 0.4, 0.7, 1] }}
              style={{ top: rect.top - PADDING, left: rect.left - PADDING, width: rect.width + PADDING * 2, height: rect.height + PADDING * 2, boxShadow: "0 0 0 2px #fff, 0 0 0 7px hsl(var(--accent) / 0.35)" }}
              data-testid="tour-anel"
            />
            {/* o dedinho 👆 aponta o alvo nos passos COM ação (anima; com prefers-reduced-motion fica parado) */}
            {atual.faca && <motion.span
              key={`dedinho-${passo}`}
              className="absolute text-[30px] leading-none pointer-events-none select-none drop-shadow-[0_6px_10px_rgba(0,0,0,.35)]"
              style={{ left: rect.left + rect.width - 34, top: rect.top + rect.height - 12 }}
              initial={reduzir ? false : { y: 6, scale: 1 }}
              animate={reduzir ? undefined : { y: [6, -4, 6], scale: [1, 0.92, 1] }}
              transition={reduzir ? undefined : { duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
              data-testid="tour-dedinho"
              aria-hidden="true"
            >👆</motion.span>}
          </>
        )}
        {pronto && (
          <motion.div key="pronto" className="absolute left-1/2 -translate-x-1/2 top-[18%] rounded-full bg-emerald-500 text-white text-[14px] font-extrabold px-4 py-2 shadow-lg pointer-events-none" initial={{ opacity: 0, y: 8, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }} data-testid="tour-pronto">
            ✓ Pronto!
          </motion.div>
        )}
        <motion.div
          key={`balao-${passo}`}
          ref={balaoRef}
          className="absolute pointer-events-auto"
          style={{ top: topo, left: esquerda, width: LARG, pointerEvents: assentado ? "auto" : "none" }}
          initial={reduzir ? false : { opacity: 0, y: abaixo ? -8 : 8 }}
          animate={assentado ? { opacity: 1, y: 0 } : { opacity: 0, y: reduzir ? 0 : abaixo ? -8 : 8 }}
          transition={entrada(reduzir, MOV.calmo, passo === 0 ? 0.25 : 0.08)}
        >
          {rect && (
            <div className="absolute w-3 h-3 bg-accent" style={{ left: bicoX, transform: "translateX(-50%) rotate(45deg)", ...(abaixo ? { top: -6 } : { bottom: -6 }) }} aria-hidden="true" />
          )}
          <div
            role="dialog"
            aria-label={`Sua Home em ${TOTAL} passos — ${passo + 1} de ${TOTAL}: ${atual.titulo}`}
            data-testid="tour-balao"
            className="relative rounded-2xl bg-accent text-accent-foreground px-4 pt-3.5 pb-3 shadow-[0_14px_40px_-14px_rgba(0,0,0,0.45)]"
          >
            <div className="absolute -top-3 -right-2 rotate-6 ct-financas [--ct-faixa:rgba(255,255,255,.95)] [--ct-acento:hsl(var(--accent))]">
              <FigurinhaPlaceholder tamanho={40} />
            </div>
            <p className="text-[10.5px] font-extrabold tracking-[.16em] uppercase opacity-85" data-testid="tour-contador">Passo {passo + 1} de {TOTAL}{ultimo ? " · último" : ` · falta ${TOTAL - passo - 1}`}</p>
            <h3 className="mt-0.5 text-[17px] font-bold leading-tight tracking-tight pr-8">{atual.titulo}</h3>
            <p className="mt-1 text-[12.5px] leading-snug opacity-90">{atual.texto}{atual.faca ? <> <b className="font-extrabold" data-testid="tour-faca">{atual.faca}.</b></> : null}</p>
            <div className="mt-3">{acao}</div>
            <div className="mt-3 flex items-center gap-1.5" aria-label={`${passo + 1} de ${TOTAL}`}>
              {PASSOS.map((p, i) => (
                <i key={p.alvo} className="block h-1.5 rounded-full bg-white transition-all" style={{ width: i === passo ? 16 : 6, opacity: i === passo ? 1 : 0.45 }} data-ativo={i === passo ? "" : undefined} />
              ))}
            </div>
            {/* o botão primário SEMPRE visível e SEMPRE avança: "Continuar"; no último passo, "Concluir missão" */}
            <button
              type="button"
              onClick={() => avancar(variante === "curto" && atual.faca ? "deixar" : ultimo ? "concluir" : "continuar")}
              className="mt-2.5 w-full h-11 rounded-full text-[14px] font-extrabold bg-white text-accent active:scale-[0.98] transition"
              data-testid={ultimo ? "tour-concluir" : "tour-continuar"}
            >
              {/* curto: o passo de "faz isso" sempre tem a saída sem fazer — "Deixar como está" / "Deixar todos" */}
              {variante === "curto" ? (ultimo ? "Deixar todos" : atual.faca ? "Deixar como está" : "Continuar") : ultimo ? "Concluir missão" : "Continuar"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
