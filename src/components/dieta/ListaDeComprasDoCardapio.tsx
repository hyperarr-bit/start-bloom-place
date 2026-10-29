import { ShoppingCart, Send, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { primeiraMaiuscula } from "@/components/dieta/cardapio";
import type { CategoriaMercado } from "@/lib/mercado";
import { comoListaAntigaDieta, gerarListaDoCardapio, moverListaAntigaDaDieta } from "@/lib/lista-e-cardapio-unicos";

/**
 * "GERAR LISTA DE COMPRAS" no Cardápio da Dieta (1.0.22, sem repetição). A lista de compras é UMA só — o Mercado da
 * Casa (`casa-grocery-categories`). Este botão separa os ingredientes do cardápio e manda pra lá. A lista antiga da
 * Dieta (`dieta-smart-list`, a aba 🛒 LISTA que saiu) continua aparecendo aqui embaixo até a pessoa mover ou limpar.
 */
export function ListaDeComprasDoCardapio({ descricoes }: { descricoes: string[] }) {
  const navigate = useNavigate();
  const [mercado, setMercado] = usePersistedState<CategoriaMercado[]>("casa-grocery-categories", []);
  const [antigaBruta, setAntiga] = usePersistedState<{ id: string; text: string; done: boolean }[]>("dieta-smart-list", []);
  const antiga = comoListaAntigaDieta(antigaBruta);
  const pendentes = antiga.filter((i) => !i.done);
  const comprados = antiga.filter((i) => i.done);
  const verNoMercado = { action: { label: "Ver", onClick: () => navigate("/casa?aba=mercado") } };

  const gerar = () => {
    if (descricoes.length === 0) { toast("O cardápio está vazio — preencha as refeições primeiro."); return; }
    const r = gerarListaDoCardapio(mercado, descricoes);
    if (r.novos === 0) { toast("A lista de compras da Casa já tem tudo do cardápio.", verNoMercado); return; }
    setMercado(r.lista);
    toast.success(r.novos === 1 ? "1 item entrou na lista de compras da Casa" : `${r.novos} itens entraram na lista de compras da Casa`, verNoMercado);
  };

  const moverAntiga = () => {
    const r = moverListaAntigaDaDieta(mercado, antiga);
    if (r.movidos === 0) return;
    if (r.novos > 0) setMercado(r.lista);
    setAntiga(r.restante);
    toast.success(r.novos > 0 ? `${r.novos} ${r.novos === 1 ? "item foi" : "itens foram"} pra lista de compras da Casa` : "Esses itens já estavam na lista da Casa", verNoMercado);
  };

  return (
    <div className="space-y-3" data-testid="lista-do-cardapio">
      <Button variant="outline" className="w-full h-10 text-xs gap-1.5" onClick={gerar} data-testid="gerar-lista-compras">
        <ShoppingCart className="w-4 h-4" /> Gerar lista de compras
      </Button>
      <p className="text-[10.5px] text-muted-foreground text-center -mt-1">Os ingredientes do cardápio vão pra lista de compras da Casa (Mercado).</p>

      {antiga.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-3 space-y-2" data-testid="lista-antiga-dieta">
          <p className="text-[10px] font-bold text-muted-foreground">DA SUA LISTA ANTIGA DA DIETA</p>
          <ul className="space-y-1">
            {pendentes.map((i) => <li key={i.id} className="text-xs">• {primeiraMaiuscula(i.text)}</li>)}
            {comprados.map((i) => <li key={i.id} className="text-xs line-through text-muted-foreground">• {primeiraMaiuscula(i.text)}</li>)}
          </ul>
          <div className="flex gap-2">
            {pendentes.length > 0 && (
              <Button size="sm" variant="outline" className="text-xs h-8 flex-1 gap-1" onClick={moverAntiga} data-testid="mover-lista-antiga-dieta">
                <Send className="w-3 h-3" /> Levar pra lista da Casa
              </Button>
            )}
            {comprados.length > 0 && (
              <Button size="sm" variant="outline" className="text-xs h-8 gap-1" onClick={() => setAntiga(antiga.filter((i) => !i.done))}>
                <Trash2 className="w-3 h-3" /> Limpar ✓
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
