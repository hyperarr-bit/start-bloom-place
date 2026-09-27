/* Contas do Cardápio, da Lista e do Diário da Dieta (26/09, varredura) — puras, pra teste. */

/** Só a 1ª letra maiúscula. A classe `capitalize` subia TODA palavra
 *  ("2 Ovos Mexidos (100g) • 1 Fatia De…"); isto também conserta a exibição
 *  dos itens antigos, que a versão anterior gravava tudo em minúsculas. */
export const primeiraMaiuscula = (s: string) => {
  const t = String(s ?? "").trim();
  return t ? t.charAt(0).toLocaleUpperCase("pt-BR") + t.slice(1) : t;
};

const chave = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();

// quantidade no começo: "120g de", "1 fatia de", "3 col sopa de", "1/2 xícara de", "uma"…
const QTD_INICIO = new RegExp(
  "^(?:\\d+(?:[.,]\\d+)?(?:\\s*\\/\\s*\\d+)?|[½¼¾]|(?:meia|meio|uma?|dois|duas|tr[eê]s|quatro|cinco)(?=\\s))\\s*" +
  "(?:(?:kg|g|gr|gramas?|mg|ml|l|lt|litros?|x[ií]caras?(?:\\s+de\\s+ch[aá])?|colher(?:es)?(?:\\s+de\\s+(?:sopa|ch[aá]|sobremesa))?" +
  "|col\\.?(?:\\s+(?:de\\s+)?(?:sopa|ch[aá]|sobremesa))?|fatias?|unidades?|unid\\.?|un\\.?|por[cç](?:[aã]o|[oõ]es)|conchas?|copos?" +
  "|peda[cç]os?|scoops?|potes?|latas?|pitadas?|punhados?|dentes?|folhas?|ramos?|talos?|fil[eé]s?|bifes?|x)(?![a-zà-ú]))?" +
  "\\s*(?:de\\s+|d[aeo]s?\\s+)?",
  "i",
);
const QTD_FIM = /\s+\d+(?:[.,]\d+)?\s*(?:kg|g|gr|ml|l)\.?$/i;
const A_GOSTO = /\s+(?:à|a)\s+(?:vontade|gosto)\.?$/i;
const IGNORAR = /^(?:refei[cç][aã]o\s+livre|livre|jejum|nada|lixo)\b/i;
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu;

/** Um pedaço de refeição vira nome de compra: sem gramas, parênteses, número
 *  inicial nem emoji. `null` = não é coisa de mercado ("Refeição livre"). */
export const limparItem = (bruto: string): string | null => {
  let t = String(bruto ?? "")
    .replace(EMOJI, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+[—–]\s+.*$/, "") // " — com consciência" é comentário
    .replace(/\s+/g, " ")
    .trim();
  if (!t || IGNORAR.test(t)) return null;
  t = t.replace(QTD_INICIO, "").replace(A_GOSTO, "").replace(QTD_FIM, "").trim();
  t = t.replace(/^[-–—:.\s]+|[-–—:.;\s]+$/g, "");
  if (!/[a-zà-ú]/i.test(t) || IGNORAR.test(t)) return null;
  return primeiraMaiuscula(t);
};

/** Descrições de refeição (ou linhas de ingredientes) → itens de compra, sem
 *  repetir e sem o que já está na lista. Antes cada refeição INTEIRA virava um
 *  item só ("2 ovos mexidos (100g) • 1 fatia de pão…"), inclusive a "Refeição
 *  livre 😌". Separa por "•", ",", ";", "+" e quebra de linha. */
export const itensDoCardapio = (descricoes: string[], jaNaLista: string[] = []): string[] => {
  const vistos = new Set(jaNaLista.map((s) => chave(String(s ?? ""))));
  const out: string[] = [];
  for (const desc of descricoes) {
    if (!desc || typeof desc !== "string") continue;
    // vírgula decimal ("1,5 kg") não é separador
    const partes = desc.replace(/(\d),(\d)/g, "$1.$2").split(/[•·,;\n+]/);
    for (const p of partes) {
      const item = limparItem(p);
      if (!item) continue;
      const k = chave(item);
      if (vistos.has(k)) continue;
      vistos.add(k);
      out.push(item);
    }
  }
  return out;
};

/* ADERÊNCIA (26/09, varredura): marcar UMA refeição como ✅ pintava o dia de
 * ❌ vermelho — qualquer marcação que não fosse "tudo seguido" contava como
 * furo. Agora ❌ só com "não segui"; dia pela metade fica em amarelo. */
export type StatusDia = "vazio" | "tudo" | "parcial" | "furou";
export const statusAderencia = (
  planejadas: string[],
  registro: Record<string, { followed?: boolean } | undefined> | undefined,
): { status: StatusDia; seguidas: number; total: number } => {
  const total = planejadas.length;
  const marcadas = planejadas.filter((m) => registro?.[m]);
  const seguidas = marcadas.filter((m) => registro?.[m]?.followed === true).length;
  if (!total || !marcadas.length) return { status: "vazio", seguidas, total };
  if (marcadas.some((m) => registro?.[m]?.followed === false)) return { status: "furou", seguidas, total };
  return { status: seguidas === total ? "tudo" : "parcial", seguidas, total };
};

/* DESFAZER A CÓPIA (26/09, varredura): "Copiar → Todos" trocava os outros 6
 * dias (com kcal e macros) sem aviso. Tira a foto dos dias de destino antes,
 * pra devolver exatamente o que havia (dia que não existia volta a não existir). */
export const fotografarDias = <T,>(mapa: Record<string, T> | undefined, dias: string[]): Record<string, T | undefined> =>
  Object.fromEntries(dias.map((d) => [d, mapa?.[d]])) as Record<string, T | undefined>;

export const restaurarDias = <T,>(mapa: Record<string, T>, foto: Record<string, T | undefined>): Record<string, T> => {
  const n = { ...mapa };
  for (const [d, v] of Object.entries(foto)) {
    if (v === undefined) delete n[d];
    else n[d] = v;
  }
  return n;
};
