import { useEffect } from "react";
import { Check } from "lucide-react";
import { BotaoDoFunil } from "@/pages/funis/w/BotaoDoFunil";
import { trackEvent } from "@/lib/analytics";
import { AREAS, FUNNEL_AREA_KEY, type AreaKey } from "@/lib/funnel";

/**
 * "VOCÊ GANHOU 3 DIAS GRÁTIS" (10/10, build 38 — brief da Porta, seção 3).
 *
 * Quem criou a conta no site (Porta iPhone, `user_metadata.porta`) e entra no app LOGADA e SEM
 * assinatura vê esta tela antes do paywall: título, 1 linha com o plano dela (a área escolhida no
 * site) e UM botão "Continuar" na posição do botão do funil → o paywall curto. Sem preço, sem
 * urgência, sem mascote. NÃO chama compra nem restaurar: o teste só começa quando a folha da Apple
 * confirma. 1x por sessão do app (fechou e abriu de novo: pode ver de novo; nunca em loop na mesma).
 */
export type PortaNaConta = { respostas?: { area?: string | null; rota?: string | null } | null } | null | undefined;

/** A conta veio da Porta? (`user_metadata.porta` gravado pelo site) */
export const contaDaPorta = (metadata: unknown): boolean => {
  const p = (metadata as { porta?: unknown } | null | undefined)?.porta;
  return !!p && typeof p === "object";
};

/** "Seu plano de Dinheiro já está salvo." — a área do site; "Tudo"/desconhecida = sem nome. */
export function linhaDoPlano(porta: PortaNaConta): string {
  const area = porta?.respostas?.area ?? null;
  const nome = area && area in AREAS ? AREAS[area as AreaKey].nome : null;
  return nome ? `Seu plano de ${nome} já está salvo.` : "Seu plano de 3 dias já está salvo.";
}

/** A área do site vira a área do app (a Missão do dia 1 abre nela, sem quiz de novo) — só se o aparelho não tem uma. */
const guardarAreaDoSite = (area: string | null): void => {
  try { if (area && area in AREAS && !localStorage.getItem(FUNNEL_AREA_KEY)) localStorage.setItem(FUNNEL_AREA_KEY, area); } catch { /* noop */ }
};

const CHAVE_VISTO = "porta-parabens-visto";
let vistoNestaSessao = false;
/** já passou pela tela nesta sessão do app? (memória + sessionStorage, que morre com o processo) */
export const parabensJaVisto = (): boolean => {
  if (vistoNestaSessao) return true;
  try { return sessionStorage.getItem(CHAVE_VISTO) === "1"; } catch { return false; }
};
const marcarVisto = (): void => {
  vistoNestaSessao = true;
  try { sessionStorage.setItem(CHAVE_VISTO, "1"); } catch { /* noop */ }
};
/** só pros testes */
export const _zerarParabens = (): void => { vistoNestaSessao = false; try { sessionStorage.removeItem(CHAVE_VISTO); } catch { /* noop */ } };

export function ParabensPorta({ porta, onContinuar }: { porta: PortaNaConta; onContinuar: () => void }) {
  const area = porta?.respostas?.area ?? null;
  useEffect(() => {
    trackEvent("porta_parabens_visto", { area });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-white text-[#16121c]"
      style={{ paddingTop: "calc(var(--app-safe-top, 0px) + 1rem)" }}
      data-testid="porta-parabens"
    >
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-20 h-20 rounded-full bg-[#16121c] text-white grid place-items-center mb-6 shadow-[0_16px_32px_-12px_rgba(22,18,28,.55)]" aria-hidden>
          <Check className="w-10 h-10" strokeWidth={3.5} />
        </div>
        <h1 className="text-[32px] font-black tracking-[-0.03em] leading-[1.05]" data-testid="porta-parabens-titulo">Você ganhou<br />3 dias grátis</h1>
        <p className="mt-3 text-[16px] text-[#4f5a64] leading-snug" data-testid="porta-parabens-plano">{linhaDoPlano(porta)}</p>
      </div>
      <BotaoDoFunil
        texto="Continuar" fixo={false} testid="porta-parabens-continuar"
        onClick={() => { marcarVisto(); guardarAreaDoSite(area); trackEvent("porta_parabens_continuar", { area }); onContinuar(); }}
      />
    </div>
  );
}
