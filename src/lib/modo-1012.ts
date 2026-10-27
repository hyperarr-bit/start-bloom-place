/**
 * MODO DE BUILD "1.0.12" (1.0.21, dono 27/10, pelos dados) — `VITE_MODO_1012=1`.
 *
 * A família 1.0.10–1.0.12 foi a que mais rendeu por iPhone novo. A 1.0.21 de loja é a EXPERIÊNCIA da 1.0.12
 * (build 34, c86bdb25) com 3 diferenças: (a) a Home nova "E" (figurinhas/Conquistas do Codex); (b) sem tutorial nem
 * dicas; (c) todos os consertos de hoje por baixo (cobrança/recusa da 1.0.20 com o card 19,90, compra/restaurar/
 * retentativa da loja, segurança, teclado).
 *
 * POR QUE UMA ENV E NÃO CHAVES DO REVENUECAT: a metadata das offerings vale também pros apps que JÁ ESTÃO NO AR
 * (1.0.16–1.0.20). Trocar `paywall_curto`/`sino_paywall`/`missao_1_por_dia`… mexeria neles. Com a env, o binário
 * da 1.0.21 deixa fixos os comportamentos da 1.0.12 e IGNORA as chaves remotas que contrariam. Sem a env, nada muda
 * (o app de hoje, os testes de hoje).
 *
 * O QUE O MODO FIXA (cada lib pergunta `modo1012()` antes da força de QA, da metadata e da constante):
 *   · funil antigo inteiro: welcome em mosaico, promessas, porta, 5 perguntas, notificação no quiz, o número,
 *     prova, preparando, radar, central, DEMO, 3 "Claro!" e o contrato — `funilCalaiLigado()` e
 *     `onboarding1TelaLigado()` = false; sem o sino (`sino_paywall` off);
 *   · paywall LONGO da 1.0.12 — todas as ofertas de saída da 1.0.14 desligadas (`ofertaLigada()` = false: curto,
 *     X → presente, recuperação, textos, enxuto, escada, mensal 19 na folha do mensal, direto 19, cadeado);
 *   · folha da Apple fechada → a 2ª chance de mesmo preço (sem presente 69,90 e sem "O que te fez parar?" ali);
 *   · cobrança da 1.0.14 LIGADA (`cobrancaV14Ligada()` = true: contador, avisos +24/+72 h, folha nativa segurada);
 *   · pós-compra: cadastro → a BOAS-VINDAS da 1.0.12 ("Pronto, Nome.") → o convite da missão "Seu CORE tá pronto";
 *   · missão: o braço "1 por dia" (A) com as telas da 1.0.12 (convite com "Trocar os 3 módulos", "Primeiro registro
 *     feito!" com a hora do lembrete), sem `dias23`;
 *   · fluxo enxuto FIXO ligado (sem tutorial, intro, montar, cartões, tour, dicas);
 *   · avaliação como na 1.0.12: só os momentos de uso (sem os da missão, sem o "Avaliar" do menu, sem o dia 2);
 *   · ATT na welcome, ~3 s depois (`auto3s`).
 *
 * Testes: `globalThis.__MODO_1012__ = true|false` força (o setup não mexe; sem o global vale a env).
 */
export const ENV_MODO_1012 = "VITE_MODO_1012";

export const modo1012 = (): boolean => {
  const g = (globalThis as { __MODO_1012__?: unknown }).__MODO_1012__;
  if (g === true || g === "1") return true;
  if (g === false || g === "0") return false;
  try { return import.meta.env.VITE_MODO_1012 === "1"; } catch { return false; }
};

/** Os campos dos eventos: com o modo ligado, todo evento diz que veio da 1.0.21 "1.0.12" (a turma se lê separada). */
export const camposModo1012 = (): { modo_1012?: true } => (modo1012() ? { modo_1012: true } : {});
