/**
 * Parser de extrato bancário (OFX e CSV) + auto-categorização.
 *
 * A ideia: a pessoa exporta o extrato no app do banco (todo banco BR exporta
 * OFX/CSV) e o CORE importa e categoriza sozinho — mata a objeção "não tenho
 * paciência de digitar tudo". A categorização usa um dicionário embutido de
 * estabelecimentos BR + regras aprendidas das correções do usuário
 * (chave finance-categorization-rules).
 */

export interface ParsedTx {
  date: string;        // YYYY-MM-DD
  description: string;
  amount: number;      // negativo = saída, positivo = entrada
}

/* ------------------------------------------------------------------- OFX */

// OFX de banco BR costuma ser SGML (sem fechar tags) — parse por regex de campo.
export const parseOFX = (text: string): ParsedTx[] => {
  const out: ParsedTx[] = [];
  const blocks = text.split(/<STMTTRN>/i).slice(1);
  for (const block of blocks) {
    const field = (name: string) => {
      const m = block.match(new RegExp(`<${name}>([^<\\r\\n]+)`, "i"));
      return m ? m[1].trim() : "";
    };
    const amtRaw = field("TRNAMT").replace(",", ".");
    const amount = parseFloat(amtRaw);
    const dt = field("DTPOSTED"); // YYYYMMDD[HHMMSS...]
    const desc = field("MEMO") || field("NAME");
    if (!isFinite(amount) || dt.length < 8) continue;
    out.push({
      date: `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`,
      description: desc || "Lançamento",
      amount,
    });
  }
  return out;
};

/* ------------------------------------------------------------------- CSV */

const BR_DATE = /^(\d{2})[/-](\d{2})[/-](\d{4})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

const parseDate = (raw: string): string | null => {
  const s = raw.trim();
  const br = s.match(BR_DATE);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = s.match(ISO_DATE);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
};

// "1.234,56", "-45,90", "R$ 12,00", "45.90" → number
const parseAmount = (raw: string): number | null => {
  let s = raw.replace(/[R$\s]/g, "").trim();
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
};

const splitCSVLine = (line: string, sep: string): string[] => {
  const out: string[] = [];
  let cur = "", inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === sep && !inQuotes) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
};

/**
 * CSV flexível: detecta separador (; ou ,) e acha as colunas pelo header
 * (data/valor/descrição em qualquer ordem — cobre Nubank, Inter, BB etc.).
 */
export const parseCSV = (text: string): ParsedTx[] => {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = (lines[0].match(/;/g)?.length ?? 0) >= (lines[0].match(/,/g)?.length ?? 0) ? ";" : ",";

  const header = splitCSVLine(lines[0], sep).map((h) =>
    h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
  );
  const findCol = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.includes(n)));

  const dateCol = findCol("data", "date", "dia");
  const amountCol = findCol("valor", "amount", "montante", "quantia");
  const descCol = findCol("descri", "histor", "title", "titulo", "lancamento", "estabelecimento", "memo", "identifica");
  if (dateCol < 0 || amountCol < 0) return [];

  const out: ParsedTx[] = [];
  for (const line of lines.slice(1)) {
    const cols = splitCSVLine(line, sep);
    const date = parseDate(cols[dateCol] ?? "");
    const amount = parseAmount(cols[amountCol] ?? "");
    if (!date || amount === null || amount === 0) continue;
    out.push({
      date,
      description: (descCol >= 0 ? cols[descCol] : "") || "Lançamento",
      amount,
    });
  }
  return out;
};

/** Detecta o formato pelo conteúdo e parseia. */
export const parseExtrato = (text: string): ParsedTx[] =>
  /<OFX|<STMTTRN>/i.test(text) ? parseOFX(text) : parseCSV(text);

/* -------------------------------------------------------- categorização */

// Estabelecimentos/termos BR → categoria do app. Ordem importa: o primeiro
// match ganha (termos mais específicos antes dos genéricos).
const BUILTIN_RULES: Array<[RegExp, string]> = [
  [/ifood|rappi|aiqfome|ze delivery|zedelivery/i, "delivery"],
  [/uber\s?(trip|br|\*)?(?!\s?eats)|99\s?(app|pop|tecnologia)|cabify|buser/i, "transporte"],
  [/uber\s?eats/i, "delivery"],
  [/posto|ipiranga|petrobras|br mania|shell|ale\b/i, "combustivel"],
  [/supermerc|mercado|carrefour|assai|atacad|extra\b|pao de acucar|bompreco|zaffari|big\b/i, "mercado"],
  [/padaria|panificad|acougue|hortifruti|sacolao|quitanda/i, "alimentacao"],
  [/farmacia|drogaria|drogasil|pague menos|panvel|raia\b|ultrafarma/i, "farmacia"],
  [/netflix|spotify|prime|disney|hbo|max\b|deezer|youtube|globoplay|crunchyroll|icloud|apple\.com|google (one|storage)/i, "assinaturas" ],
  [/academia|smart\s?fit|smartfit|bluefit|selfit|gympass|wellhub|crossfit/i, "academia"],
  [/restaurante|burguer|burger|mc\s?donald|bk\b|subway|pizza|sushi|churrascaria|outback|spoleto|habibs|giraffas|coco bambu/i, "restaurante"],
  [/shopee|shein|renner|riachuelo|c&a|cea\b|zara|hering|centauro|netshoes|nike|adidas/i, "vestuario"],
  [/petz|cobasi|petshop|pet shop|veterinari/i, "pets"],
  [/cinema|cinemark|ingresso|teatro|show|steam|playstation|xbox|nintendo/i, "lazer"],
  [/enel|light\b|cemig|copel|celpe|coelba|energia|eletropaulo|equatorial|sabesp|caesb|embasa|sanepar|comgas/i, "casa"],
  [/vivo|claro|tim\b|oi\b|net\b|internet|telefon/i, "servicos"],
  [/aluguel|imobiliaria|condominio/i, "casa"],
  [/hospital|clinica|laborator|exame|consulta|dentista|psicolog/i, "saude"],
  [/faculdade|universidade|curso|escola|udemy|alura|colegio/i, "educacao"],
  [/hotel|hostel|airbnb|booking|latam|gol\b|azul\b|decolar|123milhas/i, "viagem"],
  [/salao|barbearia|manicure|estetica|cabeleireir/i, "beleza"],
  [/amazon|magalu|magazine|americanas|casas bahia|mercado\s?livre|mercadolivre|aliexpress|kabum|fast shop/i, "eletronicos"],
];

const normalize = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Token "assinatura" do estabelecimento — a chave das regras aprendidas. */
export const ruleTokenOf = (description: string): string => {
  const cleaned = normalize(description)
    .replace(/^(compra|pagamento|pgto|pix|ted|doc|transferencia|debito|credito)\s+(no|em|para|de)?\s*/g, "")
    .replace(/[*\d]/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);
  return words.slice(0, 2).join(" ") || cleaned.slice(0, 12) || "desconhecido";
};

/** Categoria sugerida: regra aprendida do usuário > dicionário embutido > outros. */
export const suggestCategory = (description: string, learned: Record<string, string>): string => {
  const token = ruleTokenOf(description);
  if (learned[token]) return learned[token];
  for (const [rx, cat] of BUILTIN_RULES) {
    if (rx.test(normalize(description))) return cat;
  }
  return "outros";
};

/** Pix no texto → pix; senão débito (extrato de conta é débito por natureza). */
export const suggestPaymentMethod = (description: string): string =>
  /pix/i.test(description) ? "pix" : "debito";
