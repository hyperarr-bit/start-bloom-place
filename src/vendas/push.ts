/**
 * Web Push do /vendas (29/10): instalado na Tela de Início? suporta push? ligar/desligar neste aparelho.
 * O SW é /vendas/sw.js com escopo /vendas (a Vercel manda Service-Worker-Allowed: /vendas). Se o servidor não mandar
 * o cabeçalho (vite local), cai pro escopo /vendas/ — que ainda recebe push.
 */
import { SW_VENDAS_ESCOPO, SW_VENDAS_URL } from "./escopo";

type NavIOS = Navigator & { standalone?: boolean };

export function estaInstalada(): boolean {
  try {
    if ((navigator as NavIOS).standalone === true) return true;
    return typeof matchMedia === "function" && matchMedia("(display-mode: standalone)").matches;
  } catch {
    return false;
  }
}

export function suportaPush(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function chaveParaBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function registroDoVendas(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration(SW_VENDAS_ESCOPO)) ?? (await navigator.serviceWorker.getRegistration(`${SW_VENDAS_ESCOPO}/`)) ?? null;
}

async function registrar(): Promise<ServiceWorkerRegistration> {
  let reg: ServiceWorkerRegistration;
  try {
    reg = await navigator.serviceWorker.register(SW_VENDAS_URL, { scope: SW_VENDAS_ESCOPO });
  } catch {
    reg = await navigator.serviceWorker.register(SW_VENDAS_URL, { scope: `${SW_VENDAS_ESCOPO}/` });
  }
  // .ready só resolve pro SW que controla ESTA página — aqui espera o próprio registro ficar ativo.
  if (!reg.active) {
    const sw = reg.installing ?? reg.waiting;
    if (sw) await new Promise<void>((ok) => { const f = () => { if (sw.state === "activated") { sw.removeEventListener("statechange", f); ok(); } }; sw.addEventListener("statechange", f); f(); });
  }
  return reg;
}

export async function inscricaoAtual(): Promise<PushSubscription | null> {
  try {
    const reg = await registroDoVendas();
    return reg ? await reg.pushManager.getSubscription() : null;
  } catch {
    return null;
  }
}

export type Inscricao = { endpoint: string; p256dh: string; auth: string };

/** Chamar DIRETO do toque no botão: o iOS só mostra o pedido de permissão dentro do gesto. */
export async function ligarAvisos(chavePublica: () => Promise<string | null>): Promise<Inscricao> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error(perm === "denied" ? "negado" : "sem_resposta");
  const chave = await chavePublica();
  if (!chave) throw new Error("sem_chave");
  const reg = await registrar();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveParaBytes(chave) }));
  const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) throw new Error("inscricao_incompleta");
  return { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth };
}

export async function desligarAvisos(): Promise<string | null> {
  const sub = await inscricaoAtual();
  if (!sub) return null;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => {});
  return endpoint;
}
