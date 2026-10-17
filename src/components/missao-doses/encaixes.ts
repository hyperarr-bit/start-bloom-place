import type { ComponentType } from "react";
import type { SetupDaDose } from "@/lib/missao-doses";

/**
 * OS QUIZ DA 1ª DOSE QUE MORAM EM OUTROS RAMOS (1.0.16, regra final do dono, 17/10 — ver `setupDaDose` em
 * lib/missao-doses). O "Vamos montar suas Finanças" já está neste ramo e o PassoDoDia o chama direto; os outros
 * entram por aqui, cada um com UMA linha, quando o ramo dele chegar:
 *
 *   ── ramo v1016-rotina ("Rotina pronta em 3 toques"):
 *        import { MontarRotina, deveMostrarMontarRotina } from "<onde o ramo puser>";
 *        SETUPS_ENCAIXADOS["montar-rotina"] = {
 *          Componente: MontarRotina, deveMostrar: deveMostrarMontarRotina, atributo: "data-montar-rotina",
 *          depoisDoPronto: "Sua rotina está pronta. Marca o primeiro quando fizer.",
 *        };
 *      (o fim do quiz também sai na window como `montar-rotina:fim` {resultado, itens}; a missão usa os
 *       callbacks — o evento fica pra quem mede)
 *   ── ramo v1016-cartoes ("Escolher treino": 2 perguntas → modelo → marca o 1º exercício):
 *        SETUPS_ENCAIXADOS["escolher-treino"] = { Componente: EscolherTreino, deveMostrar: …, atributo: …,
 *          depoisDoPronto: "Seu treino está pronto. Marca o 1º exercício quando fizer." };
 *   ── ramo v1016-cartoes (a meta guiada de 1 toque da introdução do módulo):
 *        SETUPS_ENCAIXADOS["meta-guiada"] = { … };
 *
 * O CONTRATO (o mesmo do Montar de Finanças): o componente é uma folha em tela cheia por cima do módulo, recebe
 * `origem="missao"`, grava o que a pessoa respondeu pelo `set` do módulo e chama `onPronto` ou `onPular`; enquanto
 * está na tela, `<html ATRIBUTO>` fica presente. A missão:
 *   · abre o quiz SÓ na 1ª dose, na área escolhida no funil, e só se `deveMostrar` disser sim (conta nova, módulo
 *     vazio, não decidiu, chave do ramo ligada) — e nunca se a introdução do módulo já foi feita;
 *   · espera o atributo sair antes de procurar o controle do módulo, e ignora o que o quiz grava enquanto está
 *     aberto (criar os itens nunca conta como a dose);
 *   · no "pronto", o post-it diz `depoisDoPronto` e o anel vai pro 1º item (marcar ele É a dose);
 *   · no "pular", segue a dose guiada simples.
 * Enquanto a entrada não existe, a 1ª dose daquela área é a dose guiada simples (fail-open), e o evento de view
 * da dose diz `setup: "<id>", setup_aberto: false`.
 */
export interface EncaixeDoSetup {
  Componente: ComponentType<{ origem: "missao"; onPronto: (resumo?: unknown) => void; onPular: () => void }>;
  deveMostrar: (ctx: { criadoEm?: string | null; get: <T>(k: string, f: T) => T; isGuest: boolean }) => boolean;
  /** `<html ATRIBUTO>` enquanto o quiz está na tela */
  atributo: string;
  /** a frase do post-it depois do "pronto" — o passo guiado que conta como a dose */
  depoisDoPronto: string;
  /** opcional: onde o anel vai depois do "pronto" (ex.: o ✓ do 1º exercício do modelo). Sem ele, o controle de
   *  sempre do módulo (na Rotina, a linha de HOJE da tabela — o certo pro "marca o primeiro"). Se marcar esse item
   *  não mexe numa chave que o `alvos.ts` do tipo já reconhece como registro, estender o `achar` dele junto. */
  alvoDepoisDoPronto?: () => Element | null;
}

export const SETUPS_ENCAIXADOS: Partial<Record<Exclude<SetupDaDose, "montar-financas">, EncaixeDoSetup>> = {};

/**
 * "CONHECER MAIS DO <MÓDULO> (1 min)" — o tour opcional e mais fundo do módulo, do ramo da introdução dos módulos
 * (v1016-cartoes: `abrirConhecerMais(modulo)`). A comemoração pequena de cada dose mostra o link como opção QUIETA
 * (nunca abre sozinho): fecha a comemoração ali mesmo no módulo e chama o tour. PONTO DE ENCAIXE — quando o ramo
 * entrar, uma linha:
 *     import { abrirConhecerMais } from "<onde o ramo puser>";
 *     CONHECER_MAIS.abrir = abrirConhecerMais;
 * (opcional: `CONHECER_MAIS.temPara = (modulo) => …` pra esconder o link num módulo sem tour). Sem isso, o link não
 * aparece. As doses dos dias seguintes continuam sendo FAZER algo hoje no módulo do dia: um módulo já explorado vira
 * a dose de continuação (introDoModuloConcluida), nunca uma dose inútil.
 */
export const CONHECER_MAIS: { abrir: ((modulo: string) => void) | null; temPara?: (modulo: string) => boolean } = { abrir: null };
