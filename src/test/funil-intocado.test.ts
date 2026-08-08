import { describe, it, expect } from "vitest";
import { execSync } from "child_process";

/**
 * TRAVA DO FUNIL (08/08, ordem do dono: "faz tudo mas não dá push, o funil
 * tá vendendo e não quero risco").
 *
 * A rodada de melhorias dos módulos (editar registros, cartões próprios,
 * reserva de emergência, passeios…) roda no branch `melhorias-modulos`. Este
 * teste falha se QUALQUER arquivo da máquina de vender for tocado nesse
 * branch — funil, paywall, checkout, motor de compra e a casca do app.
 *
 * Não é burocracia: já aconteceu neste projeto de mexer numa rota de funil e
 * derrubar o app da loja junto (26/07). A diferença aqui é que a trava avisa
 * ANTES do merge, não depois da queda nas vendas.
 *
 * Fora do branch de melhorias o teste não tem o que checar e passa direto.
 */
const INTOCÁVEIS = [
  "src/pages/funis/",
  "src/components/paywall/",
  "src/components/app/AppWelcome.tsx",
  "src/components/app/AppPurchaseSheet.tsx",
  "src/components/app/PortaPerguntaApp.tsx",
  "src/pages/Comecar.tsx",
  "src/pages/Planos.tsx",
  "src/pages/PlanosApp.tsx",
  "src/pages/Preview.tsx",
  "src/lib/revenuecat.ts",
  "src/lib/native-shell.ts",
  "src/App.tsx",
  "index.html",
];

const git = (cmd: string) => execSync(cmd, { encoding: "utf8" }).trim();

describe("trava do funil", () => {
  it("nenhum arquivo da máquina de vender foi tocado no branch de melhorias", () => {
    let branch = "";
    try {
      branch = git("git rev-parse --abbrev-ref HEAD");
    } catch {
      return; // sem git disponível (CI isolado): nada a verificar
    }
    if (branch !== "melhorias-modulos") return;

    // Só o que este branch mudou em relação a main (três pontos = desde o
    // ancestral comum, então commit novo na main não polui o resultado).
    const alterados = git("git diff --name-only main...HEAD")
      .split("\n")
      .filter(Boolean);

    const proibidos = alterados.filter((f) => INTOCÁVEIS.some((p) => f.startsWith(p)));
    expect(proibidos, `arquivos de venda tocados: ${proibidos.join(", ")}`).toEqual([]);
  });
});
