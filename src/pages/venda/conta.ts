/**
 * A CONTA DA VENDA (/assinar, 15/10) — nasce NO PAGAMENTO, só com nome + e-mail (sem senha, sem CPF: o Pix da
 * Asaas é QR estático e não pede documento; o cartão a Cakto pede no checkout dela).
 *
 * Caminho mais seguro que já existe (lib/sessao-anonima, o funil B de 30/09):
 *   1. sessão ANÔNIMA + o e-mail gravado nela ANTES de qualquer cobrança (`definirEmailDaCompra`). O e-mail aplica
 *      na hora (mailer_autoconfirm) e a conta passa a ter um e-mail de verdade: o Pix casa pelo `pix_order_created`
 *      (user_id + id do QR) e o cartão casa pelo e-mail (o cakto-webhook procura o usuário pelo e-mail da compra,
 *      que vai PRÉ-PREENCHIDO no checkout). Ninguém fica órfão;
 *   2. e-mail que já tem conta → ANTES do dinheiro: entra na conta (senha ou código por e-mail) e paga NELA.
 *      Nunca cria 2ª conta. Nada de `liberar_vitalicio`;
 *   3. sign-in anônimo desligado no painel → `signUp` com uma senha aleatória (a pessoa entra no app pelo código
 *      do e-mail ou pelo "abrir o app já logado"; a senha nunca é mostrada nem usada).
 * No app, a pessoa entra com o MESMO e-mail ("Entrar" → "Entrar sem senha — receber código por e-mail").
 * A campanha fica em `user_metadata.venda` (só se ausente) — NÃO em `porta` (os lembretes da Porta falam de
 * "3 dias grátis", que não é o caso de quem pagou).
 */
import { supabase } from "@/integrations/supabase/client";
import { definirEmailDaCompra, guardarCompraAnonima, limparBatismo } from "@/lib/sessao-anonima";
import { getAuthRedirectUrl } from "@/lib/utils";
import type { AtribuicaoPorta } from "@/pages/porta/atribuicao";

export type VendaNaConta = {
  v: 1;
  attr: AtribuicaoPorta | null;
  respostas: Record<string, string | null>;
  plano: string;
  metodo: string;
  venda_session_id: string;
  criado_em: string;
};

export type ResultadoConta =
  | { ok: true; nova: boolean }
  | { ok: false; existe: true }
  | { ok: false; erro: string };

export const EMAIL_OK = /^\S+@\S+\.\S{2,}$/;
const JA_EXISTE = /already registered|already been registered|user already|already exists|taken/i;

const senhaAleatoria = (): string => {
  try {
    const b = new Uint8Array(24);
    crypto.getRandomValues(b);
    return `V!${Array.from(b, (x) => x.toString(36).padStart(2, "0")).join("")}`;
  } catch {
    return `V!${Date.now().toString(36)}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  }
};

/** Grava nome (só em conta nova) e a venda (só se ausente). Nunca lança, nunca bloqueia o pagamento. */
async function gravarDados(nome: string, venda: VendaNaConta, contaNova: boolean): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
    const novo: Record<string, unknown> = {};
    if (!meta.venda) novo.venda = venda;
    if (contaNova && nome.trim()) { novo.full_name = nome.trim(); novo.display_name = nome.trim(); }
    if (Object.keys(novo).length) await supabase.auth.updateUser({ data: novo });
    if (contaNova) {
      if (nome.trim()) {
        try { await supabase.from("profiles").update({ display_name: nome.trim() }).eq("id", u.id); } catch { /* noop */ }
      }
      try {
        const { persistLeadSource } = await import("@/lib/lead-source");
        await persistLeadSource(supabase, u.id);
      } catch { /* atribuição nunca impede o pagamento */ }
    }
  } catch { /* noop */ }
}

/**
 * Deixa a sessão pronta pra pagar com ESTE e-mail.
 *  · já logada com o mesmo e-mail → segue nela;
 *  · logada com OUTRO e-mail (conta de verdade) → sai e segue com o e-mail digitado;
 *  · senão: anônima + e-mail (ou o signUp de reserva).
 */
export async function prepararConta(args: { email: string; nome: string; venda: VendaNaConta }): Promise<ResultadoConta> {
  const email = args.email.trim().toLowerCase();
  if (!EMAIL_OK.test(email)) return { ok: false, erro: "Esse e-mail parece errado. Confere e tenta de novo." };

  const { data: sess } = await supabase.auth.getSession();
  const atual = sess?.session?.user ?? null;
  if (atual?.email && atual.email.toLowerCase() === email) {
    await gravarDados(args.nome, args.venda, false);
    return { ok: true, nova: false };
  }
  if (atual?.email) await supabase.auth.signOut();

  const r = await definirEmailDaCompra(email);
  if (!r.erro) {
    await gravarDados(args.nome, args.venda, true);
    return { ok: true, nova: true };
  }
  if (r.erro === "invalido") return { ok: false, erro: "Esse e-mail parece errado. Confere e tenta de novo." };
  if (r.erro === "email_em_uso") {
    void guardarCompraAnonima();
    return { ok: false, existe: true };
  }
  if (r.mensagem === "sem_sessao") {
    // sign-in anônimo desligado: conta comum com senha aleatória (o e-mail é o que importa)
    const { data, error } = await supabase.auth.signUp({
      email,
      password: senhaAleatoria(),
      options: { data: { venda: args.venda, full_name: args.nome.trim(), display_name: args.nome.trim() }, emailRedirectTo: getAuthRedirectUrl("/auth/callback") },
    });
    if (error && JA_EXISTE.test(error.message || "")) return { ok: false, existe: true };
    if (!error && data?.session) {
      await gravarDados(args.nome, args.venda, true);
      return { ok: true, nova: true };
    }
    if (!error && data?.user && !data.session) return { ok: false, existe: true }; // e-mail já cadastrado (resposta ofuscada)
    return { ok: false, erro: "Não consegui seguir agora. Tenta de novo em alguns segundos." };
  }
  return { ok: false, erro: "Não consegui seguir agora. Tenta de novo em alguns segundos." };
}

/** E-mail que já tem conta: entra com a senha dela (antes do dinheiro, nada fica órfão). */
export async function entrarComSenha(email: string, senha: string, nome: string, venda: VendaNaConta): Promise<boolean> {
  await guardarCompraAnonima();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: senha });
  if (error) return false;
  limparBatismo();
  await gravarDados(nome, venda, false);
  return true;
}

/** Entrou pela conta existente com o código do e-mail (EntrarComCodigo): só grava a venda. */
export async function entrouPorCodigo(nome: string, venda: VendaNaConta): Promise<void> {
  limparBatismo();
  await gravarDados(nome, venda, false);
}
