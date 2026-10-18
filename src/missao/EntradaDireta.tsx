import { Navigate, useSearchParams } from "react-router-dom";
import { AREAS_MISSAO_WEB, funilMissaoLigado, lerMissaoWeb, type AreaMissaoWeb } from "@/lib/missao-web";
import { prepararMissao } from "./preparar";

/**
 * /missao/app?area=… — a entrada DIRETA no app do funil da missão (link de QA, recarregar no meio, voltar do banco).
 * O caminho normal nem passa aqui: o missao.html monta o App já no módulo (app-entry). Sem o funil ligado → /.
 */
export default function EntradaDireta() {
  const [p] = useSearchParams();
  if (!funilMissaoLigado()) return <Navigate to="/" replace />;
  const pedida = p.get("area") as AreaMissaoWeb | null;
  const area = pedida && AREAS_MISSAO_WEB.includes(pedida) ? pedida : lerMissaoWeb()?.area ?? "dinheiro";
  let sessao = lerMissaoWeb()?.sessao;
  if (!sessao) { try { sessao = crypto.randomUUID(); } catch { sessao = `m${Date.now().toString(36)}`; } }
  return <Navigate to={prepararMissao(area, sessao)} replace />;
}
