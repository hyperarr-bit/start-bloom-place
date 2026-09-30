/**
 * GASTOS DO PET (visual novo em 29/09; dados como sempre).
 *
 * Chaves e formato intocados: `pet-expenses` [{ id, petId, category,
 * description, value, date }] e `pet-expense-categories` (só as criadas pela
 * pessoa). O que mudou: o resumo do mês virou o "extrato" do documento, com
 * o total por pet e por categoria; o formulário (campos de 28 px, pequenos
 * demais pro dedo) virou folha com campos de 44 px; lápis e lixeira na linha.
 */
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2, X, Check } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { localDayKey, dataSegura } from "@/lib/utils";
import { avisarApagado } from "@/lib/desfazer";
import { petsValidos } from "@/lib/pet";
import { CampoData } from "@/components/ui/campo-data";
import { BotaoPet, CartaoPet, Chip, FolhaPet, RotuloCampo, campoClasse } from "./kit";

interface PetExpense {
  id: string;
  petId: string;
  category: string;
  description: string;
  value: number;
  date: string;
}

// As 6 de sempre continuam FIXAS no código: são o padrão de quem acabou de
// abrir o app e não podem depender de nada gravado.
const CATEGORIAS_PADRAO = ["Ração", "Veterinário", "Banho/Tosa", "Medicamento", "Brinquedo", "Outro"];
const EMOJI_CATEGORIA: Record<string, string> = { "Ração": "🥣", "Veterinário": "🩺", "Banho/Tosa": "🛁", "Medicamento": "💊", "Brinquedo": "🎾", "Outro": "🐾" };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const valorOk = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;
/** "1.234,56" → 1234.56 · "189,9" → 189.9 · "189.90" (ponto como decimal, sem vírgula) → 189.9 */
const lerValor = (s: string): number => {
  const t = s.trim();
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) ? n : NaN;
};

export const PetExpenses = () => {
  const { get, set } = useUserData();
  const pets = petsValidos(get<unknown>("pet-list", []));
  const brutos = get<unknown>("pet-expenses", []);
  const expenses = useMemo(
    () => (Array.isArray(brutos) ? brutos : []).filter((e): e is PetExpense => !!e && typeof e === "object" && typeof (e as PetExpense).date === "string" && valorOk((e as PetExpense).value)),
    [brutos],
  );
  // Só as criadas pela pessoa vão pro banco — as padrão ficam fora da chave
  // pra que renomear/remover uma delas no futuro não exija migração de dados.
  const categoriasCustom = (get<unknown>("pet-expense-categories", []) as string[]).filter((c) => typeof c === "string");
  const categories = [...CATEGORIAS_PADRAO, ...categoriasCustom.filter((c) => !CATEGORIAS_PADRAO.includes(c))];

  const [form, setForm] = useState<null | { id?: string; petId: string; category: string; description: string; value: string; date: string }>(null);
  const [novaCat, setNovaCat] = useState("");

  // Mês pelo fuso LOCAL (regra fixada depois do bug de datas de julho)
  const mes = localDayKey().slice(0, 7);
  const doMes = expenses.filter((e) => e.date.startsWith(mes)).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const total = doMes.reduce((s, e) => s + e.value, 0);
  // O resumo sai dos GASTOS (não da lista de categorias): gasto de categoria apagada ou de versão antiga também soma
  const porCategoria = Array.from(new Set(doMes.map((e) => e.category || "Outro")))
    .map((cat) => ({ cat, total: doMes.filter((e) => (e.category || "Outro") === cat).reduce((s, e) => s + e.value, 0) }))
    .sort((a, b) => b.total - a.total);
  const porPet = pets.map((p) => ({ p, total: doMes.filter((e) => e.petId === p.id).reduce((s, e) => s + e.value, 0) })).filter((x) => x.total > 0);
  const nomeDoMes = new Date().toLocaleDateString("pt-BR", { month: "long" });

  const abrirNovo = () => setForm({ petId: pets.length === 1 ? pets[0].id : "", category: "Ração", description: "", value: "", date: localDayKey() });
  const abrirEdicao = (e: PetExpense) => setForm({ id: e.id, petId: e.petId, category: e.category, description: e.description || "", value: String(e.value).replace(".", ","), date: e.date });

  const salvar = () => {
    if (!form) return;
    const v = lerValor(form.value);
    if (!Number.isFinite(v) || v <= 0) return;
    const atual = Array.isArray(get<unknown>("pet-expenses", [])) ? (get<unknown>("pet-expenses", []) as PetExpense[]) : [];
    if (form.id) {
      set("pet-expenses", atual.map((e) => (e?.id !== form.id ? e : { ...e, petId: form.petId, category: form.category, description: form.description.trim(), value: v, date: form.date || e.date })));
    } else {
      set("pet-expenses", [...atual, { id: Date.now().toString(), petId: form.petId, category: form.category, description: form.description.trim(), value: v, date: form.date || localDayKey() }]);
    }
    setForm(null);
  };

  const apagar = (e: PetExpense) => {
    const atual = get<unknown>("pet-expenses", []) as PetExpense[];
    set("pet-expenses", atual.filter((x) => x?.id !== e.id));
    avisarApagado("Gasto apagado", () => set("pet-expenses", [...(get<unknown>("pet-expenses", []) as PetExpense[]), e]));
  };

  /* categorias da pessoa */
  const addCategoria = () => {
    const nome = novaCat.trim();
    if (!nome) return;
    // "racao" e "Ração" como duas categorias quebraria o resumo em dois pedaços da mesma coisa
    const existente = categories.find((c) => c.localeCompare(nome, "pt-BR", { sensitivity: "base" }) === 0);
    if (!existente) set("pet-expense-categories", [...categoriasCustom, nome]);
    setForm((f) => (f ? { ...f, category: existente || nome } : f));
    setNovaCat("");
  };
  // Trava dura: gasto já lançado ficaria órfão de categoria no resumo
  const emUso = (cat: string) => expenses.some((e) => e.category === cat);
  const removeCategoria = (cat: string) => {
    if (emUso(cat)) return;
    set("pet-expense-categories", categoriasCustom.filter((c) => c !== cat));
    setForm((f) => (f && f.category === cat ? { ...f, category: CATEGORIAS_PADRAO[0] } : f));
  };
  // gasto antigo numa categoria que saiu da lista: a opção dele continua na edição
  const opcoes = form && !categories.includes(form.category) ? [...categories, form.category] : categories;

  return (
    <div className="space-y-3">
      <CartaoPet titulo={`Gastos de ${nomeDoMes}`} direita={<span className="tabular-nums">{doMes.length} {doMes.length === 1 ? "lançamento" : "lançamentos"}</span>} dataCard="GASTOS DO MES">
        <div className="px-3.5 py-3">
          <p className="text-[30px] font-extrabold tracking-tight leading-none tabular-nums text-foreground" data-testid="gastos-total">{reais(total)}</p>
          {porPet.length > 1 && (
            <p className="text-[12.5px] text-muted-foreground mt-1.5">{porPet.map((x) => `${x.p.name} ${reais(x.total)}`).join(" · ")}</p>
          )}
          {porCategoria.length > 0 && (
            <ul className="mt-3 space-y-2">
              {porCategoria.map((c) => (
                <li key={c.cat} className="text-[12.5px]">
                  <div className="flex justify-between gap-2"><span className="text-foreground">{EMOJI_CATEGORIA[c.cat] ?? "🐾"} {c.cat}</span><span className="tabular-nums font-semibold text-foreground">{reais(c.total)}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-[hsl(var(--pet-mel))]" style={{ width: `${Math.max(4, Math.round((c.total / (total || 1)) * 100))}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CartaoPet>

      <CartaoPet titulo="Lançamentos" dataCard="GASTOS">
        {doMes.length === 0 ? (
          <p className="px-3.5 py-3 text-[13px] text-muted-foreground">Nenhum gasto este mês. Ração, vet, banho — tudo soma aqui.</p>
        ) : (
          <ul>
            {doMes.map((e, idx) => {
              const pet = pets.find((p) => p.id === e.petId);
              const rotulo = e.description || e.category;
              return (
                <li key={e.id} className={`flex items-center gap-1 pl-3.5 pr-1 min-h-[56px] ${idx ? "border-t border-border" : ""}`}>
                  <button type="button" onClick={() => abrirEdicao(e)} aria-label={`Editar gasto ${rotulo}`} className="flex-1 min-w-0 flex items-center gap-3 text-left min-h-[48px]">
                    <span className="text-[17px] w-6 text-center shrink-0" aria-hidden="true">{EMOJI_CATEGORIA[e.category] ?? "🐾"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-semibold truncate text-foreground">{rotulo}</span>
                      <span className="block text-[12px] text-muted-foreground truncate">{[pet?.name, e.category, dataSegura(e.date, "dd/MM")].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span className="text-[14px] font-bold tabular-nums shrink-0 text-foreground">{reais(e.value)}</span>
                  </button>
                  {/* lápis sempre visível (no celular não existe hover); apagar mora na folha de edição —
                      com lixeira na linha, o nome do gasto e o pet viravam "Ração Premier 1…" */}
                  <button type="button" onClick={() => abrirEdicao(e)} aria-label={`Editar gasto ${rotulo}`} className="w-11 h-11 shrink-0 grid place-items-center rounded-lg text-muted-foreground hover:text-foreground"><Pencil className="w-4 h-4" aria-hidden="true" /></button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="border-t border-border p-2">
          <BotaoPet onClick={abrirNovo} className="w-full" data-testid="gasto-novo"><Plus className="w-4 h-4" aria-hidden="true" /> Novo gasto</BotaoPet>
        </div>
      </CartaoPet>

      <FolhaPet aberta={!!form} onFechar={() => setForm(null)} titulo={form?.id ? "Editar gasto" : "Novo gasto"} testId="folha-gasto">
        {form && (
          <div className="space-y-3">
            {pets.length > 0 && (
              <div>
                <RotuloCampo>De quem</RotuloCampo>
                <div className="flex flex-wrap gap-1.5">
                  {pets.map((p) => <Chip key={p.id} ativo={form.petId === p.id} onClick={() => setForm({ ...form, petId: form.petId === p.id ? "" : p.id })}>{p.name}</Chip>)}
                </div>
              </div>
            )}
            <div>
              <RotuloCampo>Categoria</RotuloCampo>
              <div className="flex flex-wrap gap-1.5">
                {opcoes.map((c) => (
                  <Chip key={c} ativo={form.category === c} onClick={() => setForm({ ...form, category: c })} className="min-h-[44px] text-[12.5px]">
                    {EMOJI_CATEGORIA[c] ? `${EMOJI_CATEGORIA[c]} ` : ""}{c}
                  </Chip>
                ))}
              </div>
              {/* Categoria da pessoa, não a nossa: "Adestramento", "Areia", "Plano de saúde"… */}
              <div className="mt-2 flex gap-2">
                <input value={novaCat} onChange={(e) => setNovaCat(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addCategoria()} placeholder="Nova categoria (ex.: Adestramento)" className={campoClasse} aria-label="Nova categoria" />
                <BotaoPet variante="secundario" onClick={addCategoria} aria-label="Criar categoria" className="w-11 px-0 shrink-0"><Check className="w-4 h-4" aria-hidden="true" /></BotaoPet>
              </div>
              {categoriasCustom.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {categoriasCustom.map((c) => (
                    <span key={c} className="inline-flex items-center h-11 rounded-full border border-border pl-3 text-[12px] text-foreground">
                      {c}
                      {emUso(c) ? <span className="px-2.5 text-[11px] text-muted-foreground">em uso</span> : (
                        <button type="button" onClick={() => removeCategoria(c)} aria-label={`Apagar categoria ${c}`} className="w-11 h-11 grid place-items-center text-muted-foreground hover:text-destructive"><X className="w-3.5 h-3.5" aria-hidden="true" /></button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <RotuloCampo htmlFor="gasto-valor">Valor (R$)</RotuloCampo>
                <input id="gasto-valor" inputMode="decimal" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value.replace(/[^\d.,]/g, "") })} placeholder="0,00" className={`${campoClasse} tabular-nums`} data-testid="gasto-valor" />
              </div>
              <div>
                <RotuloCampo htmlFor="gasto-data">Data</RotuloCampo>
                <CampoData id="gasto-data" rotulo="Hoje" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={campoClasse} />
              </div>
            </div>
            <div>
              <RotuloCampo htmlFor="gasto-desc">Descrição (opcional)</RotuloCampo>
              <input id="gasto-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: Ração 15 kg" className={campoClasse} />
            </div>
            <BotaoPet className="w-full" onClick={salvar} disabled={!(lerValor(form.value) > 0)} data-testid="gasto-salvar">
              {form.id ? "Salvar gasto" : "Lançar gasto"}
            </BotaoPet>
            {form.id && (
              <BotaoPet
                variante="perigo"
                className="w-full"
                onClick={() => { const e = expenses.find((x) => x.id === form.id); if (e) apagar(e); setForm(null); }}
                data-testid="gasto-apagar"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" /> Apagar este gasto
              </BotaoPet>
            )}
          </div>
        )}
      </FolhaPet>
    </div>
  );
};
