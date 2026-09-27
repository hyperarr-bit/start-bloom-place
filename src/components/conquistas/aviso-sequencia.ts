import { toast } from "sonner";

/**
 * O momento pequeno da sequência (26/09): a 1ª anotação do dia faz a
 * sequência subir — um toast de uma linha, no estilo dos outros do app, UMA
 * vez por dia (quem garante é o registro do dia no useUserData, que só chega
 * aqui na primeira escrita de dado do dia). Nada de modal: a pessoa estava no
 * meio de anotar alguma coisa.
 *
 * Espera um instante pra não brigar com o toast da própria ação ("✅ Gasto
 * registrado") — os dois aparecem, um depois do outro.
 */
export function avisarSequencia(dias: number) {
  const texto = dias <= 1 ? "🔥 1º dia da sua sequência" : `🔥 ${dias} dias seguidos`;
  setTimeout(() => {
    try {
      toast(texto, { id: "sequencia-do-dia", duration: 2600 });
    } catch {
      /* sem toaster (teste/tela isolada): o número já está na Home */
    }
  }, 700);
}
