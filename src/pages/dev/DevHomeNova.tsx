import { lazy, Suspense, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useUserData } from "@/hooks/use-user-data";
import { nomeDaHome } from "@/lib/nome-da-pessoa";
import { HomeNova, iniciaisDe, type DirecaoTopo } from "@/components/home-nova/HomeNova";
import { BarraFlutuante, type AbaNova } from "@/components/home-nova/BarraFlutuante";
import { MolduraIphone } from "@/components/home-nova/MolduraIphone";
import type { VarianteModulos } from "@/components/home-nova/ModulosNova";
import { HomeE } from "@/components/home-nova/e/HomeE";
import { BarraVidro } from "@/components/home-nova/e/BarraVidro";
import { EVENTO_HOME_NOVA_MAIS, SUAVIDADE_HOME_NOVA } from "@/lib/home-nova";
import type { VarianteModulosE } from "@/components/home-nova/e/ModulosE";
import "@/components/home-nova/home-nova.css";

const Conquistas = lazy(() => import("@/pages/Conquistas"));
const Voce = lazy(() => import("@/pages/Voce"));

/**
 * /dev/home-nova — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de `import.meta.env.DEV`;
 * some do build). A HOME NOVA (mockup 25/10) com os dados REAIS da conta logada — não grava nada por si.
 *   ?topo=semana|fogo|marca  · direção do topo (padrão semana; marca = a palavra CORE no lugar da saudação)
 *   ?modulos=cartoes|paginas · módulos em cartões de 2 colunas (padrão) ou páginas 2×2 que rolam de lado
 *   ?tela=inicio|conquistas|voce · a aba (as outras duas são as telas de hoje, só com a barra nova por cima)
 *   ?folha=1                 · abre a folha do "+" já montada
 *   ?status=1                · moldura do iPhone (barra de status, ilha, indicador) + áreas seguras
 *   ?tema=escuro|claro       · força o modo
 *   ?inicio=Hoje             · rótulo alternativo da 1ª aba (pra fotografar os nomes)
 *
 * OPÇÃO E (25/10, ramo v1019-home-e): ?layout=e — carrossel do dia (score + 3 anéis · pendências · widgets),
 * módulos em grade de 4 (ou cartões de 3) e a barra de vidro.
 *   &modulos=grade|cartoes3  · grade de 4 azulejos com selos (padrão) ou cartões de 3 com a linha de estado
 *   &pagina=1|2|3            · abre já nessa página do carrossel
 *   &arrasto=0.45            · congela o carrossel no meio do arrasto (0…1 entre a 1ª e a 2ª página)
 *   &folha=score             · abre a folha "Como funciona a pontuação"; &folha=1 abre a do "+"
 *   &numero=dentro           · variação do card do score com o número dentro do anel (como hoje)
 */
export default function DevHomeNova() {
  const [sp] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { get } = useUserData();
  const topo: DirecaoTopo = sp.get("topo") === "fogo" ? "fogo" : sp.get("topo") === "marca" ? "marca" : "semana";
  const modulos: VarianteModulos = sp.get("modulos") === "paginas" ? "paginas" : "cartoes";
  const tela = (sp.get("tela") ?? "inicio") as AbaNova;
  const status = sp.get("status") === "1";
  const folha = sp.get("folha") === "1";
  const tema = sp.get("tema");
  const rotuloInicio = sp.get("inicio");
  // opção E
  const layoutE = sp.get("layout") === "e";
  const modulosE: VarianteModulosE = sp.get("modulos") === "cartoes3" ? "cartoes3" : "grade";
  const paginaE = Math.max(0, Math.min(2, (Number(sp.get("pagina")) || 1) - 1));
  const arrastoE = sp.get("arrasto") !== null ? Number(sp.get("arrasto")) : null;
  const folhaScore = sp.get("folha") === "score";
  const numeroDentro = sp.get("numero") === "dentro";
  const azulejoE = sp.get("azulejo") === "branco" ? "branco" : "tinta"; // rodada 5: &azulejo=branco = versão 2
  const suaveE = sp.get("suave") === "2" ? "mais" : sp.get("suave") === "1" ? "suave" : sp.get("suave") === "0" ? "forte" : SUAVIDADE_HOME_NOVA; // rodada 6: &suave=0|1|2 (padrão = a aprovada)

  useEffect(() => {
    if (!tema) return;
    document.documentElement.classList.toggle("dark", tema === "escuro");
  }, [tema]);

  const escuro = tema === "escuro" || (tema !== "claro" && typeof document !== "undefined" && document.documentElement.classList.contains("dark"));
  const fundo = escuro ? "hsl(222 16% 7%)" : "hsl(40 12% 96%)";
  const nome = nomeDaHome(get) || user?.email?.split("@")[0] || "";
  const ir = (aba: AbaNova) => navigate(`/dev/home-nova?${new URLSearchParams({ ...Object.fromEntries(sp.entries()), tela: aba }).toString()}`);

  return (
    <>
      {tela === "inicio" && layoutE ? (
        <>
          <HomeE modulos={modulosE} paginaInicial={paginaE} arrasto={Number.isFinite(arrastoE) ? arrastoE : null} folhaScoreAberta={folhaScore} folhaMaisAberta={folha} numeroDentro={numeroDentro} azulejo={azulejoE} suave={suaveE} />
          <div className="hn he he-so-vars">
            <BarraVidro ativa="inicio" iniciais={iniciaisDe(nome)} onIr={ir} onMais={() => window.dispatchEvent(new CustomEvent(EVENTO_HOME_NOVA_MAIS))} rotulos={rotuloInicio ? { inicio: rotuloInicio } : undefined} />
          </div>
        </>
      ) : tela === "inicio" ? (
        <HomeNova topo={topo} modulos={modulos} folhaAberta={folha} rotulos={rotuloInicio ? { inicio: rotuloInicio } : undefined} />
      ) : (
        <div className="hn hn-tela min-h-dvh pb-[calc(var(--app-safe-bottom,0px)+108px)]">
          <Suspense fallback={null}>{tela === "voce" ? <Voce /> : <Conquistas />}</Suspense>
          <BarraFlutuante ativa={tela} iniciais={iniciaisDe(nome)} onIr={ir} onMais={() => ir("inicio")} rotulos={rotuloInicio ? { inicio: rotuloInicio } : undefined} />
        </div>
      )}
      {status && <MolduraIphone fundo={fundo} />}
    </>
  );
}
