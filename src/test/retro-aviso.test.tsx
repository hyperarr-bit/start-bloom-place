/**
 * AVISO "SUA RETROSPECTIVA DE OUTUBRO GANHOU CARA NOVA" (01/11 — lib/retro-aviso, components/wrapped/AvisoRetroNova).
 *   · aparece pra TODA conta com outubro que ainda não abriu a nova (fechou o cartão, abriu a antiga ou nada);
 *   · conta sem outubro (nova de novembro, no teste grátis) nunca vê;
 *   · 1x por conta: visto → remontar (reabrir o app) continua escondido, inclusive com a marca só no aparelho;
 *   · abriu a nova (a página grava a marca) → não aparece;
 *   · nunca por cima de outra folha/convite; fora de 01/11–10/11, nada;
 *   · "Ver agora" vai pra /retrospectiva?mes=Outubro&origem=aviso; os eventos saem com month: "Outubro".
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, act, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => false }));
const eventos = vi.hoisted(() => [] as Array<[string, Record<string, unknown>]>);
vi.mock("@/lib/analytics", async (orig) => ({
  ...(await orig<typeof import("@/lib/analytics")>()),
  trackEvent: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
  trackEventBeacon: (n: string, d: Record<string, unknown> = {}) => { eventos.push([n, d]); },
}));
const auth = vi.hoisted(() => ({ user: { id: "u1", created_at: "2026-08-01T12:00:00Z", user_metadata: {} }, loading: false, isSubscribed: true }));
vi.mock("@/hooks/use-auth", async (orig) => ({ ...(await orig<typeof import("@/hooks/use-auth")>()), useAuth: () => auth, useAuthOpcional: () => auth }));
vi.mock("@/lib/retro-aviso", async (orig) => ({ ...(await orig<typeof import("@/lib/retro-aviso")>()), ESPERA_AVISO_RETRO_MS: 20 }));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => null }));

import { AvisoRetroNova, _zerarAvisoRetroNestaAbertura } from "@/components/wrapped/AvisoRetroNova";
import { _zerarConviteNestaAbertura } from "@/components/home-nova/EscolhaDaHome";
import { CHAVE_RETRO_AVISO, CHAVE_RETRO_AVISO_APARELHO, CHAVE_RETRO_NOVA_ABERTA, deveMostrarAvisoRetro, janelaDoAvisoRetro } from "@/lib/retro-aviso";
import { CHAVES_DO_APARELHO, vassouraLeva } from "@/lib/chaves-do-aparelho";
import Retrospectiva from "@/pages/Retrospectiva";
import { SEMENTE_COMPLETA } from "@/pages/dev/retro-outubro-exemplo";
import { criarNuvem, prepararJsdom, type Dados, type Nuvem } from "./compat-comum";

const NOV_1 = new Date(2026, 10, 1, 10, 0, 0);
const Sonda = () => { const l = useLocation(); return <div data-testid="sonda" data-rota={l.pathname + l.search} />; };

const montar = (n: Nuvem, opts: { agora?: Date; bloqueado?: boolean } = {}) => {
  _zerarAvisoRetroNestaAbertura(); _zerarConviteNestaAbertura();
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <n.Provedor>
        <Routes>
          <Route path="/home" element={<AvisoRetroNova agora={opts.agora ?? NOV_1} bloqueado={opts.bloqueado} />} />
          <Route path="/retrospectiva" element={null} />
        </Routes>
        <Sonda />
      </n.Provedor>
    </MemoryRouter>,
  );
};
const esperar = (ms = 150) => act(() => new Promise((r) => setTimeout(r, ms)));
const aviso = () => screen.queryByTestId("retro-aviso");
const comOutubro = (extra: Dados = {}) => criarNuvem({ ...SEMENTE_COMPLETA, ...extra });

beforeAll(() => { prepararJsdom(); });
beforeEach(() => { localStorage.clear(); eventos.length = 0; });
afterEach(() => { cleanup(); document.querySelectorAll("[data-teste-camada]").forEach((e) => e.remove()); });

describe("a regra (lib/retro-aviso)", () => {
  const base = { userId: "u1", contaCarregada: true, janela: true, temOutubro: true, novaAbertaNaConta: null, avisoNaConta: null };
  it("toda conta com outubro, sem a nova aberta e sem aviso visto", () => {
    expect(deveMostrarAvisoRetro(base)).toBe(true);
    expect(deveMostrarAvisoRetro({ ...base, temOutubro: false })).toBe(false);
    expect(deveMostrarAvisoRetro({ ...base, janela: false })).toBe(false);
    expect(deveMostrarAvisoRetro({ ...base, contaCarregada: false })).toBe(false);
    expect(deveMostrarAvisoRetro({ ...base, convidado: true })).toBe(false);
    expect(deveMostrarAvisoRetro({ ...base, userId: null })).toBe(false);
    expect(deveMostrarAvisoRetro({ ...base, novaAbertaNaConta: { em: "x" } })).toBe(false);
    expect(deveMostrarAvisoRetro({ ...base, avisoNaConta: { em: "x", resposta: "visto" } })).toBe(false);
  });
  it("a janela: 01/11 a 10/11 inclusive", () => {
    expect(janelaDoAvisoRetro(new Date(2026, 9, 31, 23, 0))).toBe(false);
    expect(janelaDoAvisoRetro(NOV_1)).toBe(true);
    expect(janelaDoAvisoRetro(new Date(2026, 10, 10, 23, 59))).toBe(true);
    expect(janelaDoAvisoRetro(new Date(2026, 10, 11, 0, 1))).toBe(false);
  });
  it("as marcas do aparelho sobrevivem à vassoura; as da conta não têm prefixo varrido", () => {
    expect(CHAVES_DO_APARELHO.has(CHAVE_RETRO_AVISO_APARELHO)).toBe(true);
    expect(vassouraLeva(CHAVE_RETRO_AVISO_APARELHO)).toBe(false);
    expect(vassouraLeva(CHAVE_RETRO_AVISO)).toBe(false);
    expect(vassouraLeva(CHAVE_RETRO_NOVA_ABERTA)).toBe(false);
  });
});

describe("na tela", () => {
  it("aparece pra conta antiga que FECHOU o cartão da Home (e marca visto na conta e no aparelho)", async () => {
    const n = comOutubro({ "retro-home-dispensada": "2026-10" });
    montar(n);
    await waitFor(() => expect(aviso()).not.toBeNull());
    expect(screen.getByText("Sua retrospectiva de outubro ganhou cara nova")).toBeTruthy();
    expect(screen.queryByText(/postar nos Stories/)).toBeNull(); // 01/11: dono pediu pra tirar a linha
    expect(screen.getByText("Seu outubro,")).toBeTruthy();
    expect(n.ler<{ resposta: string }>(CHAVE_RETRO_AVISO)?.resposta).toBe("visto");
    expect(localStorage.getItem(CHAVE_RETRO_AVISO_APARELHO)).toBe("u1");
    expect(eventos).toContainEqual(["retro_aviso_visto", { month: "Outubro" }]);
  });

  it("conta antiga com dados de outubro que NÃO fechou nada (abriu a antiga ou nem viu) também vê", async () => {
    montar(comOutubro());
    await waitFor(() => expect(aviso()).not.toBeNull());
  });

  it("conta sem dados de outubro (nova de novembro, no teste) nunca vê", async () => {
    montar(criarNuvem({ "core-user-name": "Ana" }));
    await esperar();
    expect(aviso()).toBeNull();
    expect(eventos.find(([e]) => e.startsWith("retro_aviso"))).toBeUndefined();
  });

  it("depois de visto não volta: 'Agora não' e remontar (reabrir o app) continua escondido", async () => {
    const n = comOutubro();
    montar(n);
    await waitFor(() => expect(aviso()).not.toBeNull());
    fireEvent.click(screen.getByTestId("retro-aviso-agora-nao"));
    expect(eventos).toContainEqual(["retro_aviso_fechar", { month: "Outubro" }]);
    expect(n.ler<{ resposta: string }>(CHAVE_RETRO_AVISO)?.resposta).toBe("fechar");
    await waitFor(() => expect(aviso()).toBeNull());
    cleanup();
    montar(n);
    await esperar();
    expect(aviso()).toBeNull();
  });

  it("visto e o app fechou antes de a conta subir: a marca do aparelho segura", async () => {
    localStorage.setItem(CHAVE_RETRO_AVISO_APARELHO, "u9,u1");
    montar(comOutubro());
    await esperar();
    expect(aviso()).toBeNull();
  });

  it("quem já abriu a NOVA não vê", async () => {
    montar(comOutubro({ [CHAVE_RETRO_NOVA_ABERTA]: { em: "2026-11-01T12:00:00.000Z" } }));
    await esperar();
    expect(aviso()).toBeNull();
  });

  it("abrir a retrospectiva nova grava a marca da conta (pages/Retrospectiva)", async () => {
    const n = comOutubro();
    render(
      <MemoryRouter initialEntries={["/retrospectiva?mes=Outubro&origem=aviso"]}>
        <n.Provedor><Routes><Route path="/retrospectiva" element={<Retrospectiva />} /></Routes></n.Provedor>
      </MemoryRouter>,
    );
    await waitFor(() => expect(n.ler(CHAVE_RETRO_NOVA_ABERTA)).toBeTruthy(), { timeout: 4000 });
    cleanup();
    montar(n);
    await esperar();
    expect(aviso()).toBeNull();
  });

  it("com outra folha aberta não aparece (e não gasta o 'visto')", async () => {
    const outra = document.createElement("div");
    outra.setAttribute("role", "dialog");
    outra.setAttribute("data-teste-camada", "");
    document.body.appendChild(outra);
    const n = comOutubro();
    montar(n);
    await esperar();
    expect(aviso()).toBeNull();
    expect(n.ler(CHAVE_RETRO_AVISO)).toBeUndefined();
    outra.remove();
    await waitFor(() => expect(aviso()).not.toBeNull()); // a tela liberou: aparece
  });

  it("com o convite da Home nova na tela, ou a Home ocupada (tour, widgets, folhas), não aparece", async () => {
    const convite = document.createElement("div");
    convite.setAttribute("role", "dialog");
    convite.setAttribute("data-convite-home", "");
    convite.setAttribute("data-teste-camada", "");
    document.body.appendChild(convite);
    montar(comOutubro());
    await esperar();
    expect(aviso()).toBeNull();
    convite.remove();
    cleanup();
    montar(comOutubro(), { bloqueado: true });
    await esperar();
    expect(aviso()).toBeNull();
  });

  it("fora da janela (depois de 10/11) não aparece", async () => {
    montar(comOutubro(), { agora: new Date(2026, 10, 11, 9, 0) });
    await esperar();
    expect(aviso()).toBeNull();
  });

  it("'Ver agora' abre a retrospectiva nova pelo caminho do cartão", async () => {
    const n = comOutubro();
    montar(n);
    await waitFor(() => expect(aviso()).not.toBeNull());
    fireEvent.click(screen.getByTestId("retro-aviso-ver"));
    expect(screen.getByTestId("sonda").getAttribute("data-rota")).toBe("/retrospectiva?mes=Outubro&origem=aviso");
    expect(eventos).toContainEqual(["retro_aviso_abrir", { month: "Outubro" }]);
    expect(n.ler<{ resposta: string }>(CHAVE_RETRO_AVISO)?.resposta).toBe("abrir");
  });
});

/* 02/11 (revisor de bugs): o convite da Home nova cede a vez quando o aviso da retrospectiva já foi a folha desta abertura. */
describe("1 folha por abertura nos dois sentidos", () => {
  it("depois do aviso nesta abertura, a marca fica ligada pro convite ler", async () => {
    const m = await import("@/lib/retro-aviso");
    m._zerarMarcaAvisoRetroNestaAbertura();
    expect(m.avisoRetroApareceuNestaAbertura()).toBe(false);
    m.marcarAvisoRetroNestaAbertura();
    expect(m.avisoRetroApareceuNestaAbertura()).toBe(true);
    m._zerarMarcaAvisoRetroNestaAbertura();
  });
});
