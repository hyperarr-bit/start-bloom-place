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
/** Faixa de ids reservada às contas — permite limpar só elas. */
const BASE_CONTAS = 100000;
const HORA_AVISO = 9; // 9h: cedo o bastante pra dar tempo de pagar

type Bill = { name?: string; paid?: boolean };
type DueDay = { day?: number; bills?: Bill[] };

const plugin = async () => {
  if (!isNativeShell()) return null;
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    return LocalNotifications;
  } catch {
    return null;
  }
};

/** true se o usuário já autorizou notificações. Não pede nada. */
export async function temPermissao(): Promise<boolean> {
  const LN = await plugin();
  if (!LN) return false;
  try {
    return (await LN.checkPermissions()).display === "granted";
  } catch {
    return false;
  }
}

/**
 * Pede permissão. Chamar SÓ depois de a pessoa criar algo que gera lembrete
 * (a 1ª conta, o 1º hábito) — no Android 13+ a recusa é definitiva, e pedir
 * na abertura é jogar a única chance fora.
 */
export async function pedirPermissao(): Promise<boolean> {
  const LN = await plugin();
  if (!LN) return false;
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
  const LN = await plugin();
  if (!LN) return;
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
 * Reagenda os avisos de conta a vencer a partir do estado atual do módulo.
 * Idempotente: pode chamar a cada mudança que não duplica.
 *
 * Devolve quantos avisos ficaram agendados (0 = nada a avisar ou sem permissão).
 */
export async function agendarContas(dueDays: DueDay[] | null | undefined): Promise<number> {
  const LN = await plugin();
  if (!LN) return 0;
  if (!(await temPermissao())) return 0;
  await garantirCanal();

  // limpa só a faixa das contas — não encosta em outros lembretes
  try {
    const pendentes = await LN.getPending();
    const nossas = (pendentes.notifications ?? []).filter((n) => n.id >= BASE_CONTAS && n.id < BASE_CONTAS + 10000);
    if (nossas.length) await LN.cancel({ notifications: nossas.map((n) => ({ id: n.id })) });
  } catch { /* nada pendente */ }

  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = agora.getMonth();
  const avisos: { id: number; title: string; body: string; schedule: { at: Date } }[] = [];

  (dueDays ?? []).forEach((d) => {
    const dia = Number(d?.day);
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) return;
    const naoPagas = (Array.isArray(d?.bills) ? d.bills : []).filter((b) => b && !b.paid);
    if (!naoPagas.length) return;

    // avisa na VÉSPERA, às 9h
    const vencimento = new Date(ano, mes, dia, HORA_AVISO, 0, 0, 0);
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
        smallIcon: "ic_stat_icon_config_sample",
        extra: { rota: "/financas" },
      })),
    });
    return avisos.length;
  } catch {
    return 0;
  }
}

/** Tudo o que está agendado — usado pela tela de ajustes e pelos testes. */
export async function listarAgendados(): Promise<{ id: number; title: string; at?: string }[]> {
  const LN = await plugin();
  if (!LN) return [];
  try {
    const p = await LN.getPending();
    return (p.notifications ?? []).map((n) => ({
      id: n.id,
      title: n.title ?? "",
      at: (n.schedule as { at?: Date } | undefined)?.at?.toISOString?.(),
    }));
  } catch {
    return [];
  }
}

/** Desliga tudo — usado quando a pessoa recusa ou desativa nos ajustes. */
export async function cancelarTudo(): Promise<void> {
  const LN = await plugin();
  if (!LN) return;
  try {
    const p = await LN.getPending();
    if (p.notifications?.length) {
      await LN.cancel({ notifications: p.notifications.map((n) => ({ id: n.id })) });
    }
  } catch { /* nada pendente */ }
}

/** Abre o módulo certo quando a pessoa toca no aviso. */
export async function ligarToqueNaNotificacao(navegar: (rota: string) => void): Promise<void> {
  const LN = await plugin();
  if (!LN) return;
  try {
    await LN.addListener("localNotificationActionPerformed", (evento) => {
      const rota = (evento.notification?.extra as { rota?: string } | undefined)?.rota;
      if (rota) navegar(rota);
    });
  } catch { /* sem listener, o toque só abre o app */ }
}
