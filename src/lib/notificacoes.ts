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
/** Magenta da marca: é a cor que o Android pinta atrás da silhueta. */
const COR_MARCA = "#D22D80";
/** Faixas de id reservadas por tipo — permitem limpar um tipo sem tocar nos outros. */
const BASE_CONTAS = 100000;
const BASE_RETRO = 200000;
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

/** Tudo o que está agendado — usado pela tela de ajustes e pelos testes. */
export async function listarAgendados(): Promise<
  { id: number; title: string; at?: string; tipo: "contas" | "retrospectiva" | "outro" }[]
> {
  const p = await plugin();
  if (!p) return [];
  const { LN } = p;
  try {
    const p = await LN.getPending();
    return (p.notifications ?? []).map((n) => ({
      id: n.id,
      title: n.title ?? "",
      at: (n.schedule as { at?: Date } | undefined)?.at?.toISOString?.(),
      tipo:
        n.id >= BASE_CONTAS && n.id < BASE_CONTAS + 10000 ? "contas" as const
        : n.id >= BASE_RETRO && n.id < BASE_RETRO + 10000 ? "retrospectiva" as const
        : "outro" as const,
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
