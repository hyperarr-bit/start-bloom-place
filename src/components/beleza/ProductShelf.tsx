import { useEffect, useMemo, useRef, useState } from "react";
import { avisarApagado } from "@/lib/desfazer";
import { numeroBR } from "@/lib/data-normalizers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Plus, Trash2, X, ShoppingCart, Package, AlarmClock, Ban, Edit2, Pipette, ChevronRight, Droplets, Waves, HandHeart, Sparkles, Palette,
  Paintbrush, Flower2, Search, Bell, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useUserData } from "@/hooks/use-user-data";
import { armarAvisos } from "@/lib/armar-avisos";
import { trackEvent } from "@/lib/analytics";
import { cn, localDayKey } from "@/lib/utils";
import { carregarCatalogo } from "@/lib/beleza-rotina";
import {
  CATEGORIAS_PRODUTO, CHAVE_LEMBRETE_VALIDADE, LEMBRETE_VALIDADE_PADRAO, TIPOS_MAQUIAGEM, buscarNaLista, carregarCatalogoCabelo, categoriaDe,
  ehMesAno, itemDaPele, itemDoCabelo, lerLembreteValidade, paoPadraoDe, produtoDaLista, rotuloDaCategoria, textoDoVencimento, vencendo,
  vencimentoAberto, vencimentoDoProduto, type CategoriaProduto, type ItemDaLista, type LembreteValidade, type ProdutoMeu,
} from "@/lib/beleza-produtos";
import { type Product, calculateCostPerDose, getExpiryProgress, inserirEm } from "./utils";
import { useChaveDaBeleza } from "./estado-compartilhado";
import { CartaoBeleza, Chip, FaixaBeleza, ROTULO_BZ, TEMA_BELEZA } from "./kit";

/* Visual da Beleza (28/09, dono): MEUS PRODUTOS no rosé do módulo, controles de
   40 px, diálogos com o tema (abrem fora da página).
   Onda 1 (28/09): categorias além do rosto (em chips), as DUAS datas (vence em mês/ano
   impresso + aberto em com o PAO), a que vence primeiro, VENCENDO no topo, aviso 7 dias
   antes (desligado) e a busca nas listas de pele e de cabelo. Formato da chave: o de sempre
   + campos opcionais (lib/beleza-produtos). */
const CAMPO = "h-10 rounded-xl text-[13px] bg-bz-cartao border-bz-linha-forte";
const DIALOGO = cn(TEMA_BELEZA, "max-w-sm rounded-3xl bg-bz-cartao border-bz-linha");

/** O ícone da categoria, em magenta sobre rosé (o 🧴 creme sumia no rosé claro). */
const ICONE_DA_CATEGORIA: Record<CategoriaProduto, LucideIcon> = {
  Skincare: Droplets, Cabelo: Waves, Corpo: HandHeart, Maquiagem: Palette, Unhas: Paintbrush, Perfume: Flower2, Outro: Sparkles,
};

/** Número com vírgula (26/09, varredura): `type="number"` + parseFloat zerava
 *  "12,90" digitado no teclado do iPhone. Rascunho em texto; o número sai do
 *  numeroBR. Quando o valor muda por fora (outro produto, formulário limpo), o
 *  rascunho acompanha. */
const CampoDecimal = ({ valor, onValor, rotulo }: { valor: number; onValor: (n: number) => void; rotulo: string }) => {
  const mostra = (n: number) => (n ? String(n).replace(".", ",") : "");
  const [txt, setTxt] = useState(() => mostra(valor));
  useEffect(() => {
    const atual = numeroBR(txt);
    if ((Number.isFinite(atual) ? atual : 0) !== (valor || 0)) setTxt(mostra(valor));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor]);
  return (
    <Input type="text" inputMode="decimal" placeholder="0" aria-label={rotulo} value={txt} className="h-10 rounded-xl text-sm bg-bz-cartao border-bz-linha-forte"
      onChange={e => { setTxt(e.target.value); const n = numeroBR(e.target.value); onValor(Number.isFinite(n) && n > 0 ? n : 0); }} />
  );
};

const genId = () => crypto.randomUUID();
const PAOS = [3, 6, 9, 12, 18, 24, 36];
const DEFAULT_PRODUCTS: ProdutoMeu[] = [];

const emptyProduct: Partial<ProdutoMeu> = {
  category: "Skincare", opened: false, rating: 0, repurchase: false,
  price: 0, sizeMl: 0, paoMonths: 12, paoPadrao: true, frequency: "Diário",
  finished: false, photoUrl: "", openedDate: "", expiry: "", brand: "", name: "", notes: "",
};

/** Chips de categoria (o valor gravado é o de sempre: "Skincare" é a Pele). */
function ChipsDeCategoria({ valor, onValor, contagem, todos }: { valor: CategoriaProduto | "todos"; onValor: (c: CategoriaProduto | "todos") => void; contagem?: Record<string, number>; todos?: number }) {
  const lista = contagem ? CATEGORIAS_PRODUTO.filter((c) => (contagem[c.valor] ?? 0) > 0) : CATEGORIAS_PRODUTO;
  const chip = (ativo: boolean) => cn("shrink-0 h-9 px-3 rounded-full text-[12px] font-semibold border transition-colors", ativo ? "bg-bz-rose-tinta text-bz-cartao border-bz-rose-tinta" : "bg-bz-cartao text-bz-suave border-bz-linha-forte");
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Categorias">
      {todos !== undefined && (
        <button type="button" onClick={() => onValor("todos")} aria-pressed={valor === "todos"} className={chip(valor === "todos")}>Todos {todos}</button>
      )}
      {lista.map((c) => (
        <button key={c.valor} type="button" onClick={() => onValor(c.valor)} aria-pressed={valor === c.valor} className={chip(valor === c.valor)} data-testid={`categoria-${c.rotulo.toLowerCase()}`}>
          {c.rotulo}{contagem ? ` ${contagem[c.valor] ?? 0}` : ""}
        </button>
      ))}
    </div>
  );
}

export const ProductShelf = () => {
  const { get } = useUserData();
  const hoje = localDayKey();
  // Sem cópia local (useChaveDaBeleza): o Desfazer do apagar funciona mesmo
  // depois de trocar de aba, e a Rotina vê os ingredientes a evitar na hora.
  const [productsBrutos, setProducts] = useChaveDaBeleza<ProdutoMeu[]>("beauty-products", DEFAULT_PRODUCTS);
  const products = productsBrutos.filter((p) => p && typeof p === "object");
  const [shoppingList, setShoppingList] = useChaveDaBeleza<Product[]>("beauty-shopping-list", []);
  const [triggers, setTriggers] = useChaveDaBeleza<string[]>("skincare-triggers", []);
  const [lembreteBruto, setLembrete] = useChaveDaBeleza<LembreteValidade>(CHAVE_LEMBRETE_VALIDADE, LEMBRETE_VALIDADE_PADRAO);
  const lembrete = lerLembreteValidade(lembreteBruto);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<ProdutoMeu>>({ ...emptyProduct });
  /* EDITAR PRODUTO (26/09, varredura): o detalhe só tinha "Acabou" e a
     lixeira — errou a marca ou o preço, tinha que apagar e cadastrar de novo.
     O "Editar" reaproveita o formulário de detalhes, preenchido. */
  const [editId, setEditId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [showForm, editId]);
  const [selectedProduct, setSelectedProduct] = useState<ProdutoMeu | null>(null);
  const [showShopping, setShowShopping] = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);
  const [newTrigger, setNewTrigger] = useState("");
  const [filtro, setFiltro] = useState<CategoriaProduto | "todos">("todos");
  // cadastro rápido: busca nas listas ou digita
  const [busca, setBusca] = useState("");
  const [quickBrand, setQuickBrand] = useState("");
  const [quickCategory, setQuickCategory] = useState<CategoriaProduto>("Skincare");
  const [lista, setLista] = useState<ItemDaLista[] | null>(null);
  useEffect(() => {
    if (lista || busca.trim().length < 2) return;
    let vivo = true;
    void Promise.all([carregarCatalogo(), carregarCatalogoCabelo()]).then(([pele, cabelo]) => {
      if (vivo) setLista([...cabelo.map(itemDoCabelo), ...pele.map(itemDaPele)]);
    });
    return () => { vivo = false; };
  }, [busca, lista]);
  // a busca olha as DUAS listas sempre (quem procura "lola" não precisa escolher "Cabelo" antes)
  const achados = useMemo(() => (lista ? buscarNaLista(lista, busca, 6) : []), [lista, busca]);

  const activeProducts = products.filter(p => !p.finished);
  const contagem = activeProducts.reduce<Record<string, number>>((m, p) => { const c = categoriaDe(p.category); m[c] = (m[c] ?? 0) + 1; return m; }, {});
  const visiveis = filtro === "todos" ? activeProducts : activeProducts.filter((p) => categoriaDe(p.category) === filtro);
  const aVencer = vencendo(activeProducts, hoje, 30);

  const gravarLembrete = (novo: LembreteValidade, pedir: boolean) => {
    setLembrete(novo);
    void armarAvisos(get, { [CHAVE_LEMBRETE_VALIDADE]: novo }, pedir, { nome: "validade_permissao", total: 1 });
  };

  const quickAdd = () => {
    if (!busca.trim()) return;
    const product: ProdutoMeu = {
      id: genId(), name: busca.trim(), category: quickCategory, brand: quickBrand.trim(),
      opened: false, openedDate: "", paoMonths: paoPadraoDe(quickCategory),
      expiry: "", notes: "", rating: 0, repurchase: false,
      price: 0, sizeMl: 0, photoUrl: "",
      frequency: "Diário", finished: false, paoPadrao: true,
    };
    setProducts(prev => [...prev, product]);
    setBusca("");
    setQuickBrand("");
  };

  const daLista = (i: ItemDaLista) => {
    const ja = activeProducts.find((p) => p.catalogoId === i.id);
    if (ja) { toast(`${i.nome} já está em MEUS PRODUTOS`); return; }
    setProducts(prev => [...prev, produtoDaLista(i, genId())]);
    trackEvent("produto_da_lista", { origem: i.origem });
    toast.success(`${i.nome} em MEUS PRODUTOS`, { description: `Validade depois de aberto: ${i.pao} meses${i.paoPadrao ? " · padrão" : ""}` });
    setBusca("");
  };

  const save = () => {
    if (!form.name?.trim()) return;
    const expiry = ehMesAno(form.expiry) ? form.expiry : "";
    const tipo = categoriaDe(form.category) === "Maquiagem" && form.tipo ? { tipo: form.tipo } : {};
    if (editId) {
      // edição: troca só o que o formulário mostra; id, "acabou", nota, foto e os campos da lista ficam
      const id = editId;
      setProducts(prev => prev.map(x => {
        if (x.id !== id) return x;
        const paoMudou = (form.paoMonths || 12) !== x.paoMonths;
        return {
          ...x, name: form.name!.trim(), category: form.category || x.category || "Outro", brand: form.brand || "",
          opened: !!form.openedDate, openedDate: form.openedDate || "", paoMonths: form.paoMonths || 12, expiry,
          notes: form.notes || "", repurchase: form.repurchase || false,
          price: form.price || 0, sizeMl: form.sizeMl || 0,
          ...tipo,
          ...(paoMudou ? { paoPadrao: !!form.paoPadrao } : {}),
        };
      }));
    } else {
      const product: ProdutoMeu = {
        id: genId(), name: form.name.trim(), category: form.category || "Outro", brand: form.brand || "",
        opened: !!form.openedDate, openedDate: form.openedDate || "", paoMonths: form.paoMonths || 12,
        expiry, notes: form.notes || "", rating: 0, repurchase: form.repurchase || false,
        price: form.price || 0, sizeMl: form.sizeMl || 0, photoUrl: form.photoUrl || "",
        frequency: form.frequency || "Diário", finished: false, paoPadrao: !!form.paoPadrao,
        ...tipo,
      };
      setProducts(prev => [...prev, product]);
    }
    fecharForm();
  };

  const fecharForm = () => {
    setForm({ ...emptyProduct });
    setEditId(null);
    setShowForm(false);
  };

  const abrirEdicao = (p: ProdutoMeu) => {
    setForm({ ...emptyProduct, ...(products.find(x => x.id === p.id) ?? p) });
    setEditId(p.id);
    setSelectedProduct(null);
    setShowForm(true);
  };

  /** Mudou a categoria (ou o tipo de maquiagem) com o PAO ainda no padrão: o padrão acompanha. */
  const mudarCategoria = (categoria: CategoriaProduto, tipo?: string) =>
    setForm((f) => ({
      ...f, category: categoria, tipo: categoria === "Maquiagem" ? tipo ?? f.tipo ?? "outro" : undefined,
      ...(f.paoPadrao !== false ? { paoMonths: paoPadraoDe(categoria, categoria === "Maquiagem" ? tipo ?? f.tipo ?? "outro" : undefined), paoPadrao: true } : {}),
    }));

  // Apaga já e oferece Desfazer (26/09, varredura: a lixeira apagava sem volta).
  const apagarProduto = (p: ProdutoMeu) => {
    const idx = products.findIndex(x => x.id === p.id);
    const atual = products[idx] ?? p;
    setProducts(prev => prev.filter(x => x.id !== p.id));
    setSelectedProduct(null);
    if (editId === p.id) fecharForm();
    avisarApagado(`"${atual.name}" saiu dos seus produtos`, () =>
      setProducts(prev => (prev.some(x => x.id === p.id) ? prev : inserirEm(prev, idx, atual))));
  };

  const markFinished = (p: ProdutoMeu) => {
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, finished: true } : x));
    setShoppingList(prev => [...prev, { ...p, id: genId(), finished: false }]);
  };

  const buyFromList = (id: string) => {
    const item = shoppingList.find(x => x.id === id);
    if (item) {
      setProducts(prev => [...prev, { ...item, id: genId(), finished: false, openedDate: "", opened: false }]);
    }
    setShoppingList(prev => prev.filter(x => x.id !== id));
  };

  const costPerDose = (p: Product) => p.price && p.sizeMl ? calculateCostPerDose(p.price, p.sizeMl, p.category) : null;

  return (
    <div className="space-y-4">
      {/* Cabeçalho: MEUS PRODUTOS (a antiga Bancada), no rosé da Beleza */}
      <CartaoBeleza>
        <FaixaBeleza
          icone={<Pipette className="w-4 h-4 text-bz-acento" />}
          titulo="MEUS PRODUTOS"
          direita={
            <span className="flex gap-1.5">
              <button onClick={() => setShowTriggers(true)} aria-label="Ingredientes a evitar" className="w-10 h-10 rounded-full bg-bz-cartao/70 grid place-items-center text-bz-rose-tinta">
                <Ban className="w-4 h-4" />
              </button>
              <button onClick={() => setShowShopping(true)} aria-label="Lista de compras" className="relative w-10 h-10 rounded-full bg-bz-cartao/70 grid place-items-center text-bz-rose-tinta">
                <ShoppingCart className="w-4 h-4" />
                {shoppingList.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-bz-acento text-bz-acento-tinta text-[9px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {shoppingList.length}
                  </span>
                )}
              </button>
            </span>
          }
        />
        <div className="px-4 py-2.5 border-t border-bz-linha space-y-2">
          <p className="text-[12px] text-bz-suave">{activeProducts.length} produtos ativos</p>
          {activeProducts.length > 0 && <ChipsDeCategoria valor={filtro} onValor={setFiltro} contagem={contagem} todos={activeProducts.length} />}
        </div>
        <div className="px-4 py-2 border-t border-bz-linha flex items-center gap-3" data-testid="lembrete-validade">
          <Bell className="w-4 h-4 text-bz-acento shrink-0" aria-hidden="true" />
          <span className="flex-1 min-w-0">
            <span className="block text-[13px] font-semibold text-bz-tinta">Avisar {lembrete.diasAntes} dias antes de vencer</span>
            <span className="block text-[11.5px] text-bz-suave">às {lembrete.hora}, no app do celular</span>
          </span>
          <Switch checked={lembrete.ligado} onCheckedChange={(v) => { gravarLembrete({ ...lembrete, ligado: v }, v); trackEvent("validade_lembrete", { ligado: v }); }} aria-label="Avisar antes de vencer" />
        </div>
      </CartaoBeleza>

      {/* VENCENDO: a data que vence primeiro (impressa ou depois de aberto), até 30 dias */}
      {aVencer.length > 0 && (
        <CartaoBeleza className="border-bz-alerta-tinta/25" data-testid="vencendo">
          <FaixaBeleza tom="alerta" icone={<AlarmClock className="w-4 h-4 text-bz-alerta-tinta" />} titulo="VENCENDO" direita={<span>{aVencer.length}</span>} />
          {aVencer.map(({ p, v }) => (
            <button key={p.id} type="button" onClick={() => setSelectedProduct(p)} className="w-full text-left px-4 py-2.5 border-t border-bz-linha flex items-center gap-2 bg-transparent active:bg-bz-blush/60">
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-semibold text-bz-tinta line-clamp-2 break-words">{p.name}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[11.5px] text-bz-suave">{rotuloDaCategoria(p.category)}{p.brand ? ` · ${p.brand}` : ""}</span>
                  <Chip tom="alerta">{textoDoVencimento(v)}</Chip>
                </span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-bz-suave" aria-hidden="true" />
            </button>
          ))}
        </CartaoBeleza>
      )}

      {/* Triggers banner */}
      {triggers.length > 0 && (
        <div className="rounded-2xl bg-bz-alerta px-4 py-2.5">
          <p className="text-[12px] text-bz-alerta-tinta font-semibold">🚫 Lembrete: Evite produtos com {triggers.join(", ")}</p>
        </div>
      )}

      {/* A PRATELEIRA (28/09): cada produto numa linha de loja de beleza — marca em miúdo, o
          nome inteiro (até 2 linhas), a validade que vence primeiro e o custo por dose em
          pílula; o ícone diz a categoria. Tocar abre o detalhe (Editar, Acabou, Apagar). */}
      <CartaoBeleza>
        <div className="bg-bz-blush px-4 py-2">
          <span className={ROTULO_BZ}>Na prateleira{filtro !== "todos" ? ` · ${rotuloDaCategoria(filtro)}` : ""}</span>
        </div>
        <div className="divide-y divide-bz-linha">
          {visiveis.map(p => {
            const cpd = costPerDose(p);
            const v = vencimentoDoProduto(p, hoje);
            const Icone = ICONE_DA_CATEGORIA[categoriaDe(p.category)];
            return (
              <div key={p.id} className="px-3.5 py-2.5 min-h-[64px] flex items-center gap-3 cursor-pointer hover:bg-bz-blush/50 active:bg-bz-blush/60 transition-colors group"
                onClick={() => setSelectedProduct(p)} data-testid="produto-meu">
                <span className="w-10 h-10 shrink-0 rounded-full bg-bz-rose grid place-items-center" aria-hidden="true" title={rotuloDaCategoria(p.category)}>
                  <Icone className="w-[18px] h-[18px] text-bz-acento" />
                </span>
                <div className="min-w-0 flex-1">
                  {p.brand && <p className="text-[10px] font-extrabold tracking-[.12em] uppercase text-bz-suave truncate">{p.brand}</p>}
                  <p className="text-[13.5px] font-semibold leading-snug text-bz-tinta line-clamp-2 break-words">{p.name}</p>
                  {(v || cpd !== null || p.repurchase) && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {v && <Chip tom={v.dias <= 30 ? "alerta" : "ok"}>{textoDoVencimento(v)}</Chip>}
                      {cpd !== null && <Chip tom="ok">R${cpd.toFixed(2)}/dose</Chip>}
                      {p.repurchase && <Chip tom="rose">🔄 recomprar</Chip>}
                    </p>
                  )}
                </div>
                {/* "Acabou" direto da lista só no computador (ao passar o mouse). No celular ele
                    era um botão invisível no canto da linha; lá o "Acabou" fica no detalhe. */}
                <button onClick={e => { e.stopPropagation(); markFinished(p); }} aria-label={`Acabou: ${p.name}`} className="hidden sm:grid w-10 h-10 shrink-0 place-items-center rounded-full bg-transparent text-bz-suave hover:text-bz-alerta-tinta opacity-0 group-hover:opacity-100">
                  <Package className="w-4 h-4" />
                </button>
                <ChevronRight className="w-4 h-4 shrink-0 text-bz-suave sm:hidden" aria-hidden="true" />
              </div>
            );
          })}

          {visiveis.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[12.5px] text-bz-suave italic">{activeProducts.length ? "Nada nesta categoria ainda" : "Nenhum produto ainda — busque na lista ou digite abaixo"}</p>
            </div>
          )}

          {/* Cadastro rápido: busca nas listas de pele e cabelo, ou digita */}
          <div className="px-3.5 py-3 space-y-2 bg-bz-papel" data-testid="cadastro-rapido">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-bz-suave pointer-events-none" aria-hidden="true" />
              <Input
                placeholder="Nome do produto"
                aria-label="Buscar na lista ou digitar o nome"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className={cn(CAMPO, "pl-10 rounded-full")}
                onKeyDown={e => { if (e.key === "Enter") quickAdd(); }}
              />
            </div>
            {achados.length > 0 && (
              <div className="rounded-2xl border border-bz-linha bg-bz-cartao overflow-hidden divide-y divide-bz-linha" data-testid="achados-da-lista">
                {achados.map((i) => (
                  <button key={`${i.origem}-${i.id}`} type="button" onClick={() => daLista(i)} className="w-full text-left px-3 py-2 min-h-[48px] flex items-center gap-2 bg-transparent active:bg-bz-blush/60" data-testid="achado">
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] font-extrabold tracking-[.12em] uppercase text-bz-suave truncate">{i.marca}</span>
                      <span className="block text-[13px] font-semibold leading-snug text-bz-tinta line-clamp-2">{i.nome}</span>
                    </span>
                    <Chip tom={i.origem === "cabelo" ? "manha" : "rose"} className="shrink-0">{i.rotulo}</Chip>
                    <Plus className="w-4 h-4 shrink-0 text-bz-acento" aria-hidden="true" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-1.5 overflow-x-auto -mx-0.5 px-0.5 pb-0.5">
              {CATEGORIAS_PRODUTO.map((c) => (
                <button key={c.valor} type="button" onClick={() => setQuickCategory(c.valor)} aria-pressed={quickCategory === c.valor}
                  className={cn("shrink-0 h-9 px-3 rounded-full text-[12px] font-semibold border", quickCategory === c.valor ? "bg-bz-rose border-bz-acento/45 text-bz-rose-tinta" : "bg-bz-cartao border-bz-linha-forte text-bz-suave")}>
                  {c.rotulo}
                </button>
              ))}
            </div>
            <Input
              placeholder="Marca"
              value={quickBrand}
              onChange={e => setQuickBrand(e.target.value)}
              className={CAMPO}
              onKeyDown={e => { if (e.key === "Enter") quickAdd(); }}
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-10 px-4 rounded-full text-[13px] font-bold flex-1" onClick={quickAdd}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
              <Button size="sm" variant="ghost" className="h-10 px-4 rounded-full text-[13px] text-bz-suave" onClick={() => { setEditId(null); setForm({ ...emptyProduct, name: busca.trim(), brand: quickBrand.trim(), category: quickCategory, paoMonths: paoPadraoDe(quickCategory), paoPadrao: true }); setShowForm(true); }}>
                + Detalhes
              </Button>
            </div>
            <p className="text-[11px] text-bz-suave">A lista tem produtos de pele e de cabelo vendidos no Brasil; o que não estiver lá, é só digitar.</p>
          </div>
        </div>
      </CartaoBeleza>

      {/* Add form (detailed) — o mesmo serve pra editar */}
      {showForm && (
        <div ref={formRef} className="rounded-[var(--bz-raio,24px)] border border-bz-linha bg-bz-cartao p-4 space-y-3 scroll-mt-32" data-testid="form-produto">
          {editId && <p className="text-[10.5px] font-extrabold uppercase tracking-[.14em] text-bz-suave">✏️ Editar produto</p>}
          <Input placeholder="Nome do produto" value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={CAMPO} />
          <Input placeholder="Marca" value={form.brand || ""} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className={CAMPO} />
          <div>
            <p className={ROTULO_BZ}>Categoria</p>
            <div className="mt-1.5"><ChipsDeCategoria valor={categoriaDe(form.category)} onValor={(c) => c !== "todos" && mudarCategoria(c)} /></div>
          </div>
          {categoriaDe(form.category) === "Maquiagem" && (
            <div>
              <p className={ROTULO_BZ}>Tipo</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Tipo de maquiagem">
                {TIPOS_MAQUIAGEM.map((t) => (
                  <button key={t.id} type="button" onClick={() => mudarCategoria("Maquiagem", t.id)} aria-pressed={form.tipo === t.id}
                    className={cn("h-9 px-3 rounded-full text-[12px] font-semibold border", form.tipo === t.id ? "bg-bz-rose border-bz-acento/45 text-bz-rose-tinta" : "bg-bz-cartao border-bz-linha-forte text-bz-suave")}>
                    {t.rotulo} · {t.pao}m
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] text-bz-suave">Preço (R$)</label>
              <CampoDecimal rotulo="Preço" valor={form.price || 0} onValor={n => setForm(p => ({ ...p, price: n }))} />
            </div>
            <div>
              <label className="text-[10.5px] text-bz-suave">Tamanho (ml/g)</label>
              <CampoDecimal rotulo="Tamanho" valor={form.sizeMl || 0} onValor={n => setForm(p => ({ ...p, sizeMl: n }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10.5px] text-bz-suave" htmlFor="vence-em">Vence em (mês/ano)</label>
              <Input id="vence-em" type="month" value={ehMesAno(form.expiry) ? form.expiry : ""} onChange={e => setForm(p => ({ ...p, expiry: e.target.value }))} className={cn(CAMPO, "appearance-none")} aria-label="Vence em (mês e ano impressos)" />
            </div>
            <div>
              <label className="text-[10.5px] text-bz-suave" htmlFor="aberto-em">Aberto em</label>
              <Input id="aberto-em" type="date" max={hoje} value={form.openedDate || ""} onChange={e => setForm(p => ({ ...p, openedDate: e.target.value }))} className={cn(CAMPO, "appearance-none [&::-webkit-date-and-time-value]:text-left")} aria-label="Aberto em" />
            </div>
          </div>
          <div>
            <p className="text-[10.5px] text-bz-suave">Validade depois de aberto {form.paoPadrao !== false ? "· padrão" : ""}</p>
            <div className="mt-1 flex flex-wrap gap-1.5" role="group" aria-label="Validade depois de aberto">
              {[...new Set([...PAOS, form.paoMonths || 12])].sort((a, b) => a - b).map((m) => (
                <button key={m} type="button" onClick={() => setForm(p => ({ ...p, paoMonths: m, paoPadrao: m === paoPadraoDe(p.category, p.tipo) && p.paoPadrao !== false }))} aria-pressed={(form.paoMonths || 12) === m}
                  className={cn("h-9 min-w-10 px-2.5 rounded-full text-[12px] font-bold border tabular-nums", (form.paoMonths || 12) === m ? "bg-bz-rose-tinta text-bz-cartao border-bz-rose-tinta" : "bg-bz-cartao border-bz-linha-forte text-bz-suave")}>
                  {m}m
                </button>
              ))}
            </div>
          </div>
          <Textarea placeholder="Notas (ingredientes, resultados...)" value={form.notes || ""} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="text-sm min-h-[56px] rounded-xl bg-bz-cartao border-bz-linha-forte" />
          <label className="flex items-center gap-1.5 text-[12.5px] text-bz-suave min-h-[36px]">
            <Checkbox checked={form.repurchase} onCheckedChange={v => setForm(p => ({ ...p, repurchase: !!v }))} /> Recomprar quando acabar
          </label>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 h-10 rounded-full font-bold" onClick={save}>Salvar</Button>
            <Button size="sm" variant="ghost" className="h-10 rounded-full text-bz-suave" onClick={fecharForm}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Product detail dialog */}
      <Dialog open={!!selectedProduct} onOpenChange={() => setSelectedProduct(null)}>
        <DialogContent className={DIALOGO}>
          {selectedProduct && (() => {
            const p = selectedProduct;
            const cpd = costPerDose(p);
            const v = vencimentoDoProduto(p, hoje);
            const aberto = vencimentoAberto(p);
            const progresso = p.openedDate && p.paoMonths ? getExpiryProgress(p.openedDate, p.paoMonths) : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><span className="text-[11px] font-extrabold uppercase tracking-[.12em] text-bz-suave">{rotuloDaCategoria(p.category)}</span> {p.name}</DialogTitle>
                  <DialogDescription className="text-bz-suave">{p.brand || "Sem marca"}</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-bz-suave text-[10.5px]">Marca</span><p className="font-medium">{p.brand || "—"}</p></div>
                    <div><span className="text-bz-suave text-[10.5px]">Preço</span><p className="font-medium">{p.price ? `R$ ${p.price.toFixed(2)}` : "—"}</p></div>
                    <div><span className="text-bz-suave text-[10.5px]">Tamanho</span><p className="font-medium">{p.sizeMl ? `${p.sizeMl} ml` : "—"}</p></div>
                    {cpd !== null && <div><span className="text-bz-suave text-[10.5px]">Custo/dose</span><p className="font-medium text-bz-ok-tinta">R$ {cpd.toFixed(2)}</p></div>}
                  </div>
                  <div className="rounded-2xl border border-bz-linha px-3 py-2.5 space-y-1 text-[12.5px]" data-testid="as-duas-datas">
                    <p className="text-bz-tinta"><span className="text-bz-suave">Vence em (impresso): </span><b>{ehMesAno(p.expiry) ? `${p.expiry.slice(5, 7)}/${p.expiry.slice(0, 4)}` : "—"}</b></p>
                    <p className="text-bz-tinta"><span className="text-bz-suave">Depois de aberto: </span><b>{p.paoMonths} meses</b>{p.paoPadrao ? " · padrão" : ""}{aberto ? ` · até ${aberto.slice(8, 10)}/${aberto.slice(5, 7)}/${aberto.slice(0, 4)}` : " · ainda fechado"}</p>
                    {v && <p className={cn("font-semibold", v.dias <= 30 ? "text-bz-alerta-tinta" : "text-bz-ok-tinta")} data-testid="vence-primeiro">Vale a que vence primeiro: {textoDoVencimento(v)}</p>}
                  </div>
                  {progresso && (
                    <div className="h-2 bg-bz-blush rounded-full overflow-hidden" aria-hidden="true">
                      <div className={`h-full rounded-full ${progresso.daysLeft < 15 ? "bg-bz-alerta-tinta" : progresso.daysLeft < 30 ? "bg-bz-acido" : "bg-bz-ok-tinta"}`}
                        style={{ width: `${Math.min(100, progresso.percent)}%` }} />
                    </div>
                  )}
                  {p.notes && <p className="text-xs text-bz-suave">{p.notes}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 h-10 rounded-full" onClick={() => abrirEdicao(p)}>
                      <Edit2 className="w-3.5 h-3.5 mr-1" /> Editar
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 h-10 rounded-full" onClick={() => { markFinished(p); setSelectedProduct(null); }}>
                      <Package className="w-3.5 h-3.5 mr-1" /> Acabou
                    </Button>
                    <Button size="sm" variant="destructive" className="h-10 w-10 p-0 rounded-full" onClick={() => apagarProduto(p)} aria-label="Apagar produto">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Shopping list dialog */}
      <Dialog open={showShopping} onOpenChange={setShowShopping}>
        <DialogContent className={DIALOGO}>
          <DialogHeader><DialogTitle>🛒 Lista de Compras</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {shoppingList.length === 0 && <p className="text-sm text-bz-suave text-center py-4">Lista vazia</p>}
            {shoppingList.map(p => (
              <div key={p.id} className="flex items-center gap-2 p-2.5 rounded-2xl border border-bz-linha">
                <Checkbox onCheckedChange={() => buyFromList(p.id)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-[11px] text-bz-suave">{p.brand} • {p.price ? `R$ ${p.price.toFixed(2)}` : ""}</p>
                </div>
              </div>
            ))}
            {shoppingList.length > 0 && (
              <div className="pt-2 border-t border-bz-linha">
                <p className="text-xs text-bz-suave">Total: <span className="font-bold text-foreground">R$ {shoppingList.reduce((s, p) => s + (p.price || 0), 0).toFixed(2)}</span></p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Triggers dialog */}
      <Dialog open={showTriggers} onOpenChange={setShowTriggers}>
        <DialogContent className={DIALOGO}>
          <DialogHeader><DialogTitle>🚫 Ingredientes a Evitar</DialogTitle></DialogHeader>
          <p className="text-[12px] text-bz-suave">Adicione ingredientes que causam reação na sua pele.</p>
          <div className="space-y-2">
            {triggers.map((t, i) => (
              <div key={i} className="flex items-center gap-2 pl-3.5 pr-1 min-h-[40px] rounded-full bg-bz-alerta">
                <span className="text-[12.5px] flex-1 text-bz-alerta-tinta font-semibold">{t}</span>
                <button onClick={() => setTriggers(prev => prev.filter((_, j) => j !== i))} aria-label={`Tirar ${t}`} className="w-9 h-9 rounded-full bg-transparent grid place-items-center text-bz-alerta-tinta/75">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input placeholder="Ex: Ácido Salicílico" value={newTrigger} onChange={e => setNewTrigger(e.target.value)}
                className={CAMPO}
                onKeyDown={e => { if (e.key === "Enter" && newTrigger.trim()) { setTriggers(prev => [...prev, newTrigger.trim()]); setNewTrigger(""); } }} />
              <Button size="sm" className="h-10 w-10 p-0 rounded-full shrink-0" aria-label="Adicionar ingrediente" onClick={() => { if (newTrigger.trim()) { setTriggers(prev => [...prev, newTrigger.trim()]); setNewTrigger(""); } }}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
