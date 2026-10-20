import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LayoutGrid, CircleUserRound } from "lucide-react";
import { MODULOS } from "@/lib/modulos";
import { useUserData } from "@/hooks/use-user-data";
import { isNativeShell } from "@/lib/native-shell";
import { navAbasLigada } from "@/lib/nav-abas";

/**
 * Trilho lateral do COMPUTADOR (11/09, "melhorar a experiência da web").
 *
 * No celular a Home é o hub: abre um módulo, "←" volta, abre outro. Com
 * mouse e tela larga isso é três cliques pra trocar de módulo, e sobra
 * espaço dos dois lados. A partir de 1024 px de largura, e só na web (no
 * app das lojas não existe tela dessa), um trilho fixo à esquerda lista a
 * Home e os módulos na ORDEM da pessoa (os ocultos ficam de fora, como na
 * grade da Home). O conteúdo desloca pra direita via a classe `com-trilho`
 * no <body> (ver index.css): barras fixas de rodapé (`.fixed.inset-x-0`)
 * também deslocam, pra não passar por baixo do trilho.
 *
 * Só aparece nas rotas de dentro do app (Home + 16 módulos). Funil, paywall,
 * admin e demonstração seguem como estão.
 */
const ROTAS_COM_TRILHO = new Set(["/home", ...MODULOS.map((m) => m.path)]);
/* 1.0.17 (barra de abas): no computador a barra de baixo não existe — o trilho faz o papel dela. Ganha as
   rotas das abas novas, "Hoje" no lugar de "Início", "Organizar" (a aba Módulos) e "Você" no pé (a conta
   saiu do avatar da Home). Com a chave desligada, o trilho de sempre. */
const ROTAS_DAS_ABAS = ["/modulos", "/voce", "/voce/aparencia"];
const LARGURA_MINIMA = "(min-width: 1024px)";

interface Prefs { hidden?: unknown; order?: unknown; favorites?: unknown }
const lista = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

export const TrilhoLateral = () => {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { get } = useUserData();
  const comAbas = navAbasLigada();
  const visivel = !isNativeShell() && (ROTAS_COM_TRILHO.has(pathname) || (comAbas && ROTAS_DAS_ABAS.includes(pathname)));

  // Leitura pura das preferências (sem o hook, que grava): o trilho nunca
  // escreve, então não pode disputar a chave com a grade da Home.
  const prefs = get<Prefs>("core-module-prefs", {});
  const modulos = useMemo(() => {
    const ocultos = new Set(lista(prefs.hidden));
    const ordem = lista(prefs.order);
    const favoritos = new Set(lista(prefs.favorites));
    const visiveis = MODULOS.filter((m) => !ocultos.has(m.id));
    if (ordem.length === 0) {
      return [...visiveis].sort((a, b) => Number(!favoritos.has(a.id)) - Number(!favoritos.has(b.id)));
    }
    const pos = new Map(ordem.map((id, i) => [id, i]));
    const conhecidos = visiveis.filter((m) => pos.has(m.id)).sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
    return [...conhecidos, ...visiveis.filter((m) => !pos.has(m.id))];
  }, [prefs.hidden, prefs.order, prefs.favorites]);

  // A classe no <body> segue o trilho: entra quando ele aparece, sai quando
  // a rota muda pra fora (funil, conta) — senão o funil ficaria deslocado.
  useEffect(() => {
    const mq = window.matchMedia?.(LARGURA_MINIMA);
    const aplicar = () => document.body.classList.toggle("com-trilho", visivel && !!mq?.matches);
    aplicar();
    mq?.addEventListener?.("change", aplicar);
    return () => { mq?.removeEventListener?.("change", aplicar); document.body.classList.remove("com-trilho"); };
  }, [visivel]);

  if (!visivel) return null;

  return (
    <aside
      data-testid="trilho-lateral"
      aria-label="Módulos"
      className="hidden lg:flex fixed inset-y-0 left-0 z-40 w-[232px] flex-col bg-card border-r border-border"
    >
      <button
        type="button"
        onClick={() => navigate("/home")}
        className="flex items-center gap-3 px-5 h-16 border-b border-border text-left hover:bg-muted/50 transition-colors"
      >
        <span className="text-lg font-black tracking-tight">CORE</span>
      </button>

      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        <button
          type="button"
          onClick={() => navigate("/home")}
          aria-current={pathname === "/home" ? "page" : undefined}
          className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/home" ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <LayoutGrid className="w-4 h-4" />
          </span>
          {comAbas ? "Hoje" : "Início"}
        </button>

        <div className="flex items-center justify-between px-2.5 pt-4 pb-1">
          <p className="text-[10px] font-bold tracking-[0.14em] uppercase text-muted-foreground">Módulos</p>
          {comAbas && (
            <button type="button" onClick={() => navigate("/modulos")} aria-current={pathname === "/modulos" ? "page" : undefined}
              className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">Organizar</button>
          )}
        </div>
        {modulos.map((m) => {
          const ativo = pathname === m.path;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(m.path)}
              aria-current={ativo ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
                ativo ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span className={`w-8 h-8 rounded-lg ${m.color} flex items-center justify-center`}>
                <m.Icon className="w-4 h-4" />
              </span>
              {m.label}
            </button>
          );
        })}
      </nav>

      {comAbas && (
        <button
          type="button"
          onClick={() => navigate("/voce")}
          aria-current={pathname.startsWith("/voce") ? "page" : undefined}
          data-testid="trilho-voce"
          className={`flex items-center gap-3 mx-3 mb-3 px-2.5 py-2 rounded-lg text-sm transition-colors ${
            pathname.startsWith("/voce") ? "bg-muted font-semibold" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          }`}
        >
          <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <CircleUserRound className="w-4 h-4" />
          </span>
          Você
        </button>
      )}
    </aside>
  );
};
