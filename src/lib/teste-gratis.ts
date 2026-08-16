import { isNativeShell } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

/**
 * TESTE GRÁTIS DE 3 DIAS DO APP DA LOJA (16/08) — o relógio.
 *
 * O desenho é do dono: em vez de trial do Google (que exige cartão e cortaria
 * a maioria Pix da base já na entrada), o app LIBERA por 3 dias sem paywall e
 * sem cadastro — a pessoa entra, planta a semente (primeira conta/hábito) e
 * usa de verdade. O paywall muda de LUGAR: do minuto 3 pro dia 3, quando já
 * existe algo construído que ela não quer perder. O produto continua o
 * vitalício R$27,90 (+ downsell 19,90) — nada muda no catálogo.
 *
 * Por que relógio LOCAL: não há conta (o cadastro é pós-compra desde a v48),
 * então não há linha no servidor pra ancorar. Reinstalar zera o relógio —
 * furo conhecido e aceito no teste: fraudar dá mais trabalho que pagar
 * R$27,90 uma vez. O evento `teste_iniciado` carimba o início no banco
 * (por sessão/aparelho via telemetria) pra MEDIR o abuso antes de decidir
 * se ele importa.
 *
 * Quem NUNCA iniciou o teste (instalações antigas, ou web) não é afetado:
 * sem marca no storage, todas as funções respondem "sem teste" e o fluxo
 * antigo (paywall no funil) continua valendo para o que for.
 */

const CHAVE_INICIO = "core-teste-inicio";
const DURACAO_MS = 3 * 24 * 3600_000;

export type EstadoTeste =
  | { fase: "nunca" }
  | { fase: "ativo"; dia: 1 | 2 | 3; horasRestantes: number; inicio: number }
  | { fase: "expirado"; inicio: number };

const lerInicio = (): number | null => {
  try {
    const v = Number(localStorage.getItem(CHAVE_INICIO));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
};

export function estadoTeste(): EstadoTeste {
  const inicio = lerInicio();
  if (!inicio) return { fase: "nunca" };
  const passado = Date.now() - inicio;
  if (passado >= DURACAO_MS) return { fase: "expirado", inicio };
  const dia = (Math.min(3, Math.floor(passado / 86_400_000) + 1)) as 1 | 2 | 3;
  return { fase: "ativo", dia, horasRestantes: Math.max(0, Math.ceil((DURACAO_MS - passado) / 3600_000)), inicio };
}

/** O teste vale acesso agora? (uma pergunta só, pro gate não pensar) */
export const testeLiberado = (): boolean => estadoTeste().fase === "ativo";

/**
 * Liga o relógio — idempotente (segunda chamada não re-inicia). Chamado no
 * fim do funil da semente, NUNCA no boot: o teste começa quando a pessoa
 * plantou algo, não quando instalou.
 */
export function iniciarTeste(area: string | null): EstadoTeste {
  const existente = lerInicio();
  if (existente) return estadoTeste();
  const agora = Date.now();
  try { localStorage.setItem(CHAVE_INICIO, String(agora)); } catch { /* sem storage: segue sem teste */ }
  trackEvent("teste_iniciado", { area: area ?? "", dias: 3, shell: isNativeShell() });
  return estadoTeste();
}
