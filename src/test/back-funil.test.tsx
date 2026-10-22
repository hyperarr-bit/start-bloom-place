/**
 * BACK DOS FUNIS WEB (21/10) — o que este arquivo trava:
 *   · a chave: BACK_FUNIL desligada = nada empilha, o /inicio fica como era (o degrau antigo do PaywallDia14);
 *   · `?back=on` liga na aba; `?back=off` desliga; o app da loja nunca liga;
 *   · o 1º voltar mostra o back (1x por sessão por etapa), o 2º voltar sai de verdade (sem laço);
 *   · degrau sobrando sem etapa = o voltar é repassado (vale como UM voltar normal);
 *   · a tela: preço igual (R$ 27,90), 2 textos, diálogo acessível, eventos back_view/back_ficou/back_saiu;
 *   · /inicio: o voltar na oferta mostra o back e "Quero meu CORE" abre o Pix de sempre;
 *   · Pix gerado: o back mostra o MESMO código; "Copiar" copia ele, sem Pix novo.
 * O /hoje está em back-hoje.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MotionGlobalConfig } from "framer-motion";

const m = vi.hoisted(() => ({
  nativo: false,
  invoke: vi.fn(),
  track: vi.fn(),
  beacon: vi.fn(),
}));

vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => m.nativo }));
vi.mock("@/lib/analytics", () => ({
  trackEvent: m.track,
  trackEventBeacon: m.beacon,
  captureLandingMeta: vi.fn(),
  getAttributionParams: () => ({}),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: m.invoke },
    auth: {
      signInWithOtp: vi.fn(),
      verifyOtp: vi.fn(),
      getUser: async () => ({ data: { user: { id: "u1", email: "ana@exemplo.com" } } }),
      getSession: async () => ({ data: { session: null } }),
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }), update: () => ({ eq: () => ({ then: () => {} }) }) }),
  },
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "u1", email: "ana@exemplo.com" }, loading: false, isSubscribed: false, subLoaded: true, signUp: vi.fn(), signIn: vi.fn() }),
  useAuthOpcional: () => ({ user: { id: "u1" } }),
}));
vi.mock("@/hooks/use-user-data", () => ({ useUserData: () => ({ get: () => null, set: vi.fn(), data: {}, loaded: true }) }));
vi.mock("@/lib/sessao-anonima", () => ({
  garantirSessao: async () => "conta",
  anonimoLigado: async () => false,
  emailDaSessao: async () => "ana@exemplo.com",
  definirEmailDaCompra: vi.fn(),
  entrarNaContaExistente: vi.fn(),
  marcarBatismoSeSemEmail: async () => {},
  guardarCompraAnonima: vi.fn().mockResolvedValue(undefined),
  limparBatismo: vi.fn(),
}));
vi.mock("@/lib/prova-social", () => ({
  useProvaSocial: () => null,
  buscarProvaSocial: vi.fn().mockResolvedValue(null),
  formatarPessoas: (n: number) => String(n),
  PROVA_SOCIAL_MINIMO: 1000,
}));
vi.mock("@/lib/meta-pixel", () => ({ fireMetaEvent: vi.fn() }));
vi.mock("@/lib/purchase-tracking", () => ({ markPixPurchasePending: vi.fn(), firePixPurchaseOnce: vi.fn() }));
vi.mock("@/lib/funnel", async (orig) => ({ ...(await orig<typeof import("@/lib/funnel")>()), isInAppBrowser: () => false }));
vi.mock("@/components/retention/WinbackWheel", () => ({ WinbackWheel: () => null, SLICES_FUNIL: [] }));

import { BACK_FUNIL, _zerarBack, backLigado, useSegurarVoltar, varianteDoBack } from "@/lib/back-funil";
import { BackFolha, COPY_DO_BACK } from "@/components/paywall/BackFolha";
import { PaywallDia14 } from "@/pages/funis/dia14/PaywallDia14";
import { PixCheckout } from "@/components/paywall/PixCheckout";

MotionGlobalConfig.skipAnimations = true;

/* ── ambiente: sempre há uma página "antes" (o anúncio) pra o voltar ter pra onde ir ── */
const abrir = (url: string) => {
  window.history.replaceState(null, "", "/anuncio");
  window.history.pushState(null, "", url);
};
/** O voltar do navegador (o jsdom dispara o popstate numa tarefa depois). */
const voltar = () => act(() => new Promise<void>((ok) => {
  const f = () => { window.removeEventListener("popstate", f); window.setTimeout(ok, 0); };
  window.addEventListener("popstate", f);
  window.history.back();
}));
const eventos = (nome: string) => m.track.mock.calls.filter((c) => c[0] === nome).map((c) => c[1] as Record<string, unknown>);
const marcasNoHistorico = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((c) => (c[0] as Record<string, unknown> | null)?.coreBack).length;

let push: ReturnType<typeof vi.spyOn>;
let back: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  _zerarBack();
  m.nativo = false;
  m.track.mockClear(); m.beacon.mockClear(); m.invoke.mockReset();
  m.invoke.mockResolvedValue({ data: {}, error: null });
  try { localStorage.clear(); sessionStorage.clear(); } catch { /* noop */ }
  push = vi.spyOn(window.history, "pushState");
  back = vi.spyOn(window.history, "back");
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => { cleanup(); push.mockRestore(); back.mockRestore(); _zerarBack(); });

const Etapa = ({ ativo, aoVoltar, etapa = "oferta" }: { ativo: boolean; aoVoltar: () => void; etapa?: "oferta" | "pix" }) => {
  useSegurarVoltar("inicio", etapa, ativo, aoVoltar);
  return <p>etapa</p>;
};

describe("a chave", () => {
  it("BACK_FUNIL nasce DESLIGADA", () => { expect(BACK_FUNIL).toBe(false); });

  it("desligada: a etapa não empilha nada e o voltar sai como sempre", async () => {
    abrir("/inicio");
    const aoVoltar = vi.fn();
    render(<Etapa ativo aoVoltar={aoVoltar} />);
    expect(backLigado()).toBe(false);
    expect(marcasNoHistorico(push)).toBe(0);
    await voltar();
    expect(aoVoltar).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/anuncio");
  });

  it("?back=on liga e fica na aba (o funil troca de URL); ?back=off desliga", () => {
    abrir("/inicio?back=on");
    expect(backLigado()).toBe(true);
    abrir("/inicio?step=signup");
    expect(backLigado()).toBe(true);
    abrir("/inicio?back=off");
    expect(backLigado()).toBe(false);
  });

  it("app da loja: nunca liga", () => {
    m.nativo = true;
    abrir("/inicio?back=on");
    expect(backLigado()).toBe(false);
  });

  it("variante: ?backv= fixa; sem ela, sorteio guardado no aparelho (sempre o mesmo)", () => {
    abrir("/inicio?backv=b");
    expect(varianteDoBack()).toBe("b");
    sessionStorage.clear(); _zerarBack();
    abrir("/inicio");
    const v = varianteDoBack();
    expect(["a", "b"]).toContain(v);
    _zerarBack();
    expect(varianteDoBack()).toBe(v);
  });
});

describe("o degrau", () => {
  it("1º voltar mostra o back (1x), 2º voltar sai de verdade — sem laço", async () => {
    abrir("/inicio?back=on");
    const aoVoltar = vi.fn();
    render(<Etapa ativo aoVoltar={aoVoltar} />);
    expect(marcasNoHistorico(push)).toBe(1);
    await voltar();
    expect(aoVoltar).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/inicio"); // ficou
    expect(marcasNoHistorico(push)).toBe(1); // não empilhou outro
    await voltar();
    expect(aoVoltar).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/anuncio"); // saiu
    expect(back).toHaveBeenCalledTimes(2); // só os dois voltar da pessoa, nada repassado
  });

  it("1x por SESSÃO: a mesma etapa montada de novo não empilha", async () => {
    abrir("/inicio?back=on");
    const aoVoltar = vi.fn();
    const r = render(<Etapa ativo aoVoltar={aoVoltar} />);
    await voltar();
    r.unmount();
    _zerarBack(); // memória zerada, a sessão (sessionStorage) não
    render(<Etapa ativo aoVoltar={aoVoltar} />);
    expect(marcasNoHistorico(push)).toBe(1);
  });

  it("cada etapa tem o seu: depois do da oferta, o do Pix ganha degrau próprio", async () => {
    abrir("/inicio?back=on");
    const oferta = vi.fn();
    const pix = vi.fn();
    const r = render(<Etapa ativo aoVoltar={oferta} />);
    await voltar();
    r.rerender(<><Etapa ativo={false} aoVoltar={oferta} /><Etapa etapa="pix" ativo aoVoltar={pix} /></>);
    expect(marcasNoHistorico(push)).toBe(2);
    await voltar();
    expect(pix).toHaveBeenCalledTimes(1);
    expect(oferta).toHaveBeenCalledTimes(1);
  });

  it("degrau sobrando (a pessoa saiu da oferta por dentro da página): o voltar é repassado, vale como UM voltar", async () => {
    abrir("/inicio?back=on");
    const aoVoltar = vi.fn();
    const r = render(<Etapa ativo aoVoltar={aoVoltar} />);
    r.rerender(<Etapa ativo={false} aoVoltar={aoVoltar} />);
    await voltar();
    await waitFor(() => expect(window.location.pathname).toBe("/anuncio"));
    expect(aoVoltar).not.toHaveBeenCalled();
    expect(back).toHaveBeenCalledTimes(2); // o da pessoa + o repasse
  });

  it("etapa inativa (telas do quiz) não mexe no histórico", () => {
    abrir("/inicio?back=on");
    render(<Etapa ativo={false} aoVoltar={vi.fn()} />);
    expect(marcasNoHistorico(push)).toBe(0);
  });
});

describe("a tela (BackFolha)", () => {
  const folha = (over: Partial<Parameters<typeof BackFolha>[0]> = {}) => {
    const p = { funil: "inicio" as const, etapa: "oferta" as const, variante: "a" as const, preco: "27,90", onQuero: vi.fn(), onFicar: vi.fn(), onSair: vi.fn(), ...over };
    render(<BackFolha {...p} />);
    return p;
  };

  it("oferta: o MESMO preço, o texto da variante, diálogo com foco no título", () => {
    folha();
    const d = screen.getByRole("dialog");
    expect(d.getAttribute("aria-modal")).toBe("true");
    expect(screen.getByTestId("back-preco").textContent).toBe("R$27,90");
    const h = screen.getByRole("heading", { name: COPY_DO_BACK.oferta.a.titulo });
    expect(document.activeElement).toBe(h);
    expect(d.getAttribute("aria-labelledby")).toBe(h.id);
    expect(screen.getByText("Garantia de 7 dias")).toBeTruthy();
    expect(eventos("back_view")[0]).toMatchObject({ funil: "inicio", etapa: "oferta", variante: "a" });
  });

  it("os títulos não terminam em ponto (regra do dono) e as duas variações existem", () => {
    for (const etapa of ["oferta", "pix"] as const) for (const v of ["a", "b"] as const) {
      expect(COPY_DO_BACK[etapa][v].titulo).not.toMatch(/\.$/);
      expect(COPY_DO_BACK[etapa][v].titulo.length).toBeLessThan(45);
    }
    expect(COPY_DO_BACK.oferta.a.titulo).not.toBe(COPY_DO_BACK.oferta.b.titulo);
  });

  it("Quero meu CORE → back_ficou {acao: quero}; Sair → back_saiu {via: botao}; Esc → fica", () => {
    const p = folha({ variante: "b" });
    fireEvent.click(screen.getByTestId("back-quero"));
    expect(p.onQuero).toHaveBeenCalled();
    expect(eventos("back_ficou")[0]).toMatchObject({ acao: "quero", variante: "b" });
    cleanup();
    const q = folha();
    fireEvent.click(screen.getByTestId("back-sair"));
    expect(q.onSair).toHaveBeenCalled();
    expect(eventos("back_saiu")[0]).toMatchObject({ via: "botao", etapa: "oferta" });
    cleanup();
    const r = folha();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(r.onFicar).toHaveBeenCalled();
    expect(eventos("back_ficou").at(-1)).toMatchObject({ acao: "fechou" });
  });

  it("fechou sem decidir (apertou voltar de novo) → back_saiu {via: voltar_de_novo}, pelo beacon", () => {
    const r = render(<BackFolha funil="hoje" etapa="oferta" variante="a" preco="27,90" onQuero={vi.fn()} onFicar={vi.fn()} onSair={vi.fn()} />);
    r.unmount();
    expect(m.beacon.mock.calls.find((c) => c[0] === "back_saiu")?.[1]).toMatchObject({ via: "voltar_de_novo", funil: "hoje" });
  });

  it("pix: o código e a validade na tela; o botão é Copiar", () => {
    folha({ etapa: "pix", codigo: "000201pixABC", validade: "24:13" });
    expect(screen.getByTestId("back-codigo").textContent).toBe("000201pixABC");
    expect(document.body.textContent).toContain("Vale por mais 24:13");
    expect(screen.getByTestId("back-quero").textContent).toContain("Copiar código Pix");
  });
});

describe("/inicio — a oferta (PaywallDia14)", () => {
  const paywall = () => render(<MemoryRouter><PaywallDia14 context="funnel" answers={{ area: "dinheiro" }} /></MemoryRouter>);

  it("chave desligada: o degrau antigo de sempre e nenhuma tela de back", async () => {
    abrir("/inicio?step=signup");
    paywall();
    expect(push.mock.calls.some((c) => (c[0] as Record<string, unknown> | null)?.paywallDia14)).toBe(true);
    expect(marcasNoHistorico(push)).toBe(0);
    await voltar();
    await waitFor(() => expect(window.location.pathname).toBe("/anuncio"));
    expect(screen.queryByTestId("back-folha")).toBeNull();
  });

  it("?back=on: 1º voltar mostra a mesma oferta (R$ 27,90); Quero meu CORE abre o Pix de sempre", async () => {
    abrir("/inicio?step=signup&back=on");
    paywall();
    expect(push.mock.calls.some((c) => (c[0] as Record<string, unknown> | null)?.paywallDia14)).toBe(false);
    expect(marcasNoHistorico(push)).toBe(1);
    await voltar();
    const f = await screen.findByTestId("back-folha");
    expect(f.getAttribute("data-funil")).toBe("inicio");
    expect(screen.getByTestId("back-preco").textContent).toBe("R$27,90");
    expect(window.location.pathname).toBe("/inicio");
    fireEvent.click(screen.getByTestId("back-quero"));
    expect(eventos("funnel_click").some((e) => e.cta === "back_quero")).toBe(true);
    await waitFor(() => expect(screen.queryByTestId("back-folha")).toBeNull());
  });

  it("?back=on: Sair mesmo assim faz o voltar de verdade", async () => {
    abrir("/inicio?step=signup&back=on");
    paywall();
    await voltar();
    fireEvent.click(await screen.findByTestId("back-sair"));
    await waitFor(() => expect(window.location.pathname).toBe("/anuncio"));
    expect(screen.queryByTestId("back-folha")).toBeNull();
  });
});

describe("/inicio — o Pix gerado (PixCheckout)", () => {
  const qr = { data: { orderId: "ord1", qrCode: "000201pixMESMO", qrCodeBase64: null, amount: "27,90", expiresAt: new Date(Date.now() + 30 * 60e3).toISOString() }, error: null };
  const clip = vi.fn(async () => {});
  beforeEach(() => {
    m.invoke.mockImplementation(async (fn: string, opts?: { body?: Record<string, unknown> }) => {
      if (fn === "asaas-pix" && opts?.body?.action === "create") return qr;
      if (fn === "asaas-pix" && opts?.body?.action === "check") return { data: { paid: false }, error: null };
      return { data: {}, error: null };
    });
    clip.mockClear();
    Object.assign(navigator, { clipboard: { writeText: clip } });
  });
  const criados = () => m.invoke.mock.calls.filter((c) => c[0] === "asaas-pix" && (c[1] as { body: { action: string } }).body.action === "create").length;

  it("?back=on: voltar com o QR na tela mostra o MESMO código; Copiar copia ele, sem Pix novo", async () => {
    abrir("/inicio?gw=asaas&back=on");
    render(<MemoryRouter><PixCheckout offer="w27" context="funnel" onClose={vi.fn()} backFunil="inicio" /></MemoryRouter>);
    await screen.findByText("Copiar código Pix", undefined, { timeout: 10000 });
    await waitFor(() => expect(marcasNoHistorico(push)).toBe(1));
    await voltar();
    const f = await screen.findByTestId("back-folha");
    expect(f.getAttribute("data-etapa")).toBe("pix");
    expect(screen.getByTestId("back-codigo").textContent).toBe("000201pixMESMO");
    expect(screen.getByTestId("back-preco").textContent).toBe("R$27,90");
    fireEvent.click(screen.getByTestId("back-quero"));
    await waitFor(() => expect(clip).toHaveBeenCalledWith("000201pixMESMO"));
    await waitFor(() => expect(screen.queryByTestId("back-folha")).toBeNull());
    expect(criados()).toBe(1);
    expect(eventos("back_ficou")[0]).toMatchObject({ etapa: "pix", acao: "copiou" });
  }, 20000);

  it("sem a prop (gate do app, /planos): nada muda, mesmo com ?back=on", async () => {
    abrir("/inicio?gw=asaas&back=on");
    render(<MemoryRouter><PixCheckout offer="w27" context="funnel" onClose={vi.fn()} /></MemoryRouter>);
    await screen.findByText("Copiar código Pix", undefined, { timeout: 10000 });
    expect(marcasNoHistorico(push)).toBe(0);
  }, 20000);
});
