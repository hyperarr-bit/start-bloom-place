import { toast } from "sonner";

/**
 * O momento pequeno da sequência (26/09): a 1ª anotação do dia faz a
 * sequência subir — um toast de uma linha, no estilo dos outros do app, UMA
 * vez por dia (quem garante é o registro do dia no useUserData, que só chega
 * aqui na primeira escrita de dado do dia). Nada de modal: a pessoa estava no
 * meio de anotar alguma coisa.
 *
 * Espera um instante pra não brigar com o toast da própria ação ("✅ Gasto
 * registrado") — os dois aparecem, um depois do outro. 2,4 s (28/09): depois
 * de a festa do adesivo (1,6 s) e o pedido de avaliação (~1,2 s) já estarem
 * na tela, pra saber se deve ficar quieto.
 */
export function avisarSequencia(dias: number) {
  const texto = dias <= 1 ? "🔥 1º dia da sua sequência" : `🔥 ${dias} dias seguidos`;
  setTimeout(() => {
    // 28/09: se já tem festa de adesivo, camada de guia (Missão "Dia 1", tutorial) ou qualquer diálogo
    // (pedido de avaliação do 1º gasto) na tela, eles já comemoram — o toast ia por cima do "Continuar"
    // da festa. A sequência segue contada na Home.
    if (typeof document !== "undefined" && document.querySelector('[data-momento], [data-camada-guia], [role="dialog"], [role="alertdialog"]')) return;
    try {
      toast(texto, { id: "sequencia-do-dia", duration: 2600 });
    } catch {
      /* sem toaster (teste/tela isolada): o número já está na Home */
    }
  }, 2400);
}
