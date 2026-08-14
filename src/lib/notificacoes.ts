import { isNativeShell } from "./native-shell";

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
export async function ligarToqueNaNotificacao(navegar: (rota: string) => void): Promise<void> {
  const p = await plugin();
  if (!p) return;
  const { LN } = p;
  try {
    await LN.addListener("localNotificationActionPerformed", (evento) => {
      const rota = (evento.notification?.extra as { rota?: string } | undefined)?.rota;
      if (rota) navegar(rota);
    });
  } catch { /* sem listener, o toque só abre o app */ }
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
export async function agendarResgateDoPlano(nomeArea?: string | null): Promise<void> {
  const p = await plugin();
  if (!p) return;
  if (!(await temPermissao())) return;
  await garantirCanal();
  await limparFaixa(BASE_RESGATE);
  const { LN } = p;
  const daArea = nomeArea ? ` de ${nomeArea}` : "";
  const avisos = [
    {
      id: BASE_RESGATE + 1,
      at: new Date(Date.now() + 2 * 3600_000),
      title: `Seu plano${daArea} ficou salvo`,
      body: "Tudo que você montou continua aqui. R$ 27,90 uma vez — garantia de 7 dias.",
    },
    {
      id: BASE_RESGATE + 2,
      at: new Date(Date.now() + 24 * 3600_000),
      title: "Ainda dá tempo de começar hoje",
      body: `Seu plano${daArea} te espera do jeito que você deixou. Pagamento único, acesso pra sempre.`,
    },
  ];
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
