import { isNativeShell } from "./native-shell";

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

    if (!jaConsumiuAbertura) {
      jaConsumiuAbertura = true;
      const inicial = await App.getLaunchUrl();
      const rotaInicial = rotaDoLink(inicial?.url);
      if (rotaInicial) navegar(rotaInicial);
    }

    const ouvinte = await App.addListener("appUrlOpen", (evento) => {
      const rota = rotaDoLink(evento?.url);
      if (rota) navegar(rota);
    });
    return () => { void ouvinte.remove(); };
  } catch {
    return () => {};
  }
}
