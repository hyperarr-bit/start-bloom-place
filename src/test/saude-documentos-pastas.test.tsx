/**
 * Documentos completos como os exames + pastas didáticas (16/10, chamado de
 * cliente: "faltam as categorias de médicos e especialistas… títulos como
 * 'exame de cardiograma', 'exame de sangue'… tem que ser didático sempre que eu
 * abrir qualquer pasta"). Rede mockada: tela, dado gravado em
 * `core-saude-documentos` e compatibilidade com o dado antigo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { UserDataContext, UserDataContextType } from "@/hooks/use-user-data";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u-1" } } }) },
    storage: { from: () => ({
      upload: async () => ({ error: null }),
      createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://assinada/${path}` } }),
      remove: async () => ({ error: null }),
    }) },
  },
}));
vi.mock("@/lib/native-shell", () => ({ isNativeShell: () => false }));

import { MedicalLog } from "@/components/saude/MedicalLog";
import {
  PREFIXO_ESPECIALIDADE, SEM_MEDICO, chaveEspecialidade, conteudoDaPasta, medicosConhecidos, naPasta, pastasDeSaude, pastasDosItens,
} from "@/lib/saude-medicos";
import { TIPOS_DOC, documentoParaGravar, normalizarDocumentos, tipoDoDocumento } from "@/lib/saude-documentos";

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

const CONSULTAS = [
  { id: "c1", doctor: "Dra. Ana", specialty: "Cardiologista", date: "2026-09-10", time: "14:00", address: "", questions: "Perguntar se posso voltar a correr" },
  { id: "c2", doctor: "Dr. Hélio", specialty: "Neurologia", date: "2026-10-20", time: "", address: "", questions: "" },
];
const EXAMES = [
  { id: "e1", name: "Ecocardiograma", date: "2026-09-25", time: "", location: "", notes: "", done: true, medico: "Dra. Ana", especialidade: "Cardiologia", resumo: "Função do coração normal.", fotos: ["u-1/saude/1-eco.pdf"] },
  { id: "e2", name: "Holter 24 h", date: "2026-10-02", time: "", location: "", notes: "", done: false, medico: "Dr. Paulo", especialidade: "Cardiologia" },
  { id: "e3", name: "Glicemia", date: "2022-04-13", time: "", location: "", notes: "", done: true },
];
/** Documentos como a versão de 11/09 grava: sem médico, sem especialidade. */
const DOCS_ANTIGOS = [
  { id: "d1", tipo: "receita", titulo: "Receita — Vitamina D", date: "2026-09-01", notes: "1 cápsula por dia, com o café. Válida por 6 meses.", fotos: [] },
  { id: "d2", tipo: "atestado", titulo: "Atestado — 2 dias", date: "2026-08-15", notes: "", fotos: ["u-1/saude/2-atestado.webp"] },
];
const DOCS_NOVOS = [
  { id: "d3", tipo: "exame", titulo: "Eletrocardiograma", date: "2026-09-25", notes: "Ritmo normal. Repetir em 1 ano.\nSem alterações de repolarização.\nFrequência 68 bpm.\nLaudo assinado pela Dra. Ana.", fotos: ["u-1/saude/3-eletro.pdf"], medico: "Dra. Ana", especialidade: "Cardiologia" },
  { id: "d4", tipo: "laudo", titulo: "Laudo da ressonância", date: "2026-10-01", notes: "", fotos: [], especialidade: "Neurologia" },
];

describe("lib: pastas por médico e por especialidade", () => {
  it("especialidade: 'Cardiologista', 'cardiologia' e 'Cardio' são a mesma pasta", () => {
    expect(chaveEspecialidade("Cardiologista")).toBe("cardiologia");
    expect(chaveEspecialidade(" cardiologia ")).toBe("cardiologia");
    expect(chaveEspecialidade("Cardio")).toBe("cardiologia");
    expect(chaveEspecialidade("Ortopedista")).toBe("ortopedia");
    expect(chaveEspecialidade("Psiquiatra")).toBe("psiquiatria");
    expect(chaveEspecialidade("Médica da família")).toBe(chaveEspecialidade("Médico da família"));
    expect(chaveEspecialidade(undefined)).toBe("");
    expect(chaveEspecialidade(42 as unknown as string)).toBe("");
  });

  it("pasta de especialidade só quando junta mais que o chip do médico: 2 médicos, ou registro só com a área", () => {
    const pastas = pastasDeSaude({ consultas: CONSULTAS, exames: EXAMES, documentos: [...DOCS_ANTIGOS, ...DOCS_NOVOS] });
    expect(pastas.map((p) => [p.tipo, p.rotulo, p.total])).toEqual([
      ["medico", "Dr. Hélio · Neurologia", 1],
      ["medico", "Dr. Paulo · Cardiologia", 1],
      ["medico", "Dra. Ana · Cardiologia", 3],
      // Dra. Ana (consulta "Cardiologista" + exame + eletro) e Dr. Paulo
      ["especialidade", "Cardiologia", 4],
      // o laudo tem a área mas não o médico → a pasta junta mais que "Dr. Hélio"
      ["especialidade", "Neurologia", 2],
      ["sem", "Sem médico", 4],
    ]);
    // um médico só por área: nada de pasta "Neurologia" repetindo o chip do Dr. Hélio
    expect(pastasDosItens([{ medico: "Dr. Hélio", especialidade: "Neurologia" }]).map((p) => p.rotulo)).toEqual(["Dr. Hélio · Neurologia"]);
    expect(pastasDosItens([])).toEqual([]);
    expect(pastasDosItens(null as unknown as [])).toEqual([]);
  });

  it("conteúdo da pasta: consultas + exames + documentos separados, do mais recente pro mais antigo", () => {
    const dados = { consultas: CONSULTAS, exames: EXAMES, documentos: [...DOCS_ANTIGOS, ...DOCS_NOVOS] };
    const ana = conteudoDaPasta("dra ana", dados);
    expect(ana.consultas.map((c) => c.id)).toEqual(["c1"]);
    expect(ana.exames.map((e) => e.id)).toEqual(["e1"]);
    expect(ana.documentos.map((d) => d.id)).toEqual(["d3"]);
    expect(ana.total).toBe(3);
    const cardio = conteudoDaPasta(PREFIXO_ESPECIALIDADE + "cardiologia", dados);
    expect(cardio.exames.map((e) => e.id)).toEqual(["e2", "e1"]);
    expect(cardio.consultas.map((c) => c.id)).toEqual(["c1"]);
    const sem = conteudoDaPasta(SEM_MEDICO, dados);
    expect(sem.exames.map((e) => e.id)).toEqual(["e3"]);
    expect(sem.documentos.map((d) => d.id)).toEqual(["d4", "d1", "d2"]);
    expect(naPasta({ medico: "  " }, SEM_MEDICO)).toBe(true);
    expect(naPasta({ especialidade: "" }, PREFIXO_ESPECIALIDADE)).toBe(false);
  });

  it("médicos conhecidos vêm de consultas, exames E documentos", () => {
    const conhecidos = medicosConhecidos([], [], [{ medico: "Dra. Bia", especialidade: "Dermatologia", date: "2026-10-01" }]);
    expect(conhecidos).toEqual([{ nome: "Dra. Bia", especialidade: "Dermatologia" }]);
    // dado estranho de versão antiga não derruba
    expect(medicosConhecidos([{ doctor: 7 as unknown as string }], [null as never], undefined)).toEqual([]);
  });
});

describe("lib: documento — dado antigo e versões antigas do app", () => {
  it("normalizar: documento antigo continua igual; sem fotos/notes vira []/\"\"; lixo sai; não-array vira []", () => {
    const [d1] = normalizarDocumentos(DOCS_ANTIGOS);
    expect(d1).toMatchObject(DOCS_ANTIGOS[0]);
    expect(d1.medico).toBeUndefined();
    expect(normalizarDocumentos([{ id: 5, tipo: "receita", titulo: "Velho" }, null, "x", { titulo: "sem id" }])).toEqual([
      expect.objectContaining({ id: "5", titulo: "Velho", notes: "", fotos: [], date: "" }),
    ]);
    expect(normalizarDocumentos({ a: 1 })).toEqual([]);
    expect(normalizarDocumentos(undefined)).toEqual([]);
    // tipo de uma versão futura aparece como "Outro"
    expect(normalizarDocumentos([{ id: "z", tipo: "carteirinha", titulo: "x", fotos: [] }])[0].tipo).toBe("outro");
  });

  it("gravar: médico vazio não entra; notes sempre string e fotos sempre array (o app antigo faz d.fotos.length)", () => {
    expect(documentoParaGravar({ tipo: "exame", titulo: "  Exame de sangue ", date: "2026-10-01", notes: " ok ", fotos: [], medico: " ", especialidade: "" }))
      .toEqual({ tipo: "exame", titulo: "Exame de sangue", date: "2026-10-01", notes: "ok", fotos: [] });
    expect(documentoParaGravar({ tipo: "exame", titulo: "Eco", date: "", notes: "", fotos: undefined as unknown as string[], medico: "Dra. Ana", especialidade: "Cardiologia" }))
      .toEqual({ tipo: "exame", titulo: "Eco", date: "", notes: "", fotos: [], medico: "Dra. Ana", especialidade: "Cardiologia" });
  });

  it("app antigo lendo documento novo: tipo novo cai em 'Outro' (índice 3), fotos/notes com o mesmo tipo de sempre", () => {
    // o MedicalLog de 11/09 → 15/10 (nas lojas) faz exatamente isto com cada documento:
    const TIPOS_ANTIGOS = [{ id: "receita" }, { id: "laudo" }, { id: "atestado" }, { id: "outro" }];
    const lerComoAntigo = (d: Record<string, unknown>) => {
      const tipo = TIPOS_ANTIGOS.find((t) => t.id === d.tipo) ?? TIPOS_ANTIGOS[3];
      const fotos = d.fotos as string[];
      return { tipo: tipo.id, titulo: String(d.titulo), anexos: fotos.length, pdf: fotos.some((f) => f.endsWith(".pdf")), notas: d.notes ? String(d.notes) : "" };
    };
    const gravado = { ...documentoParaGravar({ tipo: "exame", titulo: "Eletrocardiograma", date: "2026-09-25", notes: "Normal", fotos: ["u-1/saude/3.pdf"], medico: "Dra. Ana", especialidade: "Cardiologia" }), id: "1" };
    expect(lerComoAntigo(gravado)).toEqual({ tipo: "outro", titulo: "Eletrocardiograma", anexos: 1, pdf: true, notas: "Normal" });
    expect(lerComoAntigo({ ...documentoParaGravar({ tipo: "vacina", titulo: "Gripe", date: "", notes: "", fotos: [] }), id: "2" }).tipo).toBe("outro");
    // a ordem do array novo preserva o fallback: o índice 3 continua "Outro"
    expect(TIPOS_DOC[3].id).toBe("outro");
    expect(TIPOS_DOC.slice(0, 4).map((t) => t.id)).toEqual(["receita", "laudo", "atestado", "outro"]);
    expect(tipoDoDocumento("???").id).toBe("outro");
  });
});

describe("tela: documento completo", () => {
  beforeEach(() => { vi.useRealTimers(); });

  it("novo documento: tipo Exame, título por sugestão, médico das consultas preenche a especialidade, resumo, data → grava tudo", () => {
    const dados = montar({ "core-saude-appointments": CONSULTAS });
    fireEvent.click(screen.getByRole("button", { name: /Guardar exame, laudo, receita ou atestado/ }));
    const form = within(screen.getByTestId("form-documento"));
    fireEvent.click(form.getByRole("button", { name: "🔬 Exame" }));
    expect(form.getByRole("button", { name: "🔬 Exame" })).toHaveAttribute("aria-pressed", "true");
    // sugestões do tipo, e o autocompletar tem as de todos os tipos
    const sugestoes = within(screen.getByTestId("sugestoes-titulo")).getAllByRole("button").map((b) => b.textContent);
    expect(sugestoes).toEqual(expect.arrayContaining(["Exame de sangue", "Eletrocardiograma", "Ecocardiograma", "Ultrassom", "Raio-X", "Ressonância", "Tomografia"]));
    const titulo = form.getByLabelText("Título do documento") as HTMLInputElement;
    const autocompletar = [...document.getElementById(titulo.getAttribute("list")!)!.querySelectorAll("option")].map((o) => o.value);
    expect(autocompletar).toEqual(expect.arrayContaining(["Exame de sangue", "Receita", "Atestado médico", "Vacina da gripe", "Laudo da ressonância"]));
    fireEvent.click(form.getByRole("button", { name: "Eletrocardiograma" }));
    expect(titulo.value).toBe("Eletrocardiograma");

    const medico = form.getByLabelText("Médico do documento") as HTMLInputElement;
    const opcoes = [...document.getElementById(medico.getAttribute("list")!)!.querySelectorAll("option")].map((o) => o.value);
    expect(opcoes).toEqual(["Dr. Hélio", "Dra. Ana"]);
    fireEvent.change(medico, { target: { value: "Dra. Ana" } });
    expect((form.getByLabelText("Especialidade do médico") as HTMLInputElement).value).toBe("Cardiologista");
    fireEvent.change(form.getByLabelText("Especialidade do médico"), { target: { value: "Cardiologia" } });
    fireEvent.change(form.getByLabelText("Resumo ou notas do documento"), { target: { value: "Ritmo normal." } });
    fireEvent.change(screen.getByTestId("form-documento").querySelector('input[type="date"]')!, { target: { value: "2026-09-25" } });
    fireEvent.click(form.getByRole("button", { name: /^Guardar$/ }));

    const [doc] = dados["core-saude-documentos"] as Record<string, unknown>[];
    expect(doc).toEqual({ id: expect.any(String), tipo: "exame", titulo: "Eletrocardiograma", date: "2026-09-25", notes: "Ritmo normal.", fotos: [], medico: "Dra. Ana", especialidade: "Cardiologia" });
    const linha = screen.getByTestId("documento");
    expect(within(linha).getByTestId("documento-linha").textContent).toBe("Exame · 25/09/2026");
    expect(within(linha).getByTestId("documento-medico").textContent).toBe("🩺 Dra. Ana · Cardiologia");
    expect(within(linha).getByTestId("documento-resumo").textContent).toBe("Ritmo normal.");
  });

  it("documento ANTIGO: as notas viram o resumo (3 linhas, toque abre); data dd/mm/aaaa; nada se perde", () => {
    montar({ "core-saude-documentos": [...DOCS_ANTIGOS, DOCS_NOVOS[0]] });
    const linhas = screen.getAllByTestId("documento");
    expect(linhas.map((l) => within(l).getByTestId("documento-linha").textContent)).toEqual([
      "Exame · 25/09/2026 · 1 anexo", "Receita · 01/09/2026", "Atestado · 15/08/2026 · 1 foto",
    ]);
    const resumoReceita = within(linhas[1]).getByTestId("documento-resumo");
    expect(resumoReceita.textContent).toBe("1 cápsula por dia, com o café. Válida por 6 meses.");
    const texto = within(linhas[0]).getByTestId("documento-resumo").querySelector("span")!;
    expect(texto.className).toContain("line-clamp-3");
    fireEvent.click(screen.getByRole("button", { name: "Ler resumo de Eletrocardiograma" }));
    expect(texto.className).not.toContain("line-clamp-3");
    // atestado sem notas: sem caixa de resumo vazia
    expect(within(linhas[2]).queryByTestId("documento-resumo")).toBeNull();
  });

  it("editar documento antigo sem mexer não muda o dado; pôr o médico grava; apagar o médico tira o campo", () => {
    const dados = montar({ "core-saude-documentos": DOCS_ANTIGOS });
    fireEvent.click(screen.getByRole("button", { name: "Editar Receita — Vitamina D" }));
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(JSON.parse(JSON.stringify(dados["core-saude-documentos"]))).toEqual(DOCS_ANTIGOS);

    fireEvent.click(screen.getByRole("button", { name: "Editar Receita — Vitamina D" }));
    fireEvent.change(screen.getByLabelText("Médico do documento"), { target: { value: "Dra. Camila" } });
    fireEvent.change(screen.getByLabelText("Especialidade do médico"), { target: { value: "Médica da família" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect((dados["core-saude-documentos"] as Record<string, unknown>[])[0]).toEqual({ ...DOCS_ANTIGOS[0], medico: "Dra. Camila", especialidade: "Médica da família" });

    fireEvent.click(screen.getByRole("button", { name: "Editar Receita — Vitamina D" }));
    fireEvent.change(screen.getByLabelText("Médico do documento"), { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Especialidade do médico"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));
    expect(JSON.parse(JSON.stringify((dados["core-saude-documentos"] as unknown[])[0]))).toEqual(DOCS_ANTIGOS[0]);
  });

  it("chips de pasta nos documentos: Todos · médico · especialidade · Sem médico; tocar filtra", () => {
    montar({ "core-saude-documentos": [...DOCS_ANTIGOS, ...DOCS_NOVOS, { id: "d5", tipo: "laudo", titulo: "Laudo do eletroencefalograma", date: "2026-10-03", notes: "", fotos: [], medico: "Dr. Hélio", especialidade: "Neurologia" }] });
    const chips = within(screen.getByTestId("pastas-documentos"));
    expect(chips.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Todos 5", "🩺 Dr. Hélio · Neurologia 1", "🩺 Dra. Ana · Cardiologia 1", "🏷️ Neurologia 2", "Sem médico 3",
    ]);
    const titulos = () => screen.getAllByTestId("documento").map((l) => l.querySelector("p")!.textContent);
    fireEvent.click(chips.getByRole("button", { name: /Neurologia 2/ }));
    expect(titulos()).toEqual(["Laudo do eletroencefalograma", "Laudo da ressonância"]);
    fireEvent.click(chips.getByRole("button", { name: /Sem médico/ }));
    expect(titulos()).toEqual(["Laudo da ressonância", "Receita — Vitamina D", "Atestado — 2 dias"]);
  });

  it("o médico de um DOCUMENTO aparece como sugestão no formulário do exame", () => {
    montar({ "core-saude-documentos": DOCS_NOVOS });
    fireEvent.click(screen.getByRole("button", { name: /Novo Exame/ }));
    const medico = screen.getByLabelText("Médico que pediu o exame") as HTMLInputElement;
    expect([...document.getElementById(medico.getAttribute("list")!)!.querySelectorAll("option")].map((o) => o.value)).toEqual(["Dra. Ana"]);
  });
});

describe("tela: a estante de pastas", () => {
  it("abrir a pasta do médico mostra consultas, exames e documentos com cabeçalho, tipo, título, médico, data, resumo e anexo", () => {
    montar({ "core-saude-appointments": CONSULTAS, "core-saude-exams-v2": EXAMES, "core-saude-documentos": [...DOCS_ANTIGOS, ...DOCS_NOVOS] });
    const estante = within(screen.getByTestId("estante"));
    expect(estante.getAllByTestId("pasta").map((p) => p.textContent)).toEqual([
      "🩺Dr. Hélio · Neurologia1 consulta",
      "🩺Dr. Paulo · Cardiologia1 exame",
      "🩺Dra. Ana · Cardiologia1 consulta · 1 exame · 1 documento",
      "🏷️Cardiologia1 consulta · 2 exames · 1 documento",
      "🏷️Neurologia1 consulta · 1 documento",
      "📂Sem médico1 exame · 3 documentos",
    ]);
    fireEvent.click(estante.getByRole("button", { name: "Abrir pasta Dra. Ana · Cardiologia" }));
    const aberta = within(screen.getByTestId("pasta-aberta"));
    expect(aberta.getByRole("heading", { level: 4 }).textContent).toBe("Dra. Ana · Cardiologia");
    expect(aberta.getAllByRole("heading", { level: 5 }).map((h) => h.textContent)).toEqual(["👩‍⚕️ Consultas 1", "💉 Exames 1", "🗂️ Documentos 1"]);
    const itens = aberta.getAllByTestId("item-pasta");
    expect(itens.map((i) => within(i).getByTestId("item-pasta-tipo").textContent)).toEqual(["Consulta", "Exame", "Exame"]);
    expect(itens.map((i) => within(i).getByTestId("item-pasta-data").textContent)).toEqual(["10/09/2026 · 14:00", "25/09/2026", "25/09/2026"]);
    expect(itens.map((i) => within(i).getByTestId("item-pasta-medico").textContent)).toEqual([
      "🩺 Dra. Ana · Cardiologista", "🩺 Dra. Ana · Cardiologia", "🩺 Dra. Ana · Cardiologia",
    ]);
    expect(within(itens[0]).getByTestId("item-pasta-resumo").textContent).toBe("Perguntar: Perguntar se posso voltar a correr");
    expect(within(itens[2]).getByTestId("item-pasta-resumo").querySelector("span")!.className).toContain("line-clamp-3");
    // clipe com a contagem; consulta não tem anexo
    expect(within(itens[0]).queryByTestId("item-pasta-anexos")).toBeNull();
    expect(within(itens[1]).getByTestId("item-pasta-anexos").textContent).toBe("1");
    fireEvent.click(within(itens[2]).getByRole("button", { name: "Anexos de Eletrocardiograma" }));
    expect(within(itens[2]).getAllByTestId("anexo")).toHaveLength(1);

    fireEvent.click(aberta.getByRole("button", { name: /Todas as pastas/ }));
    expect(screen.queryByTestId("pasta-aberta")).toBeNull();
  });

  it("seção vazia explica o que vai ali; pasta de especialidade junta médicos diferentes", () => {
    montar({ "core-saude-appointments": CONSULTAS, "core-saude-exams-v2": EXAMES, "core-saude-documentos": DOCS_NOVOS });
    fireEvent.click(screen.getByRole("button", { name: "Abrir pasta Dr. Hélio · Neurologia" }));
    const vazias = within(screen.getByTestId("pasta-aberta")).getAllByTestId("secao-vazia").map((v) => v.textContent);
    expect(vazias).toEqual([
      "Nenhum exame pedido por Dr. Hélio. No exame, preencha “Pedido por”.",
      "Nenhum documento de Dr. Hélio. Em Documentos, escolha o médico ao guardar.",
    ]);
    fireEvent.click(screen.getByRole("button", { name: /Todas as pastas/ }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir pasta Cardiologia" }));
    const itens = within(screen.getByTestId("pasta-aberta")).getAllByTestId("item-pasta");
    expect(itens.map((i) => i.querySelector("p")!.textContent)).toEqual(["Consulta · Cardiologista", "Holter 24 h", "Ecocardiograma", "Eletrocardiograma"]);
  });

  it("conta VAZIA: estante e documentos explicam o que vai ali, sem chips e sem erro", () => {
    montar();
    expect(screen.getByTestId("estante-vazia").textContent).toContain("Quando você põe o médico numa consulta, num exame ou num documento");
    expect(screen.getByTestId("documentos-vazio").textContent).toContain("exames, laudos, receitas, atestados e vacinas");
    expect(screen.queryByTestId("pastas-documentos")).toBeNull();
    expect(screen.queryByTestId("pastas-medico")).toBeNull();
    expect(screen.queryAllByTestId("pasta")).toHaveLength(0);
  });

  it("só registros antigos sem médico: a estante diz como criar a primeira pasta", () => {
    montar({ "core-saude-exams-v2": [EXAMES[2]], "core-saude-documentos": DOCS_ANTIGOS });
    expect(screen.getByTestId("estante-vazia").textContent).toContain("ainda está sem médico");
  });

  it("chave corrompida (não é array) não derruba a tela", () => {
    montar({ "core-saude-documentos": { quebrado: true } });
    expect(screen.getByTestId("documentos-vazio")).toBeInTheDocument();
  });
});
