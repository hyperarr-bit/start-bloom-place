/**
 * Conquistas v3 (27/09) na tela: o planner que abre nas INSÍGNIAS na MESMA
 * moldura da capa (dono: "parecia que abria de verdade porque era do mesmo
 * tamanho"), a dica das 3 primeiras visitas no lugar do botão "Abrir meu
 * planner", o "Postar nos Stories" com 3 artes em vídeo (Capa e Carteirinha
 * fora; Roseta só nos marcos), a troca da conquista antes de postar, o card
 * do álbum de figurinhas + a tela cheia, "mostrar valores", e o CICLO
 * COMPLETO — abrir → adesivo abre → sair → REABRIR sem o dado: continua
 * colado, e o nível não cai.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { useState, type ReactNode } from "react";

vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: { id: "u1", created_at: "2026-07-10T12:00:00Z", email: "ana@x.com" } }) }));
const eventos = vi.hoisted(() => [] as Array<[string, unknown]>);
vi.mock("@/lib/analytics", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/analytics")>()),
  trackEvent: (nome: string, dados: unknown) => { eventos.push([nome, dados]); },
}));
// o aparelho gera vídeo? (o jsdom não tem WebCodecs nem MediaRecorder; o teste liga e desliga)
const suporte = vi.hoisted(() => ({ v: null as null | { formato: string; largura: number; altura: number } }));
vi.mock("@/components/conquistas/video/suporte", () => ({ suporteVideo: async () => suporte.v }));
const videoDaArte = vi.hoisted(() => ({ fn: vi.fn(async (_arte: string, _d: unknown, p?: (f: number) => void) => { p?.(0.5); return "shared"; }) }));
vi.mock("@/components/conquistas/compartilhar-conquistas", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/conquistas/compartilhar-conquistas")>()),
  compartilharVideoDaArte: (...a: unknown[]) => videoDaArte.fn(...(a as [string, unknown, ((f: number) => void)?])),
}));
// a prévia ao vivo fotografa com html-to-image (não existe no jsdom): um canvas de mentira
vi.mock("@/components/conquistas/video/AnimacaoAoVivo", () => ({ default: () => <canvas data-aovivo="tocando" /> }));

import { UserDataContext } from "@/hooks/use-user-data";
import { TelaConquistas, CHAVE_ALBUM_VISTO } from "@/components/conquistas/TelaConquistas";
import { CHAVE_DICA_PLANNER } from "@/components/conquistas/DicaDoPlanner";
import { CHAVE_NIVEL_PISO } from "@/components/gamification/types";
import { somarDias } from "@/lib/sequencia";

const HOJE = "2026-09-26";
const corrida = (fim: string, n: number) => Array.from({ length: n }, (_, i) => somarDias(fim, -(n - 1 - i)));
const dia = (n: number) => `2026-09-${String(n).padStart(2, "0")}`;

function montarStore(inicial: Record<string, unknown>) {
  const dados: Record<string, unknown> = { ...inicial };
  let ouvinte: (() => void) | null = null;
  const valor = () => ({
    get: <T,>(k: string, f: T): T => (k in dados ? (dados[k] as T) : f),
    set: (k: string, v: unknown) => { dados[k] = v; ouvinte?.(); },
    loaded: true, isGuest: false, fetchKey: async () => null,
  });
  return { dados, valor, ouvir: (fn: () => void) => { ouvinte = fn; } };
}
const Provedor = ({ store, children }: { store: ReturnType<typeof montarStore>; children: ReactNode }) => {
  const [, setN] = useState(0);
  store.ouvir(() => setN((n) => n + 1));
  return <UserDataContext.Provider value={{ ...store.valor() }}>{children}</UserDataContext.Provider>;
};
const abrir = (store: ReturnType<typeof montarStore>) =>
  render(
    <MemoryRouter initialEntries={["/conquistas"]}>
      <Provedor store={store}>
        <Routes>
          <Route path="/conquistas" element={<TelaConquistas />} />
          <Route path="*" element={<p>outra tela</p>} />
        </Routes>
      </Provedor>
    </MemoryRouter>,
  );

const cenario = (extra: Record<string, unknown> = {}) => ({
  "core-user-name": "Ana Beatriz",
  "core-dias-anotados": corrida(somarDias(HOJE, -1), 12),
  "conquistas-desbloqueadas": { "sequencia-7": "2026-09-20", "leitura-1": "2026-09-21" },
  "conquistas-vistas": { adesivos: ["sequencia-7", "leitura-1"], marcos: [7] },
  [CHAVE_NIVEL_PISO]: "Bronze",
  [CHAVE_DICA_PLANNER]: { vistas: 3, fim: true },
  "lib-books": [{ status: "lido" }],
  ...extra,
});
/** 12 treinos no mês: "Treinos no mês" vira o herói (prata, orgulho 5) e sobram candidatas pra trocar. */
const comTreinos = () => cenario({ "saude-workout-log": [dia(1), dia(3), dia(5), dia(7), dia(9), dia(11), dia(13), dia(15), dia(17), dia(19), dia(21), dia(23)] });

const abrirPlanner = async () => {
  fireEvent.click(screen.getByTestId("capa-3d"));
  return screen.findByTestId("pagina-insignias");
};

beforeEach(() => {
  eventos.length = 0;
  suporte.v = null;
  videoDaArte.fn.mockClear();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 26, 10, 0));
});
afterEach(() => { vi.useRealTimers(); });

describe("o planner abre nas insígnias, na MESMA moldura da capa", () => {
  it("toque na capa: a página tem exatamente o tamanho da capa; herói + 4 ao lado, bolinhas e rodapé; as ações ficam FORA da moldura; 'Fechar o planner' fecha", async () => {
    abrir(montarStore(cenario()));
    const capa = screen.getByTestId("capa-3d");
    const pagina = await abrirPlanner();
    // a moldura: a mesma conta pra capa e pra página (no jsdom a tela é larga: 398 × 300)
    expect(capa.getAttribute("data-moldura")).toBe("398x300");
    expect(pagina.getAttribute("data-moldura")).toBe("398x300");
    expect(pagina.style.width).toBe(capa.style.width);
    expect(pagina.style.height).toBe(capa.style.height);
    expect(screen.getByTestId("moldura-planner").style.height).toBe("300px");
    // o herói: 12 dias seguidos = bronze
    const heroi = screen.getByTestId("heroi-insignia");
    expect(heroi).toHaveAttribute("data-heroi", "seq-viva");
    expect(heroi).toHaveTextContent("A conquista do mês");
    expect(heroi).toHaveTextContent("Setembro foi de não falhar.");
    expect(heroi).toHaveTextContent("12 dias seguidos");
    expect(heroi).toHaveTextContent("Bronze");
    expect(pagina).toHaveTextContent("SETEMBRO · 2026");
    // 4 ao lado: "Dias anotados no mês" (12 = bronze) e depois as trancadas com dado, com a pílula do progresso
    const vagas = screen.getByTestId("insignias-pagina-0").querySelectorAll("[data-vaga]");
    expect(vagas).toHaveLength(4);
    expect(vagas[0]).toHaveAttribute("data-vaga", "seq-mes");
    expect(vagas[0]).toHaveAttribute("data-faixa", "bronze");
    expect(vagas[0].querySelector('[data-testid="pilula-insignia"]')).toBeNull();
    expect(vagas[1]).toHaveAttribute("data-vaga", "seq-recorde");
    expect(vagas[1]).toHaveAttribute("data-faixa", "trancada");
    expect(vagas[1].querySelector('[data-testid="pilula-insignia"]')).toHaveTextContent("12/30");
    // rodapé
    const resumo = screen.getByTestId("insignias-resumo");
    expect(resumo).toHaveTextContent(/Nível Bronze/);
    expect(resumo).toHaveTextContent("2 insígnias · 0 de ouro");
    expect(resumo).toHaveTextContent("3 com R$/peso escondidas");
    expect(resumo).toHaveTextContent("2 de 50");
    expect(screen.getByTestId("insignias-dots").querySelectorAll('[role="tab"]')).toHaveLength(7);
    // as ações moram fora da moldura
    const cta = screen.getByTestId("cta-planner-aberto");
    expect(screen.getByTestId("moldura-planner").contains(cta)).toBe(false);
    expect(within(cta).getByTestId("postar-conquista")).toHaveTextContent("Postar minha conquista");
    expect(eventos).toContainEqual(["insignias_abrir", { conquistadas: 2, heroi: "seq-viva" }]);
    fireEvent.click(screen.getByRole("button", { name: "Fechar o planner" }));
    await waitFor(() => expect(screen.queryByTestId("pagina-insignias")).toBeNull(), { timeout: 3000 });
    expect(screen.getByTestId("moldura-planner").style.height).toBe("300px");
  });

  it("as páginas viram pelas setas e pelo teclado (8 por página, trancadas em contorno); toque numa insígnia abre o detalhe com 'Ir pra <módulo>'; no herói, 'Postar esta conquista em vídeo' vai pra prévia", async () => {
    abrir(montarStore(cenario()));
    await abrirPlanner();
    expect(screen.getByTestId("insignias-anterior")).toBeDisabled();
    fireEvent.click(screen.getByTestId("insignias-proxima"));
    expect(screen.getByTestId("pagina-insignias-miolo")).toHaveAttribute("data-pagina-atual", "1");
    const segunda = screen.getByTestId("insignias-pagina-1");
    expect(segunda.querySelectorAll("[data-vaga]")).toHaveLength(8);
    expect(segunda.querySelectorAll('[data-vaga][data-faixa="trancada"]')).toHaveLength(8);
    expect(eventos).toContainEqual(["insignias_pagina", { indice: 1 }]);
    const trilho = screen.getByRole("region", { name: "Páginas das insígnias" });
    fireEvent.keyDown(trilho, { key: "End" });
    expect(screen.getByTestId("pagina-insignias-miolo")).toHaveAttribute("data-pagina-atual", "6");
    expect(screen.getByTestId("insignias-proxima")).toBeDisabled();
    fireEvent.keyDown(trilho, { key: "Home" });
    // uma trancada: o detalhe diz o bronze e manda pro módulo
    fireEvent.click(screen.getByTestId("insignias-proxima"));
    const vaga = screen.getByTestId("insignias-pagina-1").querySelector("[data-vaga]")!;
    fireEvent.click(vaga);
    const detalhe = await screen.findByTestId("detalhe-insignia");
    expect(detalhe).toHaveTextContent(/a conquistar/);
    expect(within(detalhe).getByTestId("detalhe-ir")).toHaveTextContent(/Ir pra/);
    expect(eventos.some(([n]) => n === "insignia_detalhe")).toBe(true);
    fireEvent.click(within(detalhe).getByTestId("detalhe-insignia-fechar"));
    await waitFor(() => expect(screen.queryByTestId("detalhe-insignia")).toBeNull());
    // o herói: postar em vídeo vai direto pra prévia da conquista
    fireEvent.click(screen.getByTestId("heroi-insignia"));
    const det = await screen.findByTestId("detalhe-insignia");
    expect(det).toHaveAttribute("data-insignia", "seq-viva");
    expect(det).toHaveTextContent("insígnia de bronze");
    expect(det).toHaveTextContent("Faltam 18 pra prata");
    fireEvent.click(within(det).getByTestId("detalhe-postar"));
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Minha conquista do mês");
    expect(previa.querySelector('[data-stories="conquista"]')).toHaveAttribute("data-insignia", "seq-viva");
    expect(eventos).toContainEqual(["arte_escolhida", { arte: "conquista", origem: "direto", insignia: "seq-viva" }]);
  });

  it("pouco dado: sem nenhuma faixa, o herói é a mais perto do bronze ('Suas primeiras insígnias · Faltam 3 pro bronze')", async () => {
    abrir(montarStore(cenario({ "core-dias-anotados": corrida(somarDias(HOJE, -1), 4), "conquistas-desbloqueadas": {} })));
    await abrirPlanner();
    const heroi = screen.getByTestId("heroi-insignia");
    expect(heroi).toHaveTextContent("Primeiras insígnias");
    expect(heroi).toHaveTextContent("4 dias seguidos. Faltam 3 pro bronze.");
    expect(heroi).toHaveTextContent("cada registro conta");
    expect(screen.getByTestId("insignias-resumo")).toHaveTextContent("0 de 50");
    // o CTA de fora abre o seletor (sem herói com faixa, a arte da conquista fica bloqueada)
    fireEvent.click(screen.getByTestId("postar-conquista"));
    const folha = await screen.findByTestId("seletor-de-arte");
    expect(folha.querySelector('[data-arte="conquista"]')).toHaveAttribute("data-bloqueada");
  });

  it("'mostrar valores': o rodapé abre a folha, o interruptor grava conquistas-mostrar-valores e as 3 sensíveis entram (de 53)", async () => {
    const store = montarStore(cenario());
    abrir(store);
    await abrirPlanner();
    fireEvent.click(screen.getByTestId("insignias-valores"));
    const folha = await screen.findByTestId("folha-valores");
    fireEvent.click(within(folha).getByTestId("switch-valores"));
    await waitFor(() => expect(store.dados["conquistas-mostrar-valores"]).toBe(true));
    expect(eventos).toContainEqual(["insignias_valores", { ligado: true }]);
    await waitFor(() => expect(screen.getByTestId("insignias-resumo")).toHaveTextContent("R$ e peso visíveis"));
    expect(screen.getByTestId("insignias-resumo")).toHaveTextContent("2 de 53");
  });
});

describe("a dica do planner (no lugar do botão 'Abrir meu planner')", () => {
  const semDica = () => cenario({ [CHAVE_DICA_PLANNER]: undefined });

  it("não existe mais o botão; a dica aparece nas visitas 1, 2 e 3 (o toque pulsando na capa + o cartão) e some na 4ª", () => {
    const store = montarStore(semDica());
    delete store.dados[CHAVE_DICA_PLANNER];
    for (let visita = 1; visita <= 4; visita++) {
      const tela = abrir(store);
      expect(screen.queryByTestId("abrir-planner")).toBeNull();
      expect(screen.queryByText(/Abrir meu planner|Abrir meu álbum/)).toBeNull();
      if (visita <= 3) {
        expect(screen.getByTestId("dica-planner")).toHaveTextContent("Toca no seu planner");
        expect(screen.getByTestId("dica-toque")).toBeInTheDocument();
        expect(store.dados[CHAVE_DICA_PLANNER]).toEqual({ vistas: visita, fim: false });
      } else {
        expect(screen.queryByTestId("dica-planner")).toBeNull();
        expect(screen.queryByTestId("dica-toque")).toBeNull();
        expect(store.dados[CHAVE_DICA_PLANNER]).toEqual({ vistas: 3, fim: false });
      }
      tela.unmount();
    }
    expect(eventos.filter(([n, d]) => n === "dica_planner" && (d as { motivo: string }).motivo === "mostrou")).toHaveLength(3);
  });

  it("'Abrir agora' abre o planner, e a dica não volta (já aprendeu)", async () => {
    const store = montarStore(semDica());
    delete store.dados[CHAVE_DICA_PLANNER];
    const tela = abrir(store);
    fireEvent.click(screen.getByTestId("dica-abrir"));
    expect(await screen.findByTestId("pagina-insignias")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId("dica-planner")).toBeNull());
    expect(store.dados[CHAVE_DICA_PLANNER]).toEqual({ vistas: 1, fim: true });
    tela.unmount();
    abrir(store);
    expect(screen.queryByTestId("dica-planner")).toBeNull();
  });

  it("'Entendi, não precisa mais' encerra pra sempre; abrir pela capa também encerra", async () => {
    const store = montarStore(semDica());
    delete store.dados[CHAVE_DICA_PLANNER];
    const tela = abrir(store);
    fireEvent.click(screen.getByTestId("dica-entendi"));
    await waitFor(() => expect(screen.queryByTestId("dica-planner")).toBeNull());
    expect(store.dados[CHAVE_DICA_PLANNER]).toEqual({ vistas: 1, fim: true });
    expect(eventos).toContainEqual(["dica_planner", { motivo: "entendi" }]);
    tela.unmount();

    const outro = montarStore(semDica());
    delete outro.dados[CHAVE_DICA_PLANNER];
    abrir(outro);
    expect(screen.getByTestId("dica-planner")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("capa-3d"));
    await screen.findByTestId("pagina-insignias");
    expect(outro.dados[CHAVE_DICA_PLANNER]).toEqual({ vistas: 1, fim: true });
    expect(eventos).toContainEqual(["dica_planner", { motivo: "abriu" }]);
  });

  it("toque fora do cartão fecha só desta vez (a visita continua contando, sem 'fim')", async () => {
    const store = montarStore(semDica());
    delete store.dados[CHAVE_DICA_PLANNER];
    abrir(store);
    expect(screen.getByTestId("dica-planner")).toBeInTheDocument();
    await act(async () => { await new Promise((r) => setTimeout(r, 5)); });
    fireEvent.pointerDown(screen.getByText("MEUS ADESIVOS"));
    await waitFor(() => expect(screen.queryByTestId("dica-planner")).toBeNull());
    expect(store.dados[CHAVE_DICA_PLANNER]).toEqual({ vistas: 1, fim: false });
  });
});

describe("Postar nos Stories", () => {
  it("o seletor tem as artes em vídeo — conquista e álbum (as 3 conquistas só com 3 candidatas de áreas diferentes) — sem Capa nem Carteirinha, e sem Roseta fora do marco", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    const artes = Array.from(folha.querySelectorAll("[data-arte]")).map((el) => el.getAttribute("data-arte"));
    expect(artes).toEqual(["conquista", "album"]);
    expect(folha.querySelector('[data-arte="capa"], [data-arte="carteirinha"]')).toBeNull();
    expect(within(folha).getByText("NOVA")).toBeInTheDocument();
    expect(within(folha).queryByTestId("selo-video")).toBeNull();
    fireEvent.click(folha.querySelector('[data-arte="conquista"]')!);
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Minha conquista do mês");
    expect(previa.querySelector('[data-stories="conquista"]')).toHaveAttribute("data-insignia", "seq-viva");
    expect(within(previa).getByRole("button", { name: /Postar nos Stories/ })).toBeInTheDocument();
    expect(within(previa).queryByTestId("postar-video")).toBeNull();
    expect(eventos).toContainEqual(["arte_escolhida", { arte: "conquista", origem: "seletor" }]);
  });

  it("no dia de um marco (30 dias) a Roseta entra no seletor, com o fundo transparente", async () => {
    abrir(montarStore(cenario({ "core-dias-anotados": corrida(HOJE, 30) })));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    expect(folha.querySelector('[data-arte="roseta"]')).not.toBeNull();
    fireEvent.click(folha.querySelector('[data-arte="roseta"]')!);
    const previa = await screen.findByTestId("previa-arte");
    expect(within(previa).getByRole("button", { name: /Fundo transparente/ })).toBeInTheDocument();
  });

  it("'Trocar conquista' na prévia: lista as candidatas e a escolhida vira a arte", async () => {
    abrir(montarStore(comTreinos()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    fireEvent.click(folha.querySelector('[data-arte="conquista"]')!);
    const previa = await screen.findByTestId("previa-arte");
    expect(previa.querySelector('[data-stories="conquista"]')).toHaveAttribute("data-insignia", "tre-mes");
    fireEvent.click(within(previa).getByTestId("trocar-conquista-abrir"));
    const lista = await screen.findByTestId("trocar-conquista");
    const candidatas = Array.from(lista.querySelectorAll("[data-candidata]")).map((el) => el.getAttribute("data-candidata"));
    expect(candidatas[0]).toBe("tre-mes");
    expect(candidatas).toContain("seq-viva");
    fireEvent.click(lista.querySelector('[data-candidata="seq-viva"]')!);
    await waitFor(() => expect(previa.querySelector('[data-stories="conquista"]')).toHaveAttribute("data-insignia", "seq-viva"));
    expect(eventos).toContainEqual(["conquista_trocada", { de: "tre-mes", para: "seq-viva" }]);
  });

  it("com vídeo no aparelho: o selo VÍDEO nas artes, a prévia toca ao vivo e 'Postar vídeo nos Stories' é o principal (com 'Postar imagem' embaixo); o vídeo sai com a insígnia escolhida", async () => {
    suporte.v = { formato: "webcodecs", largura: 1080, altura: 1920 };
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    await waitFor(() => expect(within(folha).getAllByTestId("selo-video")).toHaveLength(2));
    fireEvent.click(folha.querySelector('[data-arte="conquista"]')!);
    const previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveAttribute("data-video");
    expect(previa).toHaveTextContent("vídeo 5,5 s");
    expect(await within(previa).findByTestId("previa-ao-vivo")).toBeInTheDocument();
    await waitFor(() => expect(previa.querySelector('canvas[data-aovivo="tocando"]')).not.toBeNull());
    expect(within(previa).getByTestId("postar-imagem")).toHaveTextContent("Postar imagem");
    fireEvent.click(within(previa).getByTestId("postar-video"));
    await waitFor(() => expect(videoDaArte.fn).toHaveBeenCalled());
    expect(videoDaArte.fn.mock.calls[0][0]).toBe("conquista");
    expect((videoDaArte.fn.mock.calls[0][1] as { heroi: { id: string } }).heroi.id).toBe("seq-viva");
  });

  it("'Postar minha conquista' do planner aberto vai direto pra prévia da conquista; 'Compartilhar' do card do álbum vai direto pra prévia do álbum", async () => {
    abrir(montarStore(cenario()));
    await abrirPlanner();
    fireEvent.click(screen.getByTestId("postar-conquista"));
    let previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Minha conquista do mês");
    expect(eventos).toContainEqual(["arte_escolhida", { arte: "conquista", origem: "direto", insignia: undefined }]);
    fireEvent.click(within(previa).getByTestId("previa-voltar"));
    await waitFor(() => expect(screen.queryByTestId("previa-arte")).toBeNull());
    expect(screen.queryByTestId("seletor-de-arte")).toBeNull();
    fireEvent.click(screen.getByTestId("album-compartilhar"));
    previa = await screen.findByTestId("previa-arte");
    expect(previa).toHaveTextContent("Prévia · Meu álbum de figurinhas");
    const arte = previa.querySelector('[data-stories="album"]')!;
    expect(arte).toHaveTextContent("OS MAIS RAROS");
    expect(arte.querySelectorAll('[data-celula][data-aberto="true"]')).toHaveLength(2);
    expect(arte.querySelectorAll('[data-celula][data-aberto="false"]')).toHaveLength(3);
  });
});

describe("o álbum de figurinhas (card + tela cheia)", () => {
  it("o card diz '2 de 65 coladas', a raridade e o mais perto; 'Abrir o álbum' abre a tela cheia na página dos mais raros com as vagas numeradas; as abas pulam de seção; a vaga abre o detalhe; o X fecha", async () => {
    abrir(montarStore(cenario()));
    const card = screen.getByTestId("album-card");
    expect(screen.getByTestId("album-card-contagem")).toHaveTextContent("2 de 65 coladas");
    expect(card).toHaveTextContent("2 raros");
    expect(screen.getByTestId("album-card-proximo")).toHaveTextContent(/Perto de colar/);
    expect(card).toHaveAttribute("data-novas", "0");
    // "Meus adesivos" continua igual, com a folha de sempre
    expect(screen.getByTestId("meus-adesivos")).toHaveTextContent("MEUS ADESIVOS");
    fireEvent.click(screen.getByTestId("album-abrir"));
    const tela = await screen.findByTestId("album-tela");
    expect(tela).toHaveTextContent("Álbum CORE 2026");
    expect(tela).toHaveTextContent("2 de 65 · faltam 63");
    const p0 = within(tela).getByTestId("album-tela-pagina-0");
    expect(p0).toHaveTextContent("OS MAIS RAROS");
    const vagas = Array.from(p0.querySelectorAll("[data-vaga]")).map((el) => [el.getAttribute("data-vaga"), el.getAttribute("data-aberta")]);
    expect(vagas.slice(0, 2)).toEqual([["leitura-1", "true"], ["sequencia-7", "true"]]);
    expect(vagas).toHaveLength(5);
    expect(p0).toHaveTextContent("PRÓXIMAS A COLAR");
    expect(p0.querySelector('[data-vaga="sequencia-7"] .vaga-n')).toHaveTextContent("Nº 01");
    expect(within(tela).getByTestId("album-tela-dica")).toHaveTextContent(/A mais perto:/);
    expect(eventos).toContainEqual(["album_abrir", { adesivos: 2, novas: 0, via: "card", pagina: 0 }]);
    // as abas
    fireEvent.click(within(tela).getByTestId("album-aba-epico"));
    expect(tela).toHaveAttribute("data-atual", "2");
    expect(within(tela).getByTestId("album-tela-pagina-2")).toHaveTextContent("ÉPICOS · 1/2");
    expect(eventos).toContainEqual(["album_pagina", { indice: 2, secao: "epico-1" }]);
    fireEvent.click(within(tela).getByTestId("album-tela-proxima"));
    expect(within(tela).getByTestId("album-tela-pagina-3")).toHaveTextContent("ÉPICOS · 2/2");
    fireEvent.click(within(tela).getByTestId("album-aba-raro"));
    const raros = within(tela).getByTestId("album-tela-pagina-4");
    expect(raros).toHaveTextContent("RAROS · 1/2");
    expect(raros).toHaveTextContent("2 de 21 · faltam 19");
    fireEvent.click(raros.querySelector('[data-vaga="sequencia-7"]')!);
    const detalhe = await screen.findByTestId("detalhe-vaga");
    expect(detalhe).toHaveTextContent("Figurinha Nº 01");
    expect(detalhe).toHaveTextContent("7 Dias Seguidos");
    expect(detalhe).toHaveTextContent(/Colada em 20 de setembro/);
    expect(within(detalhe).getByTestId("vaga-postar")).toBeInTheDocument();
    fireEvent.click(within(detalhe).getByRole("button", { name: "Fechar" }));
    await waitFor(() => expect(screen.queryByTestId("detalhe-vaga")).toBeNull());
    fireEvent.click(within(tela).getByTestId("album-fechar"));
    await waitFor(() => expect(screen.queryByTestId("album-tela")).toBeNull());
  });

  it("o pacotinho: coladas desde a última abertura ('1 figurinha nova'); abrir marca tudo como visto", async () => {
    const store = montarStore(cenario({ [CHAVE_ALBUM_VISTO]: ["sequencia-7"] }));
    abrir(store);
    expect(screen.getByTestId("album-card")).toHaveAttribute("data-novas", "1");
    expect(screen.getByTestId("album-pacotinho")).toHaveTextContent("1 figurinha nova");
    fireEvent.click(screen.getByTestId("album-pacotinho"));
    await screen.findByTestId("album-tela");
    expect((store.dados[CHAVE_ALBUM_VISTO] as string[]).sort()).toEqual(["leitura-1", "sequencia-7"]);
    expect(eventos).toContainEqual(["album_abrir", { adesivos: 2, novas: 1, via: "pacotinho", pagina: 0 }]);
  });

  it("a 1ª vez desta versão entra em silêncio (tudo o que já estava colado vira visto); sem adesivo, 'COMEÇANDO O ÁLBUM'", async () => {
    const store = montarStore(cenario());
    abrir(store);
    await waitFor(() => expect((store.dados[CHAVE_ALBUM_VISTO] as string[]).sort()).toEqual(["leitura-1", "sequencia-7"]));
    const vazio = montarStore({ "core-user-name": "Ana", "conquistas-desbloqueadas": {}, [CHAVE_NIVEL_PISO]: "Bronze", [CHAVE_DICA_PLANNER]: { vistas: 3, fim: true } });
    render(
      <MemoryRouter initialEntries={["/conquistas"]}>
        <Provedor store={vazio}><Routes><Route path="/conquistas" element={<TelaConquistas />} /></Routes></Provedor>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getAllByTestId("album-abrir")[1]);
    const tela = await screen.findByTestId("album-tela");
    expect(within(tela).getByTestId("album-tela-pagina-0")).toHaveTextContent("COMEÇANDO O ÁLBUM");
    expect(within(tela).getByTestId("album-tela-pagina-0").querySelectorAll("[data-vaga]")).toHaveLength(3);
  });
});

describe("saídas e atalhos (dono 27/09)", () => {
  it("a prévia tem como sair: o X lá em cima e o 'Voltar' embaixo voltam pro seletor", async () => {
    abrir(montarStore(cenario()));
    fireEvent.click(screen.getByTestId("postar-stories"));
    const folha = await screen.findByTestId("seletor-de-arte");
    fireEvent.click(folha.querySelector('[data-arte="album"]')!);
    fireEvent.click(within(await screen.findByTestId("previa-arte")).getByTestId("previa-voltar"));
    await waitFor(() => expect(screen.queryByTestId("previa-arte")).toBeNull());
    expect(await screen.findByTestId("seletor-de-arte")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("seletor-de-arte").querySelector('[data-arte="conquista"]')!);
    fireEvent.click(within(await screen.findByTestId("previa-arte")).getByTestId("previa-fechar"));
    await waitFor(() => expect(screen.queryByTestId("previa-arte")).toBeNull());
  });
});

describe("desafios semanais", () => {
  it("o botão 'Reativar desafios semanais' saiu da tela; o Desafiante trancado oferece 'Ligar os desafios'", async () => {
    const store = montarStore(cenario({ "finance-challenges-hidden": true }));
    abrir(store);
    expect(screen.queryByText(/Reativar desafios/)).toBeNull();
    fireEvent.click(screen.getByText("Ver todos", { exact: false }));
    fireEvent.click(document.querySelector('[data-adesivo-celula="challenger"]')!);
    const ligar = await screen.findByRole("button", { name: /Ligar os desafios/ });
    fireEvent.click(ligar);
    expect(store.dados["finance-challenges-hidden"]).toBe(false);
  });
});

describe("ciclo completo: abrir → conquistar → sair → reabrir", () => {
  it("o adesivo que abriu fica gravado e continua colado sem o dado; o piso de nível fica; e a figurinha está na vaga dela no álbum", async () => {
    const store = montarStore(cenario({ "finance-incomes": [{ id: 1, description: "Salário", value: 3000, date: dia(5) }] }));
    const tela = abrir(store);
    // 1ª receita → "Primeiro Salário" abre e é gravado
    await waitFor(() => expect((store.dados["conquistas-desbloqueadas"] as Record<string, string>)["first-income"]).toBe(HOJE));
    expect(document.querySelector('[data-adesivo-celula="first-income"]')).toHaveAttribute("data-aberto", "true");
    expect(eventos).toContainEqual(["adesivo_desbloqueado", { id: "first-income" }]);
    tela.unmount();

    // sai da tela, a receita some (apagada), reabre: continua colado — e o nível não cai
    store.dados["finance-incomes"] = [];
    store.dados[CHAVE_NIVEL_PISO] = "Ouro";
    abrir(store);
    expect(document.querySelector('[data-adesivo-celula="first-income"]')).toHaveAttribute("data-aberto", "true");
    expect(document.querySelector('[data-nome-capa]')).toHaveTextContent("Ana Beatriz");
    fireEvent.click(screen.getByRole("button", { name: /Nível Ouro — ver progresso/ }));
    expect(await screen.findByTestId("aviso-piso")).toHaveTextContent(/nível nunca volta atrás/);
    // nenhuma festa atrasada: o momento não é montado nesta tela, e o registro não duplica
    expect(Object.keys(store.dados["conquistas-desbloqueadas"] as object).filter((k) => k === "first-income")).toHaveLength(1);
    // e no álbum ela está na 1ª página (a mais recente) e na vaga dela em COMUNS
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.click(screen.getByTestId("album-abrir"));
    const album = await screen.findByTestId("album-tela");
    expect(within(album).getByTestId("album-tela-pagina-0").querySelector('[data-vaga="first-income"]')).toHaveAttribute("data-aberta", "true");
  });
});

describe("momentos: no máximo 3 festas de tela cheia de uma vez (01/10: comuns vão pro popup)", () => {
  it("quando muitos adesivos abrem juntos, celebra em tela cheia os 3 mais raros, o 4º raro cola quieto e os comuns ficam pra UM popup", async () => {
    const { MomentosConquistas } = await import("@/components/conquistas/Momentos");
    // 5 adesivos novos de uma vez: 1º Salário (comum), Múltiplas Rendas (raro), Patrimônio 100k (lendário), Contas em Dia (comum), Lista de Desejos (comum)
    const store = montarStore(cenario({
      "conquistas-vistas": { adesivos: ["sequencia-7", "leitura-1"], marcos: [7] },
      "finance-incomes": [{ id: 1, description: "Salário", value: 3000, date: dia(5) }, { id: 2, description: "Freela", value: 100, date: dia(6) }, { id: 3, description: "Aluguel", value: 100, date: dia(7) }],
      "finance-investments": [{ id: "i", name: "x", value: 100000 }],
      "finance-dueDays": [{ day: 5, bills: [{ id: "b1", name: "Luz", paid: true }] }],
      "finance-wishlist": [{ id: "w1", name: "Fone", price: 300, savedAmount: 0 }],
    }));
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <Provedor store={store}><MomentosConquistas /></Provedor>
      </MemoryRouter>,
    );
    await waitFor(() => {
      const v = store.dados["conquistas-vistas"] as { adesivos: string[] };
      // raros+: lendário 100k, raros multi-income/10k/50k → 3 ganham tela cheia, 1 raro cola quieto
      expect(v.adesivos).not.toContain("investor-100k");
      const rarosQuietos = ["multi-income", "investor-10k", "investor-50k"].filter((id) => v.adesivos.includes(id));
      expect(rarosQuietos).toHaveLength(1);
      // os comuns NÃO entram como vistos: esperam o popup (um só, com os 4 em carrossel)
      for (const id of ["first-income", "investor-1k", "bills-ok", "wishlist"]) expect(v.adesivos).not.toContain(id);
    });
    // tudo continua gravado como conquistado
    const gravadas = store.dados["conquistas-desbloqueadas"] as Record<string, string>;
    for (const id of ["first-income", "multi-income", "investor-100k", "investor-1k", "investor-10k", "investor-50k", "bills-ok", "wishlist"]) expect(gravadas[id]).toBe(HOJE);
  });
});
