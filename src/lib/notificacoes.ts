import { isNativeShell } from "./native-shell";
import { trackEvent } from "./analytics";

/**
 * Notificações LOCAIS do app da loja (26/07).
 *
 * Locais, não push: a data de vencimento já está no aparelho, então avisar
 * não precisa de servidor, de Firebase nem de conexão. Push fica pra depois
 * (trial acabando, pagamento falhado) — aquilo sim precisa de servidor.
 *
 * Regras que valem pra todas:
 *  - UMA notificação por dia, agrupando o que vence junto. Três contas no
 *    mesmo dia viram um aviso, não três — quem recebe três desliga tudo.
 *  - id determinístico por data: reagendar SUBSTITUI em vez de duplicar.
 *  - nada é agendado pro passado, e nada além de 60 dias (o dado muda).
 */

const CANAL = "core-lembretes";
/** Silhueta em `res/drawable/ic_stat_core.xml`. Sem isto o Android desenha um "i" de sistema. */
const ICONE = "ic_stat_core";
/**
 * Grafite da marca — é a cor do disco que o Android pinta ATRÁS da silhueta.
 * Magenta aqui destoava: o "CORE" do ícone do app é grafite, o magenta é
 * acento de interface, não a assinatura.
 */
const COR_MARCA = "#1C1917";
/**
 * Faixas de id reservadas por tipo — permitem limpar um tipo sem tocar nos
 * outros, e são a ÚNICA marca que sobrevive dentro do sistema (o Android só
 * guarda o id, não sabe o que é "lembrete de treino").
 */
export type TipoDeLembrete = "contas" | "retrospectiva" | "rotina" | "treino" | "leitura" | "dieta" | "outro";

const BASES: Record<Exclude<TipoDeLembrete, "outro">, number> = {
  contas: 100000,
  retrospectiva: 200000,
  rotina: 300000,
  treino: 400000,
  leitura: 500000,
  dieta: 600000,
};
const BASE_CONTAS = BASES.contas;
const BASE_RETRO = BASES.retrospectiva;
const HORA_RETRO = 10; // 10h do dia 1º: o mês fechou, ninguém tem pressa

type Bill = { name?: string; paid?: boolean };
type DueDay = { day?: number; bills?: Bill[] };

/**
 * Acesso ao plugin — devolvido DENTRO DE UM OBJETO, e isso não é estilo.
 *
 * O plugin do Capacitor é um Proxy que transforma qualquer propriedade lida
 * numa chamada nativa. Retornar ele direto de uma função `async` faz o
 * JavaScript procurar `.then()` pra decidir se é uma promise — o proxy
 * "responde" que tem, o runtime chama, e o Android estoura com
 * `"LocalNotifications.then()" is not implemented`. A rejeição acontece no
 * `await plugin()`, ANTES de qualquer try/catch dos chamadores, então tudo
 * falhava em silêncio: nenhuma notificação era agendada e a tela de ajustes
 * ficava eternamente em "carregando". (Achado em 27/07 dirigindo o APK real
 * no emulador — no navegador nunca aparece, porque lá não há plugin nativo.)
 *
 * Embrulhar num objeto comum tira o proxy do caminho do `await`.
 */
type PluginLN = { LN: typeof import("@capacitor/local-notifications").LocalNotifications };

const plugin = async (): Promise<PluginLN | null> => {
  if (!isNativeShell()) return null;
  try {
    const mod = await import("@capacitor/local-notifications");
    return { LN: mod.LocalNotifications };
  } catch {
    return null;
  }
};

/**
 * Estado bruto da permissão. "prompt" (nunca perguntado) e "denied"
 * (bloqueado) são situações MUITO diferentes: da primeira dá pra sair com um
 * toque, da segunda só indo nas configurações do Android. Colapsar as duas em
 * um booleano faz a tela de ajustes acusar de "bloqueado" quem nunca foi nem
 * perguntado — que é justamente quem ainda dá pra converter.
 */
export type EstadoPermissao = "granted" | "denied" | "prompt" | "indisponivel";

export async function estadoPermissao(): Promise<EstadoPermissao> {
  const p = await plugin();
  if (!p) return "indisponivel";
  const { LN } = p;
  try {
    const d = (await LN.checkPermissions()).display;
    return d === "granted" ? "granted" : d === "denied" ? "denied" : "prompt";
  } catch {
    return "indisponivel";
  }
}

/** true se o usuário já autorizou notificações. Não pede nada. */
export async function temPermissao(): Promise<boolean> {
  return (await estadoPermissao()) === "granted";
}

/**
 * Pede permissão. Chamar SÓ depois de a pessoa criar algo que gera lembrete
 * (a 1ª conta, o 1º hábito) — no Android 13+ a recusa é definitiva, e pedir
 * na abertura é jogar a única chance fora.
 */
export async function pedirPermissao(): Promise<boolean> {
  const p = await plugin();
  if (!p) return false;
  const { LN } = p;
  try {
    const atual = await LN.checkPermissions();
    if (atual.display === "granted") return true;
    if (atual.display === "denied") return false; // não insiste: o sistema não mostra de novo
    return (await LN.requestPermissions()).display === "granted";
  } catch {
    return false;
  }
}

/** Canal do Android: sem ele a notificação sai sem som e sem controle próprio. */
async function garantirCanal(): Promise<void> {
  const p = await plugin();
  if (!p) return;
  const { LN } = p;
  try {
    await LN.createChannel({
      id: CANAL,
      name: "Lembretes do CORE",
      description: "Contas a vencer, hábitos e metas",
      importance: 4, // HIGH: aparece na tela, sem virar alarme
      visibility: 1,
    });
  } catch { /* canal já existe ou versão do Android não usa canais */ }
}

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Cancela só os agendamentos de UM tipo (uma faixa de id). É isso que deixa
 * a central desligar "contas" sem derrubar a retrospectiva junto.
 */
async function limparFaixa(base: number): Promise<void> {
  const p = await plugin();
  if (!p) return;
  const { LN } = p;
  try {
    const pendentes = await LN.getPending();
    const nossas = (pendentes.notifications ?? []).filter((n) => n.id >= base && n.id < base + 10000);
    if (nossas.length) await LN.cancel({ notifications: nossas.map((n) => ({ id: n.id })) });
  } catch { /* nada pendente */ }
}

/**
 * Reagenda os avisos de conta a vencer a partir do estado atual do módulo.
 * Idempotente: pode chamar a cada mudança que não duplica.
 *
 * Devolve quantos avisos ficaram agendados (0 = nada a avisar ou sem permissão).
 */
export async function agendarContas(
  dueDays: DueDay[] | null | undefined,
  opcoes?: { hora?: number; ligado?: boolean },
): Promise<number> {
  const p = await plugin();
  if (!p) return 0;
  const { LN } = p;
  if (!(await temPermissao())) return 0;
  await garantirCanal();
  await limparFaixa(BASE_CONTAS);
  if (opcoes?.ligado === false) return 0; // desligado na central: limpa e sai

  const horaAviso = Number.isInteger(opcoes?.hora) ? (opcoes!.hora as number) : 9;
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const avisos: { id: number; title: string; body: string; schedule: { at: Date } }[] = [];

  (dueDays ?? []).forEach((d) => {
    const dia = Number(d?.day);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return;
    const naoPagas = (Array.isArray(d?.bills) ? d.bills : []).filter((b) => b && !b.paid);
    if (!naoPagas.length) return;

    // avisa na VÉSPERA, na hora escolhida na central
    const vencimento = new Date(ano, mes, dia, horaAviso, 0, 0, 0);
    const quando = new Date(vencimento.getTime() - 24 * 3600e3);
    if (quando.getTime() <= agora.getTime()) return;             // já passou
    if (quando.getTime() - agora.getTime() > 60 * 24 * 3600e3) return; // longe demais

    const nomes = naoPagas.map((b) => b?.name).filter(Boolean) as string[];
    const n = nomes.length;
    // concordância de verdade: alerta de dinheiro é onde a pessoa mais repara
    const titulo = n === 1 ? "1 conta vence amanhã" : `${n} contas vencem amanhã`;
    const corpo = nomes.length
      ? `${nomes.slice(0, 3).join(", ")}${nomes.length > 3 ? ` e mais ${nomes.length - 3}` : ""} — dia ${doisDigitos(dia)}`
      : `Vencimento no dia ${doisDigitos(dia)}`;

    avisos.push({
      id: BASE_CONTAS + Number(`${doisDigitos(mes + 1)}${doisDigitos(dia)}`),
      title: titulo,
      body: corpo,
      schedule: { at: quando },
    });
  });

  if (!avisos.length) return 0;
  try {
    await LN.schedule({
      notifications: avisos.map((a) => ({
        ...a,
        channelId: CANAL,
        smallIcon: ICONE, iconColor: COR_MARCA,
        extra: { rota: "/financas" },
      })),
    });
    return avisos.length;
  } catch {
    return 0;
  }
}

/**
 * A retrospectiva do mês, todo dia 1º às 10h.
 *
 * Agenda os próximos 3 meses de uma vez: notificação local não se reagenda
 * sozinha, e o app pode passar semanas fechado. Três é o equilíbrio — cobre
 * uma ausência longa sem encher a fila do sistema de coisa que talvez mude.
 *
 * O texto NÃO promete número nenhum ("você guardou X"): quando ela dispara, o
 * app está fechado e ninguém sabe o que a pessoa registrou. Prometer um dado
 * que a tela pode não ter é como se queima a confiança numa notificação.
 */
export async function agendarRetrospectiva(ligado = true): Promise<number> {
  const p = await plugin();
  if (!p) return 0;
  const { LN } = p;
  if (!(await temPermissao())) return 0;
  await garantirCanal();
  await limparFaixa(BASE_RETRO);
  if (!ligado) return 0;

  const agora = new Date();
  const avisos: { id: number; title: string; body: string; schedule: { at: Date }; extra: { rota: string } }[] = [];

  for (let i = 1; i <= 3; i++) {
    const quando = new Date(agora.getFullYear(), agora.getMonth() + i, 1, HORA_RETRO, 0, 0, 0);
    if (quando.getTime() <= agora.getTime()) continue;
    // o mês que FECHOU é o anterior ao dia 1º que está disparando
    const fechado = new Date(quando.getFullYear(), quando.getMonth() - 1, 1);
    const nome = MESES_CURTOS[fechado.getMonth()];
    avisos.push({
      id: BASE_RETRO + Number(`${fechado.getFullYear() % 100}${doisDigitos(fechado.getMonth() + 1)}`),
      title: `Sua retrospectiva de ${nome} tá pronta 🎁`,
      body: "Seu mês em números — dá 30 segundos pra ver.",
      schedule: { at: quando },
      extra: { rota: `/retrospectiva?mes=${nome}` },
    });
  }

  if (!avisos.length) return 0;
  try {
    await LN.schedule({
      notifications: avisos.map((a) => ({ ...a, channelId: CANAL, smallIcon: ICONE, iconColor: COR_MARCA })),
    });
    return avisos.length;
  } catch {
    return 0;
  }
}

const MESES_CURTOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/* ------------------------------------------------ lembretes diários (fase 2)
 *
 * Rotina, treino, leitura e dieta. Todos DESLIGADOS por padrão — ver o porquê
 * em `prefs-notificacoes.ts`.
 *
 * A limitação que molda tudo aqui: notificação local não roda lógica na hora
 * de disparar. O texto é congelado no agendamento. Então:
 *
 *  1. HOJE é o único dia sobre o qual sabemos algo — só ele pode ser pulado
 *     ("já treinou hoje") ou ganhar texto específico ("faltam 40 páginas").
 *  2. Os dias seguintes levam texto neutro, verdadeiro em qualquer cenário.
 *     Um aviso que diz "você não fez" pra quem fez destrói a confiança na
 *     notificação inteira, e a pessoa desliga tudo.
 *  3. O reagendamento acontece a cada mudança de dado com o app aberto — e
 *     marcar hábito, registrar treino ou virar página SÓ acontece com o app
 *     aberto. Então o aviso de hoje some no instante em que deixa de valer.
 */

/** Quantos dias à frente cada série cobre. 10 dias sobrevive a uma semana sem abrir o app. */
const HORIZONTE_DIAS = 10;

const DIAS_SEMANA = ["SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO", "DOMINGO"];
/** Índice 0=segunda, como o resto do app usa (JS conta domingo=0). */
const indiceSemana = (d: Date) => (d.getDay() === 0 ? 6 : d.getDay() - 1);

type Planejado = { quando: Date; title: string; body: string };

/** Agenda uma série já pronta na faixa do tipo, substituindo a anterior. */
async function agendarSerie(tipo: Exclude<TipoDeLembrete, "outro">, rota: string, avisos: Planejado[]): Promise<number> {
  const p = await plugin();
  if (!p) return 0;
  const { LN } = p;
  if (!(await temPermissao())) return 0;
  await garantirCanal();
  await limparFaixa(BASES[tipo]);
  if (!avisos.length) return 0;

  try {
    await LN.schedule({
      notifications: avisos.map((a) => ({
        id: BASES[tipo] + Number(`${doisDigitos(a.quando.getMonth() + 1)}${doisDigitos(a.quando.getDate())}`),
        title: a.title,
        body: a.body,
        schedule: { at: a.quando },
        channelId: CANAL,
        smallIcon: ICONE,
        iconColor: COR_MARCA,
        extra: { rota },
      })),
    });
    return avisos.length;
  } catch {
    return 0;
  }
}

/** Os próximos N dias em que a notificação ainda cabe no futuro, na hora dada. */
function proximosDias(hora: number, dias = HORIZONTE_DIAS): Date[] {
  const agora = new Date();
  const out: Date[] = [];
  for (let i = 0; i <= dias; i++) {
    const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + i, hora, 0, 0, 0);
    if (d.getTime() > agora.getTime()) out.push(d);
  }
  return out;
}

const localDia = (d: Date) =>
  `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`;

/**
 * ROTINA — o fechamento do dia.
 *
 * É o lembrete mais forte do app: a sequência é o que faz voltar. Mas só o
 * dia de HOJE pode citar a sequência, porque só dele sabemos que ainda está
 * de pé. Se hoje já foi marcado, o aviso de hoje simplesmente não existe.
 */
export async function agendarRotina(
  dados: { marcados: Set<string>; sequencia: number },
  opcoes: { hora: number; ligado: boolean },
): Promise<number> {
  if (!opcoes.ligado) { await limparFaixa(BASES.rotina); return 0; }
  const hoje = localDia(new Date());
  const avisos = proximosDias(opcoes.hora)
    .filter((d) => !(localDia(d) === hoje && dados.marcados.has(hoje)))
    .map((d, i) => {
      const ehHoje = localDia(d) === hoje;
      if (ehHoje && dados.sequencia >= 3) {
        return {
          quando: d,
          title: `${dados.sequencia} dias seguidos 🔥`,
          body: "Não deixa quebrar hoje — marca o que você fez.",
        };
      }
      return {
        quando: d,
        title: i === 0 && ehHoje ? "Bora fechar o dia?" : "Como foi seu dia?",
        body: "Marca os hábitos que você cumpriu na sua rotina.",
      };
    });
  return agendarSerie("rotina", "/rotina", avisos);
}

/**
 * TREINO — só nos dias que a pessoa marcou como dia de treino.
 *
 * Um lembrete de treino todo dia é ruído; nos dias certos é serviço. O grupo
 * muscular entra no texto porque é a informação que a pessoa iria abrir o app
 * pra ver de qualquer jeito.
 */
export async function agendarTreino(
  dados: { diasAtivos: string[]; musculosPorDia: Record<string, string[]>; diasComPlano: Set<string>; jaTreinouHoje: boolean },
  opcoes: { hora: number; ligado: boolean },
): Promise<number> {
  if (!opcoes.ligado) { await limparFaixa(BASES.treino); return 0; }
  const hoje = localDia(new Date());
  const avisos = proximosDias(opcoes.hora)
    .filter((d) => dados.diasAtivos.includes(DIAS_SEMANA[indiceSemana(d)]))
    // Dia marcado como ativo mas SEM nada montado é descanso na prática —
    // muita gente deixa os 7 dias ligados e configura 5. Avisar "hoje é dia
    // de treino" num sábado vazio é o tipo de aviso que faz desligar tudo.
    .filter((d) => dados.diasComPlano.has(DIAS_SEMANA[indiceSemana(d)]))
    .filter((d) => !(localDia(d) === hoje && dados.jaTreinouHoje))
    .map((d) => {
      const musculos = dados.musculosPorDia[DIAS_SEMANA[indiceSemana(d)]] ?? [];
      return {
        quando: d,
        title: musculos.length ? `Hoje é dia de ${musculos.slice(0, 2).join(" e ").toLowerCase()}` : "Hoje é dia de treino",
        body: "Seu treino já tá montado no CORE. É só seguir.",
      };
    });
  return agendarSerie("treino", "/treino", avisos);
}

/**
 * LEITURA — 3× por semana, e só se existe livro em andamento.
 *
 * Diário seria demais pra um hábito que ninguém pratica todo dia. As páginas
 * que faltam entram no texto: "faltam 40 páginas" move muito mais que
 * "continue lendo", porque transforma o resto do livro num número pequeno.
 */
export async function agendarLeitura(
  dados: { titulo: string; faltam: number } | null,
  opcoes: { hora: number; ligado: boolean },
): Promise<number> {
  if (!opcoes.ligado || !dados) { await limparFaixa(BASES.leitura); return 0; }
  const DIAS_DE_LEITURA = [0, 2, 4]; // segunda, quarta, sexta
  const avisos = proximosDias(opcoes.hora, 14)
    .filter((d) => DIAS_DE_LEITURA.includes(indiceSemana(d)))
    .map((d) => ({
      quando: d,
      title: dados.faltam > 0 ? `Faltam ${dados.faltam} páginas` : "Seu livro tá esperando",
      body: `${dados.titulo} — 10 minutos hoje já andam bem.`,
    }));
  return agendarSerie("leitura", "/biblioteca", avisos);
}

/** DIETA — fechar o diário do dia. Pula hoje se já foi preenchido. */
export async function agendarDieta(
  dados: { jaPreencheuHoje: boolean },
  opcoes: { hora: number; ligado: boolean },
): Promise<number> {
  if (!opcoes.ligado) { await limparFaixa(BASES.dieta); return 0; }
  const hoje = localDia(new Date());
  const avisos = proximosDias(opcoes.hora)
    .filter((d) => !(localDia(d) === hoje && dados.jaPreencheuHoje))
    .map((d) => ({
      quando: d,
      title: "Como foi a dieta hoje?",
      body: "Leva 20 segundos pra fechar o diário.",
    }));
  return agendarSerie("dieta", "/dieta", avisos);
}

/** De qual lembrete é este id — a faixa é a única marca que sobrevive no sistema. */
const tipoDoId = (id: number): TipoDeLembrete => {
  const achado = (Object.keys(BASES) as TipoDeLembrete[]).find(
    (t) => id >= BASES[t] && id < BASES[t] + 10000,
  );
  return achado ?? "outro";
};

/** Tudo o que está agendado — usado pela tela de ajustes e pelos testes. */
export async function listarAgendados(): Promise<
  { id: number; title: string; at?: string; tipo: TipoDeLembrete }[]
> {
  const p = await plugin();
  if (!p) return [];
  const { LN } = p;
  try {
    const pendentes = await LN.getPending();
    return (pendentes.notifications ?? []).map((n) => ({
      id: n.id,
      title: n.title ?? "",
      at: (n.schedule as { at?: Date } | undefined)?.at?.toISOString?.(),
      tipo: tipoDoId(n.id),
    }));
  } catch {
    return [];
  }
}

/** Desliga tudo — usado quando a pessoa recusa ou desativa nos ajustes. */
export async function cancelarTudo(): Promise<void> {
  const p = await plugin();
  if (!p) return;
  const { LN } = p;
  try {
    const p = await LN.getPending();
    if (p.notifications?.length) {
      await LN.cancel({ notifications: p.notifications.map((n) => ({ id: n.id })) });
    }
  } catch { /* nada pendente */ }
}

/** Abre o módulo certo quando a pessoa toca no aviso. */
export async function ligarToqueNaNotificacao(navegar: (rota: string) => void): Promise<() => void> {
  const p = await plugin();
  if (!p) return () => {};
  const { LN } = p;
  try {
    const ouvinte = await LN.addListener("localNotificationActionPerformed", (evento) => {
      const rota = (evento.notification?.extra as { rota?: string } | undefined)?.rota;
      // 02/09: até aqui o toque não deixava rastro — impossível saber se
      // alguma notificação trazia alguém de volta.
      const id = evento.notification?.id ?? null;
      trackEvent("notif_toque", { id, rota: rota ?? null });
      // 04/09: tocou na de 2h → a da manhã seguinte não precisa mais existir
      if (id === BASE_RESGATE + 1) { void LN.cancel({ notifications: [{ id: BASE_RESGATE + 2 }] }).catch(() => { /* noop */ }); }
      if (rota) navegar(rota);
    });
    // Revisão 02/09: quem registra tem que poder REMOVER — o App.tsx
    // reinstalava o ouvinte a cada navegação e o toque navegava (e agora
    // contava) N vezes.
    return () => { void ouvinte.remove(); };
  } catch { return () => {}; /* sem listener, o toque só abre o app */ }
}

/* ------------------------------------------------------ resgate do paywall */

const BASE_RESGATE = 700000;

/**
 * RESGATE DE QUEM ABANDONOU O PAYWALL (14/08).
 *
 * Todo dia ~120 pessoas veem a oferta no app e saem sem comprar — e não
 * recebem MAIS NADA: o cadastro é pós-compra, então não há e-mail. Mas há
 * algo melhor que e-mail: o app instalado. Estas duas notificações locais
 * (2h e 24h depois) são o único canal de volta que existe.
 *
 * Regras:
 *  - SÓ agenda se a permissão JÁ foi dada. Pedir permissão na cara do
 *    paywall trocaria conversão por notificação — nunca.
 *  - Reentrar no paywall REAGENDA (limparFaixa primeiro): a régua conta a
 *    partir da última vez que a pessoa viu a oferta.
 *  - Quem paga tem tudo cancelado na hora (PaywallFlow chama o cancelar nos
 *    dois desfechos de compra) — notificação de venda depois de vender é o
 *    jeito mais rápido de virar spam.
 *  - Copy sem pressão falsa: preço real, garantia real, zero "última chance".
 */
/**
 * A 2ª notificação cai na PRÓXIMA MANHÃ (09:30), não "24h depois" (04/09).
 * Medido: 26% dos abandonos do paywall são entre 21h e 5h, então "+24h"
 * caía de madrugada; o retorno espontâneo pica às 10h e 22 das 26 compras
 * na volta são entre 8h e 16h. Se a próxima 09:30 estiver a menos de 12h,
 * vai pra manhã seguinte (a de 2h já cobre o curto prazo).
 */
export function proximaManha(agora: Date): Date {
  const alvo = new Date(agora);
  alvo.setHours(9, 30, 0, 0);
  while (alvo.getTime() - agora.getTime() < 12 * 3600_000) alvo.setDate(alvo.getDate() + 1);
  return alvo;
}

/**
 * Copy da régua (04/09): NUNCA abre com preço — a versão com "R$ 97,90 uma
 * vez só" disparou pra 148 pessoas e rendeu 0 toques em pagar. E é segmentada:
 * quem TOCOU em pagar e não fechou (compra 1,6% na volta) recebe "reservado";
 * quem só viu (0,17%) recebe "ficou salvo".
 */
export function copyDoResgate(nomeArea: string | null | undefined, tocou: boolean, plano?: "vitalicio" | "mensal") {
  const daArea = nomeArea ? ` de ${nomeArea}` : "";
  const oPlano = plano === "mensal" ? "Seu mês de CORE" : "Seu CORE vitalício";
  return {
    agora: tocou
      ? { title: `${oPlano} ficou reservado`, body: `Seu plano${daArea} está montado te esperando. É um toque pra abrir de novo.` }
      : { title: `Seu plano${daArea} ficou salvo`, body: "Tudo que você montou continua aqui. É só abrir e continuar de onde parou." },
    manha: tocou
      ? { title: "Ainda dá tempo de começar hoje", body: `${oPlano} continua reservado, do jeito que você deixou.` }
      : { title: "Ainda dá tempo de começar hoje", body: `Seu plano${daArea} te espera do jeito que você deixou.` },
  };
}

export async function agendarResgateDoPlano(
  nomeArea?: string | null,
  opts: { area?: string | null; tocou?: boolean; plano?: "vitalicio" | "mensal" } = {},
): Promise<void> {
  const p = await plugin();
  if (!p) return;
  if (!(await temPermissao())) return;
  await garantirCanal();
  await limparFaixa(BASE_RESGATE);
  const { LN } = p;
  const tocou = opts.tocou === true;
  const copy = copyDoResgate(nomeArea, tocou, opts.plano);
  const agora = new Date();
  const avisos = [
    { id: BASE_RESGATE + 1, at: new Date(agora.getTime() + 2 * 3600_000), ...copy.agora },
    { id: BASE_RESGATE + 2, at: proximaManha(agora), ...copy.manha },
  ];
  // 04/09: até aqui "quantas foram armadas" era estimativa — agora é evento.
  trackEvent("notif_resgate_armada", { area: opts.area ?? null, tocou, plano: opts.plano ?? null, manha_em_h: Math.round((avisos[1].at.getTime() - agora.getTime()) / 3600e3) });
  try {
    await LN.schedule({
      notifications: avisos.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        schedule: { at: a.at, allowWhileIdle: true },
        channelId: CANAL,
        smallIcon: ICONE,
        iconColor: COR_MARCA,
        extra: { rota: "/app?step=offer" },
      })),
    });
  } catch { /* agendar aviso nunca pode quebrar o paywall */ }
}

export async function cancelarResgateDoPlano(): Promise<void> {
  await limparFaixa(BASE_RESGATE);
}

/* ------------------------------------------------------- régua do teste 3d */

const BASE_TESTE = 800000;

/**
 * RÉGUA DO TESTE GRÁTIS (16/08) — as três notificações que sustentam os 3
 * dias e fazem o paywall do D3 chegar em gente quente, não esquecida:
 *
 *   D1 (+20h) — cumpre a promessa da tela de notificações do funil: o
 *      primeiro lembrete é DA ÁREA que a pessoa escolheu, não genérico.
 *   D2 (+44h) — honestidade que protege a nota na loja: "amanhã fecha".
 *      Cobrança-surpresa é a mãe da avaliação 1 estrela (as nossas duas
 *      3★ vieram de surpresa/frustração).
 *   D3 (+68h) — a decisão, com o endowment na frente: o que ela construiu
 *      fica se ela ficar.
 *
 * Toque → /app?step=offer&d3=1 (o paywall do dia 3 com recap).
 * Compra cancela a faixa inteira (junto do resgate).
 */
const COPY_TESTE: Record<string, { d1t: string; d1b: string }> = {
  dinheiro: { d1t: "Suas contas estão no radar 👀", d1b: "A conta que você registrou já tem lembrete. Que tal anotar o gasto de hoje? Leva 10 segundos." },
  rotina: { d1t: "Dia 1 do seu hábito", d1b: "Marca o de hoje e a sequência começa — é ela que segura você no dia fraco." },
  corpo: { d1t: "Treino e dieta te esperando", d1b: "Registra o de hoje — dia 1 é o que separa essa tentativa das outras." },
  saude: { d1t: "Seu cuidado de hoje", d1b: "Água, sono, vitamina — marca o que você já fez hoje. 10 segundos." },
  metas: { d1t: "Sua meta saiu do papel ontem", d1b: "Dá o primeiro passo de hoje — progresso visível é o que mantém ela viva." },
};

/** Horário preferido da T3 do funil ("que horário funciona melhor?") →
 *  hora local do dia. A pergunta nunca é decorativa: o D1 e o D2 caem NESSE
 *  horário, não num offset cego. */
const HORA_PREFERIDA: Record<string, number> = { manha: 8.5, almoco: 12.5, noite: 19.5 };

/**
 * Pra onde o TOQUE de cada dia leva (corrigido 16/08). O D1 diz "anota o
 * gasto de hoje" e o D2 diz "olha o que você montou" — até hoje os dois
 * abriam o PAYWALL (/app?step=offer&d3=1): a notificação prometia uso e
 * entregava cobrança, a receita exata da avaliação 1★. Agora D1 e D2 abrem
 * o MÓDULO da área (onde a faixa da trilha continua o trabalho); só o D3,
 * que é o aviso da decisão, abre a oferta.
 */
const ROTA_DA_AREA: Record<string, string> = {
  dinheiro: "/financas",
  rotina: "/rotina",
  corpo: "/treino",
  saude: "/saude",
  metas: "/desenvolvimento",
};

export async function agendarReguaDoTeste(area: string | null, inicioMs: number, preferencia?: string | null): Promise<void> {
  const p = await plugin();
  if (!p) return;
  if (!(await temPermissao())) return;
  await garantirCanal();
  await limparFaixa(BASE_TESTE);
  const { LN } = p;
  const c = COPY_TESTE[area ?? ""] ?? COPY_TESTE.rotina;
  // D1 no horário que a pessoa escolheu (primeira ocorrência ≥ +16h do
  // início), D2 = D1 + 24h; sem preferência, offsets padrão (+20h/+44h).
  // D3 fica fixo em +68h: é o aviso da DECISÃO, tem que chegar antes do gate
  // fechar (+72h), não importa o gosto de horário.
  const hora = HORA_PREFERIDA[preferencia ?? ""];
  let d1 = inicioMs + 20 * 3600_000;
  if (hora != null) {
    const alvo = new Date(inicioMs + 16 * 3600_000);
    alvo.setHours(Math.floor(hora), Math.round((hora % 1) * 60), 0, 0);
    while (alvo.getTime() < inicioMs + 16 * 3600_000) alvo.setDate(alvo.getDate() + 1);
    d1 = alvo.getTime();
  }
  const d2 = hora != null ? d1 + 24 * 3600_000 : inicioMs + 44 * 3600_000;
  // D1/D2 abrem o MÓDULO (a trilha continua lá); só o D3 abre a decisão —
  // ver o comentário do ROTA_DA_AREA.
  const rotaModulo = ROTA_DA_AREA[area ?? ""] ?? "/home";
  // v53: copy de assinatura (24,90/mês · anual = R$ 13,32/mês) — preço real.
  const avisos = [
    { id: BASE_TESTE + 1, at: new Date(d1), title: c.d1t, body: c.d1b, rota: rotaModulo },
    { id: BASE_TESTE + 2, at: new Date(d2), title: "Amanhã seu teste fecha", body: "Olha o que você já montou no CORE. Se fizer sentido, a partir de R$ 13,32/mês no anual. Se não, sem drama.", rota: rotaModulo },
    { id: BASE_TESTE + 3, at: new Date(inicioMs + 68 * 3600_000), title: "Hoje é o dia de decidir", body: "Tudo que você construiu nos 3 dias fica salvo com a assinatura. A partir de R$ 13,32/mês.", rota: "/app?step=offer&d3=1" },
  ];
  try {
    await LN.schedule({
      notifications: avisos.map((a) => ({
        id: a.id, title: a.title, body: a.body,
        schedule: { at: a.at, allowWhileIdle: true },
        channelId: CANAL, smallIcon: ICONE, iconColor: COR_MARCA,
        extra: { rota: a.rota },
      })),
    });
  } catch { /* régua nunca derruba o funil */ }
}

export async function cancelarReguaDoTeste(): Promise<void> {
  await limparFaixa(BASE_TESTE);
}

/* ----------------------------------------------------- régua da MISSÃO
 * v61 (19/08): o trial do cartão tem 72h e o dado é brutal — 0 dos 8
 * cancelados voltaram depois do D0 (vs 55% dos ativos). Estes 2 toques
 * são a ponte do retorno: PROGRESSO + missão, nunca "seu trial acaba"
 * seco (RCD: progress email; Duolingo: cobrar quando há algo a proteger).
 * D1 abre o MÓDULO (não paywall — receita da avaliação 1★, ver
 * ROTA_DA_AREA). Push nosso = USO; aviso de cobrança é do Google. */
const BASE_MISSAO = 900000;

export async function agendarReguaDaMissao(area: string | null, nomeArea: string, preferencia?: string | null): Promise<void> {
  // INSTRUMENTADA (20/08): a régua morria MUDA sem permissão — 9 de 13
  // trials sem rastro de lembrete e ninguém sabia se a régua existia. Agora
  // cada desfecho vira evento, e sem permissão ela PEDE na hora (o B1 é o
  // momento de máxima boa vontade: a pessoa acabou de assinar). A volta do
  // D1 é o jogo inteiro: 0/8 cancelados voltaram.
  const p = await plugin();
  if (!p) { trackEvent("regua_missao_armada", { ok: false, motivo: "sem_plugin", area }); return; }
  let permitido = await temPermissao();
  if (!permitido) permitido = await pedirPermissao();
  if (!permitido) { trackEvent("regua_missao_armada", { ok: false, motivo: "sem_permissao", area }); return; }
  await garantirCanal();
  await limparFaixa(BASE_MISSAO);
  const { LN } = p;
  const inicioMs = Date.now();
  const rotaModulo = ROTA_DA_AREA[area ?? ""] ?? "/home";
  // Dia 2 na hora que a pessoa escolheu (primeira ocorrência ≥ +14h);
  // véspera da cobrança fixa em +52h ~ manhã do dia 3 (a cobrança é +72h).
  const hora = HORA_PREFERIDA[preferencia ?? ""] ?? 8.5;
  const alvo = new Date(inicioMs + 14 * 3600_000);
  alvo.setHours(Math.floor(hora), Math.round((hora % 1) * 60), 0, 0);
  while (alvo.getTime() < inicioMs + 14 * 3600_000) alvo.setDate(alvo.getDate() + 1);
  const avisos = [
    {
      id: BASE_MISSAO + 1, at: alvo,
      title: "Dia 2 da sua missão 🔥",
      body: `Ontem você começou ${nomeArea}. Fechar o dia de hoje leva 1 minuto.`,
      rota: rotaModulo,
    },
    // A VÉSPERA FOI REMOVIDA (22/08, ordem do dono após a raquel cancelar 4h
    // antes da cobrança guiada pelo aviso): nenhum concorrente (BitePal, Cal
    // AI) manda lembrete de cobrança — o Google já manda o e-mail obrigatório
    // dele. Nosso push é pra USO, não pra decisão de cobrança.
  ];
  try {
    await LN.schedule({
      notifications: avisos.map((a) => ({
        id: a.id, title: a.title, body: a.body,
        schedule: { at: a.at, allowWhileIdle: true },
        channelId: CANAL, smallIcon: ICONE, iconColor: COR_MARCA,
        extra: { rota: a.rota },
      })),
    });
    trackEvent("regua_missao_armada", { ok: true, area, preferencia: preferencia ?? "sem" });
  } catch (e) {
    // régua nunca derruba o app — mas o fracasso vira evento, não silêncio
    trackEvent("regua_missao_armada", { ok: false, motivo: "erro_agendar", area });
  }
}

export async function cancelarReguaDaMissao(): Promise<void> {
  await limparFaixa(BASE_MISSAO);
}
