import { isNativeShell } from "@/lib/native-shell";
import { estadoPermissao, pedirPermissao } from "@/lib/notificacoes";
import { CHAVE_PREFS, lerPrefs } from "@/lib/prefs-notificacoes";
import { reagendarTudo, type Leitor } from "@/lib/reagendar";
import { trackEvent } from "@/lib/analytics";

/**
 * Rearma os avisos no sistema logo depois de uma escrita (nasceu nos
 * compromissos em 22/09; vale igual pras tarefas com horário desde 28/09).
 *
 * Duas coisas que o useLembretes sozinho não resolve:
 *  1. a PERMISSÃO é pedida aqui, no primeiro item com aviso — no Android 13+
 *     a recusa é definitiva, e pedir na abertura do app é jogar a chance fora;
 *  2. o `get` deste render ainda não enxerga a escrita — o leitor sobreposto
 *     entrega o valor novo ao reagendador sem esperar o próximo render (como
 *     no PharmacyChecklist).
 *
 * `sobrepor`: chave → valor novo (ex.: { "rotina-day-tasks": listaNova }).
 */
export async function armarAvisos(
  get: Leitor,
  sobrepor: Record<string, unknown>,
  pedir: boolean,
  evento: { nome: string; total: number },
): Promise<void> {
  if (!isNativeShell()) return;
  const estado = await estadoPermissao();
  if (estado === "prompt" && pedir) {
    const ok = await pedirPermissao();
    trackEvent(evento.nome, { concedida: ok, total: evento.total });
    if (!ok) return;
  } else if (estado !== "granted") return;
  const leitor: Leitor = (k, fb) => (k in sobrepor ? (sobrepor[k] as typeof fb) : get(k, fb));
  try { await reagendarTudo(leitor, lerPrefs(get<unknown>(CHAVE_PREFS, undefined))); } catch { /* sem plugin */ }
}
