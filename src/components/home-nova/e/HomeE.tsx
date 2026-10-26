import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { useHomeWidgetsE } from "@/hooks/use-home-widgets-e";
import { useModulePreferences } from "@/hooks/use-module-preferences";
import { useSequencia } from "@/components/conquistas/use-conquistas";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import type { ActionId } from "@/components/home/QuickActions";
import { useTheme } from "@/hooks/use-theme";
import { CHAVE_RESUMOS, normalizarResumos } from "@/lib/home-resumos";
import { EscolherWidgetsE } from "./EscolherWidgetsE";
import { PersonalizarPendenciasE } from "./PersonalizarPendenciasE";
import { DailyNudge } from "@/components/onboarding/DailyNudge";
import { CardSeuDia } from "@/components/missao-doses/CardSeuDia";
import { RetrospectivaNaHome } from "@/components/wrapped/RetrospectivaNaHome";
import { LojasCard } from "@/components/LojasCard";
import { CHAVE_PENDENCIAS_PREFS, PREFS_PADRAO, type PendenciasPrefs } from "@/lib/home-pendencias";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl } from "@/lib/saude-copo";
import { nomeDaHome } from "@/lib/nome-da-pessoa";
import { ATRIBUTO_RAIZ } from "@/lib/nav-abas";
import { CHAVE_COR_ANTES_HOME_NOVA, EVENTO_HOME_NOVA_MAIS, SUAVIDADE_HOME_NOVA, consumirMaisPendente, type SuavidadeHomeNova } from "@/lib/home-nova";
import { trackEvent } from "@/lib/analytics";
import { PilulaFogoE } from "./PilulaFogoE";
import { FolhaMaisE } from "./FolhaMaisE";
import { CarrosselDia } from "./CarrosselDia";
import { PaginaSeuDia } from "./PaginaSeuDia";
import { PaginaPendencias } from "./PaginaPendencias";
import { PaginaWidgets } from "./PaginaWidgets";
import { FolhaScore } from "./FolhaScore";
import { FolhaPendencias } from "./FolhaPendencias";
import { CelebracaoDia100E, celebracaoPendente, type VarianteCelebracao } from "./CelebracaoDia100E";
import { ContextoDaEntrada, FadeDoConjunto, marcarEntradaDaHome } from "./Animacoes";
import { ModulosE, type AzulejoE, type VarianteModulosE } from "./ModulosE";
import { OrganizarModulos } from "./OrganizarModulos";
import { useNavigate } from "react-router-dom";
import { useConquistas } from "@/components/conquistas/use-conquistas";
import { marcoDoAdesivo } from "@/components/conquistas/nova/recompensas";
import { FolhaSequencia } from "@/components/fogo/FolhaSequencia";
import { useFundoDaTelaE } from "./fundo-da-tela";
import "../home-nova.css";
import "./home-e.css";

/**
 * A HOME NOVA — OPÇÃO E (1.0.19; a Home de hoje é pages/Home.tsx, que monta ESTA quando a chave `home_nova`
 * está ligada pra conta — lib/home-nova). Aprovada pelo dono em 6 rodadas (novidades-guardadas/2026-10-25/home-nova/E).
 *
 * De cima pra baixo:
 *   1. "Boa noite, João" + a pílula do fogo chapado (apagada enquanto o dia não está garantido; acende 1x por dia)
 *      → a folha da sequência (semana real, ação do dia, próxima faixa).
 *   2. O CARROSSEL DO DIA (3 páginas, bolinhas): 1 · Seu dia — "27 pontos · Score do dia" + anel (toque abre a
 *      folha "Como funciona a pontuação") e Hábitos · Água · Refeições; 2 · Pendências de hoje (a mesma lista da
 *      Home de hoje, com a dose da missão em 1º e os mesmos destinos); 3 · Seus widgets (os que a pessoa escolhe).
 *   3. Módulos: a grade de 4, ordem/favoritos/ocultos reais; "Organizar" = a mesma configuração de hoje.
 *   4. O "+" da barra de vidro (global, BarraVidroGlobal) abre a folha das ações — que grava pelo QuickActions real.
 * O que a Home de hoje mostra por cima continua: o card "Seu dia" da missão (web), a Retrospectiva do mês, o convite
 * das lojas (só no site), a comemoração dos 100 pontos (26/10: a da E, CelebracaoDia100E), o nudge diário. O tour antigo da Home NÃO entra aqui
 * (apontava pras ações rápidas que não existem mais — pages/Home desliga o useTourDaHome com a chave ligada).
 */
interface Props {
  modulos?: VarianteModulosE;
  azulejo?: AzulejoE;
  suave?: SuavidadeHomeNova;
  /** rota de dev: abre já numa página do carrossel (0…2) */
  paginaInicial?: number;
  /** rota de dev: congela o trilho no meio do arrasto (0…1) */
  arrasto?: number | null;
  folhaScoreAberta?: boolean;
  folhaMaisAberta?: boolean;
  /** rota de dev: o número dentro do anel */
  numeroDentro?: boolean;
  /** rota de dev: força o número do score (os cards e a folha), sem gravar nada */
  scoreDev?: number | null;
  /** rota de dev: abre a comemoração do 100 já, nessa variante (sem olhar a chave do dia) */
  celebracaoDev?: VarianteCelebracao | null;
  /** rota de dev: a festinha do 100 do card toca a cada montagem */
  festaDev?: boolean;
}

export const ROTULOS_DO_CARROSSEL = ["Seu dia", "Pendências de hoje", "Seus widgets"];

const saudacao = (): string => {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export const HomeE = ({ modulos = "grade", azulejo = "tinta", suave = SUAVIDADE_HOME_NOVA, paginaInicial = 0, arrasto = null, folhaScoreAberta, folhaMaisAberta, numeroDentro, scoreDev = null, celebracaoDev = null, festaDev = false }: Props) => {
  const { user } = useAuth();
  const { get, set, loaded } = useUserData();
  const lifeDataReal = useLifeHubData();
  const lifeData = useMemo(() => (scoreDev === null ? lifeDataReal : { ...lifeDataReal, dayScore: scoreDev }), [lifeDataReal, scoreDev]);
  // 26/10: a festinha do 100 no card espera a comemoração de tela cheia (que abre por cima) — toca quando ela fecha
  const [celebrando, setCelebrando] = useState(false);
  const festaPausada = celebrando || (!celebracaoDev && celebracaoPendente(lifeData.dayScore));
  const seq = useSequencia();
  const navigate = useNavigate();
  // adendo 26/10: a faixa do relógio e a casca na cor da E (sem a faixa branca atrás do relógio)
  useFundoDaTelaE();
  // 26/10: a folha da sequência unificada mostra as figurinhas da sequência (a trilha das Conquistas, as artes do Codex)
  const conq = useConquistas();
  const trilha = useMemo(() => conq.adesivos.filter((b) => marcoDoAdesivo(b.id) !== null).sort((a, b) => marcoDoAdesivo(a.id)! - marcoDoAdesivo(b.id)!), [conq.adesivos]);
  // rodada 3: os widgets da E (lib/home-widgets-e — catálogo enxuto, card único, dado real)
  const widgetsE = useHomeWidgetsE();
  // UMA instância das preferências de módulos: a grade e a folha "Organizar" leem/gravam o mesmo estado (como o ModuleDrawer de hoje)
  const preferencias = useModulePreferences();
  // rodada 2: os 3 cards da página 1 escolhidos em Você › Personalizar início (lib/home-resumos)
  const resumos = normalizarResumos(get<unknown>(CHAVE_RESUMOS, null));
  // rodada 2 (dono): só o tema padrão com a Home nova — quem tinha outra cor volta pro Original (claro/escuro continuam)
  const { palette, setPalette } = useTheme();
  useEffect(() => {
    if (!loaded || palette === "default") return;
    // 26/10 (dono): a cor fica GUARDADA na conta (core-cor-antes-home-nova) e volta quando a chave home_nova desligar (pages/Home)
    set(CHAVE_COR_ANTES_HOME_NOVA, palette, { system: true });
    setPalette("default");
  }, [loaded, palette, setPalette, set]);
  const [folhaMais, setFolhaMais] = useState(!!folhaMaisAberta);
  const [acaoInicial, setAcaoInicial] = useState<ActionId | null>(null);
  const [folhaScore, setFolhaScore] = useState(!!folhaScoreAberta);
  const [picker, setPicker] = useState(false);
  const [prefsAbertas, setPrefsAbertas] = useState(false);
  const [organizar, setOrganizar] = useState(false);
  const [folhaSequencia, setFolhaSequencia] = useState(false);
  // rodada 3 (BUG: "Ver todas" abria a folha do score): a lista completa das pendências numa folha própria
  const [folhaPendencias, setFolhaPendencias] = useState(false);
  // rodada 3: a entrada escalonada/contagem só na 1ª Home da sessão — voltar pra Início pela barra não "pisca"
  const [animarEntrada] = useState(marcarEntradaDaHome);

  const nomeCompleto = nomeDaHome(get) || user?.email?.split("@")[0] || "";
  const primeiroNome = nomeCompleto.trim().split(/\s+/)[0] || "";
  const copo = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
  const pendencias = useMemo(
    () => pendenciasDeHoje(lifeData, get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date(), copo),
    [lifeData, get, copo],
  );
  const prefs: PendenciasPrefs = lifeData.pendenciasPrefs ?? PREFS_PADRAO;
  const abrirTodasPendencias = useCallback(() => { trackEvent("home_pendencias_todas", { pendentes: pendencias.pending.length }); setFolhaPendencias(true); }, [pendencias.pending.length]);

  const abrirAcao = useCallback((id: ActionId) => { setAcaoInicial(id); setFolhaMais(true); }, []);
  const abrirMais = useCallback(() => { setAcaoInicial(null); setFolhaMais(true); }, []);
  /* 1.0.19 (26/10): medir quem vê as páginas 2 e 3 do carrossel (a dose do dia mora na 2) — 1 evento por troca de
     página (a 1ª, aberta ao montar, não conta) com a página (1..3) e o rótulo */
  const paginaAnterior = useRef(paginaInicial);
  const aoMudarPagina = useCallback((n: number) => {
    if (n === paginaAnterior.current) return;
    const de = paginaAnterior.current;
    paginaAnterior.current = n;
    trackEvent("home_carrossel_pagina", { pagina: n + 1, de: de + 1, rotulo: ROTULOS_DO_CARROSSEL[n] ?? null });
  }, []);
  const abrirScore = useCallback(() => { trackEvent("home_score_abrir", { score: lifeData.dayScore }); setFolhaScore(true); }, [lifeData.dayScore]);

  // o "+" da barra de vidro (global) pede a folha por evento; vindo de outra aba, o pedido fica em memória
  // (lib/home-nova, nunca no estado da navegação — um state no histórico reabriria a folha ao voltar) e é consumido 1x
  useEffect(() => {
    const abrir = () => abrirMais();
    window.addEventListener(EVENTO_HOME_NOVA_MAIS, abrir);
    return () => window.removeEventListener(EVENTO_HOME_NOVA_MAIS, abrir);
  }, [abrirMais]);
  useEffect(() => { if (loaded && consumirMaisPendente()) abrirMais(); }, [loaded, abrirMais]);

  if (!loaded) return <div className="hn he min-h-dvh" aria-hidden data-suave={suave} />;

  const paginas = [
    <PaginaSeuDia key="dia" data={lifeData} onAbrirScore={abrirScore} onAcao={abrirAcao} onMais={abrirMais} numeroDentro={numeroDentro} copoMl={copo} resumos={resumos} festaPausada={festaPausada} forcarFesta={festaDev} />,
    <PaginaPendencias key="pend" pendencias={pendencias} onAcao={abrirAcao} onPersonalizar={() => setPrefsAbertas(true)} onVerTodas={abrirTodasPendencias} />,
    <PaginaWidgets key="wid" data={lifeData} widgets={widgetsE.ativos} onEscolher={() => setPicker(true)} onAcao={abrirAcao} />,
  ];

  return (
    <>
      <DailyNudge />
      {/* ATRIBUTO_RAIZ: a Home de verdade está na tela — é o que deixa a barra de vidro aparecer */}
      <ContextoDaEntrada.Provider value={animarEntrada}>
      <div className="hn he min-h-dvh" data-testid="home-nova" data-layout="e" data-modulos={modulos} data-suave={suave} {...{ [ATRIBUTO_RAIZ]: "hoje" }}>
        {/* rodada 2 (dono: "a Home rola além do necessário"): embaixo só o respiro da barra de vidro (60 + folga) */}
        <FadeDoConjunto><main className="max-w-lg mx-auto px-4 pt-2 pb-[calc(var(--app-safe-bottom,0px)+72px)]">
          <header className="flex items-center justify-between gap-3 pt-1" data-testid="hn-topo">
            <h1 className="text-[26px] leading-[1.15] font-bold tracking-[-0.025em] truncate min-w-0">
              {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}
            </h1>
            <PilulaFogoE seq={seq} onTocar={() => setFolhaSequencia(true)} coberta={folhaMais || folhaScore || folhaSequencia || folhaPendencias || picker || organizar || prefsAbertas} />
          </header>

          {/* "SEU DIA" da missão em doses (só no site; no app a missão abre por cima) */}
          <div className="mt-4 empty:hidden"><CardSeuDia lifeData={lifeData} sequencia={seq} /></div>

          <div className="mt-5">
            <CarrosselDia paginas={paginas} rotulos={ROTULOS_DO_CARROSSEL} paginaInicial={paginaInicial} arrasto={arrasto} onMudar={aoMudarPagina} />
          </div>

          {/* Retrospectiva do mês que fechou, do dia 1 ao 10 — some sozinha fora da janela */}
          <div className="mt-5 empty:hidden"><RetrospectivaNaHome /></div>

          <div className="mt-5">
            <ModulosE data={lifeData} variante={modulos} azulejo={azulejo} preferencias={preferencias} onOrganizar={() => { trackEvent("home_modulos_editar", { origem: "organizar" }); setOrganizar(true); }} />
          </div>

          {/* o convite das lojas (só no site; no app não existe) */}
          <div className="mt-6 empty:hidden"><LojasCard variant="home" /></div>

          <p className="text-center text-[11px] text-muted-foreground/70 pt-5">Core © {new Date().getFullYear()} — Organize sua vida</p>
        </main></FadeDoConjunto>
        {/* 26/10 (dono): a comemoração do 100 no estilo da Home nova (a antiga segue na Home antiga, intocada) */}
        <CelebracaoDia100E
          score={lifeData.dayScore} streak={seq.dias} variante={celebracaoDev ?? undefined} forcar={!!celebracaoDev}
          onAbrir={() => setCelebrando(true)} onFechar={() => setCelebrando(false)}
        />
      </div>
      </ContextoDaEntrada.Provider>

      {/* as folhas são `fixed` fora do contêiner da Home: este nó (sem fundo) só leva as variáveis da paleta até elas */}
      <div className="hn he he-so-vars" data-suave={suave}>
        <FolhaMaisE aberta={folhaMais} onFechar={() => setFolhaMais(false)} inicial={acaoInicial} data={lifeData} />
        <FolhaScore aberta={folhaScore} onFechar={() => setFolhaScore(false)} data={lifeData} seq={seq} onAcao={abrirAcao} onPersonalizar={() => setPrefsAbertas(true)} />
        <OrganizarModulos aberta={organizar} onFechar={() => setOrganizar(false)} preferencias={preferencias} />
        <FolhaSequencia
          aberta={folhaSequencia} onFechar={() => setFolhaSequencia(false)} seq={seq} trilha={trilha} origem="home"
          onIr={(rota) => navigate(rota)}
          onAdesivo={(b) => { setFolhaSequencia(false); window.setTimeout(() => navigate("/conquistas", { state: { origem: "home", figurinha: b.id } }), 180); }}
        />
        {/* rodada 2: Widgets e Personalizar pendências no estilo da Home nova (as mesmas chaves e regras de hoje) */}
        <EscolherWidgetsE aberta={picker} onFechar={() => setPicker(false)} ativos={widgetsE.ativos} onToggle={widgetsE.alternar} />
        <FolhaPendencias aberta={folhaPendencias} onFechar={() => setFolhaPendencias(false)} pendencias={pendencias} onAcao={abrirAcao} onPersonalizar={() => setPrefsAbertas(true)} />
        <PersonalizarPendenciasE open={prefsAbertas} onOpenChange={setPrefsAbertas} prefs={prefs} onChange={(p) => set(CHAVE_PENDENCIAS_PREFS, p)} porModulo={lifeData.pendenciasPorModulo} />
      </div>
    </>
  );
};
