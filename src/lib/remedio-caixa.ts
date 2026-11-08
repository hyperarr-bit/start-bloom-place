/**
 * O QUE A CAIXA MARCOU (07/11, crítica de fora, 2ª rodada): a dose que a caixa de
 * um remédio de várias doses marcou por último, por grupo (chave do grupo →
 * {id da linha, dia do registro}). O 2º toque na caixa desfaz ESSA dose, se ela
 * ainda estiver marcada — escolher só pelo relógio tirava a dose mais tarde, que
 * a pessoa tomou pela pílula, quando a caixa tinha marcado uma esquecida.
 *
 * Mora aqui, no nível do módulo, e não dentro do componente: num useRef ela
 * sumia ao sair da Saúde e voltar entre os 2 toques, e o erro voltava. Vale
 * enquanto o app estiver aberto. É só memória: não grava nada, não muda nenhuma
 * chave sincronizada nem o formato do registro de "tomado".
 */
export const marcadaPelaCaixa = new Map<string, { id: string; dia: string }>();

/** Esquece tudo (testes: cada caso começa sem memória, como o app recém-aberto). */
export function esquecerMarcasDaCaixa(): void {
  marcadaPelaCaixa.clear();
}
