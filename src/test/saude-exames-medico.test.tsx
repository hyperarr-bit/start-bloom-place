/**
 * Exames por médico, data com ano, resumo do resultado e anexo de PDF (13/10,
 * chamado de cliente começando muitos exames). Rede mockada: a tela, o dado
 * gravado em `core-saude-exams-v2` e o contrato com o Storage.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";

const upload = vi.fn();
const createSignedUrl = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    storage: { from: (bucket: string) => ({
      upload: (...a: unknown[]) => upload(bucket, ...a),
      createSignedUrl: (...a: unknown[]) => createSignedUrl(bucket, ...a),
      remove: async () => ({ error: null }),
    }) },
  },
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));
class ImagemFalsa { width = 100; height = 100; onload: null | (() => void) = null; onerror: null | (() => void) = null; set src(_v: string) { setTimeout(() => this.onload?.(), 0); } }
(globalThis as unknown as { Image: unknown }).Image = ImagemFalsa;
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;

import { MedicalLog } from "@/components/saude/MedicalLog";
import { ACEITA_ANEXO } from "@/components/saude/AnexosDeSaude";
import { uploadImagePath } from "@/lib/image-upload";
import { aoEscolherMedico, chaveMedico, medicosConhecidos, pastasDosExames } from "@/lib/saude-medicos";

beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null });
  createSignedUrl.mockReset().mockImplementation(async (_b: string, path: string) => ({ data: { signedUrl: `https://assinada/${path}?token=x` } }));
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

const EXAMES = [
  { id: "e1", name: "Ressonância do crânio", date: "2026-10-01", time: "", location: "", notes: "", done: true, medico: "Dr. Hélio", especialidade: "Neurologia", resumo: "Sem alterações. Pequena sinusite maxilar à direita, sem relevância clínica. Repetir em 1 ano se dor de cabeça voltar." },
  { id: "e2", name: "Hemograma", date: "2026-09-20", time: "", location: "", notes: "", done: true, medico: "Dra. Camila", especialidade: "Médica da família" },
  { id: "e3", name: "Eletroencefalograma", date: "2026-10-05", time: "", location: "", notes: "", done: false, medico: "dr helio", especialidade: "Neurologia" },
  // exame antigo, de antes do campo "Pedido por": continua funcionando
  { id: "e4", name: "Glicemia", date: "2022-04-13", time: "", location: "", notes: "", done: true },
];
const nomesNaTabela = () => screen.getAllByText(/Ressonância do crânio|Hemograma|Eletroencefalograma|Glicemia/).map((n) => n.textContent!.replace("✓ ", ""));

describe("pasta do médico (filtro)", () => {
  it("chips: Todos + um por médico (grafias diferentes do mesmo médico juntas) + Sem médico; tocar filtra", () => {
    montar({ "core-saude-exams-v2": EXAMES });
    const chips = within(screen.getByTestId("pastas-medico")).getAllByRole("button").map((b) => b.textContent);
    expect(chips).toEqual(["Todos 4", "🩺 Dr. Hélio · Neurologia 2", "🩺 Dra. Camila · Médica da família 1", "Sem médico 1"]);
    expect(nomesNaTabela()).toEqual(["Eletroencefalograma", "Ressonância do crânio", "Hemograma", "Glicemia"]); // data desc

    // os chips do card de Exames (a estante de Pastas, mais abaixo, tem botões com o mesmo nome)
    const chipsExames = within(screen.getByTestId("pastas-medico"));
    fireEvent.click(chipsExames.getByRole("button", { name: /Dr\. Hélio · Neurologia/ }));
    expect(chipsExames.getByRole("button", { name: /Dr\. Hélio · Neurologia/ })).toHaveAttribute("aria-pressed", "true");
    expect(nomesNaTabela()).toEqual(["Eletroencefalograma", "Ressonância do crânio"]);

    fireEvent.click(chipsExames.getByRole("button", { name: /Sem médico/ }));
    expect(nomesNaTabela()).toEqual(["Glicemia"]);
    fireEvent.click(chipsExames.getByRole("button", { name: /^Todos/ }));
    expect(nomesNaTabela()).toHaveLength(4);
  });

  it("etiqueta do médico em cada exame que tem; sem chips quando nenhum exame tem médico", () => {
    montar({ "core-saude-exams-v2": EXAMES });
    expect(screen.getAllByTestId("exame-medico").map((t) => t.textContent)).toEqual([
      "🩺 dr helio · Neurologia", "🩺 Dr. Hélio · Neurologia", "🩺 Dra. Camila · Médica da família",
    ]);
  });

  it("lista só de exames antigos (sem médico) não mostra chips", () => {
    montar({ "core-saude-exams-v2": [EXAMES[3]] });
    expect(screen.queryByTestId("pastas-medico")).toBeNull();
    expect(screen.queryByTestId("exame-medico")).toBeNull();
  });

  it("helpers: chave ignora acento/ponto/maiúscula; sugestões vêm de consultas e exames", () => {
    expect(chaveMedico(" Dr. Hélio ")).toBe(chaveMedico("dr helio"));
    const conhecidos = medicosConhecidos([{ doctor: "Dr. Hélio", specialty: "Neurologia", date: "2026-09-01" }], [{ medico: "Dra. Camila", especialidade: "Médica da família" }]);
    expect(conhecidos).toEqual([{ nome: "Dr. Hélio", especialidade: "Neurologia" }, { nome: "Dra. Camila", especialidade: "Médica da família" }]);
    expect(pastasDosExames([])).toEqual([]);
  });
});

describe("Pedido por: especialidade se preenche sozinha", () => {
  const conhecidos = [{ nome: "Dr. Hélio", especialidade: "Neurologia" }, { nome: "Dra. Camila", especialidade: "Médica da família" }];
  it("médico conhecido preenche; trocar de médico troca; especialidade digitada à mão não é sobrescrita", () => {
    expect(aoEscolherMedico({ medico: "", especialidade: "" }, "Dr. Hélio", conhecidos)).toEqual({ medico: "Dr. Hélio", especialidade: "Neurologia" });
    expect(aoEscolherMedico({ medico: "Dr. Hélio", especialidade: "Neurologia" }, "Dra. Camila", conhecidos)).toEqual({ medico: "Dra. Camila", especialidade: "Médica da família" });
    expect(aoEscolherMedico({ medico: "Dr. Hélio", especialidade: "Neurocirurgia" }, "Dra. Camila", conhecidos)).toEqual({ medico: "Dra. Camila", especialidade: "Neurocirurgia" });
    // continuou digitando e virou um médico desconhecido: a especialidade que veio do conhecido sai
    expect(aoEscolherMedico({ medico: "Dr. Hélio", especialidade: "Neurologia" }, "Dr. Hélio S", conhecidos)).toEqual({ medico: "Dr. Hélio S", especialidade: "" });
  });

  it("no formulário: médico das CONSULTAS sugere e preenche; salvar grava médico, especialidade e resumo", () => {
    const dados = montar({
      "core-saude-appointments": [{ id: "c1", doctor: "Dr. Hélio", specialty: "Neurologia", date: "2026-10-01", time: "", address: "", questions: "" }],
      "core-saude-exams-v2": [],
    });
    fireEvent.click(screen.getByRole("button", { name: /Novo Exame/ }));
    const medico = screen.getByLabelText("Médico que pediu o exame") as HTMLInputElement;
    const lista = document.getElementById(medico.getAttribute("list")!)!;
    expect([...lista.querySelectorAll("option")].map((o) => o.value)).toEqual(["Dr. Hélio"]);
    const especialidades = document.getElementById((screen.getByLabelText("Especialidade do médico") as HTMLInputElement).getAttribute("list")!)!;
    expect([...especialidades.querySelectorAll("option")].map((o) => o.value)).toEqual(expect.arrayContaining(["Clínico geral", "Médico da família", "Neurologia", "Otorrino"]));

    fireEvent.change(screen.getByPlaceholderText("Nome do exame (ex: Hemograma)"), { target: { value: "Ressonância" } });
    fireEvent.change(medico, { target: { value: "Dr. Hélio" } });
    expect((screen.getByLabelText("Especialidade do médico") as HTMLInputElement).value).toBe("Neurologia");
    fireEvent.change(screen.getByLabelText("Resumo do resultado"), { target: { value: "  Normal.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Exame" }));
    expect(dados["core-saude-exams-v2"]).toEqual([expect.objectContaining({ name: "Ressonância", medico: "Dr. Hélio", especialidade: "Neurologia", resumo: "Normal." })]);
  });

  it("exame antigo editado sem tocar nos campos novos não ganha médico/resumo vazios", () => {
    const dados = montar({ "core-saude-exams-v2": [EXAMES[3]] });
    fireEvent.click(screen.getByRole("button", { name: "Editar exame Glicemia" }));
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    const [g] = dados["core-saude-exams-v2"] as Record<string, unknown>[];
    expect(JSON.parse(JSON.stringify(g))).toEqual(EXAMES[3]);
  });

  it("editar um exame põe o médico e o resumo", () => {
    const dados = montar({ "core-saude-exams-v2": [EXAMES[1], EXAMES[3]] });
    fireEvent.click(screen.getByRole("button", { name: "Editar exame Glicemia" }));
    fireEvent.change(screen.getByLabelText("Médico que pediu o exame"), { target: { value: "Dra. Camila" } });
    expect((screen.getByLabelText("Especialidade do médico") as HTMLInputElement).value).toBe("Médica da família");
    fireEvent.change(screen.getByLabelText("Resumo do resultado"), { target: { value: "Glicemia 92 (normal)" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect((dados["core-saude-exams-v2"] as Record<string, unknown>[])[1]).toMatchObject({ medico: "Dra. Camila", especialidade: "Médica da família", resumo: "Glicemia 92 (normal)" });
  });
});

describe("data com ano e resumo embaixo do exame", () => {
  it("a data do exame sai com o ano inteiro (13/04/2022), numa linha só", () => {
    montar({ "core-saude-exams-v2": EXAMES });
    const datas = screen.getAllByTestId("exame-data");
    expect(datas.map((d) => d.textContent)).toEqual(["05/10/2026", "01/10/2026", "20/09/2026", "13/04/2022"]);
    expect(datas[3].closest("td")!.className).toContain("whitespace-nowrap");
  });

  it("resumo aparece embaixo do exame em 3 linhas; tocar abre o texto inteiro", () => {
    montar({ "core-saude-exams-v2": EXAMES });
    const resumos = screen.getAllByTestId("exame-resumo");
    expect(resumos).toHaveLength(1);
    expect(resumos[0].textContent).toContain("Sem alterações. Pequena sinusite");
    const texto = resumos[0].querySelector("span")!;
    expect(texto.className).toContain("line-clamp-3");
    fireEvent.click(screen.getByRole("button", { name: "Ler resumo de Ressonância do crânio" }));
    expect(screen.getByRole("button", { name: "Recolher resumo de Ressonância do crânio" })).toHaveAttribute("aria-expanded", "true");
    expect(texto.className).not.toContain("line-clamp-3");
  });
});

describe("anexo: foto OU PDF, da câmera, da galeria ou dos arquivos", () => {
  it("o seletor aceita imagem e PDF e NÃO força a câmera (sem capture); o botão diz Anexar", () => {
    montar({ "core-saude-exams-v2": [EXAMES[3]] });
    fireEvent.click(screen.getByRole("button", { name: "Fotos e observações de Glicemia" }));
    const input = screen.getByLabelText("Anexar foto de exame Glicemia") as HTMLInputElement;
    expect(input.getAttribute("accept")).toBe("image/*,application/pdf");
    expect(ACEITA_ANEXO).toBe("image/*,application/pdf");
    expect(input.hasAttribute("capture")).toBe(false);
    expect(screen.getByRole("button", { name: "Anexar foto ou PDF" }).textContent).toContain("Anexar");
  });

  it("PDF sobe INTACTO (sem compressão), como application/pdf e .pdf; a miniatura é um ícone PDF que abre a URL assinada", async () => {
    const dados = montar({ "core-saude-exams-v2": [EXAMES[3]] });
    fireEvent.click(screen.getByRole("button", { name: "Fotos e observações de Glicemia" }));
    const pdf = new File(["%PDF-1.7 laudo"], "laudo.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText("Anexar foto de exame Glicemia"), { target: { files: [pdf] } });
    await waitFor(() => expect((dados["core-saude-exams-v2"] as { fotos?: string[] }[])[0].fotos).toHaveLength(1));
    const caminho = (dados["core-saude-exams-v2"] as { fotos: string[] }[])[0].fotos[0];
    expect(caminho).toMatch(/^u-1\/saude\/\d+-[a-z0-9]+\.pdf$/);
    expect(upload).toHaveBeenCalledWith("dream-board", caminho, pdf, expect.objectContaining({ contentType: "application/pdf" }));
    const link = await screen.findByTestId("anexo-pdf");
    expect(link).toHaveAttribute("href", `https://assinada/${caminho}?token=x`);
    expect(link.textContent).toContain("PDF");
    expect(screen.getByRole("button", { name: "Remover exame Glicemia · PDF 1" })).toBeInTheDocument();
  });

  it("uploadImagePath: PDF com tipo vazio (alguns seletores) também vai intacto; arquivo que não é foto nem PDF não sobe", async () => {
    const semTipo = new File(["%PDF"], "Resultado.PDF", { type: "" });
    const caminho = await uploadImagePath("dream-board", semTipo, "saude");
    expect(caminho).toMatch(/\.pdf$/);
    expect(upload).toHaveBeenLastCalledWith("dream-board", caminho, semTipo, { contentType: "application/pdf", upsert: false });
    upload.mockClear();
    expect(await uploadImagePath("dream-board", new File(["x"], "planilha.xlsx", { type: "application/vnd.ms-excel" }), "saude")).toBeNull();
    expect(upload).not.toHaveBeenCalled();
  });

  it("foto continua comprimida como antes (.webp)", async () => {
    const caminho = await uploadImagePath("dream-board", new File(["x"], "f.jpg", { type: "image/jpeg" }), "saude");
    expect(caminho).toMatch(/\.webp$/);
    expect(upload).toHaveBeenLastCalledWith("dream-board", caminho, expect.anything(), expect.objectContaining({ contentType: "image/webp" }));
  });

  it("PDF grande demais avisa antes de subir", async () => {
    montar({ "core-saude-exams-v2": [EXAMES[3]] });
    fireEvent.click(screen.getByRole("button", { name: "Fotos e observações de Glicemia" }));
    const grande = new File(["x"], "tomografia.pdf", { type: "application/pdf" });
    Object.defineProperty(grande, "size", { value: 25 * 1024 * 1024 });
    fireEvent.change(screen.getByLabelText("Anexar foto de exame Glicemia"), { target: { files: [grande] } });
    expect(await screen.findByText(/Esse PDF passa de 20 MB/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });
});
