/**
 * NADA SAI DO FUNIL-DEMO SEM QUERER (14/10, dono: "só mostra o que a pessoa tocar, e o que ela tocar funciona
 * na demo"). Os módulos de verdade navegam pra rotas do app (/home, /auth, /casa, /conquistas…) — sem conta,
 * isso cai no login ou numa tela vazia, fora do funil. Aqui dentro:
 *   · rota de um dos 5 módulos da demo (/financas, /rotina?aba=…) → troca de módulo NA demo (com a aba);
 *   · qualquer outra rota interna (login, outros módulos, conquistas, retrospectiva…) → a conta do funil;
 *   · /experimente (e /liberar, a demo que vende no site — 16/10), links externos (https de outro site, mailto, tel) e o voltar do navegador seguem como são.
 * Funciona trocando o `navigator` do React Router SÓ pra dentro da demo (todo useNavigate e <Link> passam por
 * ele) + um clique em captura pra <a href="/…"> solto.
 */
import { useContext, useMemo, type ReactNode } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { ehModuloDemo, type ModuloDemo } from "./conteudo";

export type Desvio = { tipo: "modulo"; modulo: ModuloDemo; aba: string | null } | { tipo: "conta"; destino: string } | null;

/** Pra onde um destino de dentro do módulo vai na demo (null = segue normal). */
export function desvioNaDemo(destino: string): Desvio {
  let u: URL;
  try { u = new URL(destino, "https://demo.local"); } catch { return null; }
  if (u.origin !== "https://demo.local") return null; // outro site: segue
  const caminho = u.pathname.replace(/\/+$/, "") || "/";
  if (caminho === "/experimente" || caminho === "/liberar") return null;
  const m = caminho.slice(1);
  if (ehModuloDemo(m)) return { tipo: "modulo", modulo: m, aba: u.searchParams.get("aba") };
  return { tipo: "conta", destino: `${caminho}${u.search}`.slice(0, 120) };
}

type Path = { pathname?: string; search?: string; hash?: string };
const textoDo = (to: string | Path): string =>
  typeof to === "string" ? to : `${to.pathname ?? ""}${to.search ?? ""}${to.hash ?? ""}`;

/**
 * `desviar` (28/10, landing nova /organizar/demo): quem passa decide sozinho (true = tratou, a navegação não acontece).
 * Sem ele, a regra dos 5 módulos acima com `aoDesviar` — o /experimente e o /liberar não mudam.
 */
export function NavegacaoDaDemo({ aoDesviar, desviar, children }: { aoDesviar?: (d: NonNullable<Desvio>) => void; desviar?: (destino: string) => boolean; children: ReactNode }) {
  const ctx = useContext(UNSAFE_NavigationContext);
  const valor = useMemo(() => {
    const nav = ctx.navigator;
    const desviou = (to: string | Path): boolean => {
      if (desviar) return desviar(textoDo(to));
      const d = desvioNaDemo(textoDo(to));
      if (!d) return false;
      aoDesviar?.(d);
      return true;
    };
    const navigator = {
      ...nav,
      createHref: nav.createHref.bind(nav),
      go: nav.go.bind(nav),
      push: (to: string | Path, state?: unknown, opts?: unknown) => { if (!desviou(to)) (nav.push as (...a: unknown[]) => void)(to, state, opts); },
      replace: (to: string | Path, state?: unknown, opts?: unknown) => { if (!desviou(to)) (nav.replace as (...a: unknown[]) => void)(to, state, opts); },
      ...(nav.encodeLocation ? { encodeLocation: nav.encodeLocation.bind(nav) } : {}),
    } as typeof nav;
    return { ...ctx, navigator };
  }, [ctx, aoDesviar, desviar]);

  /* <a href="/…"> que não é <Link> (navegação inteira da página) */
  const aoClicar = (e: React.MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const href = a.getAttribute("href") ?? "";
    if (!href.startsWith("/") || href.startsWith("//")) return;
    if (desviar) { if (desviar(href)) e.preventDefault(); return; }
    const d = desvioNaDemo(href);
    if (!d) return;
    e.preventDefault();
    aoDesviar?.(d);
  };

  return (
    <UNSAFE_NavigationContext.Provider value={valor}>
      <div onClickCapture={aoClicar}>{children}</div>
    </UNSAFE_NavigationContext.Provider>
  );
}
