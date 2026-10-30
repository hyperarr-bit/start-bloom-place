import { supabase } from "@/integrations/supabase/client";

/**
 * Chamadas do /admin/suporte (30/10). Liberar Pix usa `transferir_pix`.
 * Trocar email usa `trocar_email`. Nenhuma das duas manda e-mail pra cliente.
 */

const EMAIL_CONTA = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const pedidoDoChamado = (msg: string): string | null =>
  msg.match(/^Pedido:\s*(\S+)/m)?.[1] ?? null;

export const limparEmailAdmin = (e: string) => e.trim().toLowerCase();

export const emailContaValido = (e: string) => EMAIL_CONTA.test(e);

type Resposta = Record<string, unknown>;

/** O invoke devolve o JSON no `data` (2xx) ou no `error.context` (4xx/5xx). */
export async function lerRespostaFuncao(
  data: unknown,
  error: { message?: string; context?: { json?: () => Promise<unknown> } } | null,
): Promise<Resposta> {
  const obj = (v: unknown): Resposta | null => (v && typeof v === "object" ? v as Resposta : null);
  const corpo = obj(data);
  if (corpo && "error" in corpo && corpo.error) return corpo;
  if (error?.context && typeof error.context.json === "function") {
    try {
      const j = obj(await error.context.json());
      if (j) return j;
    } catch { /* corpo ilegível */ }
  }
  if (error) return { error: error.message || "falhou" };
  return corpo ?? { ok: true };
}

export type ChamarAdmin = (body: Record<string, unknown>) => Promise<Resposta>;

export async function chamarAdminSuporte(body: Record<string, unknown>): Promise<Resposta> {
  const { data, error } = await supabase.functions.invoke("admin-suporte", { body });
  return lerRespostaFuncao(data, error);
}

const ERRO_PIX: Record<string, string> = {
  email_invalido: "Esse e-mail parece errado. Confere o formato.",
  destino_nao_encontrado: "Não achei uma conta com esse e-mail. Se a pessoa ainda não criou a conta, use Trocar email com o id da conta anônima. Se ela já tem conta, confere o e-mail. Daqui a gente não cria conta e não libera um acesso novo.",
  origem_nao_encontrada: "Não achei a conta do Pix.",
  origem_tem_email: "A conta do Pix já tem e-mail. Pra mudar o login, use Trocar email.",
  origem_sem_pix_ativo: "Essa conta não tem Pix ativo pra mover.",
  destino_ja_tem_assinatura: "A conta de destino já tem acesso próprio. Não movi o Pix.",
  pedido_nao_encontrado: "Não achei esse pedido. Confere o id (a linha “Pedido:” do chamado).",
  pedido_nao_bate: "O pedido não é da conta deste chamado. Não movi nada.",
  pedido_invalido: "Esse id de pedido não serve.",
  email_nao_bate: "O e-mail não é dessa conta de destino. Não movi nada.",
  forbidden: "Sem permissão de admin.",
  "deUid/paraUid inválidos": "Faltou a conta do Pix ou a conta de destino.",
};

const ERRO_EMAIL: Record<string, string> = {
  email_invalido: "O e-mail novo parece errado. Confere o formato.",
  origem_invalida: "Informa o e-mail atual (com @) ou o id da conta.",
  origem_nao_encontrada: "Não achei essa conta.",
  destino_ja_existe: "Esse e-mail já é de outra conta. Não troquei.",
  mesmo_email: "Esse já é o e-mail dessa conta.",
  assinatura_nao_atualizou: "O login já foi trocado, mas a assinatura não atualizou. Tenta de novo com o id da conta.",
  perfil_nao_atualizou: "O login já foi trocado, mas o perfil não atualizou. Tenta de novo com o id da conta.",
  forbidden: "Sem permissão de admin.",
};

/** Centavos → "R$ 27,90", sem depender do locale do navegador. */
const reaisDeCentavos = (cents: unknown): string => {
  const n = Number(cents);
  if (!Number.isFinite(n)) return "";
  const neg = n < 0;
  const abs = Math.abs(Math.round(n));
  const inteiro = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dec = String(abs % 100).padStart(2, "0");
  return `${neg ? "-" : ""}R$ ${inteiro},${dec}`;
};

export function textoLiberarPix(r: Resposta, emailDigitado: string): { ok: boolean; texto: string } {
  if (r.ok === true && !r.error) {
    const planBruto = String(r.plan ?? "");
    const plan = planBruto === "lifetime" ? "vitalício" : planBruto;
    const valor = reaisDeCentavos(r.amount_cents);
    const meio = [plan, valor].filter(Boolean).join(", ");
    return {
      ok: true,
      texto: `Pix liberado na conta ${emailDigitado}${meio ? ` (${meio})` : ""}. A pessoa entra com esse e-mail e o acesso vai junto. Nenhum e-mail foi enviado.`,
    };
  }
  const code = String(r.error ?? "falhou");
  const base = ERRO_PIX[code] ?? `Não liberou: ${code}`;
  const extra = r.mensagem ? ` ${String(r.mensagem)}` : "";
  return { ok: false, texto: base + extra };
}

export function textoTrocarEmail(r: Resposta, emailNovo: string): { ok: boolean; texto: string } {
  if (r.ok === true && !r.error) {
    const uid = String(r.uid ?? "");
    return {
      ok: true,
      texto: `E-mail de login trocado para ${emailNovo}${uid ? ` (conta ${uid})` : ""}. A pessoa entra com esse e-mail e continua com o acesso. Nenhum e-mail foi enviado.`,
    };
  }
  const code = String(r.error ?? "falhou");
  const base = ERRO_EMAIL[code] ?? `Não trocou: ${code}`;
  const extra = r.mensagem ? ` ${String(r.mensagem)}` : "";
  return { ok: false, texto: base + extra };
}

export const ERRO_PIX_EMAIL = ERRO_PIX.email_invalido;
export const ERRO_EMAIL_FORMATO = ERRO_EMAIL.email_invalido;
export const ERRO_EMAIL_ORIGEM = ERRO_EMAIL.origem_invalida;
