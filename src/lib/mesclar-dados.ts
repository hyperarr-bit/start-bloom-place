/**
 * JUNTAR O QUE FOI ESCRITO SEM O SERVIDOR COM O QUE ESTÁ NO SERVIDOR (16/10).
 *
 * Escrita feita antes de a conta chegar do servidor (abertura sem rede, rede piscando,
 * leitura demorada) foi montada em cima de uma BASE que não é o dado da pessoa — quase
 * sempre o vazio/padrão da tela. Mandar essa escrita como está sobrescreve a chave inteira
 * no servidor (user_data não tem versão: o histórico some de vez). Por isso o
 * use-user-data segura a escrita e, quando o servidor responde, junta em 3 vias:
 *
 *   base  → de onde a tela partiu (o que ela via quando escreveu; undefined = nada)
 *   local → o que a tela gravou
 *   servidor → o que a conta tem de verdade
 *
 * Regra: o que a pessoa ACRESCENTOU (item novo numa lista, chave nova num objeto) entra;
 * o que ela tirou/alterou em relação à base vale se o servidor ainda tem o mesmo que a
 * base; qualquer conflito (os dois mudaram o mesmo valor) fica com o SERVIDOR e marca
 * `perdeu` — melhor perder o toque de agora do que o histórico de meses.
 *
 * Item de lista é o mesmo quando tem o mesmo `id` (string/número); sem `id`, quando tem
 * o mesmo conteúdo.
 */

export type ResultadoDaMescla = { valor: unknown; perdeu: boolean };

const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

/** JSON com as chaves em ordem: o jsonb do Postgres devolve as chaves noutra ordem. */
const estavel = (v: unknown): string => {
  if (v === undefined) return "undefined";
  if (Array.isArray(v)) return `[${v.map(estavel).join(",")}]`;
  if (ehObjeto(v)) {
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${estavel(v[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "undefined";
};

export const iguais = (a: unknown, b: unknown): boolean => a === b || estavel(a) === estavel(b);

const idPorCampo = (item: unknown): string | null =>
  ehObjeto(item) && (typeof item.id === "string" || typeof item.id === "number") ? `id:${String(item.id)}` : null;

/** `id` repetido na mesma lista não serve de identidade — aí compara por conteúdo. */
const temIdRepetido = (lista: unknown[]): boolean => {
  const vistos = new Set<string>();
  for (const item of lista) {
    const id = idPorCampo(item);
    if (id === null) continue;
    if (vistos.has(id)) return true;
    vistos.add(id);
  }
  return false;
};

const mesclarListas = (base: unknown[], local: unknown[], servidor: unknown[]): ResultadoDaMescla => {
  const porConteudo = temIdRepetido(base) || temIdRepetido(local) || temIdRepetido(servidor);
  const idDe = (item: unknown) => (porConteudo ? null : idPorCampo(item)) ?? `v:${estavel(item)}`;
  const B = new Map(base.map((i) => [idDe(i), i] as const));
  const L = new Map(local.map((i) => [idDe(i), i] as const));
  const S = new Map(servidor.map((i) => [idDe(i), i] as const));
  let perdeu = false;
  const saida: unknown[] = [];

  for (const s of servidor) {
    const id = idDe(s);
    const naBase = B.has(id);
    const noLocal = L.has(id);
    if (naBase && !noLocal) {
      // a tela TIROU: sai se o servidor ainda tem o mesmo da base; se mudou lá, fica
      if (iguais(s, B.get(id))) continue;
      perdeu = true;
      saida.push(s);
      continue;
    }
    if (noLocal) {
      const l = L.get(id);
      const b = naBase ? B.get(id) : undefined;
      if (naBase && iguais(l, b)) { saida.push(s); continue; } // a tela não mexeu neste
      if (iguais(l, s) || (naBase && iguais(s, b))) { saida.push(l); continue; } // só a tela mexeu
      const r = mesclar3(b, l, s);
      perdeu = perdeu || r.perdeu;
      saida.push(r.valor);
      continue;
    }
    saida.push(s); // só o servidor tem
  }

  // alterado na tela, mas o servidor apagou: o servidor vence
  for (const [id, l] of L) {
    if (B.has(id) && !S.has(id) && !iguais(l, B.get(id))) perdeu = true;
  }

  // o que a tela acrescentou (nem na base nem no servidor) entra — no começo se a tela
  // pôs o novo na frente do que já existia, senão no fim
  const novos = local.filter((l) => { const id = idDe(l); return !B.has(id) && !S.has(id); });
  if (novos.length === 0) return { valor: saida, perdeu };
  const ehNovo = (l: unknown) => { const id = idDe(l); return !B.has(id) && !S.has(id); };
  const naFrente = local.length > novos.length && ehNovo(local[0]);
  return { valor: naFrente ? [...novos, ...saida] : [...saida, ...novos], perdeu };
};

const mesclarObjetos = (
  base: Record<string, unknown> | undefined,
  local: Record<string, unknown>,
  servidor: Record<string, unknown>,
): ResultadoDaMescla => {
  const b = base ?? {};
  const saida: Record<string, unknown> = { ...servidor };
  let perdeu = false;
  for (const k of new Set([...Object.keys(b), ...Object.keys(local)])) {
    const temLocal = k in local && local[k] !== undefined;
    const temBase = k in b && b[k] !== undefined;
    const temServidor = k in servidor && servidor[k] !== undefined;
    if (!temLocal) {
      if (!temBase) continue;
      // a tela APAGOU a chave: sai se o servidor ainda tem o mesmo da base
      if (!temServidor) continue;
      if (iguais(servidor[k], b[k])) delete saida[k];
      else perdeu = true;
      continue;
    }
    const r = mesclar3(temBase ? b[k] : undefined, local[k], temServidor ? servidor[k] : undefined);
    perdeu = perdeu || r.perdeu;
    if (r.valor === undefined) delete saida[k];
    else saida[k] = r.valor;
  }
  return { valor: saida, perdeu };
};

/** Junta em 3 vias. `servidor === undefined` = a chave não existe no servidor. */
export function mesclar3(base: unknown, local: unknown, servidor: unknown): ResultadoDaMescla {
  if (servidor === undefined || servidor === null) return { valor: local, perdeu: false };
  if (iguais(local, base) || iguais(local, servidor)) return { valor: servidor, perdeu: false };
  if (base !== undefined && iguais(servidor, base)) return { valor: local, perdeu: false };
  if (Array.isArray(local) && Array.isArray(servidor) && (base === undefined || base === null || Array.isArray(base))) {
    return mesclarListas(Array.isArray(base) ? base : [], local, servidor);
  }
  if (ehObjeto(local) && ehObjeto(servidor) && (base === undefined || base === null || ehObjeto(base))) {
    return mesclarObjetos(ehObjeto(base) ? base : undefined, local, servidor);
  }
  // valor simples (ou formato trocado) que os dois mudaram: fica o do servidor
  return { valor: servidor, perdeu: true };
}
