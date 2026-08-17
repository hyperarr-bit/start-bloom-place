import { isNativeShell } from "./native-shell";
import { ehRetornoDeLogin, fecharNavegador, sessaoDoLink } from "./auth-nativo";

/**
 * Deep links `core://` (27/07).
 *
 * Quem manda link pra cá hoje é o próprio aparelho: os atalhos do toque longo
 * no ícone e, no futuro, o widget. Por isso esquema próprio em vez de https —
 * App Link verificado exigiria hospedar assetlinks.json e provar o domínio,
 * trabalho que só se paga quando o link vier de fora (campanha, e-mail).
 *
 * DUAS ENTRADAS, e esquecer uma é o erro clássico:
 *  - app FECHADO: o link vem no `getLaunchUrl()`, uma vez, na abertura.
 *  - app EM SEGUNDO PLANO: o link vem no evento `appUrlOpen`. Só o listener
 *    não basta, porque no arranque frio o evento já passou antes do React
 *    montar; só o getLaunchUrl não basta, porque com o app aberto ele devolve
 *    o link ANTIGO da abertura original.
 */

/** Só o que existe de verdade — link torto não pode virar rota inventada. */
const ROTAS_VALIDAS = new Set([
  "financas", "rotina", "biblioteca", "treino", "dieta", "saude", "casa",
  "estudos", "beleza", "viagens", "carreira", "hiperfoco", "relacionamentos",
  "pet", "detox", "desenvolvimento", "conquistas", "retrospectiva",
  "notificacoes", "home", "planos",
]);

/**
 * Converte `core://financas?x=1` na rota interna `/financas?x=1`.
 * Devolve null pra qualquer coisa que não seja um destino conhecido.
 */
export function rotaDoLink(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== "core:") return null;
    // em `core://financas`, o "financas" vem no host, não no pathname
    const alvo = (u.hostname || u.pathname.replace(/^\/+/, "")).toLowerCase();
    if (!ROTAS_VALIDAS.has(alvo)) return null;
    return `/${alvo}${u.search}`;
  } catch {
    return null;
  }
}

/**
 * O link de abertura é de USO ÚNICO — e este flag é o que garante isso.
 *
 * `getLaunchUrl()` NÃO se esvazia: com o app já aberto ele continua devolvendo
 * o link que abriu o app da primeira vez. Bug real de 27/07: o atalho de
 * Finanças com o app em segundo plano navegava certo e voltava sozinho pra
 * Biblioteca um piscar depois — porque o efeito reexecutava, relia o
 * getLaunchUrl e obedecia ao link velho, atropelando o novo.
 */
let jaConsumiuAbertura = false;

/**
 * Liga as duas entradas. Devolve a função de desligar (pro cleanup do efeito).
 */
export async function ligarDeepLinks(navegar: (rota: string) => void): Promise<() => void> {
  if (!isNativeShell()) return () => {};
  try {
    // objeto embrulhado: o plugin do Capacitor é um Proxy e devolvê-lo direto
    // de uma função async faz o runtime chamar `.then()` nele — o mesmo bug
    // que quebrou as notificações inteiras (ver notificacoes.ts).
    const mod = await import("@capacitor/app");
    const App = mod.App;

    /* Nem todo core:// é atalho de módulo: o `core://auth` é a VOLTA DO LOGIN
       com Google (ver auth-nativo.ts). Ele não vira rota — ele vira sessão.
       Precisa ser testado ANTES da whitelist de rotas, senão cai como link
       desconhecido e o login morre em silêncio. */
    const tratar = async (url: string | null | undefined): Promise<boolean> => {
      if (ehRetornoDeLogin(url)) {
        const ok = await sessaoDoLink(url!);
        await fecharNavegador();
        /*
         * PRA ONDE volta quem logou com Google (04/08).
         *
         * Antes: sempre "/" — e o RootGate mandava a conta nova pro hub.
         * Quem se cadastrou com Google NO MEIO DO FUNIL nunca via o paywall:
         * entrava no app "de graça" e só topava com o gate de trial depois,
         * do nada ("o paywall aparece de novo em outra tela"). O funil já
         * marca funnel-oauth-pending antes de abrir o Google exatamente pra
         * isso — o handler da web usa; o do shell ignorava.
         */
        if (ok) {
          let voltaPro = "/";
          try {
            // 17/08: a flag passou a carregar o CAMINHO do funil (a web usa
            // pra voltar pro funil certo). No shell o destino continua o
            // mesmo de sempre — só a checagem vira "existe", não "=== true".
            if (localStorage.getItem("funnel-oauth-pending")) {
              localStorage.removeItem("funnel-oauth-pending");
              voltaPro = "/app?step=offer";
            }
          } catch { /* noop */ }
          navegar(voltaPro);
        }
        return true;
      }
      const rota = rotaDoLink(url);
      if (rota) { navegar(rota); return true; }
      return false;
    };

    if (!jaConsumiuAbertura) {
      jaConsumiuAbertura = true;
      const inicial = await App.getLaunchUrl();
      await tratar(inicial?.url);
    }

    const ouvinte = await App.addListener("appUrlOpen", (evento) => {
      void tratar(evento?.url);
    });
    return () => { void ouvinte.remove(); };
  } catch {
    return () => {};
  }
}
