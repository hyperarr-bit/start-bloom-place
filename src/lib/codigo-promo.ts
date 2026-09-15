/**
 * CÓDIGO PROMOCIONAL — "segue no Instagram e ganha 7 dias" (14/09).
 *
 * Par do resgatar-codigo (edge function). Dois momentos:
 *  - No paywall de ENTRADA a pessoa ainda não tem conta (v48: cadastro vem
 *    depois de "pagar"). Aqui só VALIDA o código, guarda no aparelho e o
 *    funil segue pro cadastro como se tivesse pago.
 *  - Na tela "Liberando", com a conta recém-nascida, `resgatarPendente()`
 *    troca o código guardado pelo acesso. Em Planos (conta existente) o
 *    resgate é direto.
 *
 * O acesso vira uma linha em `subscriptions` (payment_method "codigo") —
 * o check-subscription já a lê. iPhone não tem essa porta (3.1.1).
 */
import { supabase } from "@/integrations/supabase/client";
import { plataformaApp } from "@/lib/native-shell";
import { trackEvent } from "@/lib/analytics";

export const CHAVE_CODIGO_PENDENTE = "core-codigo-pendente";

export type ErroDeCodigo = "invalido" | "vencido" | "esgotado" | "ja_usado" | "ja_tem_acesso" | "sem_login" | "plataforma" | "rede";

export interface Resultado {
  ok: boolean;
  dias?: number;
  ate?: string;
  erro?: ErroDeCodigo;
}

export const MENSAGENS: Record<ErroDeCodigo, string> = {
  invalido: "Esse código não existe. Confere se digitou igual à mensagem.",
  vencido: "Esse código venceu.",
  esgotado: "Esse código já foi usado por todo mundo que podia.",
  ja_usado: "Essa conta já usou um código. É um por pessoa.",
  ja_tem_acesso: "Sua conta já tem acesso — o código não é necessário.",
  sem_login: "Entra na sua conta pra usar o código.",
  plataforma: "Código não disponível nesta plataforma.",
  rede: "Não deu pra conferir agora. Vê a conexão e tenta de novo.",
};

export const normalizarCodigo = (v: string) => v.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 24);

const chamar = async (body: Record<string, unknown>): Promise<Resultado> => {
  try {
    const { data, error } = await supabase.functions.invoke("resgatar-codigo", {
      body: { ...body, plataforma: plataformaApp() },
    });
    if (error || !data) return { ok: false, erro: "rede" };
    if (data.erro) return { ok: false, erro: data.erro as ErroDeCodigo };
    return { ok: true, dias: data.dias, ate: data.ate };
  } catch {
    return { ok: false, erro: "rede" };
  }
};

/** Só confere (sem conta). Se vale, guarda no aparelho pro resgate depois do cadastro. */
export const validarCodigo = async (codigo: string): Promise<Resultado> => {
  const c = normalizarCodigo(codigo);
  if (!c) return { ok: false, erro: "invalido" };
  const r = await chamar({ codigo: c, apenasValidar: true });
  trackEvent("codigo_validado", { codigo: c, ok: r.ok, erro: r.erro ?? "" });
  if (r.ok) guardarPendente(c);
  return r;
};

/** Cria o acesso na conta logada. */
export const resgatarCodigo = async (codigo: string): Promise<Resultado> => {
  const c = normalizarCodigo(codigo);
  if (!c) return { ok: false, erro: "invalido" };
  let sessao = "";
  try { sessao = sessionStorage.getItem("core_session_id") ?? ""; } catch { /* sem storage */ }
  const r = await chamar({ codigo: c, sessao });
  trackEvent("codigo_resgate", { codigo: c, ok: r.ok, erro: r.erro ?? "" });
  return r;
};

export const guardarPendente = (codigo: string) => {
  try { localStorage.setItem(CHAVE_CODIGO_PENDENTE, codigo); } catch { /* sem storage */ }
};
export const lerPendente = (): string | null => {
  try { return localStorage.getItem(CHAVE_CODIGO_PENDENTE); } catch { return null; }
};
export const limparPendente = () => {
  try { localStorage.removeItem(CHAVE_CODIGO_PENDENTE); } catch { /* sem storage */ }
};

/**
 * Chamado na tela "Liberando" logo que a conta existe. Devolve null se não
 * havia código guardado. Erro de rede mantém o código guardado (a próxima
 * abertura tenta de novo); erro definitivo (inválido, já usado…) limpa.
 */
export const resgatarPendente = async (): Promise<Resultado | null> => {
  const c = lerPendente();
  if (!c) return null;
  const r = await resgatarCodigo(c);
  if (r.ok || r.erro !== "rede") limparPendente();
  return r;
};
