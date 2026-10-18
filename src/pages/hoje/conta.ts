/**
 * A SESSÃO E A CONTA DO /hoje (18/10) — o Pix nasce SEM e-mail; a conta ganha o e-mail DEPOIS de pagar.
 *
 *   1. "Pagar com Pix" → sessão ANÔNIMA (lib/sessao-anonima `garantirSessao`; o asaas-pix exige usuário pra gravar o
 *      `pix_order_created`, que é o elo pagamento ↔ conta). Quem já está logado paga na própria conta.
 *   2. A sessão anônima é o ÚNICO acesso à compra até o e-mail entrar. O navegador do Instagram zera o storage com a
 *      página viva (memória atribuicao_web_zerada_instagram) — e o supabase-js lê a sessão do storage. Por isso uma
 *      CÓPIA dos tokens fica no heap (atualizada a cada refresh) e volta pro cliente se o storage sumir.
 *   3. Depois de pagar: 1 campo de e-mail →
 *        · e-mail livre → entra NA MESMA conta (updateUser; autoconfirm) — a compra já está nela;
 *        · e-mail que já tem conta → guarda a sessão anônima (`guardarCompraAnonima`), entra na conta existente com o
 *          código do e-mail e o `pix-vincular` traz TODAS as linhas de Pix pra ela. Nunca 2ª conta;
 *   4. Na conta final: as Finanças montadas (as MESMAS chaves do app: finance-incomes / finance-fixed-expenses, só se
 *      ela ainda não tem Finanças), o kit (core-kit-primeiro-mes), a atribuição (user_metadata.hoje, só se ausente) e
 *      as boas-vindas por e-mail (asaas-pix `boas_vindas`, 1x por pedido).
 */
import { supabase } from "@/integrations/supabase/client";
import { definirEmailDaCompra, garantirSessao, guardarCompraAnonima, limparBatismo, vincularCompraAnonima } from "@/lib/sessao-anonima";
import { CHAVE_KIT, itensParaGravar, type Conta } from "./conteudo";

/* ───────────────────────── a cópia da sessão no heap ───────────────────────── */

type Tokens = { access_token: string; refresh_token: string };
let copia: Tokens | null = null;
let ouvindo = false;
/** Só testes. */
export const _zerarCopiaSessao = (): void => { copia = null; ouvindo = false; };

function ouvir(): void {
  if (ouvindo) return;
  ouvindo = true;
  try {
    supabase.auth.onAuthStateChange((_ev, s) => {
      if (s?.access_token && s.refresh_token) copia = { access_token: s.access_token, refresh_token: s.refresh_token };
    });
  } catch { /* sem o listener, a cópia é a da criação */ }
}

async function guardarCopia(): Promise<void> {
  ouvir();
  try {
    const { data } = await supabase.auth.getSession();
    const s = data?.session;
    if (s?.access_token && s.refresh_token) copia = { access_token: s.access_token, refresh_token: s.refresh_token };
  } catch { /* noop */ }
}

/** Garante a sessão viva antes de falar com o servidor: sumiu do storage → volta a cópia do heap. */
export async function sessaoViva(): Promise<boolean> {
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session) { await guardarCopia(); return true; }
    if (!copia) return false;
    const { data: d2, error } = await supabase.auth.setSession(copia);
    return !error && !!d2?.session;
  } catch {
    return false;
  }
}

export type SessaoPagar = "ok" | "indisponivel";
/** Abre (ou reaproveita) a sessão que vai pagar. */
export async function abrirSessaoParaPagar(): Promise<SessaoPagar> {
  if (await sessaoViva()) return "ok";
  const e = await garantirSessao();
  if (e === "indisponivel") return "indisponivel";
  await guardarCopia();
  return "ok";
}

/* ───────────────────────── o e-mail depois de pagar ───────────────────────── */

export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type ResultadoEmail =
  | { ok: true; via: "mesma_conta" | "nova" }
  | { ok: false; existe: true }
  | { ok: false; erro: string };

/** O e-mail da sessão atual (null = anônima crua / sem sessão). */
export async function emailAtual(): Promise<string | null> {
  try { const { data } = await supabase.auth.getUser(); return data?.user?.email ?? null; } catch { return null; }
}

/**
 * Grava o e-mail na conta que PAGOU. Nunca troca de conta sozinho: e-mail com conta → `existe` (a tela pede o código,
 * depois de guardar a sessão anônima pra o pix-vincular trazer a compra).
 */
export async function salvarEmailDaCompra(email: string): Promise<ResultadoEmail> {
  const limpo = email.trim().toLowerCase();
  if (!EMAIL_OK.test(limpo)) return { ok: false, erro: "Esse e-mail parece errado. Confere e tenta de novo." };
  if (!(await sessaoViva())) return { ok: false, erro: "Sua sessão caiu. Toque em “Tentar de novo” — sua compra está salva." };
  const atual = await emailAtual();
  if (atual && atual.toLowerCase() === limpo) return { ok: true, via: "mesma_conta" };
  if (atual) {
    // logada com OUTRA conta de verdade (pagou nela): o e-mail digitado não manda — a compra é desta conta
    return { ok: false, erro: `Você está na conta ${atual}. A compra ficou nela — é só abrir o CORE.` };
  }
  const r = await definirEmailDaCompra(limpo);
  if (!r.erro) { limparBatismo(); return { ok: true, via: "nova" }; }
  if (r.erro === "email_em_uso") { await guardarCompraAnonima(); return { ok: false, existe: true }; }
  if (r.erro === "invalido") return { ok: false, erro: "Esse e-mail parece errado. Confere e tenta de novo." };
  return { ok: false, erro: "Não consegui salvar agora. Tenta de novo em alguns segundos — sua compra está salva." };
}

/**
 * Entrou na conta que já existia (código do e-mail): traz a compra da sessão anônima. Devolve se a conta tem o
 * acesso agora (movida, ou a compra já estava nela).
 */
export async function trazerCompraParaConta(): Promise<"movida" | "nao_moveu" | "falhou"> {
  limparBatismo();
  try {
    const { data } = await supabase.auth.getSession();
    const uid = data?.session?.user?.id;
    if (!uid) return "falhou";
    if (await vincularCompraAnonima(uid, true)) return "movida";
    // não moveu: quase sempre a conta já tinha assinatura ativa (a compra ficou na anônima — caso de suporte/reembolso)
    return "nao_moveu";
  } catch {
    return "falhou";
  }
}

/* ───────────────────────── o que vai pra conta final ───────────────────────── */

type Cliente = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
const db = supabase as unknown as Cliente;

const cheia = (v: unknown) => Array.isArray(v) && v.length > 0;

/**
 * As Finanças montadas nas MESMAS chaves do app. Só se a conta ainda não tem receita nem fixo (conta que já usa
 * Finanças nunca é tocada). Nunca lança. Devolve o que fez.
 */
export async function gravarFinancas(renda: number, contas: Conta[], agora: Date = new Date()): Promise<"gravou" | "ja_tinha" | "sem_dados" | "falhou"> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const uid = s?.session?.user?.id;
    if (!uid) return "falhou";
    const { receita, fixos } = itensParaGravar(renda, contas, agora);
    if (!receita.length && !fixos.length) return "sem_dados";
    const { data: atuais, error: e1 } = await db.from("user_data").select("key, value").eq("user_id", uid).in("key", ["finance-incomes", "finance-fixed-expenses"]);
    if (e1) return "falhou";
    if ((atuais ?? []).some((r: { value: unknown }) => cheia(r.value))) return "ja_tinha";
    const linhas = [
      ...(receita.length ? [{ user_id: uid, key: "finance-incomes", value: receita }] : []),
      ...(fixos.length ? [{ user_id: uid, key: "finance-fixed-expenses", value: fixos }] : []),
    ];
    const { error } = await db.from("user_data").upsert(linhas, { onConflict: "user_id,key" });
    return error ? "falhou" : "gravou";
  } catch {
    return "falhou";
  }
}

/** O kit do order bump: a chave da conta que o app lê pra liberar o conteúdo. */
export async function gravarKit(pedido: string, agora: Date = new Date()): Promise<boolean> {
  try {
    const { data: s } = await supabase.auth.getSession();
    const uid = s?.session?.user?.id;
    if (!uid) return false;
    const { error } = await db.from("user_data").upsert(
      { user_id: uid, key: CHAVE_KIT, value: { comprado: true, em: agora.toISOString(), pedido, origem: "hoje" } },
      { onConflict: "user_id,key" },
    );
    return !error;
  } catch {
    return false;
  }
}

/** A atribuição e as respostas na conta (user_metadata.hoje, só se ausente) + a origem do lead. Nunca lança. */
export async function gravarAtribuicao(hoje: Record<string, unknown>): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser();
    const u = data?.user;
    if (!u) return;
    if (!(u.user_metadata as Record<string, unknown> | undefined)?.hoje) await supabase.auth.updateUser({ data: { hoje } });
    try {
      const { persistLeadSource } = await import("@/lib/lead-source");
      await persistLeadSource(supabase, u.id);
    } catch { /* atribuição nunca impede nada */ }
  } catch { /* noop */ }
}

/** As boas-vindas da compra (o servidor manda 1x por pedido, com o acesso FINAL e as lojas). */
export async function pedirBoasVindas(pedido: string): Promise<void> {
  try { await supabase.functions.invoke("asaas-pix", { body: { action: "boas_vindas", id: pedido } }); } catch { /* o e-mail é extra */ }
}
