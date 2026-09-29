/**
 * FICHA DO PASSO + ESCOLHER PRODUTO (28/09, protótipo). A folha de baixo do app,
 * com a faixa na cor do dia (a mesma das tarefas com horário):
 *  - DIAS: os 7 dias em quadrados na cor de cada dia — é a frequência do passo
 *    (o ácido ter/qui/sáb, o protetor todo dia);
 *  - PRODUTO: o da lista curada de produtos vendidos no Brasil (busca por nome
 *    ou marca) ou digitado à mão. Vai pra MEUS PRODUTOS com a validade depois de
 *    aberto (PAO); "Abri hoje" começa a contar;
 *  - Remover da rotina, com Desfazer.
 * Os "indicados" são os da lista que encaixam no passo (categoria/ativo), a pele
 * da pessoa primeiro e o que ela evita ("ingredientes a evitar") por último,
 * marcado. A URL de onde cada produto foi conferido fica no JSON e nunca aparece.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Check, PackageOpen, Pencil, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, localDayKey } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import {
  DIAS_CURTOS, ativoEvitado, buscarProdutos, carregarCatalogo, diasDoPasso, diasPorExtenso, ehTodoDia, indicadosPara, nomeCurto,
  ritmoDoPasso, textoDoPao, tipoPeloNome, type CategoriaDoCatalogo, type PassoDaRotina, type Periodo, type ProdutoDaBancada,
  type ProdutoDoCatalogo, type TipoDoPasso,
} from "@/lib/beleza-rotina";
import { COR_DO_DIA, DIAS_DA_SEMANA, textoDoDia, textoDoDiaEmBotao } from "@/components/treino/planner";
import { diaCurto } from "@/components/tarefas/tarefas-do-dia";
import { getExpiryProgress } from "./utils";
import { TOM_DO_PERIODO, nomeDoDia } from "./skincare-do-dia";
import type { Skincare } from "./use-skincare";

export type PassoAberto = { periodo: Periodo; i: number; vista: "ficha" | "escolher" };

const ROTULO = "text-[10.5px] font-extrabold tracking-[.12em] text-muted-foreground";
const FOLHA = "rounded-t-3xl p-0 gap-0 overflow-hidden max-h-[92dvh] flex flex-col";

/** Categoria da lista pra um produto digitado à mão (dá o PAO padrão). */
const CATEGORIA_DO_TIPO: Record<TipoDoPasso, CategoriaDoCatalogo> = {
  limpeza: "limpeza", hidratante: "hidratante", protetor: "protetor", "vitamina-c": "serum", niacinamida: "serum",
  hialuronico: "serum", "acido-salicilico": "acido", "acido-glicolico": "acido", retinol: "retinoide",
  olhos: "olhos", labios: "labios", mascara: "mascara", tonico: "tonico",
};

function FaixaDaFicha({ titulo, sub, onFechar, onVoltar }: { titulo: ReactNode; sub: ReactNode; onFechar: () => void; onVoltar?: () => void }) {
  const dia = nomeDoDia(localDayKey());
  return (
    <div className={cn(COR_DO_DIA[dia], textoDoDia(dia), "pl-2 pr-2 py-3 flex items-start gap-1")}>
      {onVoltar ? (
        <button type="button" onClick={onVoltar} aria-label="Voltar pra ficha" className="w-10 h-10 -mt-1.5 shrink-0 grid place-items-center rounded-full hover:bg-white/15">
          <ArrowLeft className="w-4 h-4" />
        </button>
      ) : (
        <span className="w-2 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <SheetTitle className="text-[15px] font-extrabold tracking-wide text-current leading-tight">{titulo}</SheetTitle>
        <SheetDescription className="text-[12.5px] text-current opacity-90 mt-0.5 truncate">{sub}</SheetDescription>
      </div>
      <button type="button" onClick={onFechar} aria-label="Fechar" className="w-10 h-10 -mt-1.5 shrink-0 grid place-items-center rounded-full hover:bg-white/15">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------ a ficha */

function CartaoDoProduto({ produto, onTrocar, onTirar, onAbrirHoje }: { produto: ProdutoDaBancada; onTrocar: () => void; onTirar: () => void; onAbrirHoje: () => void }) {
  const validade = produto.openedDate && produto.paoMonths ? getExpiryProgress(produto.openedDate, produto.paoMonths) : null;
  const ativos = Array.isArray(produto.ativos) ? produto.ativos : [];
  return (
    <div className="mt-1 rounded-xl border border-border overflow-hidden" data-testid="produto-na-ficha">
      <div className="px-3 py-2.5">
        {produto.brand && <p className="text-[10.5px] font-extrabold tracking-[.1em] text-muted-foreground uppercase truncate">{produto.brand}</p>}
        <p className="text-[15px] font-bold leading-snug break-words">{produto.name}</p>
        {ativos.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-1">
            {ativos.slice(0, 4).map((a) => (
              <span key={a} className="rounded px-1.5 py-px text-[10.5px] font-semibold bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-300">{a}</span>
            ))}
          </p>
        )}
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Validade depois de aberto: <b className="text-foreground/80">{textoDoPao(produto.paoMonths || 12, produto.paoPadrao)}</b>
        </p>
        {validade ? (
          <p className={cn("mt-0.5 text-[12px] font-semibold", validade.expired ? "text-red-600 dark:text-red-400" : validade.daysLeft < 30 ? "text-amber-700 dark:text-amber-300" : "text-green-700 dark:text-green-300")}>
            {validade.expired ? "⚠️ Venceu — hora de repor" : `Aberto em ${diaCurto(produto.openedDate)} · faltam ${validade.daysLeft} dias`}
          </p>
        ) : (
          <button type="button" onClick={onAbrirHoje} className="mt-1.5 h-9 px-3 rounded-lg border border-border inline-flex items-center gap-1.5 text-[12.5px] font-semibold" data-testid="abri-hoje">
            <PackageOpen className="w-3.5 h-3.5" aria-hidden="true" /> Abri hoje
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 border-t border-border">
        <button type="button" onClick={onTrocar} className="h-11 text-[13px] font-semibold active:bg-muted/40">Trocar</button>
        <button type="button" onClick={onTirar} className="h-11 border-l border-border text-[13px] font-semibold text-muted-foreground active:bg-muted/40">Tirar do passo</button>
      </div>
    </div>
  );
}

function ConteudoDaFicha({ s, periodo, i, passo, onEscolher, onFechar }: { s: Skincare; periodo: Periodo; i: number; passo: PassoDaRotina; onEscolher: () => void; onFechar: () => void }) {
  const [nome, setNome] = useState(passo.name);
  const dias = diasDoPasso(passo);
  const produto = s.produtoDe(passo);
  const salvarNome = () => {
    if (nome.trim() && nome.trim() !== passo.name) s.renomear(periodo, i, nome);
    else setNome(passo.name);
  };
  return (
    <div className="px-4 pt-4 space-y-4">
      <label className="block">
        <span className={ROTULO}>PASSO</span>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={salvarNome}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          aria-label="Nome do passo"
          className="mt-1 h-11 text-[15px] font-semibold"
        />
      </label>

      <div>
        <div className="flex items-baseline gap-2">
          <span className={ROTULO}>DIAS</span>
          <span className="ml-auto text-[12px] text-muted-foreground" data-testid="ritmo-na-ficha">
            {ehTodoDia(passo) ? "todo dia" : `${ritmoDoPasso(passo)} · ${diasPorExtenso(passo)}`}
          </span>
        </div>
        <div className="mt-1.5 grid grid-cols-7 gap-1" role="group" aria-label="Dias do passo">
          {DIAS_DA_SEMANA.map((d, k) => {
            const on = dias.includes(k);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={`${d.charAt(0)}${d.slice(1).toLowerCase()}`}
                onClick={() => {
                  if (!s.alternarDiaDoPasso(periodo, i, k)) toast("O passo precisa de pelo menos 1 dia. Pra tirar, use Remover.");
                }}
                className={cn(
                  "h-11 rounded-lg text-[11px] font-extrabold transition-colors",
                  on ? cn(COR_DO_DIA[d], textoDoDiaEmBotao(d)) : "bg-card border border-border text-muted-foreground",
                )}
              >
                {DIAS_CURTOS[k]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className={ROTULO}>PRODUTO</span>
        {produto ? (
          <CartaoDoProduto
            produto={produto}
            onTrocar={onEscolher}
            onTirar={() => s.tirarProduto(periodo, i)}
            onAbrirHoje={() => { s.abrirHoje(produto.id); toast.success("A validade começou a contar hoje", { description: "Em Meus produtos aparece quando estiver perto de vencer." }); }}
          />
        ) : (
          <>
            <Button variant="outline" className="mt-1 w-full h-11 justify-start text-[14px] font-semibold" onClick={onEscolher} data-testid="abrir-lista">
              <Search className="w-4 h-4 mr-2" /> Escolher produto
            </Button>
            <p className="mt-1 text-[11.5px] text-muted-foreground leading-snug">
              Da lista de produtos populares no Brasil, ou digite o seu. Ele entra em Meus produtos, com a validade.
            </p>
          </>
        )}
      </div>

      <Button
        variant="outline"
        onClick={() => { s.removerPasso(periodo, i); onFechar(); }}
        aria-label={`Tirar ${passo.name} da rotina`}
        className="w-full h-11 text-destructive border-destructive/40 font-semibold"
      >
        <Trash2 className="w-4 h-4 mr-1.5" /> Remover da rotina
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------ escolher produto */

function LinhaDoProduto({ p, evitado, primeira, onEscolher }: { p: ProdutoDoCatalogo; evitado: string | null; primeira: boolean; onEscolher: () => void }) {
  return (
    <button
      type="button"
      onClick={onEscolher}
      className={cn("w-full text-left px-3 py-2.5 flex items-start gap-3 min-h-[60px] active:bg-muted/40 transition-colors", !primeira && "border-t border-border")}
      data-testid="produto-da-lista"
      aria-label={`${p.marca} ${p.nome}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-extrabold tracking-[.1em] text-muted-foreground uppercase truncate">{p.marca}</span>
        <span className="block text-[14px] font-semibold leading-snug">{p.nome}</span>
        {(p.ativos.length > 0 || p.fps || p.cor || p.textura) && (
          <span className="mt-1 flex flex-wrap gap-1">
            {p.fps ? <span className="rounded px-1.5 py-px text-[10.5px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">FPS {p.fps}</span> : null}
            {p.cor ? <span className="rounded px-1.5 py-px text-[10.5px] font-bold bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-300">com cor</span> : null}
            {p.textura ? <span className="rounded px-1.5 py-px text-[10.5px] font-semibold border border-border text-muted-foreground">{p.textura}</span> : null}
            {p.ativos.slice(0, 3).map((a) => (
              <span key={a} className="rounded px-1.5 py-px text-[10.5px] font-semibold bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-300">{a}</span>
            ))}
          </span>
        )}
        {evitado && <span className="mt-1 block text-[11.5px] font-semibold text-red-600 dark:text-red-400">🚫 tem {evitado}, que você evita</span>}
      </span>
      <span className="shrink-0 text-right pt-0.5">
        <span className="block text-[11.5px] font-bold tabular-nums">PAO {p.pao}M</span>
        {p.paoPadrao && <span className="block text-[10px] text-muted-foreground">padrão</span>}
      </span>
    </button>
  );
}

function EscolherProduto({ s, periodo, passo, onEscolhido }: { s: Skincare; periodo: Periodo; passo: PassoDaRotina; onEscolhido: (p: ProdutoDoCatalogo | { marca: string; nome: string; categoria?: CategoriaDoCatalogo }) => void }) {
  const [lista, setLista] = useState<ProdutoDoCatalogo[] | null>(null);
  const [q, setQ] = useState("");
  const [digitando, setDigitando] = useState(false);
  const [marca, setMarca] = useState("");
  const [nome, setNome] = useState("");
  useEffect(() => {
    let vivo = true;
    carregarCatalogo().then((l) => vivo && setLista(l)).catch(() => vivo && setLista([]));
    return () => { vivo = false; };
  }, []);
  const pele = s.perfil?.pele;
  const tipo = (passo.tipo as TipoDoPasso | undefined) ?? tipoPeloNome(passo.name);
  const buscando = q.trim().length >= 2;
  // "ter os MEUS produtos": o que a pessoa já tem e serve pra este passo vem antes da lista
  const naBancada = new Set(s.bancada.filter((b) => b && !b.finished && b.catalogoId).map((b) => b.catalogoId as string));
  const meus = lista && !buscando ? indicadosPara(lista, tipo, pele, s.evitar, 40, periodo).filter((p) => naBancada.has(p.id)) : [];
  const indicados = lista ? indicadosPara(lista, tipo, pele, s.evitar, 40, periodo).filter((p) => !naBancada.has(p.id)) : [];
  const achados = lista && buscando ? buscarProdutos(lista, q, pele, s.evitar, 30, tipo, periodo) : null;
  const mostrar = achados ?? indicados;
  const usarDigitado = () => {
    if (!nome.trim()) { toast.error("Escreve o nome do produto"); return; }
    onEscolhido({ marca: marca.trim(), nome: nome.trim(), categoria: tipo ? CATEGORIA_DO_TIPO[tipo as TipoDoPasso] : undefined });
  };
  return (
    <div className="pt-3" data-testid="escolher-produto-lista">
      <div className="px-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou marca" aria-label="Buscar produto" className="h-11 pl-9 text-[15px]" />
        </div>
      </div>
      {meus.length > 0 && (
        <>
          <p className={cn(ROTULO, "px-4 mt-3 mb-1.5")}>NOS SEUS PRODUTOS</p>
          <div className="mx-4 rounded-xl border border-pink-200 overflow-hidden bg-card" data-testid="nos-seus-produtos">
            {meus.map((p, k) => (
              <LinhaDoProduto key={p.id} p={p} evitado={ativoEvitado(p, s.evitar)} primeira={k === 0} onEscolher={() => onEscolhido(p)} />
            ))}
          </div>
        </>
      )}
      <div className="px-4">
        <p className={cn(ROTULO, "mt-3 mb-1.5")}>
          {buscando ? `${achados?.length ?? 0} NA LISTA` : `INDICADOS PRA ${nomeCurto(passo.name).toUpperCase()}`}
        </p>
      </div>
      <div className="mx-4 rounded-xl border border-border overflow-hidden bg-card">
        {lista === null && <p className="px-3 py-4 text-[13px] text-muted-foreground">Carregando a lista…</p>}
        {mostrar.map((p, k) => (
          <LinhaDoProduto key={p.id} p={p} evitado={ativoEvitado(p, s.evitar)} primeira={k === 0} onEscolher={() => onEscolhido(p)} />
        ))}
        {lista && mostrar.length === 0 && (
          <p className="px-3 py-4 text-[13px] text-muted-foreground">
            {buscando ? "Nada com esse nome na lista ainda. Digite o seu aqui embaixo." : "Ainda sem indicados pra este passo — busque pelo nome ou digite o seu."}
          </p>
        )}
      </div>
      <div className="px-4 pt-3">
        {digitando ? (
          <div className="rounded-xl border border-dashed border-border p-3 space-y-2" data-testid="digitar-produto">
            <p className={ROTULO}>DIGITAR O MEU</p>
            <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" aria-label="Marca" className="h-11 text-[15px]" />
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto" aria-label="Nome do produto" className="h-11 text-[15px]" onKeyDown={(e) => e.key === "Enter" && usarDigitado()} />
            <Button className="w-full h-11 text-[14px] font-bold" onClick={usarDigitado}>
              <Check className="w-4 h-4 mr-1.5" /> Usar este produto
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => { setDigitando(true); if (!buscando) return; setNome(q.trim()); }} className="w-full h-11 rounded-xl border border-dashed border-border inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Não achei — digitar o meu
          </button>
        )}
        <p className="mt-2 text-[11px] text-muted-foreground leading-snug">
          Lista de produtos vendidos no Brasil, conferidos no site da marca ou de lojas grandes{lista?.length ? ` (${lista.length} por enquanto)` : ""}. PAO “padrão” = o rótulo não diz; confira o potinho na embalagem.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ a folha */

export function FichaDoPasso({ s, aberto, onFechar, onVista }: { s: Skincare; aberto: PassoAberto | null; onFechar: () => void; onVista: (v: PassoAberto["vista"]) => void }) {
  // ao fechar a folha ainda desliza: segue mostrando a última ficha em vez de descer vazia
  const ultimo = useRef<PassoAberto | null>(aberto);
  if (aberto) ultimo.current = aberto;
  const atual = aberto ?? ultimo.current;
  const passo = atual ? s.passos[atual.periodo][atual.i] : null;
  const abertaDeVerdade = !!aberto && !!passo;
  const tom = atual ? TOM_DO_PERIODO[atual.periodo] : TOM_DO_PERIODO.manha;
  const titulo = atual ? `${tom.emoji} ${tom.rotulo} · ${atual.vista === "escolher" ? "ESCOLHER PRODUTO" : "PASSO"}` : "";

  return (
    <Sheet open={abertaDeVerdade} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={FOLHA} data-testid="ficha-passo">
        {atual && passo && (
          <>
            <FaixaDaFicha
              titulo={titulo}
              sub={passo.name}
              onFechar={onFechar}
              onVoltar={atual.vista === "escolher" ? () => onVista("ficha") : undefined}
            />
            <div className="overflow-y-auto pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {atual.vista === "escolher" ? (
                <EscolherProduto
                  s={s}
                  periodo={atual.periodo}
                  passo={passo}
                  onEscolhido={(p) => {
                    s.escolherProduto(atual.periodo, atual.i, p);
                    trackEvent("skincare_produto", { da_lista: "fonte" in p, passo: String(passo.tipo ?? "") });
                    toast.success("Produto no passo e em Meus produtos", { description: "fonte" in p ? `Validade depois de aberto: ${textoDoPao(p.pao, p.paoPadrao)}` : undefined });
                    onVista("ficha");
                  }}
                />
              ) : (
                <ConteudoDaFicha key={`${atual.periodo}-${atual.i}`} s={s} periodo={atual.periodo} i={atual.i} passo={passo} onEscolher={() => onVista("escolher")} onFechar={onFechar} />
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
