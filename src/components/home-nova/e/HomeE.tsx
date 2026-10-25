import { useCallback, useEffect, useMemo, useState } from "react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { useHomeWidgets } from "@/hooks/use-home-widgets";
import { useModulePreferences } from "@/hooks/use-module-preferences";
import { useSequencia } from "@/components/conquistas/use-conquistas";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import type { ActionId } from "@/components/home/QuickActions";
import { WidgetPicker } from "@/components/home/WidgetPicker";
import { PersonalizarPendencias } from "@/components/home/PersonalizarPendencias";
import { CelebracaoDia100 } from "@/components/home/CelebracaoDia100";
import { DailyNudge } from "@/components/onboarding/DailyNudge";
import { CardSeuDia } from "@/components/missao-doses/CardSeuDia";
import { RetrospectivaNaHome } from "@/components/wrapped/RetrospectivaNaHome";
import { LojasCard } from "@/components/LojasCard";
import { CHAVE_PENDENCIAS_PREFS, PREFS_PADRAO, type PendenciasPrefs } from "@/lib/home-pendencias";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl } from "@/lib/saude-copo";
import { nomeDaHome } from "@/lib/nome-da-pessoa";
import { ATRIBUTO_RAIZ } from "@/lib/nav-abas";
import { EVENTO_HOME_NOVA_MAIS, SUAVIDADE_HOME_NOVA, consumirMaisPendente, type SuavidadeHomeNova } from "@/lib/home-nova";
import { trackEvent } from "@/lib/analytics";
import { PilulaFogoE } from "./PilulaFogoE";
import { FolhaMaisE } from "./FolhaMaisE";
import { CarrosselDia } from "./CarrosselDia";
import { PaginaSeuDia } from "./PaginaSeuDia";
import { PaginaPendencias } from "./PaginaPendencias";
import { PaginaWidgets } from "./PaginaWidgets";
import { FolhaScore } from "./FolhaScore";
import { ModulosE, type AzulejoE, type VarianteModulosE } from "./ModulosE";
import { OrganizarModulos } from "./OrganizarModulos";
import { FolhaSequencia } from "./FolhaSequencia";
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
 * das lojas (só no site), a comemoração dos 100 pontos, o nudge diário. O tour antigo da Home NÃO entra aqui
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
}

const saudacao = (): string => {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export const HomeE = ({ modulos = "grade", azulejo = "tinta", suave = SUAVIDADE_HOME_NOVA, paginaInicial = 0, arrasto = null, folhaScoreAberta, folhaMaisAberta, numeroDentro }: Props) => {
  const { user } = useAuth();
  const { get, set, loaded } = useUserData();
  const lifeData = useLifeHubData();
  const seq = useSequencia();
  const { activeWidgets, addWidget, removeWidget, isActive, toggleSize } = useHomeWidgets();
  // UMA instância das preferências de módulos: a grade e a folha "Organizar" leem/gravam o mesmo estado (como o ModuleDrawer de hoje)
  const preferencias = useModulePreferences();
  const [folhaMais, setFolhaMais] = useState(!!folhaMaisAberta);
  const [acaoInicial, setAcaoInicial] = useState<ActionId | null>(null);
  const [folhaScore, setFolhaScore] = useState(!!folhaScoreAberta);
  const [picker, setPicker] = useState(false);
  const [prefsAbertas, setPrefsAbertas] = useState(false);
  const [organizar, setOrganizar] = useState(false);
  const [folhaSequencia, setFolhaSequencia] = useState(false);

  const nomeCompleto = nomeDaHome(get) || user?.email?.split("@")[0] || "";
  const primeiroNome = nomeCompleto.trim().split(/\s+/)[0] || "";
  const copo = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
  const pendencias = useMemo(
    () => pendenciasDeHoje(lifeData, get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date(), copo),
    [lifeData, get, copo],
  );
  const prefs: PendenciasPrefs = lifeData.pendenciasPrefs ?? PREFS_PADRAO;

  const abrirAcao = useCallback((id: ActionId) => { setAcaoInicial(id); setFolhaMais(true); }, []);
  const abrirMais = useCallback(() => { setAcaoInicial(null); setFolhaMais(true); }, []);
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
    <PaginaSeuDia key="dia" data={lifeData} onAbrirScore={abrirScore} onAcao={abrirAcao} onMais={abrirMais} numeroDentro={numeroDentro} copoMl={copo} />,
    <PaginaPendencias key="pend" pendencias={pendencias} onAcao={abrirAcao} onPersonalizar={() => setPrefsAbertas(true)} onVerTodas={abrirScore} />,
    <PaginaWidgets key="wid" data={lifeData} widgets={activeWidgets} onEscolher={() => setPicker(true)} onAcao={abrirAcao} />,
  ];

  return (
    <>
      <DailyNudge />
      {/* ATRIBUTO_RAIZ: a Home de verdade está na tela — é o que deixa a barra de vidro aparecer */}
      <div className="hn he min-h-dvh" data-testid="home-nova" data-layout="e" data-modulos={modulos} data-suave={suave} {...{ [ATRIBUTO_RAIZ]: "hoje" }}>
        <main className="max-w-lg mx-auto px-4 pt-2 pb-[calc(var(--app-safe-bottom,0px)+108px)]">
          <header className="flex items-center justify-between gap-3 pt-1" data-testid="hn-topo">
            <h1 className="text-[26px] leading-[1.15] font-bold tracking-[-0.025em] truncate min-w-0">
              {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}
            </h1>
            <PilulaFogoE seq={seq} onTocar={() => setFolhaSequencia(true)} />
          </header>

          {/* "SEU DIA" da missão em doses (só no site; no app a missão abre por cima) */}
          <div className="mt-4 empty:hidden"><CardSeuDia lifeData={lifeData} sequencia={seq} /></div>

          <div className="mt-5">
            <CarrosselDia paginas={paginas} rotulos={["Seu dia", "Pendências de hoje", "Seus widgets"]} paginaInicial={paginaInicial} arrasto={arrasto} />
          </div>

          {/* Retrospectiva do mês que fechou, do dia 1 ao 10 — some sozinha fora da janela */}
          <div className="mt-5 empty:hidden"><RetrospectivaNaHome /></div>

          <div className="mt-5">
            <ModulosE data={lifeData} variante={modulos} azulejo={azulejo} preferencias={preferencias} onOrganizar={() => { trackEvent("home_modulos_editar", { origem: "organizar" }); setOrganizar(true); }} />
          </div>

          {/* o convite das lojas (só no site; no app não existe) */}
          <div className="mt-6 empty:hidden"><LojasCard variant="home" /></div>

          <p className="text-center text-[11px] text-muted-foreground/70 pt-8">Core © {new Date().getFullYear()} — Organize sua vida</p>
        </main>
        <CelebracaoDia100 score={lifeData.dayScore} streak={seq.dias} />
      </div>

      {/* as folhas são `fixed` fora do contêiner da Home: este nó (sem fundo) só leva as variáveis da paleta até elas */}
      <div className="hn he he-so-vars" data-suave={suave}>
        <FolhaMaisE aberta={folhaMais} onFechar={() => setFolhaMais(false)} inicial={acaoInicial} />
        <FolhaScore aberta={folhaScore} onFechar={() => setFolhaScore(false)} data={lifeData} seq={seq} onAcao={abrirAcao} onPersonalizar={() => setPrefsAbertas(true)} />
        <OrganizarModulos aberta={organizar} onFechar={() => setOrganizar(false)} preferencias={preferencias} />
        <FolhaSequencia aberta={folhaSequencia} onFechar={() => setFolhaSequencia(false)} seq={seq} />
      </div>
      <WidgetPicker open={picker} onOpenChange={setPicker} activeWidgets={activeWidgets} onToggle={(id) => (isActive(id) ? removeWidget(id) : addWidget(id))} onToggleSize={toggleSize} />
      <PersonalizarPendencias open={prefsAbertas} onOpenChange={setPrefsAbertas} prefs={prefs} onChange={(p) => set(CHAVE_PENDENCIAS_PREFS, p)} porModulo={lifeData.pendenciasPorModulo} />
    </>
  );
};
