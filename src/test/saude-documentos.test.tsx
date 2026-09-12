/**
 * Saúde: fotos de exame e documentos (receita, laudo, atestado) — 11/09.
 * Privacidade: no user_data fica só o CAMINHO no bucket privado; a URL da
 * miniatura é assinada na hora (1 h). Rede mockada: aqui se testa a tela,
 * as chaves e o contrato com o Storage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";

const upload = vi.fn();
const createSignedUrl = vi.fn();
const remove = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    storage: { from: (bucket: string) => ({
      upload: (...a: unknown[]) => upload(bucket, ...a),
      createSignedUrl: (...a: unknown[]) => createSignedUrl(bucket, ...a),
      remove: (...a: unknown[]) => remove(bucket, ...a),
    }) },
  },
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
// compressImage usa Image + canvas: no jsdom a imagem nunca "carrega" e o
// canvas não tem contexto. Image falsa dispara onload; sem contexto, a
// função devolve o arquivo como está (é o caminho real do código).
class ImagemFalsa { width = 100; height = 100; onload: null | (() => void) = null; onerror: null | (() => void) = null; set src(_v: string) { setTimeout(() => this.onload?.(), 0); } }
(globalThis as unknown as { Image: unknown }).Image = ImagemFalsa;
// o jsdom loga "Not implemented: getContext" (barulho, não erro): devolve null direto
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

import { MedicalLog } from "@/components/saude/MedicalLog";

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null });
  createSignedUrl.mockReset().mockImplementation(async (_b: string, path: string) => ({ data: { signedUrl: `https://assinada/${path}?token=x` } }));
  remove.mockReset().mockResolvedValue({ error: null });
});

const montar = (inicial: Record<string, unknown> = {}) => {
  const dados: Record<string, unknown> = { ...inicial };
  const valor: UserDataContextType = {
    get: <T,>(key: string, fallback: T) => (key in dados ? (dados[key] as T) : fallback),
    set: (key: string, value: unknown) => { dados[key] = value; },
    loaded: true, isGuest: false, fetchKey: async () => null,
  };
  render(<UserDataContext.Provider value={valor}><MedicalLog /></UserDataContext.Provider>);
  return dados;
};
const foto = () => new File(["x"], "exame.jpg", { type: "image/jpeg" });

describe("Saúde: fotos e documentos", () => {
  it("exame: anexar foto sobe pro bucket privado na pasta da pessoa, guarda só o CAMINHO e mostra a miniatura por URL assinada de 1 h", async () => {
    const dados = montar({ "core-saude-exams-v2": [{ id: "e1", name: "Hemograma", date: "2026-09-01", time: "", location: "", notes: "", done: true }] });
    fireEvent.click(screen.getByRole("button", { name: "Fotos e observações de Hemograma" }));
    fireEvent.change(screen.getByLabelText("Anexar foto de exame Hemograma"), { target: { files: [foto()] } });

    await waitFor(() => expect((dados["core-saude-exams-v2"] as { fotos?: string[] }[])[0].fotos).toHaveLength(1));
    const caminho = (dados["core-saude-exams-v2"] as { fotos: string[] }[])[0].fotos[0];
    expect(caminho).toMatch(/^u-1\/saude\/\d+-[a-z0-9]+\.webp$/);
    expect(upload).toHaveBeenCalledWith("dream-board", caminho, expect.anything(), expect.objectContaining({ contentType: "image/webp" }));
    expect(caminho.startsWith("http")).toBe(false);
    await waitFor(() => expect(screen.getByAltText("exame Hemograma · foto 1")).toHaveAttribute("src", `https://assinada/${caminho}?token=x`));
    expect(createSignedUrl).toHaveBeenCalledWith("dream-board", caminho, 3600);
    expect(screen.getByRole("button", { name: "Fotos e observações de Hemograma" }).textContent).toContain("1");

    // remover tira do user_data e do bucket
    fireEvent.click(screen.getByRole("button", { name: "Remover exame Hemograma · foto 1" }));
    expect((dados["core-saude-exams-v2"] as { fotos: string[] }[])[0].fotos).toEqual([]);
    await waitFor(() => expect(remove).toHaveBeenCalledWith("dream-board", [caminho]));
  });

  it("documento: receita com título, data, nota e foto entra em core-saude-documentos e abre com a miniatura", async () => {
    const dados = montar();
    fireEvent.click(screen.getByRole("button", { name: /Guardar receita, laudo ou atestado/ }));
    fireEvent.click(screen.getByRole("button", { name: /Laudo/ }));
    fireEvent.change(screen.getByLabelText("Título do documento"), { target: { value: "Laudo do raio-X" } });
    fireEvent.change(screen.getByLabelText("Anexar foto de documento novo"), { target: { files: [foto()] } });
    await waitFor(() => expect(within(screen.getByTestId("form-documento")).getAllByTestId("anexo")).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /^Guardar$/ }));

    const docs = dados["core-saude-documentos"] as { tipo: string; titulo: string; fotos: string[] }[];
    expect(docs).toHaveLength(1);
    expect(docs[0]).toMatchObject({ tipo: "laudo", titulo: "Laudo do raio-X" });
    expect(docs[0].fotos[0]).toMatch(/^u-1\/saude\//);
    const linha = screen.getByTestId("documento");
    expect(linha.textContent).toContain("Laudo do raio-X");
    expect(linha.textContent).toContain("1 foto");
    fireEvent.click(screen.getByRole("button", { name: "Abrir Laudo do raio-X" }));
    await waitFor(() => expect(screen.getByAltText("Laudo do raio-X · foto 1")).toBeInTheDocument());
  });

  it("upload que falha avisa e não grava caminho nenhum", async () => {
    upload.mockResolvedValueOnce({ error: { message: "boom" } });
    const dados = montar({ "core-saude-exams-v2": [{ id: "e1", name: "Glicemia", date: "2026-09-01", time: "", location: "", notes: "", done: false }] });
    fireEvent.click(screen.getByRole("button", { name: "Fotos e observações de Glicemia" }));
    fireEvent.change(screen.getByLabelText("Anexar foto de exame Glicemia"), { target: { files: [foto()] } });
    await waitFor(() => expect(screen.getByText("Não deu pra enviar a foto. Tenta de novo.")).toBeInTheDocument());
    expect((dados["core-saude-exams-v2"] as { fotos?: string[] }[])[0].fotos).toBeUndefined();
  });
});
