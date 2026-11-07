/**
 * Bug "relatorio-app" (07/11): na aba Relatórios do APP, os botões Receitas, Despesas, Tudo e Imprimir Relatório não
 * faziam nada. O `<a download>` não baixa no WebView, e no iPhone o `window.open` devolve null (WebViewDelegationHandler
 * do Capacitor) — a tela saía calada. No app os quatro vão pela folha nativa de `lib/compartilhar`. No site nada muda:
 * o CSV continua baixando direto e a impressão continua abrindo a janela.
 *
 * O aparelho de verdade não existe aqui: Filesystem e Share são simulados. O teste prova o que o app MANDA pra folha,
 * não que a folha abre.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { UserDataContext, type UserDataContextType } from "@/hooks/use-user-data";
import { Reports } from "@/components/Reports";

const nativo = vi.hoisted(() => ({ v: false }));
vi.mock("@/lib/native-shell", async (orig) => ({ ...(await orig<typeof import("@/lib/native-shell")>()), isNativeShell: () => nativo.v }));
const escrito = vi.hoisted(() => [] as Array<{ path: string; data: string }>);
const compartilhar = vi.hoisted(() => ({ fn: vi.fn() }));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: { writeFile: async (o: { path: string; data: string }) => { escrito.push(o); return { uri: `file:///cache/${o.path}` }; } },
}));
vi.mock("@capacitor/share", () => ({ Share: { share: (o: unknown) => compartilhar.fn(o) } }));
const toasts = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", async (orig) => ({ ...(await orig<typeof import("sonner")>()), toast: Object.assign(vi.fn(), toasts) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke: vi.fn() } } }));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null, session: null, loading: false, isSubscribed: true, subLoaded: true }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const store: UserDataContextType = {
  get: <T,>(_: string, fallback: T) => fallback,
  set: () => {},
  loaded: true,
  isGuest: true,
  fetchKey: async () => null,
};
const abrirRelatorio = () => render(
  <UserDataContext.Provider value={store}>
    <Reports
      incomes={[{ id: "i", description: "Salário", value: 6200, date: "2026-11-01" }]}
      expenses={[{ id: "e", description: "Pão de açúcar", category: "mercado", value: 464, date: "2026-11-02", paymentMethod: "pix" }]}
      totalIncome={6200} totalExpenses={464} totalDebts={0} totalInvestments={0}
      setIncomes={() => {}} setExpenses={() => {}}
      fixedExpenses={[]} installments={[]}
    />
  </UserDataContext.Provider>,
);
/** O arquivo como ele fica no disco: o base64 que o Filesystem recebe, de volta em bytes e em texto UTF-8. */
const bytesDe = (base64: string) => Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
const textoDe = (base64: string) => new TextDecoder("utf-8", { ignoreBOM: true }).decode(bytesDe(base64));

const clicouNoLink = vi.fn();
const janela = vi.fn();
const janelaOriginal = window.open;

beforeEach(() => {
  nativo.v = false; escrito.length = 0;
  compartilhar.fn.mockReset(); compartilhar.fn.mockResolvedValue(undefined);
  toasts.success.mockReset(); toasts.error.mockReset(); clicouNoLink.mockReset(); janela.mockReset();
  Object.defineProperty(navigator, "canShare", { value: undefined, configurable: true });
  Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clicouNoLink);
  window.open = janela as unknown as typeof window.open;
});
afterEach(() => { vi.restoreAllMocks(); window.open = janelaOriginal; });

describe("no APP (iPhone e Android)", () => {
  beforeEach(() => { nativo.v = true; janela.mockReturnValue(null); }); // o que o iPhone devolve

  it.each([
    ["Receitas", "incomes", "Salário", "Pão de açúcar"],
    ["Despesas", "expenses", "Pão de açúcar", "Salário"],
    ["Tudo", "all", "Pão de açúcar", null],
  ])("%s abre a folha nativa com a planilha", async (botao, tipo, tem, naoTem) => {
    abrirRelatorio();
    fireEvent.click(screen.getByRole("button", { name: botao }));
    await waitFor(() => expect(compartilhar.fn).toHaveBeenCalledTimes(1));

    expect(escrito).toHaveLength(1);
    expect(escrito[0].path).toMatch(new RegExp(`^financas_${tipo}_\\d{4}-\\d{2}-\\d{2}\\.csv$`));
    expect(compartilhar.fn.mock.calls[0][0].files).toEqual([`file:///cache/${escrito[0].path}`]);
    // o BOM é o que faz o Excel ler os acentos (montarCSV, 26/09): tem que chegar no arquivo
    expect([...bytesDe(escrito[0].data).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = textoDe(escrito[0].data);
    expect(csv).toContain(tem);
    if (naoTem) expect(csv).not.toContain(naoTem);
    expect(clicouNoLink).not.toHaveBeenCalled();
    expect(toasts.error).not.toHaveBeenCalled();
  });

  it("Imprimir Relatório abre a folha nativa com o relatório em HTML, sem tentar abrir janela", async () => {
    abrirRelatorio();
    fireEvent.click(screen.getByRole("button", { name: /Imprimir Relatório/ }));
    await waitFor(() => expect(compartilhar.fn).toHaveBeenCalledTimes(1));

    expect(janela).not.toHaveBeenCalled();
    expect(escrito).toHaveLength(1);
    expect(escrito[0].path).toMatch(/^financas_relatorio_\d{4}-\d{2}-\d{2}\.html$/);
    const html = textoDe(escrito[0].data);
    expect(html).toContain("Pão de açúcar");
    expect(html).toContain("Relatório Financeiro");
  });

  it("o arquivo HTML diz que é UTF-8 antes do primeiro acento: fora do app ninguém sabe o tipo do Blob", async () => {
    abrirRelatorio();
    fireEvent.click(screen.getByRole("button", { name: /Imprimir Relatório/ }));
    await waitFor(() => expect(escrito).toHaveLength(1));
    const html = textoDe(escrito[0].data);
    const charset = html.search(/<meta charset="utf-8"/i);
    expect(charset).toBeGreaterThan(-1);
    expect(charset).toBeLessThan(html.indexOf("Relatório"));
    expect(html).toContain('name="viewport"');
  });

  it("deu errado de verdade: avisa, em vez de ficar calado", async () => {
    compartilhar.fn.mockRejectedValue(new Error("plugin ausente"));
    abrirRelatorio();
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledTimes(1));

    toasts.error.mockReset();
    fireEvent.click(screen.getByRole("button", { name: /Imprimir Relatório/ }));
    await waitFor(() => expect(toasts.error).toHaveBeenCalledTimes(1));
  });

  it("a pessoa fechou a folha: não é erro", async () => {
    compartilhar.fn.mockRejectedValue(new Error("Share canceled"));
    abrirRelatorio();
    fireEvent.click(screen.getByRole("button", { name: "Tudo" }));
    await waitFor(() => expect(compartilhar.fn).toHaveBeenCalledTimes(1));
    await new Promise((r) => setTimeout(r, 0));
    expect(toasts.error).not.toHaveBeenCalled();
  });
});

describe("no SITE nada muda", () => {
  it("o CSV baixa direto, mesmo em navegador com Web Share (no Windows a folha não tem Salvar)", async () => {
    const share = vi.fn();
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    abrirRelatorio();
    fireEvent.click(screen.getByRole("button", { name: "Despesas" }));
    await waitFor(() => expect(clicouNoLink).toHaveBeenCalledTimes(1));
    expect(share).not.toHaveBeenCalled();
    expect(compartilhar.fn).not.toHaveBeenCalled();
  });

  it("Imprimir abre a janela no mesmo toque (senão o bloqueador de pop-up segura) e chama a impressão", () => {
    const print = vi.fn();
    const write = vi.fn();
    janela.mockReturnValue({ document: { write, close: vi.fn() }, print });
    abrirRelatorio();
    fireEvent.click(screen.getByRole("button", { name: /Imprimir Relatório/ }));
    expect(janela).toHaveBeenCalledWith("", "_blank");
    expect(write.mock.calls[0][0]).toContain("Pão de açúcar");
    expect(print).toHaveBeenCalledTimes(1);
    expect(escrito).toHaveLength(0);
  });
});
