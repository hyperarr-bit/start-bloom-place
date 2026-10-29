/**
 * CONTA: E-MAIL E SENHA ESTANDO LOGADA (29/10).
 *
 * Caso real do suporte: "gostaria de alterar meu e-mail, pois não estou conseguindo redefinir minha senha para acessar
 * no computador". Até aqui o app só tinha o "Redefinir senha" (manda um link pro e-mail — que é justamente o que não
 * chegava) e nenhuma porta pra trocar o e-mail. Esta lib é o miolo das duas telas (pages/conta/Conta.tsx):
 *
 *  · CRIAR OU TROCAR SENHA logada: `updateUser({ password })` direto, sem e-mail no meio. Serve também pra quem entrou só
 *    com Google/Apple — passa a ter senha pra usar no computador. Se o painel tiver "Secure password change" ligado, o
 *    Supabase responde `reauthentication_needed`: a tela pede o código que o `reauthenticate()` manda pro e-mail e
 *    repete com `nonce`.
 *  · TROCAR E-MAIL: `updateUser({ email })`. NESTE PROJETO a troca de quem JÁ TEM e-mail passa por confirmação (medido
 *    em 01/09, lib/sessao-anonima: só a conta ANÔNIMA ganha e-mail na hora, por causa do `mailer_autoconfirm: true`).
 *    Se o "Secure email change" estiver ligado, o link vai pros DOIS e-mails e a troca só vale depois dos dois. O código
 *    trata os dois casos pelo que o Supabase devolve: `user.email` já é o novo → "aplicado"; `user.new_email` → "pendente".
 *  · A ASSINATURA NÃO MUDA: o acesso é por `user_id` (check-subscription). `subscriptions.customer_email` fica com o
 *    e-mail antigo DE PROPÓSITO — é por ele que o cakto-webhook acha a pessoa numa renovação que a Cakto ainda manda com
 *    o e-mail da compra (fallback depois do auth.users). Nada aqui toca em assinatura.
 *
 * Conta anônima (comprou na web sem e-mail) não usa nada disto: ela tem a folha "Salve seu acesso".
 */
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getAuthRedirectUrl } from "@/lib/utils";

export const SENHA_MINIMA = 8;
export const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const EMAIL_SUPORTE = "contato@coreaplicativo.com.br";

type UsuarioDaConta = Pick<User, "email" | "is_anonymous" | "identities" | "app_metadata" | "user_metadata"> & { new_email?: string | null };

/** Quem vê "Sua conta" com e-mail e senha: conta com e-mail e que não é anônima. */
export function podeGerenciarConta(user: UsuarioDaConta | null | undefined): boolean {
  return !!user && !!user.email && user.is_anonymous !== true;
}

export interface ComoEntra {
  senha: boolean;
  google: boolean;
  apple: boolean;
  /** "E-mail e senha", "Google", "Google e senha", "Apple"… */
  rotulo: string;
}

/**
 * Como a pessoa entra hoje. As identities dizem os provedores ("email" = senha); quem entrou com Google e criou senha
 * por aqui não ganha identity "email" no Supabase — por isso a marca `tem_senha` no user_metadata, gravada junto com a
 * senha na mesma chamada.
 */
export function comoEntra(user: UsuarioDaConta | null | undefined): ComoEntra {
  const provedores = new Set<string>();
  for (const i of user?.identities ?? []) if (i?.provider) provedores.add(i.provider);
  const doApp = (user?.app_metadata as { providers?: unknown; provider?: unknown } | undefined) ?? {};
  if (Array.isArray(doApp.providers)) for (const p of doApp.providers) if (typeof p === "string") provedores.add(p);
  if (typeof doApp.provider === "string") provedores.add(doApp.provider);
  const marcou = (user?.user_metadata as { tem_senha?: unknown } | undefined)?.tem_senha === true;
  const senha = provedores.has("email") || marcou;
  const google = provedores.has("google");
  const apple = provedores.has("apple");
  const partes = [google && "Google", apple && "Apple", senha && (google || apple ? "senha" : "E-mail e senha")].filter(Boolean) as string[];
  const rotulo = partes.length === 0 ? "E-mail e senha" : partes.length === 1 ? partes[0] : `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
  return { senha: senha || (!google && !apple), google, apple, rotulo };
}

/* ───────────── senha ───────────── */

export type ResultadoSenha =
  | { ok: true }
  | { ok: false; erro: "curta" | "diferentes" | "mesma" | "fraca" | "reautenticar" | "codigo_errado" | "limite" | "sessao" | "falhou"; mensagem: string };

const MENSAGEM_SENHA: Record<Exclude<ResultadoSenha, { ok: true }>["erro"], string> = {
  curta: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`,
  diferentes: "As duas senhas não estão iguais.",
  mesma: "Essa já é a sua senha. Escolha uma diferente.",
  fraca: "Essa senha é fácil de adivinhar. Misture letras e números.",
  reautenticar: "Por segurança, confirme com o código que mandamos pro seu e-mail.",
  codigo_errado: "Código errado ou vencido. Confira no seu e-mail ou peça outro.",
  limite: "Muitas tentativas agora. Espere alguns minutos e tente de novo.",
  sessao: "Sua sessão expirou. Saia e entre de novo pra trocar a senha.",
  falhou: "Não consegui salvar agora. Confira a internet e tente de novo.",
};

type ErroDoAuth = { message?: string; code?: string; status?: number } | null | undefined;

function codigoDoErro(e: ErroDoAuth): string {
  return `${e?.code ?? ""} ${e?.message ?? ""}`.toLowerCase();
}

/** Valida e salva a senha nova. `nonce` = o código do e-mail, só quando o Supabase pediu reautenticação. */
export async function salvarSenha(senha: string, confirmacao: string, nonce?: string): Promise<ResultadoSenha> {
  const falha = (erro: Exclude<ResultadoSenha, { ok: true }>["erro"]): ResultadoSenha => ({ ok: false, erro, mensagem: MENSAGEM_SENHA[erro] });
  if (senha.length < SENHA_MINIMA) return falha("curta");
  if (senha !== confirmacao) return falha("diferentes");
  try {
    const { error } = await supabase.auth.updateUser({ password: senha, data: { tem_senha: true }, ...(nonce ? { nonce } : {}) });
    if (!error) return { ok: true };
    const c = codigoDoErro(error);
    if (/same_password|different from the old/.test(c)) return falha("mesma");
    if (/weak_password|weak|pwned|leaked/.test(c)) return falha("fraca");
    if (/reauthentication_not_valid|nonce|otp|token has expired|invalid.*code/.test(c)) return falha(nonce ? "codigo_errado" : "reautenticar");
    if (/reauthentication_needed|reauthenticat/.test(c)) return falha("reautenticar");
    if (/rate|too many|429/.test(c) || error.status === 429) return falha("limite");
    if (/session|jwt|not authenticated|session_not_found/.test(c) || error.status === 401 || error.status === 403) return falha("sessao");
    return falha("falhou");
  } catch {
    return falha("falhou");
  }
}

/** Manda o código de reautenticação pro e-mail da conta. */
export async function pedirCodigoDeSeguranca(): Promise<boolean> {
  try {
    const { error } = await supabase.auth.reauthenticate();
    return !error;
  } catch {
    return false;
  }
}

/* ───────────── e-mail ───────────── */

export type ResultadoEmail =
  | { ok: true; estado: "aplicado" | "pendente"; email: string }
  | { ok: false; erro: "invalido" | "diferentes" | "mesmo" | "em_uso" | "limite" | "sessao" | "falhou"; mensagem: string };

const MENSAGEM_EMAIL: Record<Exclude<ResultadoEmail, { ok: true }>["erro"], string> = {
  invalido: "Esse e-mail parece errado. Confere?",
  diferentes: "Os dois e-mails não estão iguais.",
  mesmo: "Esse já é o e-mail da sua conta.",
  em_uso: "Esse e-mail já está em outra conta do CORE. Entre nela ou fale com o suporte que a gente ajuda.",
  limite: "Já mandamos e-mails demais agora. Espere alguns minutos e tente de novo.",
  sessao: "Sua sessão expirou. Saia e entre de novo pra trocar o e-mail.",
  falhou: "Não consegui trocar agora. Confira a internet e tente de novo.",
};

export const limparEmail = (e: string): string => e.trim().toLowerCase();

/**
 * Pede a troca do e-mail. Devolve "aplicado" quando o Supabase já trocou (confirmação desligada) e "pendente" quando
 * mandou o link de confirmação (o caso deste projeto pra conta que já tem e-mail).
 */
export async function trocarEmail(novo: string, confirmacao: string, atual: string | null | undefined): Promise<ResultadoEmail> {
  const falha = (erro: Exclude<ResultadoEmail, { ok: true }>["erro"]): ResultadoEmail => ({ ok: false, erro, mensagem: MENSAGEM_EMAIL[erro] });
  const email = limparEmail(novo);
  if (!EMAIL_VALIDO.test(email)) return falha("invalido");
  if (email !== limparEmail(confirmacao)) return falha("diferentes");
  if (atual && email === limparEmail(atual)) return falha("mesmo");
  try {
    const { data, error } = await supabase.auth.updateUser({ email }, { emailRedirectTo: getAuthRedirectUrl("/auth/callback") });
    if (error) {
      const c = codigoDoErro(error);
      if (/email_exists|already|registered|exists|taken/.test(c)) return falha("em_uso");
      if (/email_address_invalid|invalid.*email|validation_failed|unable to validate email/.test(c)) return falha("invalido");
      if (/rate|too many|over_email_send/.test(c) || error.status === 429) return falha("limite");
      if (/session|jwt|not authenticated/.test(c) || error.status === 401 || error.status === 403) return falha("sessao");
      return falha("falhou");
    }
    const u = data?.user as (User & { new_email?: string | null }) | undefined;
    if (u?.email && limparEmail(u.email) === email && !u.new_email) return { ok: true, estado: "aplicado", email };
    return { ok: true, estado: "pendente", email };
  } catch {
    return falha("falhou");
  }
}

/**
 * Avisa o e-mail ATUAL que pediram a troca (função aviso-troca-email). Fogo e esquece: sem a função publicada a chamada
 * falha calada e a troca segue igual. A função só escreve pro e-mail que a própria conta tem no servidor.
 */
export function avisarEmailAntigo(): void {
  try {
    void supabase.functions.invoke("aviso-troca-email", { body: {} }).catch(() => null);
  } catch { /* noop */ }
}

/** O link "falar com o suporte" com o assunto pronto (sem dados da conta no corpo). */
export function linkDoSuporte(assunto: string): string {
  return `mailto:${EMAIL_SUPORTE}?subject=${encodeURIComponent(assunto)}`;
}
