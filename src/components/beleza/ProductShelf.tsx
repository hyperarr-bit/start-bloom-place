import { useEffect, useRef, useState } from "react";
import { avisarApagado } from "@/lib/desfazer";
import { numeroBR } from "@/lib/data-normalizers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, X, ShoppingCart, Package, AlarmClock, Ban, Edit2, Pipette, ChevronRight, Droplets, Waves, HandHeart, Sparkles, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { type Product, calculateCostPerDose, getExpiryProgress, inserirEm } from "./utils";
import { useChaveDaBeleza } from "./estado-compartilhado";
import { CartaoBeleza, Chip, FaixaBeleza, ROTULO_BZ, TEMA_BELEZA } from "./kit";

/* Visual da Beleza (28/09, dono): MEUS PRODUTOS no rosé do módulo, controles de
   40 px, diálogos e a lista suspensa com o tema (abrem fora da página). */
const CAMPO = "h-10 rounded-xl text-[13px] bg-bz-cartao border-bz-linha-forte";
const DIALOGO = cn(TEMA_BELEZA, "max-w-sm rounded-3xl bg-bz-cartao border-bz-linha");

/** O ícone da categoria na prateleira, em magenta sobre rosé (o 🧴 creme sumia no rosé claro). */
const ICONE_DA_CATEGORIA: Record<string, LucideIcon> = { Skincare: Droplets, Cabelo: Waves, Corpo: HandHeart, Outro: Sparkles };

/** A validade na pílula da prateleira: "vence amanhã" · "vence em 8 dias" · "vence em 5 meses" · "vencido". */
const textoDaValidade = ({ daysLeft, expired }: { daysLeft: number; expired: boolean }) => {
  if (expired) return "vencido";
  if (daysLeft === 1) return "vence amanhã";
  if (daysLeft < 60) return `vence em ${daysLeft} dias`;
  const meses = Math.round(daysLeft / 30);
  return `vence em ${meses} ${meses === 1 ? "mês" : "meses"}`;
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

const categories = ["Skincare", "Cabelo", "Corpo", "Outro"];
const catEmoji: Record<string, string> = { Skincare: "🧴", Cabelo: "💇", Corpo: "🧼", Outro: "✨" };
const paoOptions = [3, 6, 9, 12, 18, 24];

const DEFAULT_PRODUCTS: Product[] = [];

const emptyProduct: Partial<Product> = {
  category: "Skincare", opened: false, rating: 0, repurchase: false,
  price: 0, sizeMl: 0, paoMonths: 12, frequency: "Diário",
  finished: false, photoUrl: "", openedDate: "", brand: "", name: "", notes: "",
};

export const ProductShelf = () => {
  // Sem cópia local (useChaveDaBeleza): o Desfazer do apagar funciona mesmo
  // depois de trocar de aba, e a Rotina vê os ingredientes a evitar na hora.
  const [products, setProducts] = useChaveDaBeleza<Product[]>("beauty-products", DEFAULT_PRODUCTS);
  const [shoppingList, setShoppingList] = useChaveDaBeleza<Product[]>("beauty-shopping-list", []);
  const [triggers, setTriggers] = useChaveDaBeleza<string[]>("skincare-triggers", []);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<Product>>({ ...emptyProduct });
  /* EDITAR PRODUTO (26/09, varredura): o detalhe só tinha "Acabou" e a
     lixeira — errou a marca ou o preço, tinha que apagar e cadastrar de novo.
     O "Editar" reaproveita o formulário de detalhes, preenchido. */
  const [editId, setEditId] = useState<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [showForm, editId]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showShopping, setShowShopping] = useState(false);
  const [showTriggers, setShowTriggers] = useState(false);
  const [newTrigger, setNewTrigger] = useState("");
  const [quickName, setQuickName] = useState("");
  const [quickBrand, setQuickBrand] = useState("");
  const [quickCategory, setQuickCategory] = useState("Skincare");

  const activeProducts = products.filter(p => !p.finished);
  const expiringSoon = activeProducts.filter(p => {
    if (!p.openedDate || !p.paoMonths) return false;
    const { daysLeft } = getExpiryProgress(p.openedDate, p.paoMonths);
    return daysLeft > 0 && daysLeft < 30;
  });

  const quickAdd = () => {
    if (!quickName.trim()) return;
    const product: Product = {
      id: genId(), name: quickName.trim(), category: quickCategory, brand: quickBrand.trim(),
      opened: false, openedDate: "", paoMonths: 12,
      expiry: "", notes: "", rating: 0, repurchase: false,
      price: 0, sizeMl: 0, photoUrl: "",
      frequency: "Diário", finished: false,
    };
    setProducts(prev => [...prev, product]);
    setQuickName("");
    setQuickBrand("");
  };

  const save = () => {
    if (!form.name?.trim()) return;
    if (editId) {
      // edição: troca só o que o formulário mostra; id, "acabou", nota e foto ficam
      const id = editId;
      setProducts(prev => prev.map(x => x.id === id ? {
        ...x, name: form.name!.trim(), category: form.category || x.category || "Outro", brand: form.brand || "",
        opened: !!form.openedDate, openedDate: form.openedDate || "", paoMonths: form.paoMonths || 12,
        notes: form.notes || "", repurchase: form.repurchase || false,
        price: form.price || 0, sizeMl: form.sizeMl || 0,
      } : x));
    } else {
      const product: Product = {
        id: genId(), name: form.name.trim(), category: form.category || "Outro", brand: form.brand || "",
        opened: !!form.openedDate, openedDate: form.openedDate || "", paoMonths: form.paoMonths || 12,
        expiry: "", notes: form.notes || "", rating: 0, repurchase: form.repurchase || false,
        price: form.price || 0, sizeMl: form.sizeMl || 0, photoUrl: form.photoUrl || "",
        frequency: form.frequency || "Diário", finished: false,
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

  const abrirEdicao = (p: Product) => {
    setForm({ ...emptyProduct, ...(products.find(x => x.id === p.id) ?? p) });
    setEditId(p.id);
    setSelectedProduct(null);
    setShowForm(true);
  };

  // Apaga já e oferece Desfazer (26/09, varredura: a lixeira apagava sem volta).
  const apagarProduto = (p: Product) => {
    const idx = products.findIndex(x => x.id === p.id);
    const atual = products[idx] ?? p;
    setProducts(prev => prev.filter(x => x.id !== p.id));
    setSelectedProduct(null);
    if (editId === p.id) fecharForm();
    avisarApagado(`"${atual.name}" saiu dos seus produtos`, () =>
      setProducts(prev => (prev.some(x => x.id === p.id) ? prev : inserirEm(prev, idx, atual))));
  };

  const markFinished = (p: Product) => {
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
    <div className="space-y-4 mt-4">
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
        <div className="px-4 py-2 border-t border-bz-linha flex items-center justify-between">
          <p className="text-[12px] text-bz-suave">{activeProducts.length} produtos ativos</p>
          <div className="flex gap-2 flex-wrap">
            {categories.map(c => {
              const count = activeProducts.filter(p => p.category === c).length;
              if (!count) return null;
              const Icone = ICONE_DA_CATEGORIA[c] ?? Sparkles;
              return (
                <span key={c} className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-bz-suave tabular-nums" title={c}>
                  <Icone className="w-3.5 h-3.5 text-bz-acento" aria-hidden="true" /> {count}
                </span>
              );
            })}
          </div>
        </div>
      </CartaoBeleza>

      {/* Expiring alerts */}
      {expiringSoon.length > 0 && (
        <CartaoBeleza className="border-bz-alerta-tinta/25">
          <FaixaBeleza tom="alerta" icone={<AlarmClock className="w-4 h-4 text-bz-alerta-tinta" />} titulo="VENCENDO EM BREVE" />
          <div className="px-4 py-2.5 space-y-1">
            {expiringSoon.map(p => {
              const { daysLeft } = getExpiryProgress(p.openedDate, p.paoMonths);
              return <p key={p.id} className="text-[12.5px] leading-snug text-bz-alerta-tinta"><b className="font-semibold">{p.name}</b> — {daysLeft} dias. Hora de repor!</p>;
            })}
          </div>
        </CartaoBeleza>
      )}

      {/* Triggers banner */}
      {triggers.length > 0 && (
        <div className="rounded-2xl bg-bz-alerta px-4 py-2.5">
          <p className="text-[12px] text-bz-alerta-tinta font-semibold">🚫 Lembrete: Evite produtos com {triggers.join(", ")}</p>
        </div>
      )}

      {/* A PRATELEIRA (28/09): cada produto numa linha de loja de beleza — marca em miúdo, o
          nome inteiro (até 2 linhas), validade e custo por dose em pílula. A tabela de colunas
          cortava o nome no celular ("Gel de Limpe…") e repetia "Skincare" em toda linha; a
          categoria ficou no emoji. Tocar abre o detalhe (Editar, Acabou, Apagar). */}
      <CartaoBeleza>
        <div className="bg-bz-blush px-4 py-2">
          <span className={ROTULO_BZ}>Na prateleira</span>
        </div>
        <div className="divide-y divide-bz-linha">
          {activeProducts.map(p => {
            const cpd = costPerDose(p);
            const expiry = p.openedDate && p.paoMonths ? getExpiryProgress(p.openedDate, p.paoMonths) : null;
            const Icone = ICONE_DA_CATEGORIA[p.category] ?? Sparkles;
            return (
              <div key={p.id} className="px-3.5 py-2.5 min-h-[64px] flex items-center gap-3 cursor-pointer hover:bg-bz-blush/50 active:bg-bz-blush/60 transition-colors group"
                onClick={() => setSelectedProduct(p)} data-testid="produto-meu">
                <span className="w-10 h-10 shrink-0 rounded-full bg-bz-rose grid place-items-center" aria-hidden="true" title={p.category}>
                  <Icone className="w-[18px] h-[18px] text-bz-acento" />
                </span>
                <div className="min-w-0 flex-1">
                  {p.brand && <p className="text-[10px] font-extrabold tracking-[.12em] uppercase text-bz-suave truncate">{p.brand}</p>}
                  <p className="text-[13.5px] font-semibold leading-snug text-bz-tinta line-clamp-2 break-words">{p.name}</p>
                  {(expiry || cpd !== null || p.repurchase) && (
                    <p className="mt-1 flex flex-wrap gap-1">
                      {expiry && <Chip tom={expiry.expired || expiry.daysLeft < 30 ? "alerta" : "ok"}>{textoDaValidade(expiry)}</Chip>}
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

          {activeProducts.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-[12.5px] text-bz-suave italic">Nenhum produto ainda — adicione abaixo</p>
            </div>
          )}

          {/* Inline quick-add row */}
          <div className="px-3.5 py-3 space-y-2 bg-bz-papel">
            <Input
              placeholder="Nome do produto"
              value={quickName}
              onChange={e => setQuickName(e.target.value)}
              className={CAMPO}
              onKeyDown={e => { if (e.key === "Enter") quickAdd(); }}
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="Marca"
                value={quickBrand}
                onChange={e => setQuickBrand(e.target.value)}
                className={CAMPO}
                onKeyDown={e => { if (e.key === "Enter") quickAdd(); }}
              />
              <Select value={quickCategory} onValueChange={setQuickCategory}>
                <SelectTrigger className={CAMPO}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={TEMA_BELEZA}>
                  {categories.map(c => <SelectItem key={c} value={c}>{catEmoji[c]} {c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="h-10 px-4 rounded-full text-[13px] font-bold flex-1" onClick={quickAdd}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar
              </Button>
              <Button size="sm" variant="ghost" className="h-10 px-4 rounded-full text-[13px] text-bz-suave" onClick={() => { if (editId) { setEditId(null); setForm({ ...emptyProduct }); } setShowForm(true); }}>
                + Detalhes
              </Button>
            </div>
          </div>
        </div>
      </CartaoBeleza>

      {/* Add form (detailed) — o mesmo serve pra editar */}
      {showForm && (
        <div ref={formRef} className="rounded-[var(--bz-raio,24px)] border border-bz-linha bg-bz-cartao p-4 space-y-3 scroll-mt-32">
          {editId && <p className="text-[10.5px] font-extrabold uppercase tracking-[.14em] text-bz-suave">✏️ Editar produto</p>}
          <Input placeholder="Nome do produto" value={form.name || ""} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={CAMPO} />
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Marca" value={form.brand || ""} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} className={CAMPO} />
            <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
              <SelectTrigger className={CAMPO}><SelectValue /></SelectTrigger>
              <SelectContent className={TEMA_BELEZA}>{categories.map(c => <SelectItem key={c} value={c}>{catEmoji[c]} {c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
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
              <label className="text-[10.5px] text-bz-suave">Data de Abertura</label>
              <Input type="date" value={form.openedDate || ""} onChange={e => setForm(p => ({ ...p, openedDate: e.target.value }))} className={cn(CAMPO, "appearance-none [&::-webkit-date-and-time-value]:text-left")} />
            </div>
            <div>
              <label className="text-[10.5px] text-bz-suave">PAO (meses)</label>
              <Select value={String(form.paoMonths || 12)} onValueChange={v => setForm(p => ({ ...p, paoMonths: parseInt(v) }))}>
                <SelectTrigger className={CAMPO}><SelectValue /></SelectTrigger>
                <SelectContent className={TEMA_BELEZA}>{paoOptions.map(m => <SelectItem key={m} value={String(m)}>{m}M</SelectItem>)}</SelectContent>
              </Select>
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
            const expiry = p.openedDate && p.paoMonths ? getExpiryProgress(p.openedDate, p.paoMonths) : null;
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2"><span>{catEmoji[p.category]}</span> {p.name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-bz-suave text-[10.5px]">Marca</span><p className="font-medium">{p.brand || "—"}</p></div>
                    <div><span className="text-bz-suave text-[10.5px]">Preço</span><p className="font-medium">{p.price ? `R$ ${p.price.toFixed(2)}` : "—"}</p></div>
                    <div><span className="text-bz-suave text-[10.5px]">Tamanho</span><p className="font-medium">{p.sizeMl ? `${p.sizeMl} ml` : "—"}</p></div>
                    {cpd !== null && <div><span className="text-bz-suave text-[10.5px]">Custo/dose</span><p className="font-medium text-bz-ok-tinta">R$ {cpd.toFixed(2)}</p></div>}
                  </div>
                  {expiry && (
                    <div>
                      <p className="text-[11px] text-bz-suave mb-1">Validade PAO {p.paoMonths}M</p>
                      <div className="h-2 bg-bz-blush rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${expiry.daysLeft < 15 ? "bg-bz-alerta-tinta" : expiry.daysLeft < 30 ? "bg-bz-acido" : "bg-bz-ok-tinta"}`}
                          style={{ width: `${Math.min(100, expiry.percent)}%` }} />
                      </div>
                      <p className="text-[11px] mt-1 text-bz-suave">{expiry.expired ? "⚠️ Vencido!" : `${expiry.daysLeft} dias restantes`}</p>
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
