/**
 * /presente/dar (31/10) — a página do presente no DIA 3 (Pix de 1 toque pelo token), com a função presente-resgatar
 * mockada (src/presente/api). Nada de Pix de verdade.
 *   · com ?t=: abre já com o Pix (pré-aquecido) → "Copiar o Pix · R$ 14,90" copia no toque → "Pagou? Volte aqui"
 *     → a conferência acha pago → o cartão com o link /presente/<código> e "Enviar no WhatsApp";
 *   · sem token e sem login → "Abra pelo link do e-mail"; sem token e logado → pede o token da conta;
 *   · token vencido → "Esse link não vale mais"; erro → "Tentar de novo";
 *   · nenhum Purchase (pixel) e texto sem "só hoje".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

const authState: { user: { id: string; email: string | null; is_anonymous?: boolean } | null; loading: boolean } = { user: null, loading: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
const purchase = vi.hoisted(() => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => purchase);

const estadoDia3 = vi.fn();
const nomeDia3 = vi.fn(async () => true);
const tokenDia3 = vi.fn();
const sairDia3 = vi.fn(async () => true);
const copiarTexto = vi.fn(async () => true);
vi.mock("@/presente/api", async (orig) => ({
  ...(await orig<typeof import("@/presente/api")>()),
  estadoDia3: (...a: unknown[]) => estadoDia3(...a),
  nomeDia3: (...a: unknown[]) => nomeDia3(...(a as [])),
  tokenDia3: () => tokenDia3(),
  sairDia3: (...a: unknown[]) => sairDia3(...(a as [])),
  copiarTexto: (...a: unknown[]) => copiarTexto(...(a as [])),
  meuPresente: vi.fn(async () => null),
  gravarNomeDoPresente: vi.fn(async () => true),
}));

import { trackEvent } from "@/lib/analytics";
import DarPresenteRota, { LACO_DAR, valeAte } from "@/pages/presente/DarPresente";

const TOKEN = "Tk".padEnd(32, "x");
const PIX = { orderId: "qr_pv_1", qrCode: "00020126PIXDOPRESENTE5204000053039865405" + "14.90" + "6304ABCD", qrCodeBase64: null, expiresAt: new Date(Date.now() + 24 * 3600e3).toISOString() };

const montar = (busca: string) => {
  window.history.replaceState({}, "", `/presente/dar${busca}`);
  return render(
    <MemoryRouter initialEntries={[`/presente/dar${busca}`]}>
      <Routes>
        <Route path="/presente/dar" element={<DarPresenteRota />} />
        <Route path="/app" element={<div data-testid="app" />} />
        <Route path="/entrar" element={<div data-testid="entrar" />} />
      </Routes>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  authState.user = null; authState.loading = false;
  estadoDia3.mockReset(); tokenDia3.mockReset(); copiarTexto.mockClear(); nomeDia3.mockClear(); sairDia3.mockClear();
  try { localStorage.clear(); } catch { /* noop */ }
  vi.mocked(trackEvent).mockClear(); purchase.firePixPurchaseOnce.mockClear(); purchase.markPixPurchasePending.mockClear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("/presente/dar com o token do e-mail", () => {
  it("abre com o Pix pronto; 1 toque copia; 'Pagou? Volte aqui'; pago → cartão com WhatsApp", async () => {
    estadoDia3.mockResolvedValueOnce({ ok: true, pago: false, pix: PIX });
    montar(`?t=${TOKEN}&utm_source=email_dia3`);
    expect(await screen.findByTestId("dar-pix")).toBeTruthy();
    // pré-aquecido: o 1º pedido já gera (gerar: true), antes de qualquer toque
    expect(estadoDia3).toHaveBeenCalledWith(TOKEN, expect.objectContaining({ gerar: true }));
    expect(screen.getByText(/Leve alguém/)).toBeTruthy();
    expect(screen.getByText(/pra quem você quer bem/)).toBeTruthy();
    expect(screen.getByTestId("dar-codigo").textContent).toBe(PIX.qrCode);
    // crítica r2: código novo diz "Vale por 24 h" (não "mais 23 h", que parece código velho)
    expect(screen.getByTestId("dar-validade").textContent).toBe("Vale por 24 h");
    const botao = screen.getByTestId("dar-copiar");
    expect(botao.textContent).toMatch(/Copiar o Pix · R\$ 14,90/);
    fireEvent.click(botao);
    await waitFor(() => expect(copiarTexto).toHaveBeenCalledWith(PIX.qrCode));
    expect(await screen.findByTestId("dar-volte")).toBeTruthy();
    expect(screen.getByTestId("dar-volte").textContent).toMatch(/Pagou\? Volte aqui\. A tela muda sozinha\./);
    expect(screen.getByTestId("dar-copiar").textContent).toMatch(/Copiado/);
    expect(trackEvent).toHaveBeenCalledWith("presente_d3_copiar", expect.objectContaining({ ok: true, origem: "email_dia3" }));

    // a conferência (volta do app do banco) acha pago
    estadoDia3.mockResolvedValue({ ok: true, pago: true, pedido: "qr_pv_1", codigo: "ABCD2345", de: null, resgatado: false });
    await act(async () => { window.dispatchEvent(new Event("pageshow")); });
    expect(await screen.findByTestId("presente-cartao")).toBeTruthy();
    expect(estadoDia3).toHaveBeenLastCalledWith(TOKEN, expect.objectContaining({ pedido: "qr_pv_1", conferir: true }));
    expect(screen.getByTestId("presente-link").textContent).toMatch(/coreaplicativo\.com\.br\/presente\/ABCD2345/);
    const zap = screen.getByTestId("presente-whatsapp") as HTMLAnchorElement;
    expect(zap.href).toMatch(/^https:\/\/wa\.me\/\?text=/);
    expect(decodeURIComponent(zap.href)).toMatch(/presente\/ABCD2345/);
    expect(screen.getByTestId("presente-continuar").textContent).toBe("Pronto");
    expect(trackEvent).toHaveBeenCalledWith("presente_d3_pago", expect.anything());
    // o nome do cartão vai pelo token (sem sessão)
    fireEvent.change(screen.getByTestId("presente-nome"), { target: { value: "Ana" } });
    fireEvent.blur(screen.getByTestId("presente-nome"));
    await waitFor(() => expect(nomeDia3).toHaveBeenCalledWith(TOKEN, "qr_pv_1", "Ana"));
    // nenhum Purchase do pixel no upsell
    expect(purchase.firePixPurchaseOnce).not.toHaveBeenCalled();
    expect(purchase.markPixPurchasePending).not.toHaveBeenCalled();
  });

  it("confere sozinha a cada 4 s nos primeiros minutos (Asaas 1 vez a cada 3)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    estadoDia3.mockResolvedValueOnce({ ok: true, pago: false, pix: PIX });
    montar(`?t=${TOKEN}`);
    await screen.findByTestId("dar-pix");
    estadoDia3.mockResolvedValue({ ok: true, pago: false, pix: PIX });
    await act(async () => { await vi.advanceTimersByTimeAsync(12_100); });
    const conferencias = estadoDia3.mock.calls.slice(1).map((c) => (c[1] as { conferir?: boolean }).conferir);
    expect(conferencias.length).toBeGreaterThanOrEqual(3);
    expect(conferencias.slice(0, 3)).toEqual([false, false, true]);
  });

  it("já pago antes (reabriu o e-mail depois) → vai direto pro cartão", async () => {
    estadoDia3.mockResolvedValueOnce({ ok: true, pago: true, pedido: "qr_pv_1", codigo: "ZZZZ2345", de: "Ana", resgatado: false });
    montar(`?t=${TOKEN}`);
    expect(await screen.findByTestId("presente-cartao")).toBeTruthy();
    expect(screen.getByTestId("presente-cartao-de").textContent).toMatch(/Ana te deu/);
  });

  it("token vencido → 'Esse link venceu' + contato (sem mandar procurar a página Você); erro de Pix → 'Tentar de novo' gera de novo", async () => {
    estadoDia3.mockResolvedValueOnce({ ok: false, motivo: "token" });
    montar(`?t=${TOKEN}`);
    expect(await screen.findByTestId("dar-token")).toBeTruthy();
    expect(screen.getByText("Esse link venceu")).toBeTruthy();
    expect(screen.getByTestId("dar-token").textContent).toContain("contato@coreaplicativo.com.br");
    expect(screen.getByTestId("dar-token").textContent).not.toContain("página Você");
    cleanup();
    estadoDia3.mockResolvedValueOnce({ ok: false, motivo: "pix" }).mockResolvedValueOnce({ ok: true, pago: false, pix: PIX });
    montar(`?t=${TOKEN}`);
    expect(await screen.findByTestId("dar-erro")).toBeTruthy();
    fireEvent.click(screen.getByText("Tentar de novo"));
    expect(await screen.findByTestId("dar-pix")).toBeTruthy();
  });
});

describe("/presente/dar sem token", () => {
  it("sem login → 'Abra pelo link do e-mail' (nada de Pix)", async () => {
    montar("");
    expect(await screen.findByTestId("dar-sem_link")).toBeTruthy();
    expect(screen.getByTestId("dar-sem_link").textContent).not.toContain("página Você");
    expect(estadoDia3).not.toHaveBeenCalled();
  });
  it("sessão anônima conta como sem login", async () => {
    authState.user = { id: "anon", email: null, is_anonymous: true };
    montar("");
    expect(await screen.findByTestId("dar-sem_link")).toBeTruthy();
    expect(tokenDia3).not.toHaveBeenCalled();
  });
  it("logado (o caminho do aviso da página Você) → pede o token da conta e abre o Pix", async () => {
    authState.user = { id: "ana", email: "ana@exemplo.com.br" };
    tokenDia3.mockResolvedValueOnce(TOKEN);
    estadoDia3.mockResolvedValueOnce({ ok: true, pago: false, pix: PIX });
    montar("");
    expect(await screen.findByTestId("dar-pix")).toBeTruthy();
    expect(tokenDia3).toHaveBeenCalledTimes(1);
    expect(window.location.search).toMatch(new RegExp(`t=${TOKEN}`));
  });
  it("logado sem o CORE pra sempre → mensagem curta", async () => {
    authState.user = { id: "bia", email: "bia@exemplo.com.br" };
    tokenDia3.mockResolvedValueOnce(null);
    montar("");
    expect(await screen.findByTestId("dar-sem_acesso")).toBeTruthy();
  });
});

describe("o texto da página", () => {
  it("sem 'só hoje', sem contagem, sem gênero", async () => {
    estadoDia3.mockResolvedValueOnce({ ok: true, pago: false, pix: PIX });
    montar(`?t=${TOKEN}`);
    const tela = await screen.findByTestId("dar-pix");
    const texto = tela.textContent ?? "";
    expect(texto).not.toMatch(/só hoje|última chance|acaba em|\d\d:\d\d/i);
    expect(texto).not.toMatch(/\b(ele|ela|amiga|amigo|namorad[oa])\b/i);
    expect(texto).toMatch(/R\$ 14,90, uma vez\./);
  });
});

describe("crítica r1", () => {
  it("explica o preço: 'Preço de presente, só pra quem já tem o CORE'", async () => {
    estadoDia3.mockResolvedValueOnce({ ok: true, pago: false, pix: PIX });
    montar(`?t=${TOKEN}`);
    expect((await screen.findByTestId("dar-preco-presente")).textContent).toBe("Preço de presente, só pra quem já tem o CORE.");
  });
  it("voltar do banco (recarga) depois de copiar mantém 'Código copiado' + 'Pagou? Volte aqui'", async () => {
    estadoDia3.mockResolvedValue({ ok: true, pago: false, pix: PIX });
    const r = montar(`?t=${TOKEN}`);
    fireEvent.click(await screen.findByTestId("dar-copiar"));
    await screen.findByTestId("dar-volte");
    r.unmount();
    montar(`?t=${TOKEN}`);
    const volte = await screen.findByTestId("dar-volte");
    expect(volte.textContent).toContain("Código copiado.");
    expect(volte.textContent).toContain("Pagou? Volte aqui.");
  });
  it("?sair=1 (o rodapé do e-mail) grava a recusa e NÃO gera Pix", async () => {
    montar(`?t=${TOKEN}&sair=1`);
    expect((await screen.findByTestId("dar-saiu")).textContent).toContain("Pronto, esse e-mail não chega mais");
    expect(screen.getByTestId("dar-saiu").textContent).not.toMatch(/Não mandamos mais ofertas/);
    expect(sairDia3).toHaveBeenCalledWith(TOKEN);
    expect(estadoDia3).not.toHaveBeenCalled();
  });
});

describe("crítica r2", () => {
  it("o laço tem teto: 4 s nos 10 min (Asaas 1/3), 30 s até 30 min (Asaas sempre), depois para; a volta da aba confere", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    estadoDia3.mockResolvedValueOnce({ ok: true, pago: false, pix: PIX });
    montar(`?t=${TOKEN}`);
    await screen.findByTestId("dar-pix");
    estadoDia3.mockResolvedValue({ ok: true, pago: false, pix: PIX });
    const depois = () => estadoDia3.mock.calls.slice(1).map((c) => (c[1] as { conferir?: boolean }).conferir);
    await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60e3); });
    const rapido = depois();
    expect(rapido.length).toBeGreaterThanOrEqual(140);
    expect(rapido.length).toBeLessThanOrEqual(151);
    expect(rapido.filter(Boolean).length).toBeLessThanOrEqual(Math.ceil(rapido.length / 3) + 1);
    await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60e3); });
    const lento = depois().slice(rapido.length);
    expect(lento.length).toBeGreaterThanOrEqual(38);
    expect(lento.length).toBeLessThanOrEqual(41);
    expect(lento.every(Boolean)).toBe(true); // no modo lento cada conferência vai na Asaas (a cada 30 s)
    const n = estadoDia3.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60 * 60e3); });
    expect(estadoDia3.mock.calls.length).toBe(n); // parou
    // a volta do app do banco ainda confere (na Asaas)
    await act(async () => { window.dispatchEvent(new Event("pageshow")); await vi.advanceTimersByTimeAsync(10); });
    expect(estadoDia3.mock.calls.length).toBe(n + 1);
    expect(estadoDia3).toHaveBeenLastCalledWith(TOKEN, expect.objectContaining({ conferir: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60e3); });
    expect(estadoDia3.mock.calls.length).toBe(n + 1); // e não religa o laço depois dos 30 min
    expect(LACO_DAR).toMatchObject({ rapidoMs: 4000, lentoMs: 30_000, paraMs: 30 * 60e3 });
  });

  it("cópia negada → nada de 'Código copiado': pede o toque no código, que fica selecionável", async () => {
    copiarTexto.mockResolvedValueOnce(false);
    estadoDia3.mockResolvedValue({ ok: true, pago: false, pix: PIX });
    montar(`?t=${TOKEN}`);
    fireEvent.click(await screen.findByTestId("dar-copiar"));
    const falta = await screen.findByTestId("dar-copia-falhou");
    expect(falta.textContent).toContain("Toque no código pra copiar.");
    expect(screen.queryByTestId("dar-volte")).toBeNull();
    expect(screen.getByTestId("dar-copiar").textContent).toMatch(/Copiar o Pix · R\$ 14,90/);
    expect(screen.getByTestId("dar-copiar").textContent).not.toMatch(/Copiado/);
    expect((screen.getByTestId("dar-codigo") as HTMLElement).style.userSelect).toBe("all");
    expect(localStorage.getItem("presente-d3-copiado")).toBeNull();
  });

  it("'Já paguei' confere na Asaas; não caiu → 'Ainda não chegou'", async () => {
    estadoDia3.mockResolvedValue({ ok: true, pago: false, pix: PIX });
    montar(`?t=${TOKEN}`);
    fireEvent.click(await screen.findByTestId("dar-copiar"));
    fireEvent.click(await screen.findByTestId("dar-ja-paguei"));
    expect((await screen.findByTestId("dar-aviso")).textContent).toContain("Ainda não chegou");
    expect(estadoDia3).toHaveBeenLastCalledWith(TOKEN, expect.objectContaining({ pedido: "qr_pv_1", conferir: true }));
  });

  it("pago: a tela diz que o link também foi pro e-mail; 'Link copiado' só quando copiou", async () => {
    estadoDia3.mockResolvedValueOnce({ ok: true, pago: true, pedido: "qr_pv_1", codigo: "ZZZZ2345", de: null, resgatado: false });
    copiarTexto.mockResolvedValueOnce(false);
    montar(`?t=${TOKEN}`);
    expect((await screen.findByTestId("presente-nota")).textContent).toContain("O link também foi pro seu e-mail");
    fireEvent.click(screen.getByTestId("presente-copiar"));
    expect(await screen.findByTestId("presente-copia-falhou")).toBeTruthy();
    expect(screen.getByTestId("presente-copiar").textContent).not.toContain("Link copiado");
  });

  it("validade: 24 h num código novo, 'mais N h' depois", () => {
    const agora = Date.parse("2026-10-31T12:00:00Z");
    expect(valeAte(new Date(agora + 24 * 3600e3 - 1000).toISOString(), agora)).toBe("Vale por 24 h");
    expect(valeAte(new Date(agora + 23 * 3600e3).toISOString(), agora)).toBe("Vale por mais 23 h");
    expect(valeAte(new Date(agora + 30 * 60e3).toISOString(), agora)).toBe("Vale por mais 30 min");
  });
});
