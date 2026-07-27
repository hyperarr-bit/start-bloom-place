import { createPortal } from "react-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativeShell } from "@/lib/native-shell";

/**
 * CTA ANCORADO — o botão mora sempre no mesmo lugar (27/07, ordem do dono).
 *
 * O PROBLEMA. Relato depois de rodar o funil no aparelho: "essa parte pode
 * confundir o usuário porque ele só vê o botão se arrastar. Lembra que no
 * BitePal e no Cal AI não existe arrastar pra ver algo? O botão de continuar
 * tá sempre no mesmo lugar, é algo fluido. Isso tem que valer pra TODO o
 * funil."
 *
 * Ele tem razão e o motivo é medível: num funil, cada tela que exige rolar
 * pra achar o "continuar" é uma tela onde parte das pessoas não acha. Não é
 * preguiça — é que o botão inline no fim de um bloco longo cai abaixo da
 * dobra, e quem não rola conclui que a tela travou. O padrão dos apps que
 * escalam é o oposto: barra ancorada no rodapé, na MESMA posição em todas as
 * telas, então a mão já sabe onde tocar antes de a tela terminar de montar.
 *
 * POR QUE PORTAL. A barra é `position: fixed`, e cada tela do funil está
 * dentro de um motion.div que anima `x`. Um ancestral com `transform` vira
 * bloco de contenção: o `fixed` passaria a se ancorar na CAIXA DA TELA, não
 * na janela — a barra ficaria no lugar errado, e pior, só às vezes. Saindo
 * por portal pro body, ela é sempre a janela.
 *
 * E a troca de tela não pisca: o AnimatePresence é mode="wait", então a tela
 * velha só desmonta quando a nova entra — a barra fica continuamente na tela,
 * só troca o rótulo. É o que dá a sensação de "um botão só", que é o pedido.
 *
 * ESCOPO: só no app da loja (isNativeShell). Na web o funil em escala é o do
 * dia 14 e ele não se toca — mesma regra de sempre.
 */
export function CtaFixo({ label, sub, onClick, disabled }: {
  label: React.ReactNode;
  /** Microcopy sob o botão (garantia, "dados de exemplo", etc). */
  sub?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  const botao = (
    <Button
      size="lg"
      disabled={disabled}
      onClick={onClick}
      className="w-full h-13 min-h-[52px] rounded-full text-base font-bold shadow-[0_10px_30px_-8px_rgba(0,0,0,0.35)]"
    >
      {label} <ArrowRight className="w-4 h-4" />
    </Button>
  );

  if (!isNativeShell()) {
    return (
      <div className="mt-5">
        {botao}
        {sub && <p className="text-xs text-muted-foreground mt-3 text-center">{sub}</p>}
      </div>
    );
  }

  return (
    <>
      {/* espaçador: reserva no fluxo a altura da barra (botão + microcopy +
          safe area), senão o fim da tela fica escondido atrás dela */}
      <div aria-hidden className={sub ? "h-[112px]" : "h-[88px]"} />
      {typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-black/5 bg-white/95 backdrop-blur-md"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="max-w-md mx-auto px-5 pt-3">
            {botao}
            {sub && <p className="text-[11px] text-muted-foreground mt-2 text-center leading-snug">{sub}</p>}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
