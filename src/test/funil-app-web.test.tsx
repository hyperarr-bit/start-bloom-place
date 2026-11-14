/**
 * FUNIL APP WEB (14/11, /funil-app) — a tela e a chave:
 *   · a chave nasce DESLIGADA: /funil-app manda pra "/" e nada mais muda; `?funil-app-web=on` liga só neste aparelho;
 *   · o ComecarW SEM a prop segue no paywall de sempre (o app nativo e as rotas /app e /funil-w não veem nada disto);
 *   · o `jornada: "app_web"` só existe na rota /funil-app;
 *   · o paywall: as DUAS colunas do Android 138 (vitalício 97,90 marcado, mensal 34,90), garantia escrita, "Liberar meu CORE";
 *   · a folha: vitalício abre no Pix (QR na folha, fechar/reabrir = o MESMO Pix, sem 2ª cobrança); mensal abre no Cartão com
 *     "Prefere Pix? Vitalício por R$ 97,90"; 3x leva as parcelas; recusado mostra o aviso; pago → Purchase-ready + pós-compra.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, act } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const eventos: Array<{ nome: string; dados: Record<string, unknown> }> = [];
vi.mock("@/lib/analytics", () => ({
  trackEvent: (nome: string, dados: Record<string, unknown> = {}) => { eventos.push({ nome, dados }); },
  getAttributionParams: () => ({ utm_source: "fb", fbclid: "IwAR_x" }),
}));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/sessao-anonima", () => ({ garantirSessao: vi.fn().mockResolvedValue("anonima"), limparBatismo: vi.fn() }));
vi.mock("@/pages/funis/w/ComecarW", () => ({ default: (p: { cobrancaWeb?: boolean }) => <div data-testid="comecar-w" data-cobranca={String(!!p.cobrancaWeb)} /> }));

import FunilAppWeb from "@/pages/funis/w/FunilAppWeb";
import { FUNIL_APP_WEB, CHAVE_FORCA_FUNIL_APP_WEB, camposJornadaAppWeb } from "@/lib/funil-app-web";
import { CHAVE_PEDIDO, gravarPedido, lerPedido, pedidoNovo, type ApiAppWeb, type CorpoAcao, type StripeLike } from "@/lib/stripe-app-web";
import { FolhaPagamentoWeb } from "@/pages/funis/w/FolhaPagamentoWeb";
import { ColunasDePreco } from "@/pages/funis/w/PaywallWebStripe";

type J = Window & { __appWebApi?: ApiAppWeb; __appWebStripe?: StripeLike };
const raiz = resolve(__dirname, "../..");
const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");

function rota(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/" element={<div data-testid="home-site" />} />
        <Route path="/funil-app" element={<FunilAppWeb />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); eventos.length = 0; });
afterEach(() => { cleanup(); delete (window as J).__appWebApi; delete (window as J).__appWebStripe; vi.useRealTimers(); });

describe("a chave", () => {
  it("nasce DESLIGADA: /funil-app vai pra home do site", async () => {
    expect(FUNIL_APP_WEB).toBe("off");
    rota("/funil-app");
    expect(await screen.findByTestId("home-site")).toBeTruthy();
    expect(screen.queryByTestId("comecar-w")).toBeNull();
  });
  it("?funil-app-web=on liga NESTE aparelho (o ComecarW com cobrancaWeb); =off desliga", async () => {
    rota("/funil-app?funil-app-web=on");
    const c = await screen.findByTestId("comecar-w");
    expect(c.getAttribute("data-cobranca")).toBe("true");
    expect(localStorage.getItem(CHAVE_FORCA_FUNIL_APP_WEB)).toBe("on");
    cleanup();
    rota("/funil-app?funil-app-web=off");
    expect(await screen.findByTestId("home-site")).toBeTruthy();
  });
  it("reabriu com Pix vivo → pousa no paywall (?step=offer)", async () => {
    localStorage.setItem(CHAVE_FORCA_FUNIL_APP_WEB, "on");
    gravarPedido({ ...pedidoNovo("vitalicio"), fase: "pix", pi: "pi_1", pix: { data: "00020126" }, email: "a@b.com" });
    let busca = "";
    render(
      <MemoryRouter initialEntries={["/funil-app"]}>
        <Routes>
          <Route path="/funil-app" element={<><FunilAppWeb /><Espiao onBusca={(b) => { busca = b; }} /></>} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId("comecar-w");
    expect(busca).toContain("step=offer");
  });
  it("o app e as rotas que vendem hoje não mudam: ComecarW sem a prop = paywall de sempre; /app e /funil-w intactas", () => {
    const comecar = ler("src/pages/funis/w/ComecarW.tsx");
    expect(comecar).toMatch(/export default function ComecarW\(\{ cobrancaWeb = false \}/);
    expect(comecar).toContain('{step === "offer" && cobrancaWeb && naWeb && <Suspense fallback={null}><PaywallWebStripe');
    expect(comecar).toContain('{step === "offer" && !(cobrancaWeb && naWeb) && (');
    const app = ler("src/App.tsx");
    expect(app).toContain('<Route path="/funil-app" element={<SoNaWeb><RouteErrorBoundary routeName="funil-app-web"><FunilAppWeb /></RouteErrorBoundary></SoNaWeb>} />');
    expect(app.match(/<ComecarW cobrancaWeb/g)).toBeNull(); // só o FunilAppWeb passa a prop
    expect(ler("src/pages/funis/w/FunilAppWeb.tsx")).toContain("<ComecarW cobrancaWeb />");
    // o vercel.json não ganhou nada (a rota é do SPA) e as páginas da landing seguem com o checkout delas
    const v = ler("vercel.json");
    expect(v).not.toContain("funil-app");
    expect(ler("src/landing/stripe-checkout.ts")).toContain('pagina: "oferta"');
  });
});

function Espiao({ onBusca }: { onBusca: (b: string) => void }) {
  onBusca(useLocation().search);
  return null;
}

describe("jornada na telemetria", () => {
  it("só na rota /funil-app", () => {
    window.history.replaceState({}, "", "/funil-app?x=1");
    expect(camposJornadaAppWeb()).toEqual({ jornada: "app_web" });
    window.history.replaceState({}, "", "/organizar");
    expect(camposJornadaAppWeb()).toEqual({});
    window.history.replaceState({}, "", "/");
  });
});

describe("as colunas do paywall (Android 138, preços da web)", () => {
  it("vitalício 97,90 e mensal 34,90; o toque troca", () => {
    const onSelect = vi.fn();
    render(<ColunasDePreco plano="vitalicio" onSelect={onSelect} />);
    expect(screen.getByTestId("appweb-coluna-vitalicio").textContent).toContain("R$ 97,90");
    expect(screen.getByTestId("appweb-coluna-vitalicio").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("appweb-coluna-mensal").textContent).toContain("R$ 34,90");
    expect(screen.getByTestId("appweb-coluna-vitalicio").textContent).toContain("3 meses de mensal");
    fireEvent.click(screen.getByTestId("appweb-coluna-mensal"));
    expect(onSelect).toHaveBeenCalledWith("mensal");
  });
});

/* ───────── a folha ───────── */
function apiFalsa(respostas: Partial<Record<CorpoAcao["acao"], Record<string, unknown>>> = {}) {
  const chamadas: CorpoAcao[] = [];
  let pago = false;
  const api: ApiAppWeb = {
    acao: async (c) => { chamadas.push(c); return (respostas[c.acao] ?? (c.acao === "pix" ? { ok: true, pi: "pi_1", pix: { data: "00020126PIXTESTE" }, plano: "vitalicio" } : { ok: true, pago: true, pi: "pi_2", plano: c.acao === "assinar" ? "mensal" : "vitalicio", sub: c.acao === "assinar" ? "sub_1" : undefined })) as never; },
    status: async () => ({ ok: true, pago, status: pago ? "succeeded" : "requires_action", metodo: "pix" }),
  };
  (window as J).__appWebApi = api;
  return { chamadas, pagar: () => { pago = true; } };
}
function stripeFalso(): StripeLike {
  let pronto: (() => void) | undefined;
  return {
    elements: () => ({ create: () => ({ mount: (el: HTMLElement) => { el.innerHTML = "<input data-testid='cartao-falso' />"; setTimeout(() => pronto?.(), 0); }, on: (ev: string, cb: (e: Record<string, never>) => void) => { if (ev === "ready") pronto = () => cb({}); } }), submit: async () => ({}) }),
    createPaymentMethod: async () => ({ paymentMethod: { id: "pm_teste4242" } }),
    handleNextAction: async () => ({ paymentIntent: { status: "succeeded" } }),
  };
}
const folha = (plano: "vitalicio" | "mensal", o: { onPago?: () => void; onPlano?: (p: "vitalicio" | "mensal") => void } = {}) =>
  render(<FolhaPagamentoWeb plano={plano} onPlano={o.onPlano ?? vi.fn()} onFechar={vi.fn()} onPago={o.onPago ?? vi.fn()} />);

describe("folha: vitalício", () => {
  it("abre no Pix com e-mail, garantia e sem CPF; e-mail vazio não gera Pix", async () => {
    const a = apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    folha("vitalicio");
    expect(screen.getByTestId("appweb-folha-titulo").textContent).toBe("CORE vitalício · R$ 97,90");
    expect(screen.getByTestId("appweb-aba-pix").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByTestId("appweb-garantia").textContent).toContain("Garantia de 7 dias");
    expect(document.body.textContent).not.toMatch(/CPF/);
    fireEvent.click(screen.getByTestId("appweb-gerar-pix"));
    expect((await screen.findByTestId("appweb-erro-email")).textContent).toContain("e-mail");
    expect(a.chamadas).toHaveLength(0);
    expect(eventos.find((e) => e.nome === "appweb_folha_aberta")?.dados).toMatchObject({ funil: "app_web", plano: "vitalicio" });
  });
  it("gera o Pix (QR + copiar na folha); fechar e reabrir mostra o MESMO Pix sem pedir outro", async () => {
    const a = apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    folha("vitalicio");
    fireEvent.change(screen.getByTestId("appweb-email"), { target: { value: "Maria@Exemplo.com" } });
    fireEvent.click(screen.getByTestId("appweb-gerar-pix"));
    expect(await screen.findByTestId("appweb-pix-qr")).toBeTruthy();
    expect(a.chamadas[0]).toMatchObject({ acao: "pix", email: "maria@exemplo.com", pagina: "app_web" });
    expect(a.chamadas[0]).not.toHaveProperty("amount");
    expect(lerPedido()).toMatchObject({ fase: "pix", pi: "pi_1", email: "maria@exemplo.com" });
    expect(eventos.some((e) => e.nome === "appweb_pix_gerado")).toBe(true);
    const ref = lerPedido()!.ref;
    cleanup();
    folha("vitalicio");
    expect(await screen.findByTestId("appweb-pix-qr")).toBeTruthy();
    expect(a.chamadas).toHaveLength(1);
    expect(lerPedido()!.ref).toBe(ref);
  });
  it("o Pix cai → pago (1×) → onPago", async () => {
    const a = apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    gravarPedido({ ...pedidoNovo("vitalicio"), fase: "pix", pi: "pi_1", pix: { data: "00020126" }, email: "a@b.com" });
    const onPago = vi.fn();
    folha("vitalicio", { onPago });
    a.pagar();
    expect(await screen.findByTestId("appweb-pago", {}, { timeout: 5000 })).toBeTruthy();
    await waitFor(() => expect(onPago).toHaveBeenCalled(), { timeout: 3000 });
    expect(eventos.filter((e) => e.nome === "appweb_pago")).toHaveLength(1);
    expect(eventos.find((e) => e.nome === "appweb_pago")!.dados).toMatchObject({ metodo: "pix", plano: "vitalicio", valor_cents: 9790 });
    expect(lerPedido()).toMatchObject({ fase: "pago", purchaseFeito: true });
  });
  it("cartão em 3x: o botão diz a parcela e o pedido leva parcelas 3 (o PM, nunca o número do cartão)", async () => {
    const a = apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    folha("vitalicio");
    fireEvent.change(screen.getByTestId("appweb-email"), { target: { value: "maria@exemplo.com" } });
    fireEvent.click(screen.getByTestId("appweb-aba-card"));
    await screen.findByTestId("cartao-falso");
    fireEvent.click(screen.getByTestId("appweb-parcela-3"));
    await waitFor(() => expect(screen.getByTestId("appweb-pagar-cartao").textContent).toBe("Pagar R$ 97,90 em 3x"));
    // revisão 7: 3 × 32,63 = 97,89 — a tela diz o total e marca a parcela aproximada; 2x é exato
    expect(screen.getByTestId("appweb-parcela-3").textContent).toContain("≈ R$ 32,63");
    expect(screen.getByTestId("appweb-parcela-2").textContent).not.toContain("≈");
    expect(screen.getByTestId("appweb-parcelas-total").textContent).toContain("Total R$ 97,90");
    expect(screen.getByTestId("appweb-parcelas-total").textContent).not.toMatch(/sem juros/);
    fireEvent.click(screen.getByTestId("appweb-pagar-cartao"));
    await screen.findByTestId("appweb-pago");
    expect(a.chamadas[0]).toMatchObject({ acao: "cartao", pm: "pm_teste4242", parcelas: 3 });
  });
  it("recusado → aviso e a folha continua aberta", async () => {
    apiFalsa({ cartao: { ok: false, recusado: true, code: "generic_decline" } }); (window as J).__appWebStripe = stripeFalso();
    folha("vitalicio");
    fireEvent.change(screen.getByTestId("appweb-email"), { target: { value: "maria@exemplo.com" } });
    fireEvent.click(screen.getByTestId("appweb-aba-card"));
    await screen.findByTestId("cartao-falso");
    await waitFor(() => expect((screen.getByTestId("appweb-pagar-cartao") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId("appweb-pagar-cartao"));
    expect((await screen.findByTestId("appweb-erro")).textContent).toContain("O banco recusou este cartão");
    expect(eventos.find((e) => e.nome === "appweb_cartao_recusado")?.dados).toMatchObject({ code: "generic_decline" });
    expect(screen.queryByTestId("appweb-pago")).toBeNull();
  });
  it("com Pix vivo, a aba Cartão avisa que o Pix será cancelado", async () => {
    apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    gravarPedido({ ...pedidoNovo("vitalicio"), fase: "pix", pi: "pi_1", pix: { data: "00020126" }, email: "a@b.com" });
    folha("vitalicio");
    fireEvent.click(screen.getByTestId("appweb-aba-card"));
    expect(screen.getByTestId("appweb-painel-cartao").textContent).toContain("o Pix que você gerou é cancelado");
  });
});

describe("folha: mensal", () => {
  it("abre no Cartão, sem aba Pix, com 'Prefere Pix? Vitalício por R$ 97,90'; assinar → pago com a assinatura", async () => {
    const a = apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    const onPlano = vi.fn();
    folha("mensal", { onPlano });
    expect(screen.getByTestId("appweb-folha-titulo").textContent).toBe("CORE mensal · R$ 34,90/mês");
    expect(screen.queryByTestId("appweb-aba-pix")).toBeNull();
    expect(screen.queryByTestId("appweb-parcelas")).toBeNull();
    expect(screen.getByTestId("appweb-prefere-pix").textContent).toBe("Prefere Pix? Vitalício por R$ 97,90");
    fireEvent.change(screen.getByTestId("appweb-email"), { target: { value: "maria@exemplo.com" } });
    await screen.findByTestId("cartao-falso");
    await waitFor(() => expect(screen.getByTestId("appweb-pagar-cartao").textContent).toBe("Assinar por R$ 34,90/mês"));
    fireEvent.click(screen.getByTestId("appweb-pagar-cartao"));
    await screen.findByTestId("appweb-pago");
    expect(a.chamadas[0]).toMatchObject({ acao: "assinar", pm: "pm_teste4242" });
    expect(lerPedido()).toMatchObject({ plano: "mensal", sub: "sub_1" });
    cleanup();
    folha("mensal", { onPlano });
    fireEvent.click(screen.getByTestId("appweb-prefere-pix"));
    expect(onPlano).toHaveBeenCalledWith("vitalicio");
  });
});

describe("o pedido no aparelho", () => {
  it("vence em 2 dias (pago: 7)", () => {
    const p = gravarPedido(pedidoNovo("vitalicio"));
    expect(lerPedido(p.salvoEm + 1 * 86400_000)).not.toBeNull();
    expect(lerPedido(p.salvoEm + 3 * 86400_000)).toBeNull();
    expect(localStorage.getItem(CHAVE_PEDIDO)).toBeNull();
    const pago = gravarPedido({ ...pedidoNovo("vitalicio"), fase: "pago" });
    expect(lerPedido(pago.salvoEm + 5 * 86400_000)).not.toBeNull();
  });
});

void act;

describe("folha: ir ao Cartão e voltar pro Pix vivo", () => {
  it("mostra o MESMO QR de novo (sem gerar outro) e o Pix pago com a aba Cartão aberta ainda conclui", async () => {
    const a = apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    gravarPedido({ ...pedidoNovo("vitalicio"), fase: "pix", pi: "pi_1", pix: { data: "00020126" }, email: "a@b.com" });
    const onPago = vi.fn();
    folha("vitalicio", { onPago });
    fireEvent.click(screen.getByTestId("appweb-aba-card"));
    fireEvent.click(screen.getByTestId("appweb-aba-pix"));
    expect(await screen.findByTestId("appweb-pix-qr")).toBeTruthy();
    expect(a.chamadas).toHaveLength(0);
    fireEvent.click(screen.getByTestId("appweb-aba-card"));
    a.pagar();
    expect(await screen.findByTestId("appweb-pago", {}, { timeout: 5000 })).toBeTruthy();
  });
});

describe("revisão de tela (14/11)", () => {
  it("1: recarregar com Pix vivo e ?step=compromissos (volta da demo) → pousa no paywall, não nas perguntas", async () => {
    localStorage.setItem(CHAVE_FORCA_FUNIL_APP_WEB, "on");
    gravarPedido({ ...pedidoNovo("vitalicio"), fase: "pix", pi: "pi_1", pix: { data: "00020126" }, email: "a@b.com" });
    let busca = "";
    render(
      <MemoryRouter initialEntries={["/funil-app?step=compromissos"]}>
        <Routes><Route path="/funil-app" element={<><FunilAppWeb /><Espiao onBusca={(b) => { busca = b; }} /></>} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId("comecar-w");
    expect(busca).toContain("step=offer");
    expect(busca).not.toContain("compromissos");
  });
  it("1: SEM pedido pendente o ?step=compromissos fica (o funil de sempre)", async () => {
    localStorage.setItem(CHAVE_FORCA_FUNIL_APP_WEB, "on");
    let busca = "";
    render(
      <MemoryRouter initialEntries={["/funil-app?step=compromissos"]}>
        <Routes><Route path="/funil-app" element={<><FunilAppWeb /><Espiao onBusca={(b) => { busca = b; }} /></>} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByTestId("comecar-w");
    expect(busca).toContain("step=compromissos");
  });
  it("3+4: com Pix gerado: como pagar no celular, prazo junto do copiar e 'Trocar e-mail' (o MESMO Pix passa a liberar o e-mail novo)", async () => {
    const a = apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    gravarPedido({ ...pedidoNovo("vitalicio"), fase: "pix", pi: "pi_1", pix: { data: "00020126", expires_at: 1763134200 }, email: "a@b.com" });
    folha("vitalicio");
    expect(screen.getByTestId("appweb-pix-como").textContent).toContain("Pix Copia e Cola");
    expect(screen.getByTestId("appweb-pix-vence").textContent).toMatch(/Vale até/);
    fireEvent.click(screen.getByTestId("appweb-trocar-email"));
    fireEvent.change(screen.getByTestId("appweb-email"), { target: { value: "novo@exemplo.com" } });
    fireEvent.click(screen.getByTestId("appweb-gerar-pix"));
    expect(await screen.findByTestId("appweb-pix-qr")).toBeTruthy();
    expect(a.chamadas[0]).toMatchObject({ acao: "pix", email: "novo@exemplo.com", ref: lerPedido()!.ref });
    expect(lerPedido()!.email).toBe("novo@exemplo.com");
  });
  it("5: recusado no vitalício → 'Pagar no Pix' leva pra aba Pix mantendo o e-mail; no mensal → 'Prefere Pix? Vitalício'", async () => {
    apiFalsa({ cartao: { ok: false, recusado: true, code: "generic_decline" }, assinar: { ok: false, recusado: true, code: "x" } }); (window as J).__appWebStripe = stripeFalso();
    folha("vitalicio");
    fireEvent.change(screen.getByTestId("appweb-email"), { target: { value: "maria@exemplo.com" } });
    fireEvent.click(screen.getByTestId("appweb-aba-card"));
    await screen.findByTestId("cartao-falso");
    await waitFor(() => expect((screen.getByTestId("appweb-pagar-cartao") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId("appweb-pagar-cartao"));
    fireEvent.click(await screen.findByTestId("appweb-recusado-pix"));
    expect(screen.getByTestId("appweb-aba-pix").getAttribute("aria-checked")).toBe("true");
    expect((screen.getByTestId("appweb-email") as HTMLInputElement).value).toBe("maria@exemplo.com");
    cleanup(); localStorage.clear();
    const onPlano = vi.fn();
    folha("mensal", { onPlano });
    fireEvent.change(screen.getByTestId("appweb-email"), { target: { value: "maria@exemplo.com" } });
    await screen.findByTestId("cartao-falso");
    await waitFor(() => expect((screen.getByTestId("appweb-pagar-cartao") as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByTestId("appweb-pagar-cartao"));
    const link = await screen.findByTestId("appweb-recusado-pix");
    expect(link.textContent).toBe("Prefere Pix? Vitalício por R$ 97,90");
    fireEvent.click(link);
    expect(onPlano).toHaveBeenCalledWith("vitalicio");
  });
  it("6+9+11: botão de pagar no rodapé fixo; garantia com o canal; subtítulo de 1 linha", () => {
    apiFalsa(); (window as J).__appWebStripe = stripeFalso();
    folha("vitalicio");
    expect(screen.getByTestId("appweb-rodape").contains(screen.getByTestId("appweb-gerar-pix"))).toBe(true);
    expect(screen.getByTestId("appweb-garantia").textContent).toContain("Garantia de 7 dias: 1 e-mail pra contato@coreaplicativo.com.br e devolvemos 100%.");
    expect(screen.getByTestId("appweb-folha-subtitulo").textContent).toBe("App CORE completo, pra sempre. iPhone, Android e computador.");
  });
  it("2: atrás do 'Liberar meu CORE' o fundo é branco sólido (sem degradê translúcido)", () => {
    const fonte = ler("src/pages/funis/w/PaywallWebStripe.tsx");
    expect(fonte).toContain('className="fixed inset-x-0 bottom-0 z-[75] bg-white pt-3"');
    expect(fonte).not.toContain("via-white/95");
  });
  it("8: senha com '(mínimo 6)' e olhinho; lojas com 'e a senha que você criou'", () => {
    const fonte = ler("src/pages/funis/w/PosCompraWeb.tsx");
    expect(fonte).toContain("Crie uma senha pra entrar no app");
    expect(fonte).toContain("(mínimo 6)");
    expect(fonte).toContain('data-testid="appweb-ver-senha"');
    expect(fonte).toContain("Entre com este e-mail e a senha que você criou");
    expect(fonte).toContain("Você já tinha conta: entre com sua senha ou receba um código por e-mail.");
  });
});
