import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { useHomeWidgets } from "@/hooks/use-home-widgets";
import { useSequencia } from "@/components/conquistas/use-conquistas";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import type { ActionId } from "@/components/home/QuickActions";
import { WidgetPicker } from "@/components/home/WidgetPicker";
import { PersonalizarPendencias } from "@/components/home/PersonalizarPendencias";
import { CHAVE_PENDENCIAS_PREFS, PREFS_PADRAO, type PendenciasPrefs } from "@/lib/home-pendencias";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl } from "@/lib/saude-copo";
import { nomeDaHome } from "@/lib/nome-da-pessoa";
import { trackEvent } from "@/lib/analytics";
import { PilulaFogoE } from "./PilulaFogoE";
import { iniciaisDe } from "../HomeNova";
import { FolhaMaisE } from "./FolhaMaisE";
import type { AbaNova } from "../BarraFlutuante";
import { CarrosselDia } from "./CarrosselDia";
import { PaginaSeuDia } from "./PaginaSeuDia";
import { PaginaPendencias } from "./PaginaPendencias";
import { PaginaWidgets } from "./PaginaWidgets";
import { FolhaScore } from "./FolhaScore";
import { ModulosE, type VarianteModulosE } from "./ModulosE";
import { BarraVidro } from "./BarraVidro";
import "../home-nova.css";
import "./home-e.css";

/**
 * HOME NOVA — OPÇÃO E (mockup 25/10, ramo v1019-home-e; a Home de verdade é pages/Home.tsx e não muda).
 *
 * De cima pra baixo:
 *   1. Topo: "Boa noite, João" + a pílula do fogo na cor da faixa — APAGADA enquanto o dia não está
 *      garantido, ACESA (com um pulso, 1× por dia) ao garantir (rodada 2, porte da direção A v3). Sem data,
 *      sem a semana.
 *   2. O CARROSSEL DO DIA (3 páginas, bolinhas): 1 · Seu dia ("27 pontos · Score do dia" + anel com a
 *      estrela, que abre a folha "Como funciona a pontuação"; + Hábitos, Água, Refeições); 2 · Pendências de
 *      hoje (a lista, compacta, com ação); 3 · Seus widgets (os que a pessoa escolhe, redesenhados).
 *   3. Módulos, já na primeira tela: grade de 4 (sem selos, rodada 3) ou cartões de 3.
 *   4. A barra de VIDRO (Início · Conquistas · Você) + o "+" que abre a folha das ações rápidas.
 *   RODADA 3: paleta única (paleta.ts, oklch com a mesma luminosidade/croma, uma matiz por módulo), ícones
 *   Lucide com traço 1,75 em tudo, fundo quase branco com véu no topo, sombras mínimas, barra mais embaixo.
 *
 * Lê os MESMOS dados da Home de hoje (hub, sequência, widgets, pendências). Não grava nada por conta
 * própria; as ações da folha são de mentira no mockup.
 */
interface Props {
  modulos: VarianteModulosE;
  /** abre já numa página do carrossel (0…2) */
  paginaInicial?: number;
  /** congela o trilho no meio do arrasto entre a 1ª e a 2ª página (0…1) */
  arrasto?: number | null;
  folhaScoreAberta?: boolean;
  folhaMaisAberta?: boolean;
  rotulos?: Partial<Record<AbaNova, string>>;
  /** variação do card do score: o número dentro do anel (como hoje) */
  numeroDentro?: boolean;
}

const saudacao = (): string => {
  const h = new Date().getHours();
  if (h < 6) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

export const HomeE = ({ modulos, paginaInicial = 0, arrasto = null, folhaScoreAberta, folhaMaisAberta, rotulos, numeroDentro }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get, set, loaded } = useUserData();
  const lifeData = useLifeHubData();
  const seq = useSequencia();
  const { activeWidgets, addWidget, removeWidget, isActive, toggleSize } = useHomeWidgets();
  const [folhaMais, setFolhaMais] = useState(!!folhaMaisAberta);
  const [acaoInicial, setAcaoInicial] = useState<ActionId | null>(null);
  const [folhaScore, setFolhaScore] = useState(!!folhaScoreAberta);
  const [picker, setPicker] = useState(false);
  const [prefsAbertas, setPrefsAbertas] = useState(false);

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
  const abrirScore = useCallback(() => { trackEvent("home_score_abrir", { score: lifeData.dayScore, origem: "home-nova-e" }); setFolhaScore(true); }, [lifeData.dayScore]);
  const ir = (aba: AbaNova) => {
    if (aba === "inicio") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    navigate(aba === "conquistas" ? "/conquistas" : "/voce", aba === "conquistas" ? { state: { origem: "home" } } : undefined);
  };

  if (!loaded) return <div className="hn he min-h-dvh" aria-hidden />;

  const paginas = [
    <PaginaSeuDia key="dia" data={lifeData} onAbrirScore={abrirScore} onAcao={abrirAcao} onMais={abrirMais} numeroDentro={numeroDentro} copoMl={copo} />,
    <PaginaPendencias key="pend" pendencias={pendencias} onAcao={abrirAcao} onPersonalizar={() => setPrefsAbertas(true)} onVerTodas={abrirScore} />,
    <PaginaWidgets key="wid" data={lifeData} widgets={activeWidgets} onEscolher={() => setPicker(true)} />,
  ];

  return (
    <div className="hn he min-h-dvh" data-testid="home-nova" data-layout="e" data-modulos={modulos}>
      <main className="max-w-lg mx-auto px-4 pt-2 pb-[calc(var(--app-safe-bottom,0px)+108px)]">
        <header className="flex items-center justify-between gap-3 pt-1" data-testid="hn-topo">
          <h1 className="text-[26px] leading-[1.15] font-bold tracking-[-0.025em] truncate min-w-0">
            {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}
          </h1>
          <PilulaFogoE seq={seq} />
        </header>

        <div className="mt-5">
          <CarrosselDia paginas={paginas} rotulos={["Seu dia", "Pendências de hoje", "Seus widgets"]} paginaInicial={paginaInicial} arrasto={arrasto} />
        </div>

        <div className="mt-5">
          <ModulosE data={lifeData} variante={modulos} />
        </div>
        <p className="text-center text-[11px] text-muted-foreground/70 pt-8">CORE · organize sua vida</p>
      </main>

      <BarraVidro ativa="inicio" iniciais={iniciaisDe(nomeCompleto)} onIr={ir} onMais={abrirMais} rotulos={rotulos} />
      <FolhaMaisE aberta={folhaMais} onFechar={() => setFolhaMais(false)} inicial={acaoInicial} />
      <FolhaScore aberta={folhaScore} onFechar={() => setFolhaScore(false)} data={lifeData} seq={seq} onAcao={abrirAcao} onPersonalizar={() => setPrefsAbertas(true)} />
      <WidgetPicker open={picker} onOpenChange={setPicker} activeWidgets={activeWidgets} onToggle={(id) => (isActive(id) ? removeWidget(id) : addWidget(id))} onToggleSize={toggleSize} />
      <PersonalizarPendencias open={prefsAbertas} onOpenChange={setPrefsAbertas} prefs={prefs} onChange={(p) => set(CHAVE_PENDENCIAS_PREFS, p)} porModulo={lifeData.pendenciasPorModulo} />
    </div>
  );
};
