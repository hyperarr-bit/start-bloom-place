/**
 * FUNIL DA MISSÃO NA WEB (18/10, versão de verdade depois do protótipo aprovado) — a camada da oferta, a cópia de
 * segurança do storage, o pop-up dos lembretes e o servidor que leva os dados do dia 1.
 *
 * O que não pode quebrar:
 *   · a oferta só entra DEPOIS da festa (ou pulou, ou PAROU: 3 min parada / "voltar"); paywall enxuto: sem o "CORE"
 *     do topo, sem "Ver o que fiz", sem "sem baixar nada";
 *   · Pix REAL: sessão anônima no "Pagar", as ofertas do /hoje (h279…), source_url = a URL do /missao (a venda se
 *     separa no banco), InitiateCheckout no pixel/CAPI; nada é simulado fora do servidor de desenvolvimento;
 *   · depois de pagar: e-mail livre → a mesma conta + boas-vindas; e-mail com conta → código (a compra E os dados vão
 *     pelo pix-vincular); a tela final mostra App Store / Google Play + "entre com este e-mail";
 *   · o Instagram zerando o storage no meio: a cópia volta e o evento mede;
 *   · na web, pergunta de lembrete vira "Baixe o app pra receber os lembretes".
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/* ---------------------------------------------------------------- mocks */
const authState: { user: { id: string; email: string | null } | null; loading: boolean; isSubscribed: boolean } = { user: null, loading: false, isSubscribed: false };
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => authState }));
const dados: Record<string, unknown> = {};
const tentarDeNovo = vi.fn();
vi.mock("@/hooks/use-user-data", () => ({
  useUserData: () => ({ get: (k: string, f: unknown) => (k in dados ? dados[k] : f), set: vi.fn(), loaded: true, isGuest: true, fetchKey: vi.fn(), tentarDeNovo }),
}));

const getSession = vi.fn();
const getUser = vi.fn();
const updateUser = vi.fn();
const setSession = vi.fn();
const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: (...a: unknown[]) => getSession(...a),
      getUser: (...a: unknown[]) => getUser(...a),
      updateUser: (...a: unknown[]) => updateUser(...a),
      setSession: (...a: unknown[]) => setSession(...a),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signInWithOtp: vi.fn(async () => ({ error: null })),
      verifyOtp: vi.fn(async () => ({ error: null })),
    },
    functions: { invoke: (...a: unknown[]) => invoke(...a) },
    from: () => ({
      select: () => ({ eq: () => ({ in: () => Promise.resolve({ data: [], error: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn(), trackEventBeacon: vi.fn() }));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn(async () => true) }));
vi.mock("@/lib/lead-source", () => ({ persistLeadSource: vi.fn(async () => {}) }));
const garantirSessao = vi.fn();
const definirEmailDaCompra = vi.fn();
const guardarCompraAnonima = vi.fn(async () => {});
const vincularCompraAnonima = vi.fn(async (..._a: unknown[]) => true);
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: (...a: unknown[]) => garantirSessao(...a),
  definirEmailDaCompra: (...a: unknown[]) => definirEmailDaCompra(...a),
  guardarCompraAnonima: () => guardarCompraAnonima(),
  vincularCompraAnonima: (...a: unknown[]) => vincularCompraAnonima(...a),
  limparBatismo: vi.fn(),
}));

import { trackEvent } from "@/lib/analytics";
import { fireMetaEvent } from "@/lib/meta-pixel";
import { FunilMissaoCamada, PARADA_MS, _zerarOferta, reciboDoDia } from "@/missao/FunilMissaoCamada";
import { BaixarAppPopup } from "@/missao/BaixarAppPopup";
import { _zerarCopiaSessao } from "@/pages/hoje/conta";
import { _zerarMemoriaPorta } from "@/pages/porta/atribuicao";
import { BUMP_KIT } from "@/pages/hoje/conteudo";
import { CHAVE_MISSAO_WEB, FUNIL_MISSAO, apagarMissaoWeb, lembretesSoNoApp } from "@/lib/missao-web";
import { CHAVE_ESTADO_MISSAO_DOSES } from "@/lib/missao-doses";
import { localDayKey } from "@/lib/utils";
import { SENTINELA, _zerarSeguranca, rodada, vigiarStorage } from "@/missao/seguranca";
import { copiarDadosDaAnonima, vazio } from "../../supabase/functions/_shared/copiar-dados-anonima";
import { FAIXAS_DE_RENDA } from "@/lib/montar-financas";
import { OPCOES_ACORDAR } from "@/lib/montar-rotina";

/* ---------------------------------------------------------------- ambiente */
const LANDING = "https://www.coreaplicativo.com.br/missao?utm_source=ig&utm_campaign=missao&fbclid=IwAR_m";
const hoje = localDayKey();
function estadoWeb(extra: Record<string, unknown> = {}) {
  localStorage.setItem(CHAVE_MISSAO_WEB, JSON.stringify({ v: 1, area: "dinheiro", em: Date.now() - 60_000, sessao: "s-1", pago: null, email: null, landing: LANDING, ...extra }));
  localStorage.setItem("funil-missao-force", "on");
}
function missao(feito: boolean, extra: Record<string, unknown> = {}) {
  localStorage.setItem(CHAVE_ESTADO_MISSAO_DOSES, JSON.stringify({
    v: 1, inicio: hoje, modulos: ["financas", "rotina", "saude"], boasVindas: true, braco: "A",
    feitos: feito ? { 1: { dia: hoje, rotulo: "Pode gastar R$ 120 por dia" } } : {}, ...extra,
  }));
}
const montar = (rota = "/financas") => render(
  <MemoryRouter initialEntries={[rota]}>
    <Routes>
      <Route path="*" element={<div data-testid="app">app</div>} />
    </Routes>
    <FunilMissaoCamada />
  </MemoryRouter>,
);
const texto = () => document.body.textContent ?? "";
const eventos = (nome: string) => vi.mocked(trackEvent).mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const invocacoes = (fn: string, acao?: string) => invoke.mock.calls.filter((c) => c[0] === fn).map((c) => (c[1] as { body: Record<string, unknown> }).body).filter((b) => !acao || b.action === acao);

let pedidos = 0;
const pagos = new Set<string>();
function servidor() {
  invoke.mockImplementation(async (fn: string, { body }: { body: Record<string, unknown> }) => {
    if (fn !== "asaas-pix") return { data: { ok: true }, error: null };
    if (body.action === "create") { const id = `qr_${++pedidos}_${body.offer}`; return { data: { orderId: id, qrCode: `000201PIX${id}`, qrCodeBase64: null, expiresAt: null }, error: null }; }
    if (body.action === "check") return { data: { paid: pagos.has(String(body.id)) }, error: null };
    return { data: { ok: true }, error: null };
  });
}

beforeEach(() => {
  _zerarCopiaSessao(); _zerarMemoriaPorta(); _zerarOferta(); _zerarSeguranca(); apagarMissaoWeb();
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  for (const k of Object.keys(dados)) delete dados[k];
  authState.user = null; authState.isSubscribed = false;
  [getSession, getUser, updateUser, setSession, invoke, garantirSessao, definirEmailDaCompra, tentarDeNovo].forEach((f) => f.mockReset());
  guardarCompraAnonima.mockClear(); vincularCompraAnonima.mockClear(); vincularCompraAnonima.mockResolvedValue(true);
  vi.mocked(trackEvent).mockClear(); vi.mocked(fireMetaEvent).mockClear();
  pedidos = 0; pagos.clear();
  let temSessao = false;
  garantirSessao.mockImplementation(async () => { temSessao = true; return "anonima"; });
  getSession.mockImplementation(async () => ({ data: { session: temSessao ? { access_token: "a", refresh_token: "r", user: { id: "anon-1" } } : null } }));
  getUser.mockImplementation(async () => ({ data: { user: temSessao ? { id: "anon-1", email: null, user_metadata: {} } : null } }));
  updateUser.mockResolvedValue({ data: {}, error: null });
  definirEmailDaCompra.mockResolvedValue({ erro: null });
  servidor();
  document.documentElement.removeAttribute("data-missao-tutorial");
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

const ateOferta = async () => {
  estadoWeb(); missao(true);
  dados["finance-incomes"] = [{ id: "r", value: 3000 }];
  dados["finance-fixed-expenses"] = [{ id: "a" }, { id: "b" }, { id: "c" }];
  dados["finance-expenses"] = [{ id: "g" }];
  montar();
  await waitFor(() => expect(screen.getByTestId("missao-oferta")).toBeTruthy());
};

/* ---------------------------------------------------------------- chave */
describe("a chave", () => {
  it("FUNIL_MISSAO LIGADO (19/10, dono); /missao e /missao/app só na web", () => {
    expect(FUNIL_MISSAO).toBe("on");
    const app = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    expect(app).toContain('<Route path="/missao/app" element={<SoNaWeb>');
    expect(app).toContain('<Route path="/missao" element={<SoNaWeb>');
  });
});

/* ---------------------------------------------------------------- o paywall */
describe("a oferta (paywall enxuto)", () => {
  it("entra depois da festa, com o recibo do que ela fez — sem 'CORE' no topo, sem 'Ver o que fiz', sem 'sem baixar nada'", async () => {
    await ateOferta();
    expect(screen.getByTestId("missao-recibo").textContent).toMatch(/Dia 1 de 3 feito/);
    expect(screen.getByTestId("missao-recibo").textContent).toMatch(/Renda e 3 contas do mês montadas/);
    expect(texto()).toMatch(/Ative seu CORE pra continuar/);
    expect(screen.getByTestId("missao-oferta-sub").textContent).toMatch(/Amanhã vem o dia 2: .*Rotina/);
    expect(screen.queryByTestId("missao-ver")).toBeNull();
    expect(screen.queryByTestId("missao-terminar-dia1")).toBeNull(); // só no "parou" (antes do aha)
    expect(texto()).not.toMatch(/Ver o que fiz/);
    expect(texto()).not.toMatch(/sem baixar nada/i);
    expect(document.querySelector(".mo-oferta .fn-marca")).toBeNull();
    expect(eventos("missao_web_oferta_view")[0]).toMatchObject({ variante: "feito", area: "dinheiro" });
    expect(vi.mocked(fireMetaEvent).mock.calls.some((c) => c[0] === "ViewContent")).toBe(true);
  });
  it("o HTML leve também: sem 'sem baixar nada' e sem o ponto rosa antes de CORE", () => {
    const html = readFileSync(join(process.cwd(), "missao.html"), "utf8");
    expect(html).not.toMatch(/sem baixar nada/i);
    expect(html).not.toMatch(/mt-marca"><i><\/i>/);
    expect(html).not.toMatch(/\.mt-marca i \{/);
  });
  it("antes da festa, nada cobre o app", async () => {
    estadoWeb(); missao(false);
    montar();
    await new Promise((r) => setTimeout(r, 400));
    expect(screen.queryByTestId("missao-oferta")).toBeNull();
  });
  it("PAROU: 3 min sem tocar em nada no tutorial → a oferta entra (variante 'parou', sem recibo)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    estadoWeb(); missao(false);
    document.documentElement.setAttribute("data-missao-tutorial", "1");
    montar();
    expect(screen.queryByTestId("missao-oferta")).toBeNull();
    await act(async () => { vi.advanceTimersByTime(PARADA_MS + 50); });
    await waitFor(() => expect(screen.getByTestId("missao-oferta").getAttribute("data-variante")).toBe("parou"));
    expect(screen.queryByTestId("missao-recibo")).toBeNull();
    expect(screen.getByTestId("missao-oferta-sub").textContent).toMatch(/Continue de onde parou/);
    expect(eventos("missao_web_parou")[0]).toMatchObject({ via: "tempo" });
    // a saída quieta: "Terminar o dia 1 primeiro" tira a oferta e o relógio não volta
    fireEvent.click(screen.getByTestId("missao-terminar-dia1"));
    await waitFor(() => expect(screen.queryByTestId("missao-oferta")).toBeNull());
    await act(async () => { vi.advanceTimersByTime(PARADA_MS * 2); });
    expect(screen.queryByTestId("missao-oferta")).toBeNull();
    expect(JSON.parse(localStorage.getItem(CHAVE_MISSAO_WEB)!).parouDispensou).toBeTruthy();
  });
  it("PAROU por 'voltar': o histórico cai no /missao → a oferta entra", async () => {
    estadoWeb(); missao(false);
    document.documentElement.setAttribute("data-missao-tutorial", "1");
    montar();
    window.history.pushState({}, "", "/missao");
    window.dispatchEvent(new PopStateEvent("popstate"));
    await waitFor(() => expect(screen.getByTestId("missao-oferta").getAttribute("data-variante")).toBe("parou"));
    expect(eventos("missao_web_parou")[0]).toMatchObject({ via: "saida" });
    window.history.replaceState({}, "", "/");
  });
});

/* ---------------------------------------------------------------- o Pix de verdade */
describe("Pix REAL (Asaas) e a compra", () => {
  it("Pagar → sessão anônima → asaas-pix create com a oferta do /hoje e source_url = a URL do /missao; InitiateCheckout", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("missao-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    expect(garantirSessao).toHaveBeenCalled();
    const c = invocacoes("asaas-pix", "create")[0];
    expect(c).toMatchObject({ offer: "h279", sourceUrl: LANDING });
    expect(vi.mocked(fireMetaEvent).mock.calls.find((x) => x[0] === "InitiateCheckout")?.[1]).toMatchObject({ value: 27.9, currency: "BRL" });
    expect(eventos("missao_web_pagar")[0]).toMatchObject({ plano: "anual", valor: 27.9 });
    expect(texto()).not.toMatch(/PROTOTIPO|simulado/i);
  });
  it("kit no mesmo Pix (h279k); pago → pra sempre 47 → 'Não' → 27 → 'Não' → e-mail livre → 'Seu CORE está salvo' com as LOJAS + boas-vindas", async () => {
    await ateOferta();
    const of = BUMP_KIT ? "h279k" : "h279";
    if (BUMP_KIT) fireEvent.click(screen.getByTestId("missao-bump"));
    else expect(screen.queryByTestId("missao-bump")).toBeNull(); // 19/10: bump desligado
    expect(screen.getByTestId("missao-pagar").textContent).toMatch(BUMP_KIT ? /37,80/ : /27,90/);
    fireEvent.click(screen.getByTestId("missao-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    expect(invocacoes("asaas-pix", "create")[0]).toMatchObject({ offer: of });
    pagos.add(`qr_${pedidos}_${of}`);
    fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
    await waitFor(() => expect(screen.getByTestId("missao-up1")).toBeTruthy());
    expect(eventos("missao_web_pago")[0]).toMatchObject({ oferta: of, valor: BUMP_KIT ? 37.8 : 27.9, simulado: false });
    expect(JSON.parse(localStorage.getItem(CHAVE_MISSAO_WEB)!).pago.ofertas).toEqual([of]);
    fireEvent.click(screen.getByTestId("missao-up1-nao"));
    await waitFor(() => expect(screen.getByTestId("missao-down")).toBeTruthy());
    fireEvent.click(screen.getByTestId("missao-down-nao"));
    await waitFor(() => expect(screen.getByTestId("missao-pago")).toBeTruthy());
    fireEvent.change(screen.getByTestId("missao-email"), { target: { value: "Maria@Exemplo.com" } });
    fireEvent.click(screen.getByTestId("missao-salvar-email"));
    await waitFor(() => expect(screen.getByTestId("missao-pronto")).toBeTruthy());
    expect(definirEmailDaCompra).toHaveBeenCalledWith("maria@exemplo.com");
    expect(invocacoes("asaas-pix", "boas_vindas")[0]).toMatchObject({ id: `qr_1_${of}` });
    // as lojas: os selos oficiais + "entre com este e-mail"
    expect(screen.getByTestId("missao-lojas").textContent).toMatch(/App Store.*Google Play/);
    expect(screen.getByTestId("missao-lojas").textContent).toMatch(/maria@exemplo\.com/);
    expect(screen.getByTestId("selo-app-store").getAttribute("href")).toMatch(/\/baixar\?origem=web_missao_pos_compra&loja=ios/);
    expect(screen.getByTestId("selo-google-play").getAttribute("href")).toMatch(/loja=android/);
    expect(JSON.parse(localStorage.getItem(CHAVE_MISSAO_WEB)!).email).toBe("maria@exemplo.com");
    fireEvent.click(screen.getByTestId("missao-continuar"));
    await waitFor(() => expect(screen.queryByTestId("missao-oferta")).toBeNull());
    expect(JSON.parse(localStorage.getItem(CHAVE_MISSAO_WEB)!).continuou).toBeTruthy();
  });
  it("e-mail que JÁ TEM conta → código; a compra fica guardada pra o pix-vincular (que leva os dados do dia 1 junto)", async () => {
    await ateOferta();
    fireEvent.click(screen.getByTestId("missao-pagar"));
    await waitFor(() => expect(screen.getByTestId("hoje-copiar")).toBeTruthy());
    pagos.add(`qr_${pedidos}_h279`);
    fireEvent.click(screen.getByTestId("hoje-ja-paguei"));
    await waitFor(() => expect(screen.getByTestId("missao-up1")).toBeTruthy());
    fireEvent.click(screen.getByTestId("missao-up1-nao"));
    await waitFor(() => expect(screen.getByTestId("missao-down")).toBeTruthy());
    fireEvent.click(screen.getByTestId("missao-down-nao"));
    await waitFor(() => expect(screen.getByTestId("missao-pago")).toBeTruthy());
    definirEmailDaCompra.mockResolvedValue({ erro: "email_em_uso" });
    fireEvent.change(screen.getByTestId("missao-email"), { target: { value: "antiga@exemplo.com" } });
    fireEvent.click(screen.getByTestId("missao-salvar-email"));
    await waitFor(() => expect(screen.getByTestId("missao-existe")).toBeTruthy());
    expect(guardarCompraAnonima).toHaveBeenCalled();
    expect(texto()).toMatch(/Sua compra e o que você fez hoje vão pra essa conta/);
  });
  it("o Pix simulado só existe no servidor de desenvolvimento (import.meta.env.DEV + ?missao-simular=1)", () => {
    const src = readFileSync(join(process.cwd(), "src/missao/FunilMissaoCamada.tsx"), "utf8");
    expect(src).toMatch(/if \(!import\.meta\.env\.DEV\) return false;/);
  });
});

/* ---------------------------------------------------------------- recibo */
describe("o recibo do dia 1", () => {
  it("Finanças: o número da festa vence o do Montar", () => {
    const get = <T,>(k: string, f: T): T => (({ "finance-incomes": [1], "finance-fixed-expenses": [1, 2], "finance-expenses": [1] } as Record<string, unknown>)[k] as T) ?? f;
    expect(reciboDoDia("financas", "Pode gastar R$ 100 por dia", get, "💰 Pode gastar R$ 131 por dia")).toEqual(["Renda e 2 contas do mês montadas", "Pode gastar R$ 131 por dia", "1º gasto anotado"]);
  });
});

/* ---------------------------------------------------------------- Instagram zerando o storage */
describe("cópia de segurança do storage (navegador do Instagram)", () => {
  it("a sentinela some com a página viva → tudo volta (só o que falta) e o evento mede", () => {
    localStorage.setItem(SENTINELA, '{"v":1}');
    localStorage.setItem("guest:finance-incomes", "[1]");
    localStorage.setItem("missao-doses", '{"v":1}');
    expect(rodada()).toBe("copiou");
    localStorage.clear(); // o Instagram
    expect(rodada()).toBe("restaurou");
    expect(localStorage.getItem("guest:finance-incomes")).toBe("[1]");
    expect(localStorage.getItem("missao-doses")).toBe('{"v":1}');
    expect(eventos("missao_web_storage_sumiu")[0]).toMatchObject({ onde: "memoria", chaves: 3 });
  });
  it("guest:* apagado DE PROPÓSITO (a migração pra conta) não volta: a cópia acompanha enquanto a sentinela existe", () => {
    localStorage.setItem(SENTINELA, '{"v":1}');
    localStorage.setItem("guest:x", "1");
    rodada();
    localStorage.removeItem("guest:x");
    expect(rodada()).toBe("copiou");
    localStorage.removeItem(SENTINELA);
    rodada();
    expect(localStorage.getItem("guest:x")).toBeNull();
  });
  it("escrita espelhada: o que ela respondeu 1 instante antes de o storage sumir volta ATUALIZADO (não a foto de 1,5 s atrás)", () => {
    localStorage.setItem(SENTINELA, "1");
    const parar = vigiarStorage(60_000);
    localStorage.setItem("core-montar-financas", '{"rascunho":{"etapa":"renda"}}');
    localStorage.setItem("core-montar-financas", '{"rascunho":{"etapa":"contas"}}'); // a resposta de agora
    localStorage.clear();
    expect(rodada()).toBe("restaurou");
    expect(localStorage.getItem("core-montar-financas")).toBe('{"rascunho":{"etapa":"contas"}}');
    parar();
  });
  it("sessão do Supabase (sb-*) e cache por conta (u:*) ficam fora da cópia", () => {
    localStorage.setItem(SENTINELA, "1"); localStorage.setItem("sb-x-auth-token", "t"); localStorage.setItem("u:1:k", "v");
    rodada(); localStorage.clear(); rodada();
    expect(localStorage.getItem("sb-x-auth-token")).toBeNull();
    expect(localStorage.getItem("u:1:k")).toBeNull();
    expect(localStorage.getItem(SENTINELA)).toBe("1");
  });
});

/* ---------------------------------------------------------------- lembretes na web */
describe("lembretes: na web vira 'Baixe o app'", () => {
  it("lembretesSoNoApp: só com o convidado da missão ativo, nunca fora dele", () => {
    expect(lembretesSoNoApp()).toBe(false);
    estadoWeb();
    expect(lembretesSoNoApp()).toBe(true);
  });
  it("antes de pagar: selos + 'depois é só entrar com a sua conta'; 'Agora não' segue", () => {
    estadoWeb();
    const agoraNao = vi.fn();
    render(<BaixarAppPopup contexto="rotina" onAgoraNao={agoraNao} />);
    expect(screen.getByText("Baixe o app pra receber os lembretes")).toBeTruthy();
    expect(screen.getByTestId("selo-app-store")).toBeTruthy();
    expect(screen.getByTestId("selo-google-play")).toBeTruthy();
    expect(screen.getByTestId("baixar-app-depois").textContent).toMatch(/entrar com a sua conta/);
    fireEvent.click(screen.getByTestId("baixar-app-agora-nao"));
    expect(agoraNao).toHaveBeenCalled();
    expect(eventos("missao_web_lembrete_popup").map((e) => e.acao)).toEqual(["view", "agora_nao"]);
  });
  it("depois de pagar: 'Entre com este e-mail: …'", () => {
    estadoWeb({ email: "maria@exemplo.com", pago: { em: 1, ofertas: ["h279"] } });
    render(<BaixarAppPopup contexto="plano_amanha" onAgoraNao={vi.fn()} />);
    expect(screen.getByTestId("baixar-app-email").textContent).toMatch(/Entre com este e-mail:.*maria@exemplo\.com/);
  });
  it("os 3 lugares que perguntavam lembrete usam o pop-up na web", () => {
    for (const f of ["src/components/rotina/montar/MontarRotina.tsx", "src/components/missao-doses/PlanoDeAmanhaA.tsx", "src/components/missao-doses/PassoDoDia.tsx"]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      expect(s).toContain("lembretesSoNoApp");
      expect(s).toContain("<BaixarAppPopup");
    }
  });
});

/* ---------------------------------------------------------------- servidor: os dados do dia 1 vão junto */
describe("servidor: copiarDadosDaAnonima (pix-vincular e destino do e-mail)", () => {
  function banco(linhas: Array<{ user_id: string; key: string; value: unknown }>) {
    const upserts: Array<{ user_id: string; key: string; value: unknown }> = [];
    const admin = {
      from: () => ({
        select: () => ({
          eq: (_c: string, uid: string) => ({
            limit: async () => ({ data: linhas.filter((l) => l.user_id === uid), error: null }),
            in: async (_k: string, chaves: string[]) => ({ data: linhas.filter((l) => l.user_id === uid && chaves.includes(l.key)), error: null }),
          }),
        }),
        upsert: async (novas: typeof upserts) => { upserts.push(...novas); return { error: null }; },
      }),
    };
    return { admin, upserts };
  }
  it("copia só as chaves que o destino não tem (ou tem vazias); nunca sobrescreve dado de verdade", async () => {
    const { admin, upserts } = banco([
      { user_id: "anon", key: "finance-incomes", value: [{ v: 3000 }] },
      { user_id: "anon", key: "finance-fixed-expenses", value: [{ v: 900 }] },
      { user_id: "anon", key: "rotina-habits", value: [{ n: "Água" }] },
      { user_id: "anon", key: "vazia", value: [] },
      { user_id: "velha", key: "finance-incomes", value: [{ v: 5000 }] },
      { user_id: "velha", key: "finance-fixed-expenses", value: [] },
    ]);
    const n = await copiarDadosDaAnonima(admin, "anon", "velha");
    expect(n).toBe(2);
    expect(upserts.map((u) => u.key).sort()).toEqual(["finance-fixed-expenses", "rotina-habits"]);
    expect(upserts.every((u) => u.user_id === "velha")).toBe(true);
  });
  it("vazio: null, [], {}, '' ", () => {
    expect([null, [], {}, ""].every(vazio)).toBe(true);
    expect([[1], { a: 1 }, "x", 0, false].some(vazio)).toBe(false);
  });
  it("pix-vincular chama a cópia depois da prova da anônima; destino-hoje também", () => {
    const pv = readFileSync(join(process.cwd(), "supabase/functions/pix-vincular/index.ts"), "utf8");
    const i = pv.indexOf('motivo: "origem_tem_email"');
    expect(i).toBeGreaterThan(0);
    expect(pv.indexOf("copiarDadosDaAnonima(admin, origem.id, destino.id)")).toBeGreaterThan(i);
    const dh = readFileSync(join(process.cwd(), "supabase/functions/_shared/destino-hoje.ts"), "utf8");
    expect(dh).toContain("copiarDadosDaAnonima(admin, args.uidAnonimo, para)");
  });
});

/* ---------------------------------------------------------------- o passo 1 em HTML (quem toca rápido) */
describe("o passo 1 do tutorial em HTML (Finanças e Rotina) é a MESMA tela do app", () => {
  const html = readFileSync(join(process.cwd(), "missao.html"), "utf8");
  const leve = readFileSync(join(process.cwd(), "src/missao/leve.ts"), "utf8");
  it("Finanças: os textos do passo 'renda' do MontarFinancas e as MESMAS faixas (id, rótulo, valor)", () => {
    const mf = readFileSync(join(process.cwd(), "src/components/finance/montar/MontarFinancas.tsx"), "utf8");
    // 1.0.17 (dono: "minimalista"): a pergunta + "Pode ser aproximado." — sem kicker, sem a dica embaixo do campo
    for (const t of ["<h2>Quanto entra por mês?</h2>", "<p>Pode ser aproximado.</p>", "💰 Renda do mês"]) {
      expect(mf).toContain(t); expect(html).toContain(t);
    }
    for (const t of ["Vamos montar suas finanças · 1 de 3", "Só pra calcular quanto dá pra gastar", "Salário, freela, pensão"]) { expect(mf).not.toContain(t); expect(html).not.toContain(t); }
    for (const f of FAIXAS_DE_RENDA) expect(leve).toContain(`{ id: "${f.id}", rotulo: "${f.rotulo}", valor: ${f.valor} }`);
  });
  it("Rotina: os textos do passo 'acordar' do MontarRotina (na web são 2 perguntas) e as MESMAS horas", () => {
    const mr = readFileSync(join(process.cwd(), "src/components/rotina/montar/MontarRotina.tsx"), "utf8");
    for (const t of ["<h2>Que horas você acorda?</h2>", "Outro horário"]) { expect(mr).toContain(t); expect(html).toContain(t); }
    for (const t of ["Seu dia começa daí. Dá pra mudar depois.", "Vamos montar sua rotina · 1 de"]) { expect(mr).not.toContain(t); expect(html).not.toContain(t); }
    for (const o of OPCOES_ACORDAR) expect(html).toContain(`data-opcao="${o.id}"`);
  });
  it("a resposta vai pra tela de verdade pelos MESMOS toques (nada gravado por fora do app)", () => {
    expect(leve).toContain('document.querySelector<HTMLElement>(\'.mf[data-etapa="renda"]\')');
    expect(leve).toContain('document.querySelector<HTMLElement>(\'.mrt[data-etapa="acordar"]\')');
    expect(leve).not.toMatch(/localStorage\.setItem\("core-montar/);
  });
});

describe("eventos do HTML leve (19/10)", () => {
  it("o insert só usa colunas que existem (user_id, session_id, event_name, event_data) — `page` derrubava as telas 1–2", () => {
    const leve = readFileSync(join(process.cwd(), "src/missao/leve.ts"), "utf8");
    expect(leve).not.toMatch(/page: location\.pathname/);
    expect(leve).toContain("path: location.pathname");
  });
});

describe("a camada da missão não cobre outras páginas (20/10)", () => {
  it("admin, Entrar, conta e outros funis ficam livres; /missao, módulos e Home continuam", async () => {
    const { rotaSemCamadaDaMissao } = await import("@/lib/missao-web");
    for (const r of ["/admin", "/admin/funil", "/entrar", "/auth", "/planos", "/hoje", "/inicio", "/"]) expect(rotaSemCamadaDaMissao(r)).toBe(true);
    for (const r of ["/missao", "/home", "/financas", "/rotina"]) expect(rotaSemCamadaDaMissao(r)).toBe(false);
  });
});
