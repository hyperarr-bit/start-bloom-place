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
import DarPresenteRota from "@/pages/presente/DarPresente";

const TOKEN = "Tk".padEnd(32, "x");
const PIX = { orderId: "qr_pv_1", qrCode: "00020126PIXDOPRESENTE5204000053039865405" + "14.90" + "6304ABCD", qrCodeBase64: null, expiresAt: new Date(Date.now() + 23.5 * 3600e3).toISOString() };

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
    expect(screen.getByTestId("dar-validade").textContent).toMatch(/Vale por mais 2[23] h/);
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

  it("confere sozinha a cada 4 s (Asaas 1 vez a cada 3)", async () => {
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

  it("token vencido → 'Esse link não vale mais'; erro de Pix → 'Tentar de novo' gera de novo", async () => {
    estadoDia3.mockResolvedValueOnce({ ok: false, motivo: "token" });
    montar(`?t=${TOKEN}`);
    expect(await screen.findByTestId("dar-token")).toBeTruthy();
    expect(screen.getByText("Esse link não vale mais")).toBeTruthy();
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
    expect((await screen.findByTestId("dar-saiu")).textContent).toContain("Pronto, sem ofertas por e-mail");
    expect(sairDia3).toHaveBeenCalledWith(TOKEN);
    expect(estadoDia3).not.toHaveBeenCalled();
  });
});
