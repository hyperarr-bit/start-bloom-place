import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { useAuth } from "@/hooks/use-auth";
import { useHomeWidgets } from "@/hooks/use-home-widgets";
import { useSequencia } from "@/components/conquistas/use-conquistas";
import { pendenciasDeHoje } from "@/components/home/NextHoursTimeline";
import type { ActionId } from "@/components/home/QuickActions";
import { CHAVE_COMPROMISSOS, type Compromisso } from "@/lib/compromissos";
import { CHAVE_COPO_ML, COPO_ML_PADRAO, normalizarCopoMl } from "@/lib/saude-copo";
import { nomeDaHome } from "@/lib/nome-da-pessoa";
import { TopoNova } from "./TopoNova";
import { CardScoreNova } from "./CardScoreNova";
import { SecaoHoje } from "./SecaoHoje";
import { ModulosNova, type VarianteModulos } from "./ModulosNova";
import { BarraFlutuante, type AbaNova } from "./BarraFlutuante";
import { FolhaMais } from "./FolhaMais";
import "./home-nova.css";

/**
 * HOME NOVA — MOCKUP (25/10, ramo v1019-home; a Home de verdade é pages/Home.tsx e não muda).
 *
 * A ordem da tela, de cima pra baixo:
 *   1. Topo: "Boa noite, João" + pílula do fogo (direção "Semana" traz a semana Seg…Dom embaixo);
 *   2. Card do score: anel + título + explicação em coisas + a linha da sequência (sem divisória);
 *   3. Hoje: pendências + widgets num bloco, com "Personalizar";
 *   4. Módulos: cartões grandes em 2 colunas (ou páginas 2×2 que rolam de lado);
 *   5. Barra flutuante (Início · Conquistas · Você) + o "+" que abre a folha das ações rápidas.
 *
 * Lê os MESMOS dados da Home de hoje (hub, sequência, widgets, pendências). Não grava nada por conta
 * própria; as ações da folha são de mentira no mockup.
 */
export type DirecaoTopo = "semana" | "fogo" | "marca";

interface Props {
  topo: DirecaoTopo;
  modulos: VarianteModulos;
  /** abre a folha do "+" já montada (prints) */
  folhaAberta?: boolean;
  rotulos?: Partial<Record<AbaNova, string>>;
}

export const iniciaisDe = (nome: string): string => {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "?";
  return partes.length > 1 ? `${partes[0][0]}${partes[partes.length - 1][0]}`.toUpperCase() : partes[0].slice(0, 2).toUpperCase();
};

export const HomeNova = ({ topo, modulos, folhaAberta, rotulos }: Props) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get, loaded } = useUserData();
  const lifeData = useLifeHubData();
  const seq = useSequencia();
  const { activeWidgets, addWidget, removeWidget, isActive, toggleSize } = useHomeWidgets();
  const [folha, setFolha] = useState(!!folhaAberta);
  const [acaoInicial, setAcaoInicial] = useState<ActionId | null>(null);

  const nomeCompleto = nomeDaHome(get) || user?.email?.split("@")[0] || "";
  const primeiroNome = nomeCompleto.trim().split(/\s+/)[0] || "";
  const copo = normalizarCopoMl(get<number>(CHAVE_COPO_ML, COPO_ML_PADRAO));
  const pendencias = useMemo(
    () => pendenciasDeHoje(lifeData, get<Compromisso[]>(CHAVE_COMPROMISSOS, []) ?? [], new Date(), copo),
    [lifeData, get, copo],
  );

  const abrirAcao = (id: ActionId) => { setAcaoInicial(id); setFolha(true); };
  const ir = (aba: AbaNova) => {
    if (aba === "inicio") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    navigate(aba === "conquistas" ? "/conquistas" : "/voce", aba === "conquistas" ? { state: { origem: "home" } } : undefined);
  };

  if (!loaded) return <div className="hn min-h-dvh" aria-hidden />;

  return (
    <div className="hn min-h-dvh" data-testid="home-nova" data-topo={topo} data-modulos={modulos}>
      <main className="max-w-lg mx-auto px-4 pt-3 pb-[calc(var(--app-safe-bottom,0px)+108px)] space-y-7">
        <TopoNova nome={primeiroNome} seq={seq} comSemana={topo !== "fogo"} marca={topo === "marca"} />
        <CardScoreNova score={lifeData.dayScore} pendentes={pendencias.pending.length} feitas={pendencias.done.length} seq={seq} />
        <SecaoHoje
          data={lifeData}
          pendencias={pendencias}
          widgets={activeWidgets}
          onToggleWidget={(id) => (isActive(id) ? removeWidget(id) : addWidget(id))}
          onToggleSize={toggleSize}
          onAcao={abrirAcao}
        />
        <ModulosNova data={lifeData} variante={modulos} />
        <p className="text-center text-[11px] text-muted-foreground/70 pt-2">CORE · organize sua vida</p>
      </main>

      <BarraFlutuante ativa="inicio" iniciais={iniciaisDe(nomeCompleto)} onIr={ir} onMais={() => { setAcaoInicial(null); setFolha(true); }} rotulos={rotulos} />
      <FolhaMais aberta={folha} onFechar={() => setFolha(false)} inicial={acaoInicial} />
    </div>
  );
};
