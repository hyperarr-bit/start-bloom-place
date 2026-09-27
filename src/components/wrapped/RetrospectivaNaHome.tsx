import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { trackEvent } from "@/lib/analytics";
import { construirRetroMes, mesAnterior, type Leitor } from "@/lib/retrospectiva";
import { FOIL, foilCss } from "./prancheta";
import { Espiral, Lacre, P3, creme, kicker, linho, relevo, serif, vinheta } from "./pecas-planner";

/**
 * A retrospectiva na HOME (26/09). Até aqui ela só era anunciada dentro de
 * Finanças (WrappedBanner) — quem não abria aquele módulo só a achava pela
 * notificação. Aqui ela aparece nos 10 primeiros dias do mês e some pra
 * sempre daquele mês com o X.
 *
 * (26/09, sistema de temas) Na pele do tema padrão — uma página do planner:
 * linho grafite, espiral dourada, o mês em foil e o lacre. É um objeto: igual
 * no claro e no escuro.
 *
 * Componente isolado de propósito: a Home.tsx é de outro agente nesta rodada.
 */
const DIAS_NA_HOME = 10;

export const RetrospectivaNaHome = ({ agora: agoraFixo }: { agora?: Date }) => {
  // um "agora" por montagem (um Date novo a cada render refaria o cálculo sempre)
  const agoraDaMontagem = useRef(new Date());
  const agora = agoraFixo ?? agoraDaMontagem.current;
  const { user } = useAuth();
  const { get } = useUserData();
  const navigate = useNavigate();
  const [dispensada, setDispensada] = usePersistedState<string>("retro-home-dispensada", "");

  const retro = useMemo(() => {
    if (!user?.id || agora.getDate() > DIAS_NA_HOME) return null;
    const { ano, mesIdx } = mesAnterior(agora);
    const ler: Leitor = (chave) => get<unknown>(chave, undefined);
    return construirRetroMes(ano, mesIdx, user.id, undefined, { ler, agora });
  }, [user?.id, get, agora]);

  const id = retro ? `${retro.ano}-${String(retro.mesIdx + 1).padStart(2, "0")}` : "";
  const visivel = !!retro && dispensada !== id;

  const contou = useRef("");
  useEffect(() => {
    if (!visivel || contou.current === id) return;
    contou.current = id;
    trackEvent("wrapped_home_visto", { month: retro!.mes });
  }, [visivel, id, retro]);

  if (!visivel || !retro) return null;

  const paginas = retro.atividade.diasComRegistro;
  const mesMinusculo = retro.mes.toLowerCase();
  const MES = retro.mes.toUpperCase();
  const abrir = () => navigate(`/retrospectiva?mes=${encodeURIComponent(retro.mes)}&origem=home`);

  return (
    <div
      className="relative overflow-hidden"
      style={{ borderRadius: 16, background: P3.mesa, color: P3.creme, fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      data-testid="retrospectiva-na-home"
    >
      <div aria-hidden style={{ position: "absolute", left: 14, top: 0, right: 0, bottom: 0, borderRadius: "4px 16px 16px 4px", ...linho() }} />
      <div aria-hidden style={{ ...vinheta, left: 14 }} />
      <Espiral n={4} passo={44} topo={12} esquerda={14} w={11} h={20} caixa={28} />
      <Lacre texto={`${MES} · ${retro.ano} · FECHADO · `} tamanho={78} style={{ right: 16, bottom: 14, transform: "rotate(-8deg)" }} />
      <button
        onClick={() => {
          trackEvent("wrapped_dismiss", { month: retro.mes, origem: "home" });
          setDispensada(id);
        }}
        aria-label="Dispensar retrospectiva"
        className="absolute top-2 right-2 grid place-items-center w-8 h-8 rounded-full p-0"
        style={{ color: creme(0.55), zIndex: 2 }}
      >
        <X className="w-4 h-4" />
      </button>
      <button onClick={abrir} className="relative block w-full text-left active:scale-[0.99] transition-transform" style={{ padding: "16px 104px 16px 36px", zIndex: 1 }}>
        <span className="block" style={kicker(10)}>Retrospectiva</span>
        <span className="block" style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
          <span style={{ ...serif, ...foilCss, fontSize: 36, lineHeight: 1, filter: "drop-shadow(0 2px 2px rgba(0,0,0,.55))", paddingRight: 4 }}>{retro.mes}</span>
          <span style={{ ...relevo, fontSize: 15, fontWeight: 900, letterSpacing: ".06em" }}>{retro.ano}</span>
        </span>
        <span className="block" style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.25, marginTop: 8, letterSpacing: "-.01em" }}>
          Sua retrospectiva de {mesMinusculo} tá pronta
        </span>
        <span className="block" style={{ fontSize: 12.5, color: creme(0.6), marginTop: 3 }}>
          {paginas > 0 ? `${paginas} ${paginas === 1 ? "página preenchida" : "páginas preenchidas"}. Bora folhear?` : "Bora folhear?"}
        </span>
        <span className="inline-flex items-center" style={{ marginTop: 12, height: 36, padding: "0 16px", borderRadius: 10, background: FOIL, color: "#3a2604", fontSize: 13.5, fontWeight: 800, boxShadow: "0 8px 16px -8px rgba(0,0,0,.8)" }}>
          Folhear →
        </span>
      </button>
    </div>
  );
};

export default RetrospectivaNaHome;
