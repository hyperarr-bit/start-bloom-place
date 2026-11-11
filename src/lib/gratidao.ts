/**
 * GRATIDÃO EM DUAS CHAVES (05/11, e-mail de cliente): o "+" da Home grava em `core-gratitude-log` e o Desenvolvimento
 * lia só `dp-gratitude`, então o que vinha da Home não aparecia em lugar nenhum. A tela junta as duas só pra MOSTRAR:
 * nada é movido nem regravado, e a mesma frase no mesmo dia aparece uma vez.
 */
type Registro = Record<string, unknown>;

const frases = (v: unknown): string[] =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === "string" && x.trim().length > 0);

export const juntarGratidao = (modulo: Registro | null | undefined, home: Registro | null | undefined): Record<string, string[]> => {
  const saida: Record<string, string[]> = {};
  for (const fonte of [modulo, home]) {
    for (const [dia, itens] of Object.entries(fonte ?? {})) {
      const vistas = new Set((saida[dia] ?? []).map((f) => f.trim().toLowerCase()));
      for (const frase of frases(itens)) {
        const chave = frase.trim().toLowerCase();
        if (vistas.has(chave)) continue;
        vistas.add(chave);
        (saida[dia] ??= []).push(frase);
      }
    }
  }
  return saida;
};
