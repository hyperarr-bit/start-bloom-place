/**
 * PORTA v4 (12/10): o LEMBRETE por e-mail pra quem criou a conta na /comece e não entrou no app —
 * as regras puras (supabase/functions/_shared/porta-lembretes.ts), o e-mail (email-porta.ts) e a ligação
 * na função porta-handoff + o SQL do cron (que NÃO é migração).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEMBRETE1_ATE_MIN, LEMBRETE1_DE_MIN, decidirLembrete, filtroBasico, horaBrasilia, inicioDoDiaBrasilia, janelaDoLembrete,
  segredoConfere, type SinaisDaConta,
} from "../../supabase/functions/_shared/porta-lembretes";
import { ASSUNTO_LEMBRETE, htmlLembrete } from "../../supabase/functions/_shared/email-porta";

const iso = (s: string) => new Date(s);

describe("janelas", () => {
  it("1º lembrete: contas criadas entre 120 e 60 min atrás", () => {
    const agora = iso("2026-10-12T15:00:00Z");
    const j = janelaDoLembrete(1, agora)!;
    expect(j.de.toISOString()).toBe("2026-10-12T13:00:00.000Z");
    expect(j.ate.toISOString()).toBe("2026-10-12T14:00:00.000Z");
    expect([LEMBRETE1_DE_MIN, LEMBRETE1_ATE_MIN]).toEqual([60, 120]);
  });

  it("2º lembrete: só das 9h às 12h de Brasília, pra contas criadas ONTEM (dia de Brasília)", () => {
    // 12/10 08:59 BRT = 11:59Z → ainda não
    expect(janelaDoLembrete(2, iso("2026-10-12T11:59:00Z"))).toBeNull();
    // 12/10 09:00 BRT = 12:00Z → 11/10 00:00 BRT (03:00Z) até 12/10 00:00 BRT
    const j = janelaDoLembrete(2, iso("2026-10-12T12:00:00Z"))!;
    expect(j.de.toISOString()).toBe("2026-10-11T03:00:00.000Z");
    expect(j.ate.toISOString()).toBe("2026-10-12T03:00:00.000Z");
    expect(janelaDoLembrete(2, iso("2026-10-12T14:59:00Z"))).not.toBeNull(); // 11h59 BRT
    expect(janelaDoLembrete(2, iso("2026-10-12T15:00:00Z"))).toBeNull(); // meio-dia BRT
    // 01h BRT ainda é o dia anterior em Brasília
    expect(horaBrasilia(iso("2026-10-12T02:00:00Z"))).toBe(23);
    expect(inicioDoDiaBrasilia(iso("2026-10-12T02:00:00Z")).toISOString()).toBe("2026-10-11T03:00:00.000Z");
  });
});

describe("quem recebe", () => {
  const agora = iso("2026-10-12T15:00:00Z");
  const j = janelaDoLembrete(1, agora)!;
  const ok: SinaisDaConta = { criadaEm: "2026-10-12T13:30:00Z", temPorta: true, email: "ana@exemplo.com", ehIos: true, temApp: false, jaRecebeu: false };

  it("conta da Porta, iPhone, sem app, sem lembrete: manda", () => {
    expect(decidirLembrete(j, ok)).toEqual({ manda: true });
  });

  it("cada motivo de não mandar", () => {
    expect(decidirLembrete(j, { ...ok, temPorta: false })).toEqual({ manda: false, motivo: "sem_porta" });
    expect(decidirLembrete(j, { ...ok, email: null })).toEqual({ manda: false, motivo: "sem_email" });
    expect(decidirLembrete(j, { ...ok, email: "fulano+portaqa1@gmail.com" })).toEqual({ manda: false, motivo: "email_teste" });
    expect(decidirLembrete(j, { ...ok, criadaEm: "2026-10-12T14:10:00Z" })).toEqual({ manda: false, motivo: "fora_da_janela" }); // 50 min
    expect(decidirLembrete(j, { ...ok, criadaEm: "2026-10-12T12:50:00Z" })).toEqual({ manda: false, motivo: "fora_da_janela" }); // 130 min
    expect(decidirLembrete(j, { ...ok, criadaEm: null })).toEqual({ manda: false, motivo: "fora_da_janela" });
    expect(decidirLembrete(j, { ...ok, ehIos: false })).toEqual({ manda: false, motivo: "nao_ios" });
    expect(decidirLembrete(j, { ...ok, temApp: true })).toEqual({ manda: false, motivo: "ja_entrou_no_app" });
    expect(decidirLembrete(j, { ...ok, jaRecebeu: true })).toEqual({ manda: false, motivo: "ja_recebeu" });
  });

  it("o filtro barato decide antes de qualquer consulta", () => {
    expect(filtroBasico(j, { criadaEm: ok.criadaEm, temPorta: true, email: ok.email })).toEqual({ manda: true });
    expect(filtroBasico(j, { criadaEm: ok.criadaEm, temPorta: false, email: ok.email })).toEqual({ manda: false, motivo: "sem_porta" });
  });

  it("o segredo do cron confere em tempo constante e recusa vazio", () => {
    expect(segredoConfere("abc123", "abc123")).toBe(true);
    expect(segredoConfere("abc124", "abc123")).toBe(false);
    expect(segredoConfere("abc", "abc123")).toBe(false);
    expect(segredoConfere("", "")).toBe(false); // sem PORTA_CRON_SECRET configurado, ninguém entra
  });
});

describe("o e-mail do lembrete", () => {
  it("assunto curto, botão 'Entrar no CORE' com o código NOVO, reserva https, a resposta dela; sem preço", () => {
    expect(ASSUNTO_LEMBRETE[1]).toBe("Seu plano de 3 dias está te esperando");
    expect(ASSUNTO_LEMBRETE[2]).toBe("Seu Dia 1 ainda está te esperando");
    const html = htmlLembrete({ email: "ana@exemplo.com", metodo: "senha", codigo: "ABCDEFGH23", n: 1, dor: "Gasto sem perceber" });
    expect(html).toContain('href="core://entrar?h=ABCDEFGH23"');
    expect(html).toContain(">Entrar no CORE</a>");
    expect(html).toContain('href="https://coreaplicativo.com.br/abrir?h=ABCDEFGH23"');
    expect(html).toContain("Você disse: <b>“Gasto sem perceber”</b>");
    expect(html).toContain("Seus 3 dias grátis começam quando você entrar.");
    expect(html).toContain("baixar?origem=porta_lembrete1");
    expect(html).toContain("Digite <b>ana@exemplo.com</b> e a sua senha");
    expect(html).not.toMatch(/R\$|\d+,90|sem cart[aã]o|anual|mensal/i);
    // método e escape
    expect(htmlLembrete({ email: "a@b.com", metodo: "google", codigo: "X", n: 2 })).toContain("Continuar com Google");
    expect(htmlLembrete({ email: "a@b.com", metodo: "apple", codigo: "X", n: 2 })).toContain("Seu Dia 1 continua pronto no app.");
    expect(htmlLembrete({ email: "<x>@b.com", metodo: "senha", codigo: "X", n: 1, dor: "<script>" })).not.toMatch(/<x>|<script>/);
    const saida = process.env.PORTA_LEMBRETE_HTML;
    if (saida) writeFileSync(saida, html);
  });
});

describe("a função e o cron", () => {
  const raiz = process.cwd();
  const fn = readFileSync(join(raiz, "supabase/functions/porta-handoff/index.ts"), "utf8");
  const sqlPath = join(raiz, "supabase/cron/porta-lembretes.sql");

  it("ação 'lembretes' só com o segredo do cron (header x-cron-secret = PORTA_CRON_SECRET)", () => {
    expect(fn).toContain('if (acao === "lembretes")');
    expect(fn).toContain('segredoConfere(req.headers.get("x-cron-secret") ?? "", Deno.env.get("PORTA_CRON_SECRET") ?? "")');
    expect(fn).toContain('return json({ erro: "proibido" }, 403)');
  });

  it("código novo: grava, manda e SÓ DEPOIS invalida os antigos; e-mail falhou = apaga o novo; registra 1x por lembrete", () => {
    const corpo = fn.slice(fn.indexOf("async function rodarLembrete"), fn.indexOf("serve(async"));
    const iInsert = corpo.indexOf('from("porta_handoff").insert');
    const iEnvio = corpo.indexOf("await enviarEmail(");
    const iInvalida = corpo.indexOf('usado_por: "substituido"');
    expect(iInsert).toBeGreaterThan(0);
    expect(iEnvio).toBeGreaterThan(iInsert);
    expect(iInvalida).toBeGreaterThan(iEnvio);
    expect(corpo).toContain('.neq("codigo_hash", hash)');
    expect(corpo).toContain('from("porta_handoff").delete().eq("codigo_hash", hash)');
    expect(corpo).toContain('event_name: "porta_lembrete_enviado", event_data: { n,');
    expect(corpo).toContain('.contains("event_data", { n })');
    expect(corpo).toContain("if (ensaio) { enviaria++; continue; }");
  });

  it("sinal de app: código resgatado no app, assinatura, eventos do app, sessão nativa", () => {
    const corpo = fn.slice(fn.indexOf("async function temSinalDeApp"), fn.indexOf("async function ehDoIphone"));
    expect(corpo).toContain('.like("usado_por", "app:%")');
    expect(corpo).toContain('from("subscriptions")');
    expect(corpo).toContain("EVENTOS_DO_APP");
    expect(corpo).toContain('["app_device_info", "webview_info"]');
  });

  it("SQL do cron a cada 15 min, fora das migrações, segredo do Vault no header", () => {
    expect(existsSync(sqlPath)).toBe(true);
    const sql = readFileSync(sqlPath, "utf8");
    expect(sql).toContain("'*/15 * * * *'");
    expect(sql).toContain("'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'porta_cron_secret'");
    expect(sql).toContain("jsonb_build_object('acao', 'lembretes')");
    expect(sql).toContain("/functions/v1/porta-handoff");
    expect(existsSync(join(raiz, "supabase/migrations/porta-lembretes.sql"))).toBe(false);
  });
});
