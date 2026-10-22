/**
 * 1.0.18 (QA de aparelho 21/10, iPhone 17 Pro e SE): no "+ Outro" do post-it (dia 1 em Finanças e as intros dos
 * módulos) o teclado do iPhone desloca a área visível e o conteúdo do módulo ATRÁS do post-it passava por baixo do
 * relógio/ilha. A TarjaDoRelogio cobre a área segura de cima só com o teclado aberto e a tela deslocada.
 */
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { PostItDaMissao } from "@/components/demo-guiada/pecas";
import { instalarTecladoIphone } from "@/test/helpers/teclado-iphone";

afterEach(() => { cleanup(); });
const chips = [{ nome: "Café", emoji: "☕", valor: 12 }] as Parameters<typeof PostItDaMissao>[0]["chips"];

describe("post-it do '+ Outro' × teclado do iPhone (tarja do relógio)", () => {
  it("com o '+ Outro': sem teclado não há tarja; teclado aberto com a tela deslocada → tarja no topo da tela; fechou → some", () => {
    const teclado = instalarTecladoIphone({ alturaTela: 874, larguraTela: 402, alturaTeclado: 336 });
    try {
      render(<PostItDaMissao pergunta="Gastou algo hoje?" chips={chips} aoChip={() => {}} outro={{ placeholder: "Ex.: Mercado", comValor: true, aoEscolher: () => {} }} />);
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull();
      const campo = document.createElement("input");
      document.body.appendChild(campo);
      teclado.abrir(campo, 0, 156); // o campo está num `fixed`: o iPhone desloca a área visível 156
      const tarja = screen.getByTestId("tarja-do-relogio");
      expect(tarja.style.top).toBe("156px");
      expect(tarja.className).toMatch(/pointer-events-none/);
      expect(tarja.className).toMatch(/z-\[60\]/); // abaixo do post-it (z 200)
      teclado.soltarFoco();
      teclado.assentar();
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull();
      campo.remove();
    } finally { teclado.desinstalar(); }
  });

  it("post-it só com chips (sem '+ Outro'): nunca põe a tarja", () => {
    const teclado = instalarTecladoIphone({ alturaTela: 874, larguraTela: 402, alturaTeclado: 336 });
    try {
      render(<PostItDaMissao pergunta="Gastou algo hoje?" chips={chips} aoChip={() => {}} />);
      const campo = document.createElement("input");
      document.body.appendChild(campo);
      teclado.abrir(campo, 0, 156);
      expect(screen.queryByTestId("tarja-do-relogio")).toBeNull();
      campo.remove();
    } finally { teclado.desinstalar(); }
  });
});
