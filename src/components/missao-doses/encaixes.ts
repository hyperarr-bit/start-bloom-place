import type { ComponentType } from "react";
import type { SetupDaDose } from "@/lib/missao-doses";
import type { ChipDaMissao, Retangulo } from "@/components/demo-guiada/alvos";
import { MontarRotina, deveMostrarMontarRotina, ATRIBUTO_NA_TELA as ATRIBUTO_MONTAR_ROTINA, TEXTO_DO_GUIA, quadradinhoDeHoje, recorteDoQuadradinho, type ResumoMontarRotina } from "@/components/rotina/montar/MontarRotina";
import { abrirConhecerMais, temTour } from "@/lib/conhecer-mais";
import { INTROS, introLigada } from "@/lib/intro-modulo";
import { EscolherTreinoDaMissao, deveMostrarEscolherTreino, ATRIBUTO_ESCOLHER_TREINO, type ResultadoDaEscolha } from "./EscolherTreinoDaMissao";

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
  /** opcional: o recorte do anel nesse alvo (Rotina: o quadrado justo do checkbox de hoje) */
  recorteDepoisDoPronto?: (el: Element) => Retangulo | null;
  /** opcional: o "pronto" do quiz JÁ É a dose — devolve o rótulo do feito (a missão comemora na hora) ou null
   *  (segue o passo guiado). Rotina: marcou o 1º quadradinho no guia da própria tela; Treino: a semana montada
   *  com um modelo pronto (a dose de Treino é escolher o treino — desenho 8, 4.1). */
  prontoEhADose?: (resumo: unknown) => string | null;
}

export const SETUPS_ENCAIXADOS: Partial<Record<Exclude<SetupDaDose, "montar-financas">, EncaixeDoSetup>> = {
  /* ROTINA — "Rotina pronta em 3 toques" (ramo v1016-rotina, 2667da27): 3 perguntas → a Rotina cheia → o guia da
   * própria tela no quadradinho de HOJE do 1º hábito (anel justo, toque em outro quadradinho segurado). `onPronto`
   * chega DEPOIS do guia: marcou (primeiroMarcado) = a dose está feita; não marcou ("Entendi" / 60 s) = o post-it da
   * missão segue no mesmo quadradinho com a frase do dono — marcar (rotina-habits-checked) é a dose. */
  "montar-rotina": {
    Componente: MontarRotina,
    deveMostrar: deveMostrarMontarRotina,
    atributo: ATRIBUTO_MONTAR_ROTINA,
    depoisDoPronto: `${TEXTO_DO_GUIA.titulo} ${TEXTO_DO_GUIA.texto}`,
    alvoDepoisDoPronto: () => quadradinhoDeHoje(0),
    recorteDepoisDoPronto: recorteDoQuadradinho,
    prontoEhADose: (r) => {
      const resumo = r as Partial<ResumoMontarRotina> | null | undefined;
      return resumo?.primeiroMarcado ? (resumo.primeiro?.nome || "Seu primeiro hábito") : null;
    },
  },
  /* TREINO (área "corpo") — o EscolherTreino da introdução dos módulos (2 perguntas → modelo pronto aplicado na
   * semana, aba HOJE aberta). A semana montada É a dose (o rótulo é o modelo). */
  "escolher-treino": {
    Componente: EscolherTreinoDaMissao,
    deveMostrar: deveMostrarEscolherTreino,
    atributo: ATRIBUTO_ESCOLHER_TREINO,
    depoisDoPronto: "Seu treino está pronto. Marca o 1º exercício quando fizer.",
    prontoEhADose: (r) => (r as Partial<ResultadoDaEscolha> | null | undefined)?.modelo || "Treino da semana",
  },
  /* METAS — sem folha à parte: a 1ª dose de Metas É a meta guiada de 1 toque da introdução do módulo (a mesma
   * pergunta e os mesmos 3 chips do INTROS.desenvolvimento — metaGuiadaDaIntro, abaixo). */
};

/** Metas: a pergunta, os chips e o detalhe da meta guiada da introdução do módulo (uma fonte só), ou null. */
export function metaGuiadaDaIntro(): { pergunta: string; chips: ChipDaMissao[]; detalhe: string } | null {
  try {
    const c = INTROS.desenvolvimento;
    const passo = c && c.formato === "toque" ? c.passos[0] : null;
    if (!passo) return null;
    return { pergunta: passo.pergunta, chips: passo.opcoes.map((o) => ({ emoji: o.emoji, nome: o.rotulo })), detalhe: passo.descricao ?? "A meta nasce com duas etapas pra você preencher." };
  } catch { return null; }
}

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
export const CONHECER_MAIS: { abrir: ((modulo: string) => void) | null; temPara?: (modulo: string) => boolean } = {
  // ramo da introdução dos módulos (lib/conhecer-mais): o passeio de Finanças, Rotina e Saúde
  abrir: (modulo) => { abrirConhecerMais(modulo, "fim_dose"); },
  /* quem abre o passeio é o ConhecerMaisHost, que só existe com a introdução dos módulos ligada (IntroDoModulo) — com
     ela desligada (rollback remoto `intro_modulo: "off"`), o link fecharia a festa e nada abriria: sem link (17/10) */
  temPara: (modulo) => temTour(modulo) && introLigada(),
};
