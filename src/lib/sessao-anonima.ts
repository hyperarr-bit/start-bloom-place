/**
 * SESSÃO ANÔNIMA — pra vender ANTES de pedir cadastro na web (01/09).
 *
 * O PROBLEMA QUE ISSO RESOLVE
 * No funil web a pessoa era obrigada a criar conta antes de ver o preço,
 * porque `asaas-pix` exige usuário autenticado pra emitir o QR (o QR é
 * estático e não carrega customer nosso; o único elo entre o pagamento e a
 * conta é o registro `pix_order_created`, chaveado no user_id). Medido em
 * 01/09: de 54 pessoas que assinaram o contrato, 11 criaram conta — o cadastro
 * come 80% num tráfego 100% pago. No app não existe esse degrau: lá quem cobra
 * é a folha do Google, que não precisa de conta nossa.
 *
 * A SAÍDA MAIS BARATA
 * Em vez de reescrever a cadeia do dinheiro pra aceitar compra sem dono
 * (asaas-pix + asaas-webhook + pix-reconcile + uma tabela nova de pendentes),
 * a gente cria um usuário ANÔNIMO do Supabase antes do QR. Aí existe um
 * `user.id` de verdade, e `asaas-pix`, `asaas-webhook` e `pix-reconcile`
 * continuam byte a byte como estão — nenhuma função que move dinheiro muda.
 * Depois de pagar, a pessoa BATIZA essa conta com e-mail e senha
 * (`updateUser`), e a assinatura já está lá dentro.
 *
 * POR QUE `updateUser` NÃO TRAVA O ACESSO
 * `GET /auth/v1/settings` deste projeto devolve `mailer_autoconfirm: true`:
 * confirmação de e-mail está DESLIGADA. Então batizar aplica na hora, sem
 * mandar a pessoa pro e-mail no meio da compra. Se um dia alguém ligar a
 * confirmação, este caminho passa a prender o acesso — está anotado aqui de
 * propósito.
 *
 * O QUE ISSO CUSTA (é dívida real, não detalhe)
 * O acesso de quem paga e NÃO batiza a conta mora num token de UM navegador.
 * Não há e-mail em lugar nenhum, então não há como recuperar: nem por suporte,
 * nem pelo `pix-reconcile` (que credita pelo user_id do pedido — e esse
 * usuário anônimo É o dono, então pra ele já está tudo certo). Quem limpar os
 * dados do navegador perde a compra. Enquanto essa dívida existir, a tela do
 * QR não pode prometer que "o acesso chega no seu e-mail".
 *
 * DEGRADA SOZINHO
 * Sign-in anônimo é uma chave no painel do Supabase e em 01/09 estava
 * DESLIGADA (`external.anonymous_users: false`). Por isso `garantirSessao()`
 * devolve "indisponivel" em vez de explodir: com a chave desligada o funil web
 * volta a pedir cadastro antes do paywall, exatamente como era. Ligar a chave
 * ativa o caminho novo sem precisar de deploy.
 *
 * ATENÇÃO DE SEGURANÇA: usuário anônimo entra com role `authenticated` (com a
 * claim `is_anonymous: true`), então TODA policy de RLS escrita pra
 * `authenticated` passa a valer pra quem só abriu a página.
 */
import { supabase } from "@/integrations/supabase/client";

/* Repetidos aqui de propósito: `src/integrations/supabase/client.ts` é gerado
 * e diz "não edite", então não dá pra exportar as constantes de lá. Os dois
 * valores são públicos — já viajam no bundle e no header de toda requisição —,
 * então repetir não expõe nada novo. */
const SUPABASE_URL = "https://itoylenzvahbscgjgtqf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";

export type EstadoSessao = "ja-tinha" | "anonima" | "indisponivel";

/** Cache do resultado: uma vez que a chave se provou desligada, não adianta
 *  bater de novo a cada tentativa de compra. Vive só nesta aba. */
let anonimoIndisponivel = false;

/** Resposta de `GET /auth/v1/settings`, cacheada por aba. */
let promessaDaChave: Promise<boolean> | null = null;

/**
 * A chave "Anonymous sign-ins" está LIGADA no painel do Supabase?
 *
 * Existe pra que o funil escolha a ORDEM das telas antes de chegar no
 * checkout. Sem isso a degradação não seria graciosa, seria um beco: com a
 * chave desligada, a pessoa passaria o funil inteiro, tocaria em comprar e só
 * então descobriria que precisa de conta — numa tela de erro que a manda pra
 * fora do funil. Perguntando ANTES, o funil volta a pedir cadastro antes do
 * paywall, exatamente como era até 31/08.
 *
 * `/auth/v1/settings` é público (é o mesmo que o supabase-js usa pra saber
 * quais provedores mostrar) e a resposta é minúscula. Na dúvida — rede fora,
 * campo ausente, formato diferente — responde `false`, que é o caminho antigo
 * e comprovado. Nunca falhar para o lado novo.
 */
export function anonimoLigado(): Promise<boolean> {
  if (promessaDaChave) return promessaDaChave;
  promessaDaChave = (async () => {
    try {
      const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY } });
      if (!r.ok) return false;
      const j = (await r.json()) as { external?: Record<string, unknown> };
      return j?.external?.anonymous_users === true;
    } catch {
      return false;
    }
  })();
  return promessaDaChave;
}

/**
 * Garante que existe uma sessão pra chamar as edge functions de pagamento.
 * - "ja-tinha"     → a pessoa já estava logada; nada foi criado.
 * - "anonima"      → criamos um usuário anônimo agora; ela ainda não tem e-mail.
 * - "indisponivel" → não há sessão e não deu pra criar (chave desligada,
 *                    rede caiu). Quem chama tem que mandar a pessoa cadastrar.
 */
export async function garantirSessao(): Promise<EstadoSessao> {
  const { data: sess } = await supabase.auth.getSession();
  if (sess?.session) return "ja-tinha";
  if (anonimoIndisponivel) return "indisponivel";
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data?.session) {
      // Erro típico com a chave desligada: "Anonymous sign-ins are disabled".
      anonimoIndisponivel = true;
      return "indisponivel";
    }
    return "anonima";
  } catch {
    anonimoIndisponivel = true;
    return "indisponivel";
  }
}

/**
 * A sessão atual é de um usuário anônimo (pagou, ainda não batizou a conta)?
 *
 * Isso decide o caminho do cadastro: numa sessão anônima, chamar `signUp()`
 * cria um SEGUNDO usuário e deixa a assinatura paga órfã no primeiro — o
 * dinheiro entra e a pessoa fica sem acesso. Quem estiver nesse estado tem que
 * usar `updateUser()`.
 */
export async function ehSessaoAnonima(): Promise<boolean> {
  const { data } = await supabase.auth.getUser();
  const u = data?.user as ({ is_anonymous?: boolean } & { email?: string | null }) | null | undefined;
  if (!u) return false;
  // `is_anonymous` é a fonte da verdade (claim do JWT). O fallback por e-mail
  // vazio cobre versões da lib que ainda não expõem a claim no objeto.
  return u.is_anonymous === true || !u.email;
}

/**
 * Batiza a sessão anônima: põe e-mail, senha e nome na conta que JÁ é dona da
 * compra. Não cria usuário novo — é isso que preserva a assinatura.
 *
 * Devolve `{ erro: "email_em_uso" }` quando o e-mail já pertence a outra conta.
 * Nesse caso NÃO logamos na conta antiga: a compra está nesta sessão, e trocar
 * de usuário aqui deixaria o pagamento órfão. Quem chama deve pedir outro
 * e-mail — a pessoa não perde o acesso, só o endereço preferido.
 */
export async function batizarSessaoAnonima(
  email: string,
  password: string,
  nome: string,
): Promise<{ erro: null | "email_em_uso" | "falhou"; mensagem?: string }> {
  const { error } = await supabase.auth.updateUser({
    email,
    password,
    data: { full_name: nome, display_name: nome },
  });
  if (!error) return { erro: null };
  const msg = error.message || "";
  if (/already|registered|exists|taken/i.test(msg)) return { erro: "email_em_uso", mensagem: msg };
  return { erro: "falhou", mensagem: msg };
}
