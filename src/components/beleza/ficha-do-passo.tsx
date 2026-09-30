/**
 * FICHA DO PASSO + ESCOLHER PRODUTO (28/09, protótipo). A folha de baixo do app,
 * no visual da Beleza (kit): a faixa é a do PERÍODO do passo — pêssego com sol
 * de manhã, malva com lua à noite — e o nome do passo vem em serifa:
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
import { cn } from "@/lib/utils";
import { trackEvent } from "@/lib/analytics";
import {
  DIAS_CURTOS, ativoEvitado, buscarProdutos, carregarCatalogo, diasDoPasso, diasPorExtenso, ehTodoDia, indicadosPara, nomeCurto,
  ritmoDoPasso, textoDoPao, tipoPeloNome, type CategoriaDoCatalogo, type PassoDaRotina, type Periodo, type ProdutoDaBancada,
  type ProdutoDoCatalogo, type TipoDoPasso,
} from "@/lib/beleza-rotina";
import { DIAS_DA_SEMANA } from "@/components/treino/planner";
import { diaCurto } from "@/components/tarefas/tarefas-do-dia";
import { getExpiryProgress } from "./utils";
import { BOTAO_CONTORNO, Chip, IconePeriodo, ROTULO_BZ, Serif, TEMA_BELEZA } from "./kit";
import type { Skincare } from "./use-skincare";

export type PassoAberto = { periodo: Periodo; i: number; vista: "ficha" | "escolher" };

const ROTULO = ROTULO_BZ;
const FOLHA = "rounded-t-3xl p-0 gap-0 overflow-hidden max-h-[92dvh] flex flex-col";

/** Categoria da lista pra um produto digitado à mão (dá o PAO padrão). */
const CATEGORIA_DO_TIPO: Record<TipoDoPasso, CategoriaDoCatalogo> = {
  limpeza: "limpeza", hidratante: "hidratante", protetor: "protetor", "vitamina-c": "serum", niacinamida: "serum",
  hialuronico: "serum", "acido-salicilico": "acido", "acido-glicolico": "acido", retinol: "retinoide",
  olhos: "olhos", labios: "labios", mascara: "mascara", tonico: "tonico",
};

function FaixaDaFicha({ periodo, titulo, sub, onFechar, onVoltar }: { periodo: Periodo; titulo: ReactNode; sub: ReactNode; onFechar: () => void; onVoltar?: () => void }) {
  const manha = periodo === "manha";
  return (
    <div className={cn(manha ? "bg-bz-manha text-bz-manha-tinta" : "bg-bz-noite text-bz-noite-tinta", "pl-2 pr-2 pt-3 pb-3.5 flex items-start gap-1.5")}>
      {onVoltar ? (
        <button type="button" onClick={onVoltar} aria-label="Voltar pra ficha" className="w-10 h-10 -mt-1 shrink-0 grid place-items-center rounded-full bg-bz-cartao/60">
          <ArrowLeft className="w-4 h-4" />
        </button>
      ) : (
        <IconePeriodo periodo={periodo} className="ml-1.5 mt-0.5" />
      )}
      <div className="min-w-0 flex-1 pl-1">
        <SheetTitle className="text-[11.5px] font-extrabold tracking-[.14em] uppercase text-current leading-tight opacity-85">{titulo}</SheetTitle>
        <SheetDescription asChild>
          <p className="mt-0.5 truncate"><Serif className={cn("text-[24px] leading-tight", manha ? "text-bz-manha-tinta" : "text-bz-noite-tinta")}>{sub}</Serif></p>
        </SheetDescription>
      </div>
      <button type="button" onClick={onFechar} aria-label="Fechar" className="w-10 h-10 -mt-1 shrink-0 grid place-items-center rounded-full bg-bz-cartao/60">
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
    <div className="mt-1.5 rounded-2xl border border-bz-linha bg-bz-papel overflow-hidden" data-testid="produto-na-ficha">
      <div className="px-3 py-2.5">
        {produto.brand && <p className="text-[10.5px] font-extrabold tracking-[.12em] text-bz-suave uppercase truncate">{produto.brand}</p>}
        <p className="text-[15px] font-bold leading-snug break-words text-bz-tinta">{produto.name}</p>
        {ativos.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-1">
            {ativos.slice(0, 4).map((a) => (
              <Chip key={a} tom="rose">{a}</Chip>
            ))}
          </p>
        )}
        <p className="mt-1.5 text-[12px] text-bz-suave">
          Validade depois de aberto: <b className="text-bz-tinta">{textoDoPao(produto.paoMonths || 12, produto.paoPadrao)}</b>
        </p>
        {validade ? (
          <p className={cn("mt-0.5 text-[12px] font-semibold", validade.expired || validade.daysLeft < 30 ? "text-bz-alerta-tinta" : "text-bz-ok-tinta")}>
            {validade.expired ? "⚠️ Venceu — hora de repor" : `Aberto em ${diaCurto(produto.openedDate)} · faltam ${validade.daysLeft} dias`}
          </p>
        ) : (
          <button type="button" onClick={onAbrirHoje} className={cn(BOTAO_CONTORNO, "mt-2 inline-flex items-center gap-1.5 text-[12.5px]")} data-testid="abri-hoje">
            <PackageOpen className="w-3.5 h-3.5" aria-hidden="true" /> Abri hoje
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 border-t border-bz-linha bg-bz-cartao">
        <button type="button" onClick={onTrocar} className="h-11 bg-transparent text-[13px] font-bold text-bz-acento active:bg-bz-blush">Trocar</button>
        <button type="button" onClick={onTirar} className="h-11 bg-transparent border-l border-bz-linha text-[13px] font-semibold text-bz-suave active:bg-bz-blush">Tirar do passo</button>
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
          className="mt-1 h-11 rounded-xl text-[15px] font-semibold bg-bz-cartao border-bz-linha-forte"
        />
      </label>

      <div>
        <div className="flex items-baseline gap-2">
          <span className={ROTULO}>DIAS</span>
          <span className="ml-auto text-[12px] text-bz-suave" data-testid="ritmo-na-ficha">
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
                  "h-11 rounded-full text-[11px] font-extrabold tracking-wide transition-colors",
                  on
                    ? periodo === "manha" ? "bg-bz-manha-tinta text-bz-cartao" : "bg-bz-noite-tinta text-bz-cartao"
                    : "bg-bz-cartao border border-bz-linha-forte text-bz-suave",
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
            <button type="button" className="mt-1.5 w-full h-11 rounded-full bg-bz-acento text-bz-acento-tinta inline-flex items-center justify-center gap-2 text-[14px] font-bold active:scale-[.98] transition" onClick={onEscolher} data-testid="abrir-lista">
              <Search className="w-4 h-4" /> Escolher produto
            </button>
            <p className="mt-1.5 text-[11.5px] text-bz-suave leading-snug">
              Da lista de produtos populares no Brasil, ou digite o seu. Ele entra em Meus produtos, com a validade.
            </p>
          </>
        )}
      </div>

      <Button
        variant="outline"
        onClick={() => { s.removerPasso(periodo, i); onFechar(); }}
        aria-label={`Tirar ${passo.name} da rotina`}
        className="w-full h-11 rounded-full bg-bz-cartao text-bz-alerta-tinta border-bz-alerta-tinta/35 font-semibold"
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
      className={cn("w-full text-left px-3.5 py-2.5 flex items-start gap-3 min-h-[60px] bg-transparent active:bg-bz-blush transition-colors", !primeira && "border-t border-bz-linha")}
      data-testid="produto-da-lista"
      aria-label={`${p.marca} ${p.nome}`}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[10.5px] font-extrabold tracking-[.12em] text-bz-suave uppercase truncate">{p.marca}</span>
        <span className="block text-[14px] font-semibold leading-snug text-bz-tinta">{p.nome}</span>
        {(p.ativos.length > 0 || p.fps || p.cor || p.textura) && (
          <span className="mt-1 flex flex-wrap gap-1">
            {p.fps ? <Chip tom="manha">FPS {p.fps}</Chip> : null}
            {p.cor ? <Chip tom="noite">com cor</Chip> : null}
            {p.textura ? <Chip tom="contorno">{p.textura}</Chip> : null}
            {p.ativos.slice(0, 3).map((a) => <Chip key={a} tom="rose">{a}</Chip>)}
          </span>
        )}
        {evitado && <span className="mt-1 block text-[11.5px] font-semibold text-bz-alerta-tinta">🚫 tem {evitado}, que você evita</span>}
      </span>
      <span className="shrink-0 text-right pt-0.5">
        <span className="block text-[11.5px] font-bold tabular-nums text-bz-tinta">PAO {p.pao}M</span>
        {p.paoPadrao && <span className="block text-[10px] text-bz-suave">padrão</span>}
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-bz-suave" aria-hidden="true" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou marca" aria-label="Buscar produto" className="h-11 pl-10 rounded-full text-[15px] bg-bz-papel border-bz-linha-forte" />
        </div>
      </div>
      {meus.length > 0 && (
        <>
          <p className={cn(ROTULO, "px-4 mt-3 mb-1.5")}>NOS SEUS PRODUTOS</p>
          <div className="mx-4 rounded-2xl border-2 border-bz-dica-borda overflow-hidden bg-bz-dica" data-testid="nos-seus-produtos">
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
      <div className="mx-4 rounded-2xl border border-bz-linha overflow-hidden bg-bz-cartao">
        {lista === null && <p className="px-3.5 py-4 text-[13px] text-bz-suave">Carregando a lista…</p>}
        {mostrar.map((p, k) => (
          <LinhaDoProduto key={p.id} p={p} evitado={ativoEvitado(p, s.evitar)} primeira={k === 0} onEscolher={() => onEscolhido(p)} />
        ))}
        {lista && mostrar.length === 0 && (
          <p className="px-3.5 py-4 text-[13px] text-bz-suave">
            {buscando ? "Nada com esse nome na lista ainda. Digite o seu aqui embaixo." : "Ainda sem indicados pra este passo — busque pelo nome ou digite o seu."}
          </p>
        )}
      </div>
      <div className="px-4 pt-3">
        {digitando ? (
          <div className="rounded-2xl border border-dashed border-bz-dica-borda bg-bz-dica p-3 space-y-2" data-testid="digitar-produto">
            <p className={ROTULO}>DIGITAR O MEU</p>
            <Input value={marca} onChange={(e) => setMarca(e.target.value)} placeholder="Marca" aria-label="Marca" className="h-11 rounded-xl text-[15px] bg-bz-cartao" />
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do produto" aria-label="Nome do produto" className="h-11 rounded-xl text-[15px] bg-bz-cartao" onKeyDown={(e) => e.key === "Enter" && usarDigitado()} />
            <Button className="w-full h-11 rounded-full text-[14px] font-bold" onClick={usarDigitado}>
              <Check className="w-4 h-4 mr-1.5" /> Usar este produto
            </Button>
          </div>
        ) : (
          <button type="button" onClick={() => { setDigitando(true); if (!buscando) return; setNome(q.trim()); }} className="w-full h-11 rounded-full border border-dashed border-bz-linha-forte bg-transparent inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-bz-suave">
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" /> Não achei — digitar o meu
          </button>
        )}
        <p className="mt-2 text-[11px] text-bz-suave leading-snug">
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
  const titulo = atual ? `${atual.periodo === "manha" ? "Manhã" : "Noite"} · ${atual.vista === "escolher" ? "escolher produto" : "passo"}` : "";

  return (
    <Sheet open={abertaDeVerdade} onOpenChange={(v) => !v && onFechar()}>
      <SheetContent side="bottom" semFechar className={cn(FOLHA, TEMA_BELEZA, "bg-bz-cartao")} data-testid="ficha-passo">
        {atual && passo && (
          <>
            <FaixaDaFicha
              periodo={atual.periodo}
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
