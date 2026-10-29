// SERVICE WORKER DO AVISO DE VENDA (29/10) — só do /vendas (escopo /vendas), só do dono.
// NÃO tem cache nem `fetch`: não intercepta pedido nenhum, nem do /vendas. Só faz duas coisas:
//   push              → mostra a notificação (title, body, icon, badge, tag, data.url)
//   notificationclick → abre/foca o /vendas
// O kill-switch da raiz (/sw.js) e a limpeza do src/main.tsx não mexem neste registro (src/vendas/escopo.ts).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { title: "💰 Venda", body: event.data ? event.data.text() : "" }; }
  const title = d.title || "💰 Venda";
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || "",
    icon: d.icon || "/icon-192.png",
    badge: d.badge || "/icon-192.png",
    tag: d.tag || undefined,
    data: { url: d.url || "/vendas" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const alvo = new URL((event.notification.data && event.notification.data.url) || "/vendas", self.location.origin);
  if (!alvo.pathname.startsWith("/vendas")) alvo.pathname = "/vendas";
  event.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of janelas) {
      if (new URL(c.url).pathname.startsWith("/vendas") && "focus" in c) { await c.focus(); return; }
    }
    await self.clients.openWindow(alvo.href);
  })());
});
