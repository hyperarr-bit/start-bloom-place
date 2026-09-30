import { isNativeShell } from "@/lib/native-shell";

/**
 * LEMBRETE SÓ EXISTE NO APP DA LOJA (30/09, integração de Pet, Relações e Beleza).
 *
 * O aviso é notificação LOCAL do celular (plugin do Capacitor): no site ele não
 * toca, e a própria central de Notificações nem abre fora do app. Então, na web,
 * nenhum módulo mostra interruptor de lembrete nem convite "Ligar" — seria botão
 * morto (a pessoa liga, acha que vai ser avisada e nada acontece).
 *
 * Na demo (/preview) também não: é dado de exemplo em memória, e ligar ali
 * agendaria aviso de verdade no celular com os pets/pessoas de mentira.
 *
 * Nada muda nas chaves: o que a pessoa ligou no app continua ligado (e é o app
 * que agenda). Todos nascem DESLIGADOS — nada agenda sozinho.
 */
export const avisosNoApp = (): boolean => {
  if (!isNativeShell()) return false;
  try {
    return !window.location.pathname.startsWith("/preview");
  } catch {
    return true;
  }
};
