/**
 * INDIQUE E GANHE — onde a pessoa acha o convite DEPOIS (17/11):
 *   /indique: digita o e-mail da compra → a MESMA resposta sempre (nunca diz se o e-mail existe); e-mail inválido não chama nada;
 *   a entrada do menu Você: só no SITE (iPhone/Android da loja nunca, nem com o QA); pra qualquer cliente pagante;
 *   o bloco do e-mail de acesso leva pra /indique; as 2 caras do painel (bitepal/site) e a troca por ?indique-estilo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IndiqueRecuperarVista } from "@/pages/IndiqueRecuperar";
import { PainelIndiqueVista } from "@/pages/IndiquePainel";
import { PAINEL_INDIQUE_EXEMPLO } from "@/lib/afiliados";
import { clientePagante, entradaIndiqueAqui } from "@/lib/indique-entrada";
import { ESTILO_INDIQUE, estiloIndique } from "@/lib/indique-estilo";
import { blocoIndiqueEmail } from "../../supabase/functions/_shared/indique";
import { htmlVenda } from "../../supabase/functions/_shared/email-venda";

beforeEach(() => { localStorage.clear(); });

describe("/indique (perdi meu link)", () => {
  it("e-mail inválido: avisa e não chama o servidor; válido: a resposta não diz se o e-mail existe", async () => {
    const enviar = vi.fn().mockResolvedValue("ok");
    render(<IndiqueRecuperarVista enviar={enviar} />);
    fireEvent.change(screen.getByTestId("recuperar-campo"), { target: { value: "ana@" } });
    fireEvent.click(screen.getByTestId("recuperar-enviar"));
    expect(screen.getByTestId("recuperar-erro")).toHaveTextContent("Confira o e-mail");
    expect(enviar).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId("recuperar-campo"), { target: { value: " Ana@Exemplo.com " } });
    fireEvent.click(screen.getByTestId("recuperar-enviar"));
    await waitFor(() => expect(screen.getByTestId("recuperar-enviado")).toHaveTextContent("Se esse e-mail é de quem já assina o CORE"));
    expect(enviar).toHaveBeenCalledWith("ana@exemplo.com");
  });
  it("servidor desligado: mensagem neutra (nada sobre o e-mail)", async () => {
    render(<IndiqueRecuperarVista enviar={async () => "desligado"} />);
    fireEvent.change(screen.getByTestId("recuperar-campo"), { target: { value: "ana@exemplo.com" } });
    fireEvent.click(screen.getByTestId("recuperar-enviar"));
    await waitFor(() => expect(screen.getByTestId("recuperar-erro")).toHaveTextContent("ainda não está disponível"));
  });
  it("críticas 17/11 r2: a página não manda procurar no app (quem comprou no iPhone abre o app da loja e não acha nada)", async () => {
    const enviar = vi.fn().mockResolvedValue("ok");
    for (const estilo of ["bitepal", "site"] as const) {
      const { unmount } = render(<IndiqueRecuperarVista enviar={enviar} estilo={estilo} />);
      const pagina = screen.getByTestId("indique-recuperar");
      expect(pagina).not.toHaveTextContent(/aberto no site|no app|Você →/);
      expect(pagina).toHaveTextContent("Se perder de novo, é só voltar aqui.");
      fireEvent.change(screen.getByTestId("recuperar-campo"), { target: { value: "ana@exemplo.com" } });
      fireEvent.click(screen.getByTestId("recuperar-enviar"));
      await waitFor(() => expect(screen.getByTestId("recuperar-enviado")).toBeInTheDocument());
      expect(screen.getByTestId("indique-recuperar")).not.toHaveTextContent(/aberto no site|no app|Você →/);
      unmount();
    }
  });
});

describe("entrada no menu Você", () => {
  it("só no site: iPhone e Android da loja nunca, nem forçando; chave off por padrão", () => {
    expect(entradaIndiqueAqui({ plataforma: "web" })).toBe(false); // INDIQUE_ENTRADA = "off"
    expect(entradaIndiqueAqui({ plataforma: "web", forca: "on" })).toBe(true);
    expect(entradaIndiqueAqui({ plataforma: "ios", forca: "on" })).toBe(false);
    expect(entradaIndiqueAqui({ plataforma: "android", forca: "on", modo: "web" })).toBe(false);
  });
  it("pra QUALQUER cliente pagante (17/11, subida): site, Pix antigo, loja; cancelada não", () => {
    expect(clientePagante([{ payment_method: "stripe", status: "active", plan: "lifetime", amount_cents: 6790 }])).toBe(true);
    expect(clientePagante([{ payment_method: "pix", status: "active", plan: "lifetime", amount_cents: 2790 }])).toBe(true);
    expect(clientePagante([{ payment_method: "stripe", status: "canceled", plan: "lifetime", amount_cents: 6790 }])).toBe(false);
  });
});

describe("e-mail de acesso", () => {
  it("o bloco leva pra /indique e entra no e-mail só quando passado (o e-mail de hoje não muda)", () => {
    const b = blocoIndiqueEmail();
    expect(b).toContain("/indique?utm_source=email");
    expect(b).toContain("R$ 33,95");
    expect(b).toContain("sem limite de amigas");
    expect(b).not.toMatch(/67,90|de graça/); // o e-mail não lembra o preço pago
    const hoje = htmlVenda({ email: "a@x.com", nome: null, periodo: "lifetime", hoje: true });
    expect(hoje).not.toContain("Indique e ganhe");
    expect(htmlVenda({ email: "a@x.com", nome: null, periodo: "lifetime", hoje: true, extra: b })).toContain("Ganhe R$ 33,95 por amiga");
  });
});

describe("as 2 caras", () => {
  it("padrão = c (recomendada); ?indique-estilo=site|bitepal troca e fica no aparelho; auto volta", () => {
    expect(ESTILO_INDIQUE).toBe("c");
    expect(estiloIndique("")).toBe("c");
    expect(estiloIndique("?indique-estilo=site")).toBe("site");
    expect(estiloIndique("")).toBe("site");
    expect(estiloIndique("?indique-estilo=bitepal")).toBe("bitepal");
    expect(estiloIndique("?indique-estilo=auto")).toBe("c");
  });
  it("versão C: o painel não lembra o preço pago (nem meta, nem barra, nem R$ 67,90)", () => {
    render(<PainelIndiqueVista p={PAINEL_INDIQUE_EXEMPLO} salvarPix={vi.fn()} agora={new Date("2026-11-23T15:00:00Z")} estilo="c" />);
    const meta = screen.getByTestId("meta").textContent ?? "";
    expect(meta).toMatch(/Você ganha R\$\s33,95 por amiga · sem limite/);
    expect(meta).not.toMatch(/67,90|de graça/);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
  it("o painel desenha as 2 (mesmos números)", () => {
    const { unmount } = render(<PainelIndiqueVista p={PAINEL_INDIQUE_EXEMPLO} salvarPix={vi.fn()} agora={new Date("2026-11-23T15:00:00Z")} estilo="site" />);
    expect(screen.getByTestId("painel-indique")).toHaveAttribute("data-estilo", "site");
    expect(screen.getByTestId("ganho")).toHaveTextContent("R$ 101,85");
    unmount();
    render(<PainelIndiqueVista p={PAINEL_INDIQUE_EXEMPLO} salvarPix={vi.fn()} agora={new Date("2026-11-23T15:00:00Z")} />);
    expect(screen.getByTestId("painel-indique")).toHaveAttribute("data-estilo", "c");
    expect(screen.getByTestId("ganho")).toHaveTextContent("R$ 101,85");
  });
});
