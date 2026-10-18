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
 * Item de lista é o mesmo quando tem o mesmo `id` (string/número); sem `id`, quando tem o
 * mesmo campo de VAGA ou de NOME (CAMPOS_NATURAIS, único nas três listas); senão, quando tem
 * o mesmo conteúdo.
 *
 * REGRA DO VAZIO. Chave ausente no servidor (undefined/null): vale o da tela. Valor simples
 * VAZIO no servidor ("", 0, false) com a tela tendo MUDADO o valor: vale o da tela também —
 * inclusive sem base (set direto, fora do usePersistedState). Não há histórico pra proteger, mas
 * há um custo aceito: daqui o vazio "nunca marcado" e o vazio gravado DE PROPÓSITO noutro
 * aparelho (ajuste desligado, contador zerado) são o mesmo valor — sem versão no servidor não dá
 * pra separar. Um ajuste ligado antes de a conta chegar vence o "desligado" de lá; o pior caso é
 * refazer 1 toque, nunca perder registro. A regra é só pra valor SIMPLES (no topo ou dentro de
 * objeto): lista/objeto vazio no servidor ([] / {}) passa pela junção normal, e contador montado
 * do vazio ({count: 1}) × servidor preenchido ({count: 57}) é conflito — fica o do servidor.
 * Se a tela não mudou nada em relação à base, o vazio do servidor vale (desmarcado lá).
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

/*
 * IDENTIDADE NATURAL (revisão 17/10). Lista de objetos SEM id comparada por conteúdo
 * duplicava a vaga quando a tela mudava o item: `finance-dueDays` é [{day, color, bills}] —
 * a conta posta no "Dia 5" padrão virava um 2º Dia 5 ao lado do Dia 5 do servidor, e o
 * calendário (setBillsForDay mapeia por dia) passava a gravar toda conta nova daquele dia
 * DUAS vezes; no treino (saude-workouts-v2.<DIA>.exercises) o "Supino" aparecia 2×.
 *
 * Quando TODOS os itens das três listas são objetos sem id com um destes campos simples
 * (texto/número) e ele é ÚNICO dentro de cada lista, o campo é a identidade:
 *   - vaga: day (dia do mês das contas), month (finance-annual, monthly-budgets),
 *     weekStart (histórico dos desafios);
 *   - nome: name/nome (exercício do plano, passo do skincare), label (categoria).
 * Data de REGISTRO ("date", "data", "dia") fica de fora de propósito: em histórico (treino-
 * exercise-history, exames, cuidados) dois registros no mesmo dia são dois registros —
 * fundir apagaria um. Campo repetido numa lista = não é identidade → volta pro conteúdo.
 *
 * name/nome/label NUNCA podem valer pra lista de HISTÓRICO sem id (registro de algo que
 * aconteceu: {name, date}, vacina, medição, sessão). Ali dois itens com o mesmo nome são DOIS
 * registros, e a trava do "repetido" não salva quando cada lista tem o nome uma vez só:
 * servidor [{name: "V10", date: "2025-10-01"}, {name: "Raiva", …}] × tela [{name: "V10",
 * date: "2026-10-17"}] → o V10 novo vira "o mesmo item" do antigo, a data entra em conflito,
 * fica a do servidor e o registro novo SOME (sobra só o aviso "Seus dados chegaram"). Por isso:
 * lista de histórico nasce com `id` (com id, o campo natural nem é olhado); campo novo aqui só
 * se for identidade de COISA (vaga, item de plano, categoria), nunca de registro — ex.: o
 * `exercise` do treino-exercise-history ({date, exercise, …}, histórico SEM id) não pode entrar.
 * (Varredura 17/10: as listas sem id com name/nome/label de hoje são todas de coisa — plano do
 * treino, passos do skincare, categorias, desafios do DP; os históricos sem id não têm esses campos.)
 */
const CAMPOS_NATURAIS = ["day", "month", "weekStart", "name", "nome", "label"] as const;

const campoNatural = (listas: unknown[][]): string | null => {
  if (!listas.some((l) => l.length > 0)) return null;
  for (const campo of CAMPOS_NATURAIS) {
    const serve = listas.every((lista) => {
      const vistos = new Set<string>();
      for (const item of lista) {
        if (!ehObjeto(item) || idPorCampo(item) !== null) return false;
        const v = item[campo];
        if (typeof v !== "string" && typeof v !== "number") return false;
        const chave = `${typeof v}:${v}`;
        if (vistos.has(chave)) return false;
        vistos.add(chave);
      }
      return true;
    });
    if (serve) return campo;
  }
  return null;
};

const mesclarListas = (base: unknown[], local: unknown[], servidor: unknown[]): ResultadoDaMescla => {
  const porConteudo = temIdRepetido(base) || temIdRepetido(local) || temIdRepetido(servidor);
  const natural = porConteudo ? null : campoNatural([base, local, servidor]);
  const idDe = (item: unknown) =>
    (porConteudo ? null : idPorCampo(item))
    ?? (natural && ehObjeto(item) ? `n:${natural}:${typeof item[natural]}:${String(item[natural])}` : null)
    ?? `v:${estavel(item)}`;
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
  // valor simples vazio no servidor ("" = não marcado, 0, false): não há o que proteger — e o
  // vazio de propósito noutro aparelho perde pro gesto daqui (ver REGRA DO VAZIO no topo)
  if (servidor === "" || servidor === 0 || servidor === false) return { valor: local, perdeu: false };
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
