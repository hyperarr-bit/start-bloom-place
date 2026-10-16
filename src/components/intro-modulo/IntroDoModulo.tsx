import { useState } from "react";
import { useUserData } from "@/hooks/use-user-data";
import { lerMissao, missaoDosesLigada } from "@/lib/missao-doses";
import { INTROS, introLigada, introVistaNaConta, introVistaNesteAparelho, marcarIntroVistaNaConta, marcarIntroVistaNoAparelho } from "@/lib/intro-modulo";
import { moduloDaMissao } from "@/components/cartoes-modulo/CartoesDoModulo";
import { IntroGuiada } from "./IntroGuiada";
import { EstadoVazio } from "./EstadoVazio";

/**
 * A PORTA DA INTRO (protótipo 16/10): decide UMA vez, no mount, se este módulo mostra a
 * intro guiada (Finanças/Rotina/Saúde) ou o estado vazio (Casa), e grava "vista" no
 * aparelho E na conta ao terminar (feita ou pulada) — fechar o app no meio = volta 1x.
 *   · chave desligada (sem força de QA)          → nada
 *   · módulo sem intro                            → nada
 *   · já vista neste aparelho OU nesta conta      → nada
 *   · módulo da missão em doses da pessoa         → nada (a dose é a intro dele)
 */
export function IntroDoModulo({ moduleId }: { moduleId: string }) {
  const { get, set } = useUserData();
  const config = INTROS[moduleId];
  const [visivel, setVisivel] = useState(() => {
    if (!config || !introLigada()) return false;
    if (introVistaNesteAparelho(moduleId) || introVistaNaConta(moduleId, get)) return false;
    try { if (missaoDosesLigada() && moduloDaMissao(moduleId, lerMissao())) return false; } catch { /* sem storage */ }
    return true;
  });
  if (!visivel || !config) return null;
  const terminar = () => { marcarIntroVistaNoAparelho(moduleId); marcarIntroVistaNaConta(moduleId, get, set); setVisivel(false); };
  return config.formato === "guiada"
    ? <IntroGuiada config={config} aoTerminar={terminar} />
    : <EstadoVazio config={config} aoTerminar={terminar} />;
}
