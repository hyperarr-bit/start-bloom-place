/**
 * AJUDA E SUPORTE — o formulário que a cliente pediu por DM (07/09):
 *
 *   "Faz em algum local suporte e coloca um formulário pra gente por o bug e
 *    anexar o print."
 *
 * O que estas travas protegem, na ordem em que doeria perder:
 *  1. chamado vazio nunca sai (o dono recebe "oi" e não tem o que responder);
 *  2. o tipo escolhido chega no servidor — é ele que vira o `source` da linha
 *     e separa erro de sugestão na tela do /admin;
 *  3. a confirmação DIZ por onde a resposta chega (o e-mail da conta), senão
 *     a pessoa fica esperando resposta dentro do app;
 *  4. erro do servidor não pode virar tela de sucesso — e o texto tem que
 *     continuar lá, senão ela digita tudo de novo;
 *  5. o limite de 3 prints é da tela E do servidor.
 *
 * Rede e upload são mockados: aqui se testa a tela, não o Storage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Ajuda from "@/pages/Ajuda";

const invoke = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: { id: "uid-1", email: "cliente@exemplo.com" } }),
}));

vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));

const uploadFromInput = vi.fn();
vi.mock("@/lib/image-upload", () => ({
  uploadFromInput: (...a: unknown[]) => uploadFromInput(...a),
}));

vi.mock("@/lib/diagnostico-suporte", () => ({
  CHAVE_ULTIMO_MODULO: "core-ultimo-modulo",
  montarDiagnostico: async () => ({
    versao: "1.0.95 (96)",
    plataforma: "app Android (Play)",
    aparelho: "Android 13; SM-A135M",
    modulo: "financas",
    tela: "/ajuda",
    idioma: "pt-BR",
  }),
}));

const abrir = () => render(<MemoryRouter><Ajuda /></MemoryRouter>);
const botaoEnviar = () => screen.getByRole("button", { name: /^Enviar$/ });
const escrever = (txt: string) =>
  fireEvent.change(screen.getByLabelText(/Conta pra gente/i), { target: { value: txt } });

/** O <input type="file"> está escondido (o clique vem do quadradinho +). */
const inputArquivo = () => screen.getByLabelText("Escolher print") as HTMLInputElement;

beforeEach(() => {
  invoke.mockReset();
  uploadFromInput.mockReset();
  invoke.mockResolvedValue({ data: { ok: true, ticketId: "t-1", email: "cliente@exemplo.com" }, error: null });
  let n = 0;
  uploadFromInput.mockImplementation(async () =>
    `https://itoylenzvahbscgjgtqf.supabase.co/storage/v1/object/sign/dream-board/uid-1/suporte/${++n}.webp?token=x`);
});

describe("Formulário de suporte", () => {
  it("não envia chamado vazio — e diz o que falta", async () => {
    abrir();
    fireEvent.click(botaoEnviar());
    expect(await screen.findByRole("alert")).toHaveTextContent(/Escreva o que aconteceu/i);
    expect(invoke).not.toHaveBeenCalled();

    // só espaço em branco também não conta como relato
    escrever("    ");
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(invoke).not.toHaveBeenCalled());
  });

  it("manda o tipo escolhido, o texto e os anexos pra função certa", async () => {
    abrir();
    fireEvent.click(screen.getByRole("button", { name: /Sugestão/ }));
    escrever("Seria ótimo poder anexar print aqui.");
    fireEvent.change(inputArquivo());
    await screen.findByAltText("Print 1");

    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));

    const [nome, opcoes] = invoke.mock.calls[0] as [string, { body: Record<string, unknown> }];
    expect(nome).toBe("suporte-ticket");
    expect(opcoes.body.tipo).toBe("sugestao");
    expect(opcoes.body.mensagem).toBe("Seria ótimo poder anexar print aqui.");
    expect(opcoes.body.anexos).toHaveLength(1);
    // o diagnóstico vai junto SEM a pessoa digitar nada
    expect(opcoes.body.diagnostico).toMatchObject({ versao: "1.0.95 (96)", modulo: "financas" });
  });

  it("nasce em Erro quando a pessoa não escolhe nada", async () => {
    abrir();
    escrever("Não está salvando meus lançamentos.");
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect((invoke.mock.calls[0][1] as { body: { tipo: string } }).body.tipo).toBe("erro");
  });

  it("confirma que chegou e diz que a resposta vem no e-mail da conta", async () => {
    abrir();
    escrever("O app fecha sozinho ao abrir Finanças.");
    fireEvent.click(botaoEnviar());

    expect(await screen.findByText(/Chegou aqui/i)).toBeInTheDocument();
    expect(screen.getByText(/A resposta chega no e-mail da sua conta/i)).toBeInTheDocument();
    expect(screen.getByText("cliente@exemplo.com")).toBeInTheDocument();
    // o formulário sai da tela: não dá pra reenviar sem querer
    expect(screen.queryByLabelText(/Conta pra gente/i)).not.toBeInTheDocument();
  });

  it("erro do servidor NÃO vira sucesso e o texto continua na tela", async () => {
    invoke.mockResolvedValue({ data: { error: "dados_invalidos" }, error: null });
    abrir();
    escrever("Comprei e não liberou.");
    fireEvent.click(botaoEnviar());

    expect(await screen.findByRole("alert")).toHaveTextContent(/Não consegui enviar agora/i);
    expect(screen.queryByText(/Chegou aqui/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Conta pra gente/i)).toHaveValue("Comprei e não liberou.");

    // a falha foi do servidor, não da pessoa: tentar de novo funciona
    invoke.mockResolvedValue({ data: { ok: true, ticketId: "t-2" }, error: null });
    fireEvent.click(botaoEnviar());
    expect(await screen.findByText(/Chegou aqui/i)).toBeInTheDocument();
  });

  it("trata falha de rede do supabase-js igual a erro do corpo", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "Failed to fetch" } });
    abrir();
    escrever("Sem internet no meio do envio.");
    fireEvent.click(botaoEnviar());
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não consegui enviar agora/i);
    expect(screen.queryByText(/Chegou aqui/i)).not.toBeInTheDocument();
  });

  it("aceita no máximo 3 prints e deixa remover", async () => {
    abrir();
    fireEvent.change(inputArquivo());
    await screen.findByAltText("Print 1");
    fireEvent.change(inputArquivo());
    await screen.findByAltText("Print 2");
    fireEvent.change(inputArquivo());
    await screen.findByAltText("Print 3");

    // no limite o botão de anexar some — não existe 4º print pra tentar
    expect(screen.queryByRole("button", { name: "Anexar print" })).not.toBeInTheDocument();
    expect(screen.getByText(/limite de 3 prints/i)).toBeInTheDocument();
    expect(uploadFromInput).toHaveBeenCalledTimes(3);

    // removeu um → dá pra anexar de novo
    fireEvent.click(screen.getByRole("button", { name: "Remover print 2" }));
    expect(screen.queryByAltText("Print 3")).not.toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Anexar print" })).toBeInTheDocument();

    escrever("Segue o print do erro.");
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect((invoke.mock.calls[0][1] as { body: { anexos: string[] } }).body.anexos).toHaveLength(2);
  });

  it("avisa quando o upload do print falha, sem derrubar o chamado", async () => {
    uploadFromInput.mockResolvedValue(null);
    abrir();
    fireEvent.change(inputArquivo());
    expect(await screen.findByRole("alert")).toHaveTextContent(/Não consegui carregar essa imagem/i);

    // o texto ainda envia — print é ajuda, não requisito
    escrever("Tentei mandar o print e não foi.");
    fireEvent.click(botaoEnviar());
    await waitFor(() => expect(invoke).toHaveBeenCalledTimes(1));
    expect((invoke.mock.calls[0][1] as { body: { anexos: string[] } }).body.anexos).toEqual([]);
  });
});
