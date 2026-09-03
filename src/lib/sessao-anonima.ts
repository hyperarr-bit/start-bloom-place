/**
 * COMPRAR SEM CADASTRO NA WEB — sessão anônima + e-mail antes do QR (01/09).
 *
 * O PROBLEMA
 * No funil web a pessoa era obrigada a criar conta antes de ver o preço,
 * porque `asaas-pix` exige usuário autenticado pra emitir o QR (o QR é
 * estático e não carrega customer nosso; o único elo entre o pagamento e a
 * conta é o registro `pix_order_created`, chaveado no user_id). Medido em
 * 01/09: de 54 pessoas que assinaram o contrato, 11 criaram conta — o cadastro
 * comia 80% de um tráfego 100% pago.
 *
 * A SOLUÇÃO, EM DOIS TEMPOS
 *   1. antes do QR: abre uma sessão ANÔNIMA e grava só o E-MAIL nela;
 *   2. depois de pagar: a pessoa põe nome e senha na MESMA conta.
 * Assim `asaas-pix`, `asaas-webhook` e `pix-reconcile` não mudam uma linha —
 * sempre existe um `user.id` real, e agora também um `user.email` real.
 *
 * POR QUE O E-MAIL VEM ANTES, E NÃO SÓ DEPOIS
 * Medido na base: 202 de 774 pagantes do Pix — 26,1% — nunca emitiram
 * `pix_confirmed`. Pagam e fecham a aba. E 59% dos checkouts rodam dentro do
 * webview do Instagram/Facebook, onde o armazenamento é volátil. Se o e-mail
 * só fosse pedido DEPOIS do pagamento, esse um em cada quatro ficaria com uma
 * conta paga sem endereço nenhum: sem welcome, sem "esqueci minha senha", sem
 * acesso em outro aparelho. O e-mail digitado antes é a única identidade que
 * atravessa aba fechada, cache limpo e troca de aparelho — é o equivalente web
 * do recibo que a conta Google guarda no app.
 *
 * Continua MUITO mais curto que o cadastro completo: um campo, sem senha, sem
 * CPF, sem confirmação.
 *
 * COLISÃO DE E-MAIL RESOLVIDA ANTES DO DINHEIRO
 * 13,9% dos compradores do Pix já tinham conta. Perguntar o e-mail antes do QR
 * faz essa colisão aparecer enquanto NADA foi pago — aí dá pra simplesmente
 * entrar na conta existente, sem risco de deixar pagamento órfão. Se a mesma
 * colisão aparecesse depois do pagamento, trocar de sessão órfanaria a compra.
 *
 * DETALHES DE AUTH QUE FORAM MEDIDOS, NÃO SUPOSTOS
 *  · `mailer_autoconfirm: true` neste projeto (confirmação de e-mail desligada).
 *  · DEFINIR o e-mail de uma conta anônima aplica NA HORA — provado com sessão
 *    real: `updateUser({email})` devolve 200 com o campo `email` preenchido,
 *    `new_email` vazio, e o login com esse endereço funciona. É diferente de
 *    TROCAR o e-mail de uma conta que já tem um, que passa por confirmação.
 *  · Ao ganhar e-mail, `is_anonymous` vira **false**. Por isso a pendência do
 *    batismo é marcada explicitamente aqui, e não deduzida daquela flag.
 *
 * DEGRADA SOZINHO
 * Sign-in anônimo é uma chave do painel. Com ela desligada, `garantirSessao()`
 * responde "indisponivel" e o funil volta a pedir cadastro antes do paywall.
 *
 * ATENÇÃO DE SEGURANÇA: usuário anônimo entra com role `authenticated`, então
 * toda policy de RLS escrita pra `authenticated` passa a valer pra quem só
 * abriu a página. Auditado em 01/09: 50 das 53 amarram em `auth.uid()`, as
 * outras 3 são regras de negação.
 */
import { supabase } from "@/integrations/supabase/client";

/* Repetidos aqui de propósito: `src/integrations/supabase/client.ts` é gerado
 * e diz "não edite", então não dá pra exportar as constantes de lá. Os dois
 * valores são públicos — já viajam no bundle e no header de toda requisição. */
const SUPABASE_URL = "https://itoylenzvahbscgjgtqf.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0b3lsZW56dmFoYnNjZ2pndHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzMTc4NzUsImV4cCI6MjA4OTg5Mzg3NX0.G3bJEdD5B5lmc1cic6UYGeu2xv4XrbmZ9MA_afoYnLg";

/** Marca no aparelho que ESTE usuário comprou sem conta e ainda deve nome e
 *  senha. Guarda o id porque `is_anonymous` deixa de servir assim que o e-mail
 *  entra — sem isso, a tela de cadastro chamaria `signUp` e criaria um segundo
 *  usuário, órfanando a compra. */
const CHAVE_BATISMO = "core-batismo-pendente";

export type EstadoSessao = "ja-tinha" | "anonima" | "indisponivel";
export type ErroEmail = null | "email_em_uso" | "invalido" | "falhou";

let anonimoIndisponivel = false;
let promessaDaChave: Promise<boolean> | null = null;

/**
 * A chave "Anonymous sign-ins" está LIGADA no painel do Supabase?
 *
 * Existe pra que o funil escolha a ORDEM das telas antes de chegar no
 * checkout. Sem isso a degradação não seria graciosa, seria um beco: a pessoa
 * passaria o funil inteiro, tocaria em comprar e só então descobriria que
 * precisa de conta — numa tela de erro que a manda pra fora do funil.
 *
 * Na dúvida — rede fora, campo ausente, formato diferente — responde `false`,
 * que é o caminho antigo e comprovado. Nunca falhar para o lado novo.
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
 * Garante uma sessão pra chamar as edge functions de pagamento.
 * - "ja-tinha"     → já estava logada; nada foi criado.
 * - "anonima"      → criamos um usuário anônimo agora.
 * - "indisponivel" → não há sessão e não deu pra criar. Quem chama tem que
 *                    mandar a pessoa cadastrar.
 */
export async function garantirSessao(): Promise<EstadoSessao> {
  const { data: sess } = await supabase.auth.getSession();
  if (sess?.session) return "ja-tinha";
  if (anonimoIndisponivel) return "indisponivel";
  try {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error || !data?.session) {
      anonimoIndisponivel = true;
      return "indisponivel";
    }
    return "anonima";
  } catch {
    anonimoIndisponivel = true;
    return "indisponivel";
  }
}

/** O e-mail da sessão atual, ou null (sem sessão, ou sessão anônima crua). */
export async function emailDaSessao(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.email ?? null;
}

const EMAIL_OK = /^\S+@\S+\.\S+$/;

/**
 * Grava o e-mail na conta que vai pagar — o passo que roda ANTES do QR.
 *
 * Abre a sessão anônima se preciso e define o endereço nela. A partir daqui
 * `asaas-pix` enxerga `user.email`, o welcome do webhook tem destinatário, e a
 * pessoa consegue recuperar o acesso mesmo que feche a aba no segundo seguinte.
 */
export async function definirEmailDaCompra(email: string): Promise<{ erro: ErroEmail; mensagem?: string }> {
  const limpo = email.trim().toLowerCase();
  if (!EMAIL_OK.test(limpo)) return { erro: "invalido" };
  const estado = await garantirSessao();
  if (estado === "indisponivel") return { erro: "falhou", mensagem: "sem_sessao" };

  const jaTem = await emailDaSessao();
  if (jaTem === limpo) return { erro: null }; // repetiu o mesmo e-mail: nada a fazer

  const { error } = await supabase.auth.updateUser({ email: limpo });
  if (error) {
    const msg = error.message || "";
    if (/already|registered|exists|taken/i.test(msg)) return { erro: "email_em_uso", mensagem: msg };
    return { erro: "falhou", mensagem: msg };
  }
  const { data } = await supabase.auth.getUser();
  if (data?.user?.id) marcarBatismoPendente(data.user.id);
  return { erro: null };
}

/**
 * A colisão de e-mail acontece ANTES do pagamento, então entrar na conta que já
 * existe é seguro — não há compra nenhuma pra ficar órfã. Trocar de sessão aqui
 * é o caminho certo; depois do pagamento seria o erro mais caro possível.
 */
export async function entrarNaContaExistente(email: string, senha: string): Promise<{ erro: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  if (error) return { erro: error.message || "falhou" };
  limparBatismo(); // conta de verdade: não deve nada
  return { erro: null };
}

function marcarBatismoPendente(userId: string) {
  try { localStorage.setItem(CHAVE_BATISMO, userId); } catch { /* noop */ }
}

/**
 * QR PRIMEIRO (02/09): o Pix passou a nascer ANTES do e-mail. Quem paga sem
 * tocar em "Salvar e-mail" caía em /home anônimo, sem e-mail e sem senha —
 * acesso só no token do navegador (59% dos checkouts são o WebView do
 * Instagram, que esquece). A pendência de batismo passa a ser marcada na
 * hora em que o Pix é gerado numa sessão sem e-mail: depois de pagar, a tela
 * de cadastro (e-mail + senha) vem antes do "liberando".
 */
export async function marcarBatismoSeSemEmail(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (u?.id && !u.email) marcarBatismoPendente(u.id);
  } catch { /* noop */ }
}

export function limparBatismo() {
  try { localStorage.removeItem(CHAVE_BATISMO); } catch { /* noop */ }
}

/**
 * Esta sessão comprou sem conta e ainda deve nome e senha?
 *
 * Compara o id marcado com o usuário atual. NÃO usa `is_anonymous`, que vira
 * `false` assim que o e-mail entra — confiar nele faria a tela de cadastro
 * chamar `signUp`, criar um segundo usuário e órfãnar a compra paga.
 */
export async function precisaBatizar(): Promise<boolean> {
  let marcado: string | null = null;
  try { marcado = localStorage.getItem(CHAVE_BATISMO); } catch { /* noop */ }
  if (!marcado) return false;
  const { data } = await supabase.auth.getUser();
  return !!data?.user && data.user.id === marcado;
}

/**
 * Fecha a conta de quem comprou sem cadastro: põe senha e nome na MESMA conta
 * que é dona da compra. O e-mail já entrou antes do QR, então aqui NÃO se mexe
 * nele — mandar o mesmo endereço de novo cairia no fluxo de troca de e-mail,
 * que exige confirmação e prenderia o acesso.
 *
 * `email` é opcional e só é usado no caso de borda em que a conta chegou aqui
 * sem endereço (a chave do anônimo ligou no meio do caminho, por exemplo).
 */
export async function batizarConta(
  senha: string,
  nome: string,
  email?: string,
): Promise<{ erro: null | "email_em_uso" | "falhou"; mensagem?: string }> {
  const atual = await emailDaSessao();
  const payload: { password: string; data: Record<string, string>; email?: string } = {
    password: senha,
    data: { full_name: nome, display_name: nome },
  };
  if (!atual && email && EMAIL_OK.test(email.trim().toLowerCase())) {
    payload.email = email.trim().toLowerCase();
  }
  const { error } = await supabase.auth.updateUser(payload);
  if (error) {
    const msg = error.message || "";
    if (/already|registered|exists|taken/i.test(msg)) return { erro: "email_em_uso", mensagem: msg };
    return { erro: "falhou", mensagem: msg };
  }
  limparBatismo();
  // 02/09: 21 dos 24 pagantes web de 01–02/09 estavam sem utm no perfil —
  // persistLeadSource só rodava no signUp clássico, e o batismo não é signUp.
  try {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.id) {
      const { persistLeadSource } = await import("@/lib/lead-source");
      await persistLeadSource(supabase as unknown as Parameters<typeof persistLeadSource>[0], data.user.id);
    }
  } catch { /* atribuição nunca pode impedir o acesso */ }
  return { erro: null };
}
