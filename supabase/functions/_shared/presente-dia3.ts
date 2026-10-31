/**
 * O PRESENTE NO DIA 3 (31/10, PLANO.md §C — novidades-guardadas/2026-10-31/upsell-2027-presente). "Leve alguém junto":
 * o CORE pra sempre de presente por R$ 14,90 (oferta `pv149`, a mesma do upsell de 21/10), oferecido 3 dias DEPOIS da
 * compra do vitalício na web — quando a pessoa já usou o app — e não logo depois do pagamento.
 *
 *   c1 · e-mail único no dia 3 (passada nova dentro do cron que já existe, o pix-pendente-email; secret PRESENTE_DIA3=on,
 *        sem ele = off). Quem recebe (`motivoDia3`): vitalício web ativo (linha `pix`, vitalícia, `amount_cents > 0`),
 *        72–96 h depois da compra, das 9h às 20h de Brasília, com e-mail e fora das contas de teste, que ENTROU no app
 *        (`module_analytics` 30 min ou mais depois da compra), nunca comprou presente e nunca recebeu este e-mail
 *        (trava `pv149-d3-email:<conta>` reservada antes de mandar e solta se o envio falhar).
 *   c2 · o aviso discreto na página Você (src/lib/presente-aviso.ts) — o toque pede o mesmo link pela ação `dia3_token`.
 *
 * O e-mail NÃO leva o código Pix: leva um botão com um TOKEN (32 letras, `pv149-d3-t:<token>` → a conta). A página
 * /presente/dar abre com o token e o Pix é gerado NA HORA em que ela abre (pré-aquecido: o toque em "Copiar o Pix" já
 * copia). Por quê: um Pix gerado no envio venceria em 24 h e quem abre o e-mail no dia 5 cairia num código morto; e o
 * painel da Asaas não enche de QR de quem nunca abriu. O Pix é o de upsell (`garantirPixUpsell`, 24 h, 1 por conta:
 * chave `pv149-d3:<conta>`), com `pix_order_created.user_id = a conta` — o elo que o check, o webhook e o reconcile
 * usam pra virar código de presente (`garantirPresente`) e mandar o link por e-mail (`mandarLinkPorEmail`).
 *
 * Sem sessão na página (quem toca no e-mail quase nunca está logado no navegador): o token responde o estado
 * (`estadoDia3`): o Pix, ou "pago" + o código do presente pro cartão do WhatsApp. Se o webhook ainda não chegou, o
 * estado confere na Asaas e cria o código (idempotente; a UTMify e o e-mail do link continuam com o webhook/reconcile,
 * pelas travas próprias). Pixel: o presente não manda Purchase pra Meta (META_PURCHASE_UPSELL = false).
 *
 * Sem Deno: banco mínimo + Asaas injetada — testado no vitest com banco falso (src/test/presente-dia3.test.ts).
 */
import { garantirPixUpsell, chavePresenteDia3, chavePixUpsell, type CriarQr } from "./pix-upsell.ts";
import {
  OFERTA_PRESENTE, PRECO_PRESENTE_CENTAVOS, garantirPresente, presentePorPedido, reservar, soltar, temPraSempre, nomeNoCartao, type LinhaMin,
} from "./presente.ts";
import { registroDoPedido } from "./registro-pedido.ts";
import { valorCobre } from "./trava-grant.ts";
import { ehEmailTeste } from "./aviso-venda.ts";

// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ClienteMin = { from: (t: string) => any };

/* ───────────────────────── a chave ───────────────────────── */

/** Secret do servidor: "on" liga o e-mail do dia 3. Sem o secret (ou qualquer outro valor) = off. */
export const SECRET_PRESENTE_DIA3 = "PRESENTE_DIA3";
export const dia3Ligado = (valor: string | null | undefined): boolean => valor === "on";

/* ───────────────────────── quem recebe ───────────────────────── */

const H = 3600e3;
export const JANELA_DIA3 = { deMs: 72 * H, ateMs: 96 * H } as const;
/** Das 9h às 20h (Brasília, UTC−3 sem horário de verão). */
export const HORA_DIA3 = { de: 9, ate: 20 } as const;
export const horaDeMandar = (agora: number): boolean => {
  const h = new Date(agora - 3 * H).getUTCHours();
  return h >= HORA_DIA3.de && h < HORA_DIA3.ate;
};
/** "Entrou no app" = uso registrado 30 min ou mais depois da compra (a demo da landing, no mesmo navegador, logo
 *  depois do Pix, não conta — e a partir deste ramo a demo nem grava: src/lib/caminho-demo.ts). */
export const ENTROU_DEPOIS_MS = 30 * 60e3;
export const MAX_ENVIOS_POR_PASSADA = 40;

export type LinhaDia3 = {
  user_id?: string | null; created_at?: string | null; status?: string | null; payment_method?: string | null;
  billing_period?: string | null; plan?: string | null; amount_cents?: number | null;
};
/** Vitalício web pago: linha Pix, ativa, vitalícia, com valor (o presente recebido é "presente", não "pix"). */
export const ehVitalicioWeb = (l: LinhaDia3): boolean =>
  l.payment_method === "pix" && l.status === "active" && (l.billing_period === "lifetime" || l.plan === "lifetime") && Number(l.amount_cents) > 0;

export type MotivoDia3 = "ok" | "nao_e_vitalicio_web" | "fora_da_janela" | "fora_do_horario" | "sem_email" | "teste" | "nao_entrou" | "ja_comprou" | "ja_avisado";

/** Puro: esta conta recebe o e-mail do dia 3 agora? A ordem é a do custo (o que não precisa de banco vem antes). */
export function motivoDia3(a: {
  linha: LinhaDia3; agora: number; email: string | null; entrouNoApp: boolean; jaComprouPresente: boolean; jaAvisado: boolean;
}): MotivoDia3 {
  if (!ehVitalicioWeb(a.linha)) return "nao_e_vitalicio_web";
  const t = Date.parse(String(a.linha.created_at ?? ""));
  if (!Number.isFinite(t)) return "fora_da_janela";
  const idade = a.agora - t;
  if (idade < JANELA_DIA3.deMs || idade >= JANELA_DIA3.ateMs) return "fora_da_janela";
  if (!horaDeMandar(a.agora)) return "fora_do_horario";
  if (a.jaAvisado) return "ja_avisado";
  if (!a.email) return "sem_email";
  if (ehEmailTeste(a.email)) return "teste";
  if (a.jaComprouPresente) return "ja_comprou";
  if (!a.entrouNoApp) return "nao_entrou";
  return "ok";
}

/* ───────────────────────── o token do link ───────────────────────── */

export const chaveEnvioDia3 = (uid: string): string => `pv149-d3-email:${uid}`;
export const chaveTokenDia3 = (t: string): string => `pv149-d3-t:${t}`;
export const chaveTokenDoDono = (uid: string): string => `pv149-d3-td:${uid}`;
/** O link do e-mail vale 30 dias (o Pix é gerado quando a página abre, então não morre com ele). */
export const TOKEN_VALIDO_MS = 30 * 24 * H;
const ALFABETO_TOKEN = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
export const TAMANHO_TOKEN = 32;
const RE_TOKEN = new RegExp(`^[A-Za-z0-9]{${TAMANHO_TOKEN}}$`);
export const tokenValido = (t: unknown): t is string => typeof t === "string" && RE_TOKEN.test(t);

export function gerarToken(aleatorio: (n: number) => Uint8Array = (n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); return b; }): string {
  const limite = 256 - (256 % ALFABETO_TOKEN.length);
  let out = "";
  while (out.length < TAMANHO_TOKEN) {
    for (const b of aleatorio(TAMANHO_TOKEN * 2)) {
      if (b >= limite) continue;
      out += ALFABETO_TOKEN[b % ALFABETO_TOKEN.length];
      if (out.length === TAMANHO_TOKEN) break;
    }
  }
  return out;
}

async function lerEvento(admin: ClienteMin, id: string): Promise<Record<string, unknown> | null> {
  const { data } = await admin.from("webhook_events").select("id, event").eq("id", id);
  const l = (Array.isArray(data) ? data[0] : data) as { event?: unknown } | undefined;
  if (!l || typeof l.event !== "string") return null;
  try { const v = JSON.parse(l.event); return v && typeof v === "object" ? v as Record<string, unknown> : null; } catch { return null; }
}

/** O token desta conta (1 por conta, reaproveitado enquanto vale; o e-mail e o aviso do app usam o MESMO). null = falhou. */
export async function tokenDoDono(admin: ClienteMin, dono: string, a: { agora?: number; gerar?: () => string } = {}): Promise<string | null> {
  const agora = a.agora ?? Date.now();
  try {
    const ja = await lerEvento(admin, chaveTokenDoDono(dono));
    const valeAte = (em: unknown) => Number(em) + TOKEN_VALIDO_MS;
    if (ja && tokenValido(ja.t) && valeAte(ja.em) - agora > 7 * 24 * H) return ja.t;
    const t = (a.gerar ?? (() => gerarToken()))();
    const { error: e1 } = await admin.from("webhook_events").insert({ id: chaveTokenDia3(t), source: "presente", event: JSON.stringify({ dono, em: agora }) });
    if (e1) return null;
    const marca = JSON.stringify({ t, em: agora });
    if (!ja) {
      const { error: e2 } = await admin.from("webhook_events").insert({ id: chaveTokenDoDono(dono), source: "presente", event: marca });
      if (e2) { // corrida: o outro caminho criou o dele primeiro — vale o dele
        const outro = await lerEvento(admin, chaveTokenDoDono(dono));
        return outro && tokenValido(outro.t) ? outro.t : null;
      }
    } else {
      await admin.from("webhook_events").update({ event: marca }).eq("id", chaveTokenDoDono(dono));
    }
    return t;
  } catch { return null; }
}

/** De quem é este token (e se ainda vale). null = não existe, venceu ou é lixo. */
export async function donoDoToken(admin: ClienteMin, t: unknown, agora: number = Date.now()): Promise<string | null> {
  if (!tokenValido(t)) return null;
  try {
    const v = await lerEvento(admin, chaveTokenDia3(t));
    if (!v || typeof v.dono !== "string" || !v.dono) return null;
    if (agora - Number(v.em) > TOKEN_VALIDO_MS) return null;
    return v.dono;
  } catch { return null; }
}

/* ───────────────────────── o link e o e-mail ───────────────────────── */

export const SITE = "https://www.coreaplicativo.com.br";
export function linkDarPresente(a: { t: string; site?: string; origem?: string }): string {
  const q = new URLSearchParams({ t: a.t, utm_source: a.origem ?? "email_dia3", utm_medium: "email", utm_campaign: "presente_dia3" });
  return `${a.site ?? SITE}/presente/dar?${q.toString()}`;
}
/** "Não quero ofertas por e-mail" (crítica r1): a mesma página, com `sair=1` — grava a recusa pelo token (sem login). */
export function linkSairDia3(a: { t: string; site?: string }): string {
  const q = new URLSearchParams({ t: a.t, sair: "1", utm_source: "email_dia3", utm_medium: "email" });
  return `${a.site ?? SITE}/presente/dar?${q.toString()}`;
}

/** A recusa de ofertas por e-mail desta conta (o cron do dia 3 confere antes de mandar). */
export const chaveRecusaOfertas = (uid: string): string => `ofertas-email-nao:${uid}`;
/** Grava a recusa pelo token do link (idempotente). Nunca lança. */
export async function sairDia3(admin: ClienteMin, a: { t: unknown; agora?: number }): Promise<{ ok: boolean }> {
  try {
    const dono = await donoDoToken(admin, a.t, a.agora ?? Date.now());
    if (!dono) return { ok: false };
    const { error } = await admin.from("webhook_events").insert({ id: chaveRecusaOfertas(dono), source: "presente", event: JSON.stringify({ em: a.agora ?? Date.now(), via: "email_dia3" }) });
    if (!error) await admin.from("analytics_events").insert({ user_id: dono, event_name: "ofertas_email_recusou", event_data: { via: "email_dia3" } }).then(() => {}, () => {});
    return { ok: true };
  } catch { return { ok: false }; }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const assuntoDia3 = (): string => "Leve alguém junto";

/** O e-mail do dia 3 (curto, sem gênero, sem "só hoje", sem brinde). */
export function htmlDia3(a: { link: string; nome?: string | null; sair?: string | null }): string {
  const oi = a.nome ? `${esc(a.nome)}, ` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3f2f7;font-family:-apple-system,Segoe UI,Roboto,Inter,sans-serif;color:#16121c;">
<div style="max-width:520px;margin:0 auto;padding:28px 20px;">
  <div style="background:#fff;border-radius:22px;padding:26px 22px;border:1px solid #ebe6ef;" data-email="presente-dia3">
    <div style="font-size:12px;font-weight:800;letter-spacing:.08em;color:#d6338a;text-transform:uppercase;">De presente</div>
    <h1 style="font-size:24px;line-height:1.2;margin:10px 0 8px;">Leve alguém junto 💛</h1>
    <p style="font-size:15.5px;line-height:1.5;margin:0 0 6px;color:#3b3542;">${oi}dê o CORE pra sempre pra quem você quer bem.</p>
    <p style="font-size:15.5px;line-height:1.5;margin:0 0 18px;color:#3b3542;"><b style="color:#16121c;">R$ 14,90, uma vez.</b> Sem mensalidade.<br><span style="font-size:14px;color:#6b6575;">Preço de presente, só pra quem já tem o CORE.</span></p>
    <a href="${esc(a.link)}" style="display:block;background:#16121c;color:#fff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 24px;border-radius:999px;text-align:center;">Dar de presente</a>
    <p style="font-size:13px;line-height:1.5;margin:14px 0 0;color:#6b6575;">Você paga no Pix e recebe um link pra mandar no WhatsApp. Quem abrir cria a conta e ganha o CORE pra sempre.</p>
    <p style="font-size:14px;line-height:1.5;margin:20px 0 0;color:#5b5560;">Um abraço,<br>Equipe CORE</p>
  </div>
  <p style="font-size:11px;color:#8a838f;text-align:center;margin:14px 0 0;">Você recebeu este e-mail porque tem o CORE pra sempre. É uma mensagem só, não vamos repetir.${a.sair ? `<br><a href="${esc(a.sair)}" style="color:#8a838f;text-decoration:underline;">Não quero ofertas por e-mail</a>` : ""}</p>
</div></body></html>`;
}
export const previewDia3 = (site: string = SITE): { assunto: string; html: string } =>
  ({ assunto: assuntoDia3(), html: htmlDia3({ link: linkDarPresente({ t: "PREVIEWxxxxxxxxxxxxxxxxxxxxxxxxx", site, origem: "email_dia3_preview" }), nome: "João", sair: linkSairDia3({ t: "PREVIEWxxxxxxxxxxxxxxxxxxxxxxxxx", site }) }) });

/* ───────────────────────── a passada do cron ───────────────────────── */

export type ResultadoDia3 = {
  candidatos: number; enviados: number; foraDoHorario: number; naoEntrou: number; jaComprou: number; jaAvisados: number;
  semEmail: number; testes: number; falhas: number; recusou: number;
};

const primeiroNome = (n?: string | null) => String(n ?? "").trim().split(/\s+/)[0] || "";

/**
 * Uma passada (o cron roda a cada 10 min). Nunca lança; as contagens vão pro log (nada de e-mail/id).
 * `conta` lê o e-mail e o nome da conta (auth.admin); `enviar` manda pelo Resend e devolve true se saiu.
 */
export async function varrerPresenteDia3(admin: ClienteMin, deps: {
  agora?: number; site?: string;
  conta: (uid: string) => Promise<{ email: string | null; nome?: string | null }>;
  enviar: (para: string, assunto: string, html: string, tags: Record<string, string>) => Promise<boolean>;
  gerar?: () => string; max?: number;
}): Promise<ResultadoDia3> {
  const agora = deps.agora ?? Date.now();
  const r: ResultadoDia3 = { candidatos: 0, enviados: 0, foraDoHorario: 0, naoEntrou: 0, jaComprou: 0, jaAvisados: 0, semEmail: 0, testes: 0, falhas: 0, recusou: 0 };
  if (!horaDeMandar(agora)) { r.foraDoHorario = 1; return r; }
  const { data, error } = await admin.from("subscriptions")
    .select("user_id, created_at, status, payment_method, billing_period, plan, amount_cents")
    .eq("payment_method", "pix").eq("status", "active")
    .gte("created_at", new Date(agora - JANELA_DIA3.ateMs).toISOString())
    .lte("created_at", new Date(agora - JANELA_DIA3.deMs).toISOString())
    .limit(500);
  if (error) throw error;
  const vistas = new Set<string>();
  for (const linha of (data ?? []) as LinhaDia3[]) {
    const uid = String(linha.user_id ?? "");
    if (!uid || vistas.has(uid) || !ehVitalicioWeb(linha)) continue;
    vistas.add(uid);
    r.candidatos++;
    if (r.enviados >= (deps.max ?? MAX_ENVIOS_POR_PASSADA)) break;
    try {
      const jaAvisado = !!(await lerLinhaExiste(admin, chaveEnvioDia3(uid)));
      if (jaAvisado) { r.jaAvisados++; continue; }
      if (await lerLinhaExiste(admin, chaveRecusaOfertas(uid))) { r.recusou++; continue; } // o link do rodapé: não quer ofertas
      const { data: pres } = await admin.from("presentes").select("codigo").eq("comprador_id", uid).limit(1);
      const jaComprouPresente = Array.isArray(pres) && pres.length > 0;
      if (jaComprouPresente) { r.jaComprou++; continue; }
      const desde = new Date(Date.parse(String(linha.created_at)) + ENTROU_DEPOIS_MS).toISOString();
      const { data: uso } = await admin.from("module_analytics").select("user_id").eq("user_id", uid).gte("entered_at", desde).limit(1);
      const entrouNoApp = Array.isArray(uso) && uso.length > 0;
      if (!entrouNoApp) { r.naoEntrou++; continue; }
      const c = await deps.conta(uid).catch(() => ({ email: null, nome: null }));
      const m = motivoDia3({ linha, agora, email: c.email, entrouNoApp, jaComprouPresente, jaAvisado });
      if (m === "sem_email") { r.semEmail++; continue; }
      if (m === "teste") { r.testes++; continue; }
      if (m !== "ok") continue;
      if (!(await reservar(admin, chaveEnvioDia3(uid), "d3_email"))) { r.jaAvisados++; continue; }
      const t = await tokenDoDono(admin, uid, { agora, gerar: deps.gerar });
      if (!t) { await soltar(admin, chaveEnvioDia3(uid)); r.falhas++; continue; }
      const link = linkDarPresente({ t, site: deps.site });
      const foi = await deps.enviar(c.email!, assuntoDia3(), htmlDia3({ link, nome: primeiroNome(c.nome) || null, sair: linkSairDia3({ t, site: deps.site }) }), { presente: "d3" }).catch(() => false);
      if (!foi) { await soltar(admin, chaveEnvioDia3(uid)); r.falhas++; continue; }
      await admin.from("analytics_events").insert({ user_id: uid, event_name: "presente_d3_email_enviado", event_data: { compra_em: linha.created_at ?? null } })
        .then(() => {}, () => {});
      r.enviados++;
    } catch { r.falhas++; }
  }
  return r;
}

async function lerLinhaExiste(admin: ClienteMin, id: string): Promise<boolean> {
  const { data } = await admin.from("webhook_events").select("id").eq("id", id);
  return Array.isArray(data) ? data.length > 0 : !!data;
}

/* ───────────────────────── a página /presente/dar (sem login, pelo token) ───────────────────────── */

export type PixDia3 = { orderId: string; qrCode: string; qrCodeBase64: string | null; expiresAt: string };
export type RespostaDia3 =
  | { ok: false; motivo: "token" | "sem_acesso" | "pix" }
  | { ok: true; pago: true; pedido: string; codigo: string; de: string | null; resgatado: boolean }
  | { ok: true; pago: false; pix: PixDia3 | null };

/** O pagamento deste QR na Asaas (injetado). null = não deu pra saber. */
export type PagamentoNaAsaas = (orderId: string) => Promise<{ pago: boolean; valor: unknown } | null>;

/** O pedido é um Pix de presente DESTA conta? (o cliente manda o pedido: confere no registro do create) */
async function pedidoDoDono(admin: ClienteMin, pedido: string, dono: string): Promise<boolean> {
  const reg = (await registroDoPedido(admin, pedido))[0];
  return !!reg && reg.user_id === dono && (reg.event_data as { offer?: unknown } | null)?.offer === OFERTA_PRESENTE;
}

/**
 * O estado da página do presente pelo token: pago (o código pro cartão) ou o Pix (gerado agora com `gerar`, ou o que
 * já existe). `pedido` = o QR que a página está mostrando (pode ser um anterior ao guardado). Nunca lança.
 */
export async function estadoDia3(admin: ClienteMin, a: {
  t: unknown; pedido?: unknown; gerar?: boolean; criarQr: CriarQr; /** só com `conferir` (a página pede de vez em quando, não a cada 4 s) */ pagamento?: PagamentoNaAsaas; agora?: () => number;
}): Promise<RespostaDia3> {
  const agora = a.agora ?? (() => Date.now());
  try {
    const dono = await donoDoToken(admin, a.t, agora());
    if (!dono) return { ok: false, motivo: "token" };
    const guardado = await lerEvento(admin, chavePixUpsell(chavePresenteDia3(dono)));
    const pedidos = [...new Set([
      typeof a.pedido === "string" && /^[A-Za-z0-9_-]{4,80}$/.test(a.pedido) ? a.pedido : null,
      typeof guardado?.orderId === "string" ? guardado.orderId : null,
    ].filter(Boolean) as string[])];
    for (const pedido of pedidos) {
      let p = await presentePorPedido(admin, pedido);
      if (!p && a.pagamento && await pedidoDoDono(admin, pedido, dono)) {
        // o webhook ainda não chegou: confere na Asaas e cria o código (idempotente; UTMify + e-mail ficam com o webhook/reconcile)
        const pg = await a.pagamento(pedido).catch(() => null);
        if (pg?.pago && valorCobre(pg.valor, PRECO_PRESENTE_CENTAVOS)) {
          const g = await garantirPresente(admin, { orderId: pedido, compradorId: dono, valorCentavos: PRECO_PRESENTE_CENTAVOS });
          if (g) p = await presentePorPedido(admin, pedido);
        }
      }
      if (p && p.comprador_id === dono) return { ok: true, pago: true, pedido, codigo: p.codigo, de: p.de_nome ?? null, resgatado: !!p.resgatado_por };
    }
    if (!a.gerar) {
      const g = guardado;
      const vivo = g && typeof g.orderId === "string" && typeof g.payload === "string" && typeof g.expiresAt === "string" && Date.parse(g.expiresAt) > agora();
      return { ok: true, pago: false, pix: vivo ? { orderId: g!.orderId as string, qrCode: g!.payload as string, qrCodeBase64: null, expiresAt: g!.expiresAt as string } : null };
    }
    const { data: linhas } = await admin.from("subscriptions").select("status, plan, billing_period, current_period_end, abacatepay_billing_id").eq("user_id", dono);
    if (!temPraSempre((linhas ?? []) as LinhaMin[])) return { ok: false, motivo: "sem_acesso" };
    const pix = await garantirPixUpsell(admin, {
      chave: chavePresenteDia3(dono), dono, oferta: OFERTA_PRESENTE, valorCentavos: PRECO_PRESENTE_CENTAVOS, descricao: "CORE de presente",
      criarQr: a.criarQr, extraPedido: { origem: "dia3" }, agora,
    });
    if ("erro" in pix) return { ok: false, motivo: "pix" };
    return { ok: true, pago: false, pix: { orderId: pix.orderId, qrCode: pix.qrCode, qrCodeBase64: pix.qrCodeBase64, expiresAt: pix.expiresAt } };
  } catch { return { ok: false, motivo: "pix" }; }
}

/** O nome no cartão pelo token (só o comprador e só antes do resgate). */
export async function nomeDia3(admin: ClienteMin, a: { t: unknown; pedido: unknown; nome: unknown }): Promise<{ ok: boolean; de?: string | null }> {
  try {
    const dono = await donoDoToken(admin, a.t);
    if (!dono || typeof a.pedido !== "string") return { ok: false };
    const p = await presentePorPedido(admin, a.pedido);
    if (!p || p.comprador_id !== dono) return { ok: false };
    if (p.resgatado_por) return { ok: true, de: p.de_nome ?? null };
    const de = nomeNoCartao(a.nome);
    await admin.from("presentes").update({ de_nome: de }).eq("codigo", p.codigo);
    return { ok: true, de };
  } catch { return { ok: false }; }
}

/** O pagamento de um QR estático na Asaas (o mesmo GET do lembrete da landing, com o valor). */
export function pagamentoNaAsaas(buscar: (url: string, init: { headers: Record<string, string> }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>, apiKey: string): PagamentoNaAsaas {
  return async (orderId) => {
    if (!apiKey) return null;
    try {
      const r = await buscar(`https://api.asaas.com/v3/payments?pixQrCodeId=${encodeURIComponent(orderId)}&limit=10`, {
        headers: { access_token: apiKey, "User-Agent": "CORE/1.0 (Supabase Edge)" },
      });
      if (!r.ok) return null;
      const out = (await r.json().catch(() => ({}))) as { data?: Array<{ status?: string; value?: unknown }> };
      const pago = (out?.data ?? []).find((p) => ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(String(p?.status)));
      return { pago: !!pago, valor: pago?.value ?? null };
    } catch { return null; }
  };
}
