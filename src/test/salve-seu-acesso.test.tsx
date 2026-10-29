/**
 * "SALVE SEU ACESSO" (29/10) — a folha obrigatória de quem pagou numa conta ANÔNIMA sem e-mail (o pagante órfão da
 * landing, caso #10 de 29/10). Usuários no formato do supabase-js (User com is_anonymous, email "" na anônima crua).
 * Cobre: aparece / não aparece em cada caso, o e-mail livre (updateUser), o e-mail com conta (código + transferência
 * pelo pix-vincular, ou suporte — nunca liberar_vitalicio), e o fechar/reabrir (remontar com a mesma conta).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type U = { id: string; email?: string; is_anonymous?: boolean; aud: string; role: string; app_metadata: Record<string, unknown>; user_metadata: Record<string, unknown>; created_at: string };
const h = vi.hoisted(() => ({
  auth: { user: null as unknown, isSubscribed: true, subLoaded: true },
  nativo: false,
  salvar: vi.fn(),
  trazer: vi.fn(),
  verifyOtp: vi.fn(),
  signInWithOtp: vi.fn(async () => ({ data: {}, error: null })),
  refresh: vi.fn(async () => ({ data: {}, error: null })),
  eventos: [] as Array<[string, Record<string, unknown>]>,
}));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => h.auth }));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => h.nativo }));
vi.mock("@/lib/analytics", () => ({ trackEvent: (n: string, d: Record<string, unknown>) => { h.eventos.push([n, d]); } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { verifyOtp: h.verifyOtp, signInWithOtp: h.signInWithOtp, refreshSession: h.refresh } },
}));
vi.mock("@/pages/hoje/conta", () => ({ salvarEmailDaCompra: h.salvar, trazerCompraParaConta: h.trazer }));

import SalveSeuAcesso, { deveMostrarSalveAcesso } from "@/components/account/SalveSeuAcesso";

/** auth.users de verdade: a anônima crua da landing (email "" / is_anonymous true) e a conta com e-mail */
const anonima: U = { id: "5d7f0c2e-3b1a-4c9e-8f6d-2a1b0c9d8e7f", email: "", is_anonymous: true, aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-10-29T11:37:12.000Z" };
const comEmail: U = { ...anonima, email: "maria@email.com", is_anonymous: false };

beforeEach(() => {
  cleanup();
  h.auth = { user: anonima, isSubscribed: true, subLoaded: true };
  h.nativo = false; h.eventos.length = 0;
  for (const f of [h.salvar, h.trazer, h.verifyOtp, h.signInWithOtp, h.refresh]) f.mockClear();
});

describe("quando aparece", () => {
  const base = { user: anonima, isSubscribed: true, subLoaded: true, nativo: false, emIframe: false };
  it("anônima + sem e-mail + assinatura ativa, no site → aparece", () => {
    expect(deveMostrarSalveAcesso(base)).toBe(true);
  });
  it("NÃO aparece: conta com e-mail, sem assinatura, assinatura ainda não lida, app da loja, dentro do iframe da demo, sem usuário", () => {
    expect(deveMostrarSalveAcesso({ ...base, user: comEmail })).toBe(false);
    expect(deveMostrarSalveAcesso({ ...base, isSubscribed: false })).toBe(false);
    expect(deveMostrarSalveAcesso({ ...base, subLoaded: false })).toBe(false);
    expect(deveMostrarSalveAcesso({ ...base, nativo: true })).toBe(false);
    expect(deveMostrarSalveAcesso({ ...base, emIframe: true })).toBe(false);
    expect(deveMostrarSalveAcesso({ ...base, user: null })).toBe(false);
    expect(deveMostrarSalveAcesso({ ...base, user: { ...anonima, is_anonymous: false } })).toBe(false);
  });
  it("no app da loja não existe sessão anônima: o signInAnonymously só roda nos funis da web (SoNaWeb / PixCheckout fora do app)", () => {
    const raiz = resolve(__dirname, "../..");
    const anon = readFileSync(resolve(raiz, "src/lib/sessao-anonima.ts"), "utf8");
    expect(anon).toContain("supabase.auth.signInAnonymously()");
    const app = readFileSync(resolve(raiz, "src/App.tsx"), "utf8");
    for (const rota of ["/hoje", "/organizar/demo", "/assinar", "/missao"]) expect(app).toMatch(new RegExp(`path="${rota}" element={<SoNaWeb>`));
    const protegida = readFileSync(resolve(raiz, "src/components/ProtectedRoute.tsx"), "utf8");
    expect(protegida).toContain("user && !user.email && !isNativeShell() ? <SalveSeuAcesso />");
  });
});

describe("a folha", () => {
  it("renderiza só nos casos certos (e o evento 'visto' 1x por carga)", () => {
    h.auth = { user: comEmail, isSubscribed: true, subLoaded: true };
    const { unmount } = render(<SalveSeuAcesso />);
    expect(screen.queryByTestId("salve-acesso")).toBeNull();
    unmount();
    h.nativo = true; h.auth = { user: anonima, isSubscribed: true, subLoaded: true };
    render(<SalveSeuAcesso />);
    expect(screen.queryByTestId("salve-acesso")).toBeNull();
    cleanup(); h.nativo = false;
    h.auth = { user: anonima, isSubscribed: false, subLoaded: true };
    render(<SalveSeuAcesso />);
    expect(screen.queryByTestId("salve-acesso")).toBeNull();
    cleanup();
    h.auth = { user: anonima, isSubscribed: true, subLoaded: true };
    render(<SalveSeuAcesso />);
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Salve seu acesso")).toBeTruthy();
  });

  it("e-mail livre → updateUser na MESMA conta; a conta ganha e-mail → some; fechar e reabrir → não volta", async () => {
    h.salvar.mockResolvedValueOnce({ ok: true, via: "nova" });
    const { rerender, unmount } = render(<SalveSeuAcesso />);
    const botao = screen.getByRole("button", { name: "Salvar meu acesso" }) as HTMLButtonElement;
    expect(botao.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Seu e-mail"), { target: { value: " Maria@Email.com " } });
    expect(botao.disabled).toBe(false);
    fireEvent.click(botao);
    await waitFor(() => expect(h.salvar).toHaveBeenCalledWith("maria@email.com"));
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(h.eventos).toContainEqual(["salve_acesso_ok", { via: "nova" }]);
    h.auth = { user: comEmail, isSubscribed: true, subLoaded: true }; // o AuthProvider relê o usuário
    rerender(<SalveSeuAcesso />);
    expect(screen.queryByTestId("salve-acesso")).toBeNull();
    unmount();
    render(<SalveSeuAcesso />); // reabriu o app
    expect(screen.queryByTestId("salve-acesso")).toBeNull();
  });

  it("fechar e reabrir SEM salvar: a folha volta (é obrigatória — não tem 'fechar')", () => {
    const { unmount } = render(<SalveSeuAcesso />);
    expect(screen.queryByRole("button", { name: /fechar|agora não|depois/i })).toBeNull();
    unmount();
    render(<SalveSeuAcesso />);
    expect(screen.getByTestId("salve-acesso")).toBeTruthy();
  });

  it("e-mail que já tem conta → explica, manda o código; código certo → entra e a compra é TRANSFERIDA (pix-vincular)", async () => {
    h.salvar.mockResolvedValueOnce({ ok: false, existe: true });
    h.verifyOtp.mockResolvedValueOnce({ data: { session: {} }, error: null });
    h.trazer.mockResolvedValueOnce("movida");
    render(<SalveSeuAcesso />);
    fireEvent.change(screen.getByLabelText("Seu e-mail"), { target: { value: "maria@email.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meu acesso" }));
    await screen.findByText("Esse e-mail já tem conta");
    expect(h.signInWithOtp).toHaveBeenCalledWith({ email: "maria@email.com", options: { shouldCreateUser: false } });
    const suporte = screen.getByText("Falar com o suporte").closest("a")!;
    expect(suporte.getAttribute("href")).toMatch(/^mailto:contato@coreaplicativo\.com\.br\?subject=/);
    expect(decodeURIComponent(suporte.getAttribute("href")!)).toContain(anonima.id);
    fireEvent.change(screen.getByLabelText("Código de 6 números"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar e juntar minha compra" }));
    await waitFor(() => expect(h.trazer).toHaveBeenCalled());
    expect(h.verifyOtp).toHaveBeenCalledWith({ email: "maria@email.com", token: "123456", type: "email" });
    expect(h.eventos).toContainEqual(["salve_acesso_ok", { via: "codigo", compra: "movida" }]);
  });

  it("a conta do e-mail já tinha o CORE → a compra fica à parte e a folha manda falar com a gente (devolução)", async () => {
    h.salvar.mockResolvedValueOnce({ ok: false, existe: true });
    h.verifyOtp.mockResolvedValueOnce({ data: { session: {} }, error: null });
    h.trazer.mockResolvedValueOnce("nao_moveu");
    render(<SalveSeuAcesso />);
    fireEvent.change(screen.getByLabelText("Seu e-mail"), { target: { value: "maria@email.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meu acesso" }));
    await screen.findByText("Esse e-mail já tem conta");
    fireEvent.change(screen.getByLabelText("Código de 6 números"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar e juntar minha compra" }));
    await screen.findByText(/ficou guardada à parte/);
  });

  it("código errado → erro e continua na folha; nunca chama liberar_vitalicio", async () => {
    h.salvar.mockResolvedValueOnce({ ok: false, existe: true });
    h.verifyOtp.mockResolvedValueOnce({ data: {}, error: { message: "Token has expired or is invalid", status: 403 } });
    render(<SalveSeuAcesso />);
    fireEvent.change(screen.getByLabelText("Seu e-mail"), { target: { value: "maria@email.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar meu acesso" }));
    await screen.findByText("Esse e-mail já tem conta");
    fireEvent.change(screen.getByLabelText("Código de 6 números"), { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar e juntar minha compra" }));
    await screen.findByText(/Código errado/);
    expect(h.trazer).not.toHaveBeenCalled();
    const fonte = readFileSync(resolve(__dirname, "../components/account/SalveSeuAcesso.tsx"), "utf8");
    expect(fonte.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/liberar_vitalicio/);
  });
});
