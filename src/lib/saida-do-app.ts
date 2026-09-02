import { registerPlugin } from "@capacitor/core";
import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

/**
 * POR QUE O APP MORREU DA ÚLTIMA VEZ (02/09) — o lado JS do SaidaDoAppPlugin.
 *
 * O banco mostrava o EFEITO (13–31% das compras terminavam em reinício com a
 * folha do Google na frente, S25 e Z Flip inclusos) e não a CAUSA. Aqui, no
 * boot do shell, lemos o que o próprio Android guardou sobre a última saída
 * do processo e o que a MainActivity anotou sobre a morte do renderer, e
 * cruzamos com a hora do último toque em comprar (`core-folha-aberta-em`,
 * gravado pelo revenuecat.ts). Cada saída é reportada uma vez.
 */
interface Saida {
  disponivel: boolean;
  motivo?: number;
  descricao?: string;
  quando?: number;
  importancia?: number;
  pss?: number;
  rendererMorreu?: boolean;
  rendererQuando?: number;
  rendererCrash?: boolean;
  rendererPrioridade?: number;
}
const SaidaDoApp = registerPlugin<{ ultimaSaida(): Promise<Saida> }>("SaidaDoApp");

/** Nomes dos ApplicationExitInfo.REASON_* — legíveis no painel. */
const MOTIVOS: Record<number, string> = {
  0: "desconhecido", 1: "exit_self", 2: "signaled", 3: "memoria_baixa", 4: "crash", 5: "crash_nativo",
  6: "anr", 7: "falha_inicializacao", 8: "permissao_mudou", 9: "recurso_excessivo", 10: "usuario_pediu",
  11: "usuario_parou", 12: "dependencia_morreu", 13: "outro", 14: "freezer", 15: "estado_pacote", 16: "pacote_atualizado",
};
const CHAVE_TOQUE = "core-folha-aberta-em";
const CHAVE_PROCESSO_VISTO = "core-saida-vista";
const CHAVE_RENDERER_VISTO = "core-renderer-visto";

const lerNum = (k: string): number => { try { return Number(localStorage.getItem(k) ?? 0) || 0; } catch { return 0; } };
const gravar = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* noop */ } };

export async function reportarSaidaAnterior(): Promise<void> {
  if (!isNativeShell()) return;
  let s: Saida;
  try { s = await SaidaDoApp.ultimaSaida(); } catch { return; /* build sem o plugin */ }
  const toque = lerNum(CHAVE_TOQUE);
  const relacao = (quando: number) => ({
    apos_folha: toque > 0 && quando > toque && quando - toque < 180_000,
    seg_apos_toque: toque > 0 ? Math.round((quando - toque) / 1000) : null,
  });
  if (s.rendererMorreu && (s.rendererQuando ?? 0) > lerNum(CHAVE_RENDERER_VISTO)) {
    const q = s.rendererQuando as number;
    trackEvent("app_renderer_morreu", { crash: !!s.rendererCrash, prioridade: s.rendererPrioridade ?? null, ...relacao(q) });
    gravar(CHAVE_RENDERER_VISTO, q);
  }
  if (s.disponivel && s.quando && s.quando > lerNum(CHAVE_PROCESSO_VISTO)) {
    trackEvent("app_reinicio", {
      motivo: MOTIVOS[s.motivo ?? 0] ?? String(s.motivo),
      codigo: s.motivo ?? null,
      descricao: (s.descricao ?? "").slice(0, 120),
      importancia: s.importancia ?? null,
      pss_mb: s.pss ? Math.round(s.pss / 1024) : null,
      ...relacao(s.quando),
    });
    gravar(CHAVE_PROCESSO_VISTO, s.quando);
  }
}
