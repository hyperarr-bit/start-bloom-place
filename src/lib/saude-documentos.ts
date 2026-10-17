/**
 * DOCUMENTOS DA SAÚDE (11/09: receita, laudo, atestado com foto; 16/10:
 * completo como os exames — médico + especialidade, resumo e sugestão de título).
 *
 * Chamado 16/10: "aqui vai ficar tudo arquivado… faltam as categorias de
 * médicos e especialistas. Títulos seriam 'exame de cardiograma', 'exame de
 * sangue'… tem que ser didático sempre que eu abrir qualquer pasta."
 *
 * COMPATIBILIDADE (chave sincronizada `core-saude-documentos`, lida também
 * pelas versões antigas do app nas lojas):
 *  - continua um ARRAY de objetos com os mesmos campos. Nada muda de tipo.
 *  - `notes` continua sendo o texto do documento e agora é o "Resumo / notas"
 *    da tela: o que a pessoa já escreveu vira o resumo de 3 linhas da lista, sem
 *    migração, e o app antigo segue mostrando o mesmo texto ao abrir.
 *  - `fotos` é SEMPRE um array (o app antigo faz `d.fotos.length`).
 *  - `medico`/`especialidade` são opcionais e só entram quando preenchidos; o
 *    app antigo ignora campo que não conhece.
 *  - tipos novos ("exame", "vacina"): o app antigo mostra como "Outro"
 *    (`TIPOS_DOC.find(...) ?? TIPOS_DOC[3]`, desde 11/09) — não quebra.
 */

export type TipoDocumento = "receita" | "laudo" | "exame" | "atestado" | "vacina" | "outro";

export interface Documento {
  id: string;
  tipo: TipoDocumento;
  titulo: string;
  date: string;
  /** "Resumo / notas" (16/10): o que diz o resultado, a posologia, a validade. */
  notes: string;
  fotos: string[];
  /** Médico e especialidade (16/10) — a pasta do médico. Opcionais. */
  medico?: string;
  especialidade?: string;
}

export const TIPOS_DOC: { id: TipoDocumento; rotulo: string; emoji: string }[] = [
  { id: "receita", rotulo: "Receita", emoji: "💊" },
  { id: "laudo", rotulo: "Laudo", emoji: "🧾" },
  { id: "atestado", rotulo: "Atestado", emoji: "📄" },
  { id: "outro", rotulo: "Outro", emoji: "📎" },
  // 16/10: depois do "Outro" no array pra o índice 3 continuar sendo o
  // "Outro" — é o fallback que as versões antigas usam pra tipo desconhecido
  { id: "exame", rotulo: "Exame", emoji: "🔬" },
  { id: "vacina", rotulo: "Vacina", emoji: "💉" },
];
/** Ordem dos chips no formulário (o array acima guarda a ordem de compatibilidade). */
export const ORDEM_TIPOS: TipoDocumento[] = ["exame", "laudo", "receita", "atestado", "vacina", "outro"];
export const tipoDoDocumento = (tipo: unknown) => TIPOS_DOC.find((t) => t.id === tipo) ?? TIPOS_DOC[3];

/** Sugestões de título por tipo — os chips embaixo do campo e o autocompletar. */
export const SUGESTOES_TITULO: Record<TipoDocumento, string[]> = {
  exame: ["Exame de sangue", "Eletrocardiograma", "Ecocardiograma", "Ultrassom", "Raio-X", "Ressonância", "Tomografia", "Mamografia", "Exame de urina"],
  laudo: ["Laudo da ressonância", "Laudo do ultrassom", "Laudo do raio-X", "Laudo da tomografia", "Laudo do eletrocardiograma"],
  receita: ["Receita", "Receita de óculos", "Receita controlada"],
  atestado: ["Atestado médico", "Atestado de comparecimento"],
  vacina: ["Carteira de vacinação", "Vacina da gripe", "Vacina COVID-19", "Vacina hepatite B"],
  outro: ["Pedido de exame", "Encaminhamento", "Relatório médico", "Carteirinha do plano"],
};
export const TODAS_SUGESTOES = [...new Set(ORDEM_TIPOS.flatMap((t) => SUGESTOES_TITULO[t]))];

/** Placeholder do título e do resumo conforme o tipo — o exemplo ensina o que escrever. */
export const EXEMPLO_TITULO: Record<TipoDocumento, string> = {
  exame: "Título (ex: Exame de sangue, Eletrocardiograma)",
  laudo: "Título (ex: Laudo da ressonância)",
  receita: "Título (ex: Receita da Dra. Ana)",
  atestado: "Título (ex: Atestado médico)",
  vacina: "Título (ex: Vacina da gripe)",
  outro: "Título (ex: Pedido de exame, Encaminhamento)",
};
export const EXEMPLO_RESUMO: Record<TipoDocumento, string> = {
  exame: "Ex: Eletro normal, ritmo regular. Repetir em 1 ano.",
  laudo: "Ex: Sem alterações. Pequena sinusite à direita.",
  receita: "Ex: Vitamina D 7.000 UI, 1 por semana. Válida por 6 meses.",
  atestado: "Ex: 2 dias de repouso. Entregue no RH.",
  vacina: "Ex: 2ª dose. Próxima em outubro de 2027.",
  outro: "Ex: o que o médico disse, validade, onde entregar…",
};

/**
 * Leitura defensiva da chave: dado que veio do servidor (ou de uma versão
 * antiga, ou corrompido) nunca derruba a tela. Item sem `fotos` vira `[]`, sem
 * `notes` vira "", e o que não for objeto com id sai da lista exibida. Só pra
 * EXIBIR — o que está gravado não é reescrito por isto.
 */
export function normalizarDocumentos(bruto: unknown): Documento[] {
  if (!Array.isArray(bruto)) return [];
  return bruto
    .filter((d): d is Record<string, unknown> => !!d && typeof d === "object" && (typeof (d as { id?: unknown }).id === "string" || typeof (d as { id?: unknown }).id === "number"))
    .map((d) => {
      const texto = (v: unknown) => (typeof v === "string" ? v : "");
      const medico = texto(d.medico).trim();
      const especialidade = texto(d.especialidade).trim();
      return {
        ...(d as object),
        id: String(d.id),
        tipo: tipoDoDocumento(d.tipo).id,
        titulo: texto(d.titulo),
        date: texto(d.date),
        notes: texto(d.notes),
        fotos: Array.isArray(d.fotos) ? d.fotos.filter((f): f is string => typeof f === "string") : [],
        ...(medico ? { medico } : { medico: undefined }),
        ...(especialidade ? { especialidade } : { especialidade: undefined }),
      } as Documento;
    });
}

export type RascunhoDocumento = Omit<Documento, "id">;
export const documentoVazio = (date: string, tipo: TipoDocumento = "exame"): RascunhoDocumento => ({
  tipo, titulo: "", date, notes: "", fotos: [], medico: "", especialidade: "",
});

/**
 * O que vai pro dado: título e textos aparados, médico/especialidade só se
 * preenchidos (documento antigo editado sem tocar neles fica idêntico),
 * `notes` sempre string e `fotos` sempre array.
 */
export function documentoParaGravar(r: RascunhoDocumento): RascunhoDocumento {
  const { medico, especialidade, ...resto } = r;
  const m = (medico ?? "").trim();
  const e = (especialidade ?? "").trim();
  return {
    ...resto,
    titulo: r.titulo.trim(),
    notes: (r.notes ?? "").trim(),
    fotos: Array.isArray(r.fotos) ? r.fotos : [],
    ...(m ? { medico: m } : {}),
    ...(e ? { especialidade: e } : {}),
  };
}
