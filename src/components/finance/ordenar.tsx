/**
 * ORDENAR as listas de Finanças (08/10, chamado: "ordenar os gastos por data ou
 * por nome"). Só de EXIBIÇÃO: a lista gravada segue na ordem de lançamento — o
 * mesclarPerfil preserva a ordem completa e, em "Tudo junto", gravaria a ordem
 * nova por cima. A escolha fica guardada numa chave própria (é preferência de
 * tela, não dado); o app antigo das lojas nunca lê essas chaves.
 */

export type OrdemDosGastos = "lancamento" | "data" | "nome";
export const CHAVE_ORDEM_GASTOS = "finance-ordem-gastos";
export const ORDENS_DOS_GASTOS: { valor: OrdemDosGastos; rotulo: string; titulo: string }[] = [
  { valor: "lancamento", rotulo: "Lançamento", titulo: "Na ordem em que você lançou" },
  { valor: "data", rotulo: "Data", titulo: "Mais recente primeiro" },
  { valor: "nome", rotulo: "Nome", titulo: "De A a Z" },
];

export type OrdemDosFixos = "lancamento" | "dia" | "nome";
export const CHAVE_ORDEM_FIXOS = "finance-ordem-fixos";
export const ORDENS_DOS_FIXOS: { valor: OrdemDosFixos; rotulo: string; titulo: string }[] = [
  { valor: "lancamento", rotulo: "Lançamento", titulo: "Na ordem em que você lançou" },
  { valor: "dia", rotulo: "Dia", titulo: "Pelo dia do vencimento; sem dia, no fim" },
  { valor: "nome", rotulo: "Nome", titulo: "De A a Z" },
];

const porNome = (a: unknown, b: unknown) => String(a ?? "").localeCompare(String(b ?? ""), "pt-BR", { sensitivity: "base" });

/** Devolve uma lista nova, nunca mexe na gravada. Empate mantém a ordem de lançamento (sort é estável). */
export const ordenarGastos = <T extends { description: string; date: string }>(lista: T[], ordem: OrdemDosGastos): T[] => {
  if (ordem === "data") return [...lista].sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  if (ordem === "nome") return [...lista].sort((a, b) => porNome(a.description, b.description));
  return lista;
};

export const ordenarFixos = <T extends { description: string; day?: number }>(lista: T[], ordem: OrdemDosFixos): T[] => {
  if (ordem === "dia") return [...lista].sort((a, b) => (Number.isInteger(a.day) ? (a.day as number) : 99) - (Number.isInteger(b.day) ? (b.day as number) : 99));
  if (ordem === "nome") return [...lista].sort((a, b) => porNome(a.description, b.description));
  return lista;
};

/** As pílulas "Ordenar" — o mesmo desenho dos chips de filtro por conta (22/09). */
export function OrdenarChips<T extends string>({ valor, opcoes, onChange, testid }: {
  valor: T; opcoes: { valor: T; rotulo: string; titulo: string }[]; onChange: (v: T) => void; testid?: string;
}) {
  return (
    <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-1.5 flex-wrap" data-testid={testid}>
      <span className="text-[10px] text-muted-foreground mr-0.5">Ordenar</span>
      {opcoes.map((o) => (
        <button
          key={o.valor}
          type="button"
          onClick={() => onChange(o.valor)}
          aria-pressed={valor === o.valor}
          title={o.titulo}
          className={`h-6 px-2 rounded-full text-[10px] font-semibold border ${valor === o.valor ? "bg-foreground text-background border-foreground" : "bg-background text-muted-foreground border-border"}`}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}
