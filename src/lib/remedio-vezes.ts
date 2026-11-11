/**
 * CHAVE DO REMÉDIO DE VÁRIAS DOSES (07/11, 4ª rodada da crítica).
 *
 * O que fica atrás dela, no cadastro de Saúde › Vitaminas e Remédios (PharmacyChecklist):
 *   · "Quantas vezes" além de 1× ao dia (12 em 12, 8 em 8, 6 em 6) e a fileira "Horários"
 *     com o "Começa hoje/amanhã";
 *   · "Até quando" (data de fim) — no cadastro e na edição de um remédio que ainda não tem fim.
 *
 * POR QUE: o lembrete do celular é agendado pelo app do celular, e a versão que está hoje na
 * loja não conhece `ate` nem `inicio` (lib/remedios). Um 8 em 8 com fim cadastrado no site
 * viraria, no celular com o app antigo, aviso às 08, 16 e 00 todo dia, pra sempre (e antes de
 * começar). O site costuma ir ao ar antes da build do iPhone e do Android.
 *
 * Sem a chave, o cadastro do site é o de sempre (1 horário, sem fim). O que já existe continua
 * aparecendo e marcando no site — um 8 em 8 cadastrado no app novo mostra as doses normalmente.
 *
 * COMO LIGAR NO SITE: quando a build que entende `ate` e `inicio` estiver NA LOJA nos dois
 * (iPhone e Android), trocar `REMEDIO_VEZES_WEB` pra "on" e fazer o deploy do site. Aí o texto
 * "No celular, atualize o app do CORE…" do cadastro passa a ser verdade.
 * Rollback (nos dois): "off" — o que já foi cadastrado continua valendo; só o cadastro novo volta
 * a ser de 1 horário.
 */
import { isNativeShell } from "@/lib/native-shell";

export type ModoChave = "on" | "off";
/** App das lojas. DESLIGADA na build 1.0.25/137 (10/11): o remédio novo ainda tem problema aberto (crítica de fora
 *  10/11, rodada 2: J1, J2, J3). Ligar aqui só numa build depois do conserto; a 1.0.25 já entende `ate` e `inicio`. */
export const REMEDIO_VEZES_APP = "off" as ModoChave;
/** Site (Vercel). DESLIGADA até a build nova estar na loja (iPhone e Android). */
export const REMEDIO_VEZES_WEB = "off" as ModoChave;

/** "Quantas vezes" e "Até quando" aparecem no cadastro deste aparelho? */
export const remedioVezesLigado = (): boolean => (isNativeShell() ? REMEDIO_VEZES_APP : REMEDIO_VEZES_WEB) === "on";
