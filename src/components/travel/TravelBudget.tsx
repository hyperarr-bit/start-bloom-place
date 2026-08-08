import { useState, useMemo, useEffect } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { useUserData } from "@/hooks/use-user-data";
import { parseLocalDay } from "@/lib/utils";
import { TravelTrip, TravelTripsStore, TravelCostItem, TravelPlace, genId, formatCurrency, temConteudo, aplicarMigracao, PLACE_CATEGORIES, PLACE_STATUS } from "./types";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ExternalLink, ImagePlus } from "lucide-react";

const CATEGORIES = [
  { key: "passagens", emoji: "✈️", label: "PASSAGENS AÉREAS", headerColor: "bg-violet-300 dark:bg-violet-700", bodyColor: "bg-violet-50 dark:bg-violet-950/20" },
  { key: "hotel", emoji: "🏨", label: "HOTEL", headerColor: "bg-teal-300 dark:bg-teal-700", bodyColor: "bg-teal-50 dark:bg-teal-950/20" },
  { key: "passeios", emoji: "🎡", label: "PASSEIOS / TURISMO", headerColor: "bg-sky-200 dark:bg-sky-700", bodyColor: "bg-sky-50 dark:bg-sky-950/20" },
  { key: "alimentacao", emoji: "🍲", label: "ALIMENTAÇÃO", headerColor: "bg-pink-300 dark:bg-pink-700", bodyColor: "bg-pink-50 dark:bg-pink-950/20" },
  { key: "transporte", emoji: "🚕", label: "TRANSPORTE", headerColor: "bg-amber-200 dark:bg-amber-700", bodyColor: "bg-amber-50 dark:bg-amber-950/20" },
  { key: "compras", emoji: "🛍️", label: "COMPRAS", headerColor: "bg-rose-300 dark:bg-rose-700", bodyColor: "bg-rose-50 dark:bg-rose-950/20" },
];

const PLACE_CAT_OPTIONS = Object.entries(PLACE_CATEGORIES) as [keyof typeof PLACE_CATEGORIES, { label: string; emoji: string }][];
const PLACE_STATUS_OPTIONS = Object.entries(PLACE_STATUS) as [keyof typeof PLACE_STATUS, { label: string; emoji: string }][];

const defaultTrip = (): TravelTrip => ({
  id: genId(),
  destination: "",
  startDate: "",
  endDate: "",
  photoUrl: "",
  places: [],
  categories: Object.fromEntries(CATEGORIES.map(c => [c.key, []])),
});

/**
 * === POR QUE ESTE ARQUIVO MUDOU DE CHAVE (08/2026) ===
 *
 * O orçamento morava num OBJETO ÚNICO em "travel-budget-v2". Ou seja: o app
 * inteiro só cabia UMA viagem. Quem voltasse de Buenos Aires e começasse a
 * planejar Salvador escrevia por cima de tudo — datas, custos, locais — sem
 * nenhum aviso e sem desfazer.
 *
 * Agora a chave é "travel-trips-v2" (lista + qual está aberta). A chave antiga
 * continua existindo e é só LIDA, nunca escrita: usuários reais têm dados lá,
 * e reescrever/apagar seria trocar um bug por perda de dados. Na primeira
 * carga a viagem antiga entra na lista e o `migrouDoObjetoUnico` carimba que
 * já veio — sem esse carimbo a migração rodaria de novo toda vez e
 * duplicaria (ou ressuscitaria) a viagem.
 */
const CHAVE_OBJETO_UNICO = "travel-budget-v2";
const CHAVE_LISTA = "travel-trips-v2";

const storeVazio = (): TravelTripsStore => ({ trips: [], ativoId: "", migrouDoObjetoUnico: false });

// `temConteudo` e `aplicarMigracao` vivem em ./types (funções puras, com
// teste próprio em viagens-migracao.test.ts).

export const TravelBudget = () => {
  // Leitura da chave antiga. NUNCA usamos o setter dela — é fonte só de
  // leitura pra migração (e rede de segurança se algo der errado aqui).
  const [tripAntiga] = usePersistedState<TravelTrip | null>(CHAVE_OBJETO_UNICO, null);
  const [store, setStore] = usePersistedState<TravelTripsStore>(CHAVE_LISTA, storeVazio());
  const { loaded } = useUserData();

  // A migração roda por EFEITO (e não uma vez na montagem) de propósito: a
  // chave antiga pode chegar atrasada. Viagem com foto passa fácil dos 50KB,
  // e chave pesada é buscada sob demanda depois do boot (ver
  // use-persisted-state) — quem migrasse só no mount pegaria `null` e a
  // viagem da pessoa "sumiria".
  useEffect(() => {
    // Espera o store terminar de carregar. Migrar antes disso escreveria por
    // cima da lista que ainda ia chegar do servidor (quem já migrou noutro
    // aparelho perderia as viagens criadas lá).
    if (!loaded) return;
    if (store.migrouDoObjetoUnico) return;
    if (!temConteudo(tripAntiga)) return; // nada pra trazer (ainda)
    setStore(prev => aplicarMigracao(prev, tripAntiga));
  }, [loaded, tripAntiga, store.migrouDoObjetoUnico, setStore]);

  const trips = store.trips;
  const trip = trips.find(t => t.id === store.ativoId) || trips[0];

  const [confirmandoExclusao, setConfirmandoExclusao] = useState(false);

  const novaViagem = () => {
    const nova = defaultTrip();
    setStore(prev => ({ ...prev, trips: [...prev.trips, nova], ativoId: nova.id }));
    setConfirmandoExclusao(false);
  };

  const abrirViagem = (id: string) => {
    setStore(prev => ({ ...prev, ativoId: id }));
    setConfirmandoExclusao(false);
  };

  const excluirViagem = (id: string) => {
    setStore(prev => {
      const restantes = prev.trips.filter(t => t.id !== id);
      return { ...prev, trips: restantes, ativoId: prev.ativoId === id ? (restantes[0]?.id || "") : prev.ativoId };
    });
    setConfirmandoExclusao(false);
  };

  /** Toda escrita passa por aqui: mexe SÓ na viagem aberta. */
  const atualizarViagem = (updater: (t: TravelTrip) => TravelTrip) => {
    if (!trip) return;
    setStore(prev => ({ ...prev, trips: prev.trips.map(t => (t.id === trip.id ? updater(t) : t)) }));
  };

  const nightsCount = useMemo(() => {
    if (!trip?.startDate || !trip?.endDate) return 0;
    // parseLocalDay: "YYYY-MM-DD" vira meia-noite LOCAL. `new Date("2026-08-10")`
    // parseia como UTC e no Brasil escorrega um dia.
    const diff = parseLocalDay(trip.endDate).getTime() - parseLocalDay(trip.startDate).getTime();
    return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
  }, [trip?.startDate, trip?.endDate]);

  const updateTrip = (patch: Partial<TravelTrip>) => atualizarViagem(t => ({ ...t, ...patch }));

  // === Cost items ===
  const updateItem = (catKey: string, itemId: string, patch: Partial<TravelCostItem>) => {
    atualizarViagem(t => ({
      ...t,
      categories: {
        ...t.categories,
        [catKey]: (t.categories[catKey] || []).map(item => (item.id === itemId ? { ...item, ...patch } : item)),
      },
    }));
  };

  const addItem = (catKey: string) => {
    atualizarViagem(t => ({
      ...t,
      categories: {
        ...t.categories,
        [catKey]: [...(t.categories[catKey] || []), { id: genId(), description: "", estimated: 0, actual: 0 }],
      },
    }));
  };

  const removeItem = (catKey: string, itemId: string) => {
    atualizarViagem(t => ({
      ...t,
      categories: {
        ...t.categories,
        [catKey]: (t.categories[catKey] || []).filter(item => item.id !== itemId),
      },
    }));
  };

  // === Places ===
  const places = trip?.places || [];

  const addPlace = () => {
    atualizarViagem(t => ({
      ...t,
      places: [...(t.places || []), { id: genId(), name: "", category: "comida", notes: "", mapsLink: "", status: "quero_ir" }],
    }));
  };

  const updatePlace = (placeId: string, patch: Partial<TravelPlace>) => {
    atualizarViagem(t => ({ ...t, places: (t.places || []).map(p => (p.id === placeId ? { ...p, ...patch } : p)) }));
  };

  const removePlace = (placeId: string) => {
    atualizarViagem(t => ({ ...t, places: (t.places || []).filter(p => p.id !== placeId) }));
  };

  const cycleStatus = (placeId: string) => {
    const order: TravelPlace["status"][] = ["quero_ir", "ja_fui", "favorito"];
    atualizarViagem(t => ({
      ...t,
      places: (t.places || []).map(p => {
        if (p.id !== placeId) return p;
        const idx = order.indexOf(p.status);
        return { ...p, status: order[(idx + 1) % order.length] };
      }),
    }));
  };

  // === Totals ===
  const catTotals = useMemo(() => {
    return CATEGORIES.map(cat => {
      const items = trip?.categories?.[cat.key] || [];
      return {
        key: cat.key,
        label: cat.label,
        emoji: cat.emoji,
        estimated: items.reduce((s, i) => s + (i.estimated || 0), 0),
        actual: items.reduce((s, i) => s + (i.actual || 0), 0),
      };
    });
  }, [trip?.categories]);

  const grandEstimated = catTotals.reduce((s, c) => s + c.estimated, 0);
  const grandActual = catTotals.reduce((s, c) => s + c.actual, 0);

  /** Seletor de viagens — a prova visual de que agora cabe mais de uma. */
  const seletor = (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
      {trips.map(t => {
        const total = Object.values(t.categories || {}).reduce((s, items) => s + (items || []).reduce((a, i) => a + (i.estimated || 0), 0), 0);
        return (
          <button
            key={t.id}
            onClick={() => abrirViagem(t.id)}
            className={`shrink-0 rounded-xl px-4 py-2 border transition-all text-left min-w-[132px] ${
              trip?.id === t.id ? "border-foreground bg-foreground text-background shadow-sm" : "border-border bg-card hover:border-foreground/30"
            }`}
          >
            <p className="text-xs font-semibold truncate">{t.destination || "Viagem sem nome"}</p>
            <p className="text-[9px] opacity-70">
              {t.startDate ? parseLocalDay(t.startDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "sem data"}
              {total > 0 ? ` • ${formatCurrency(total)}` : ""}
            </p>
          </button>
        );
      })}
      <button
        onClick={novaViagem}
        className="shrink-0 rounded-xl px-4 py-2 border border-dashed border-border hover:border-foreground/50 min-w-[120px] flex items-center justify-center gap-1 text-muted-foreground text-xs transition-colors"
      >
        <Plus className="w-3 h-3" /> Nova viagem
      </button>
    </div>
  );

  // Sem nenhuma viagem: um botão só, sem formulário fantasma pra preencher.
  if (!trip) {
    return (
      <div className="space-y-3">
        {seletor}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="bg-blue-200 dark:bg-blue-800/60 px-3 py-2">
            <span className="text-xs font-bold uppercase tracking-wider">💰 ORÇAMENTO DE VIAGEM</span>
          </div>
          <div className="bg-blue-50 dark:bg-blue-950/20 p-6 text-center space-y-3">
            <p className="text-xs text-muted-foreground">
              Nenhuma viagem por aqui ainda. Agora dá pra ter várias — uma não apaga a outra.
            </p>
            <button onClick={novaViagem} className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-semibold">
              + Criar minha primeira viagem
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {seletor}

      {/* Destination card */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-blue-200 dark:bg-blue-800/60 px-3 py-2 flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider flex-1">📍 DESTINO</span>
          {/* Excluir em dois toques: sem confirmação, um toque errado levava a
              viagem inteira embora — que é justamente o problema que este
              arquivo veio consertar. */}
          {confirmandoExclusao ? (
            <>
              <button onClick={() => excluirViagem(trip.id)} className="h-9 px-2.5 rounded-lg bg-destructive text-destructive-foreground text-[10px] font-bold">
                Excluir mesmo
              </button>
              <button onClick={() => setConfirmandoExclusao(false)} className="h-9 px-2.5 rounded-lg border border-border text-[10px] font-medium">
                Cancelar
              </button>
            </>
          ) : (
            <button
              onClick={() => setConfirmandoExclusao(true)}
              aria-label="Excluir esta viagem"
              className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-background/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 hover:text-destructive" />
            </button>
          )}
        </div>
        <div className="bg-blue-50 dark:bg-blue-950/20 p-3 space-y-2">
          {trip.photoUrl && (
            <div className="rounded-lg overflow-hidden aspect-video relative">
              <img src={trip.photoUrl} alt={trip.destination || "Destino"} className="w-full h-full object-cover" />
              <button
                onClick={() => updateTrip({ photoUrl: "" })}
                aria-label="Remover foto do destino"
                className="absolute top-1.5 right-1.5 rounded-full w-9 h-9 bg-black/50 text-white flex items-center justify-center"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <Input
            placeholder="Nome do destino (ex: Nova York)"
            value={trip.destination}
            onChange={e => updateTrip({ destination: e.target.value })}
            className="h-9 rounded-lg text-xs bg-background/60"
          />
          {!trip.photoUrl && (
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border/60 bg-background/40 hover:bg-background/60 transition-colors px-3 py-2">
              <ImagePlus className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Adicionar foto do destino</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => updateTrip({ photoUrl: reader.result as string });
                  reader.readAsDataURL(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-muted-foreground font-medium uppercase">Data de Ida</label>
              <Input
                type="date"
                value={trip.startDate}
                onChange={e => updateTrip({ startDate: e.target.value })}
                className="h-9 rounded-lg text-xs bg-background/60 appearance-none [&::-webkit-date-and-time-value]:text-left"
              />
            </div>
            <div>
              <label className="text-[9px] text-muted-foreground font-medium uppercase">Data de Volta</label>
              <Input
                type="date"
                value={trip.endDate}
                onChange={e => updateTrip({ endDate: e.target.value })}
                className="h-9 rounded-lg text-xs bg-background/60 appearance-none [&::-webkit-date-and-time-value]:text-left"
              />
            </div>
          </div>
          {nightsCount > 0 && (
            <p className="text-xs text-muted-foreground text-center font-medium">
              🌙 {nightsCount} {nightsCount === 1 ? "noite" : "noites"}
            </p>
          )}
        </div>
      </div>

      {/* Category cards */}
      {CATEGORIES.map(cat => {
        const items = trip.categories?.[cat.key] || [];
        const totalEst = items.reduce((s, i) => s + (i.estimated || 0), 0);
        const totalAct = items.reduce((s, i) => s + (i.actual || 0), 0);

        return (
          <div key={cat.key} className="rounded-xl border border-border overflow-hidden">
            <div className={`${cat.headerColor} px-3 py-2 flex items-center justify-between`}>
              <span className="text-xs font-bold uppercase tracking-wider">
                {cat.emoji} {cat.label}
              </span>
              <button
                onClick={() => addItem(cat.key)}
                aria-label={`Adicionar item em ${cat.label}`}
                className="rounded-full w-9 h-9 flex items-center justify-center bg-background/40 hover:bg-background/70 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className={`${cat.bodyColor}`}>
              {items.length > 0 && (
                <div className="px-3 pt-2">
                  <div className="grid grid-cols-[1fr_72px_72px_36px] gap-1 mb-1">
                    <span className="text-[8px] font-bold text-muted-foreground uppercase">Descrição</span>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase text-right">Estimado</span>
                    <span className="text-[8px] font-bold text-muted-foreground uppercase text-right">Real</span>
                    <span />
                  </div>
                  {items.map(item => (
                    <div key={item.id} className="grid grid-cols-[1fr_72px_72px_36px] gap-1 items-center mb-1">
                      <Input
                        value={item.description}
                        onChange={e => updateItem(cat.key, item.id, { description: e.target.value })}
                        placeholder="Descrição"
                        className="h-9 rounded-md text-[11px] bg-background/50 border-0 px-2"
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={item.estimated || ""}
                        onChange={e => updateItem(cat.key, item.id, { estimated: Number(e.target.value) })}
                        placeholder="0"
                        className="h-9 rounded-md text-[11px] bg-background/50 border-0 px-2 text-right tabular-nums"
                      />
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={item.actual || ""}
                        onChange={e => updateItem(cat.key, item.id, { actual: Number(e.target.value) })}
                        placeholder="0"
                        className="h-9 rounded-md text-[11px] bg-background/50 border-0 px-2 text-right tabular-nums"
                      />
                      {/* Sempre visível: hover não existe no celular. */}
                      <button
                        onClick={() => removeItem(cat.key, item.id)}
                        aria-label={`Apagar ${item.description || "item"}`}
                        className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {items.length === 0 && (
                <button
                  onClick={() => addItem(cat.key)}
                  className="w-full py-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  + Adicionar item
                </button>
              )}

              {items.length > 0 && (
                <div className="px-3 py-2 border-t border-border/30 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Valor Total</span>
                  <div className="flex gap-4">
                    <span className="text-xs font-bold tabular-nums">{formatCurrency(totalEst)}</span>
                    <span className="text-xs font-bold tabular-nums">{formatCurrency(totalAct)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Places card */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-emerald-300 dark:bg-emerald-700 px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider">📍 LOCAIS PARA CONHECER</span>
          <button
            onClick={addPlace}
            aria-label="Adicionar local"
            className="rounded-full w-9 h-9 flex items-center justify-center bg-background/40 hover:bg-background/70 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-950/20">
          {places.length === 0 && (
            <button
              onClick={addPlace}
              className="w-full py-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              + Adicionar local
            </button>
          )}
          {places.map(place => (
            <div key={place.id} className="px-3 py-2.5 border-b border-border/20 last:border-b-0">
              <div className="flex items-start gap-2">
                <div className="flex-1 space-y-1.5">
                  <Input
                    value={place.name}
                    onChange={e => updatePlace(place.id, { name: e.target.value })}
                    placeholder="Nome do local"
                    className="h-9 rounded-md text-[11px] bg-background/50 border-0 px-2 font-medium"
                  />
                  <div className="flex gap-1.5 items-center flex-wrap">
                    <select
                      value={place.category}
                      onChange={e => updatePlace(place.id, { category: e.target.value as TravelPlace["category"] })}
                      aria-label="Categoria do local"
                      className="h-9 rounded-md text-[10px] bg-background/50 border-0 px-1.5 appearance-none cursor-pointer"
                    >
                      {PLACE_CAT_OPTIONS.map(([key, val]) => (
                        <option key={key} value={key}>{val.emoji} {val.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => cycleStatus(place.id)}
                      className="h-9 rounded-md text-[10px] bg-background/50 px-2 hover:bg-background/80 transition-colors whitespace-nowrap"
                    >
                      {PLACE_STATUS[place.status].emoji} {PLACE_STATUS[place.status].label}
                    </button>
                  </div>
                  <Input
                    value={place.notes}
                    onChange={e => updatePlace(place.id, { notes: e.target.value })}
                    placeholder="Notas..."
                    className="h-9 rounded-md text-[10px] bg-background/50 border-0 px-2 text-muted-foreground"
                  />
                  <div className="flex items-center gap-1">
                    <Input
                      value={place.mapsLink}
                      onChange={e => updatePlace(place.id, { mapsLink: e.target.value })}
                      placeholder="Link Google Maps"
                      className="h-9 rounded-md text-[10px] bg-background/50 border-0 px-2 flex-1"
                    />
                    {place.mapsLink && (
                      <a href={place.mapsLink} target="_blank" rel="noopener noreferrer" aria-label="Abrir no Maps" className="h-9 w-9 shrink-0 flex items-center justify-center">
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => removePlace(place.id)}
                  aria-label={`Apagar ${place.name || "local"}`}
                  className="h-9 w-9 shrink-0 flex items-center justify-center rounded-lg hover:bg-background/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grand total card */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-stone-400 dark:bg-stone-700 px-3 py-2">
          <span className="text-xs font-bold uppercase tracking-wider">💰 ORÇAMENTO TOTAL</span>
        </div>
        <div className="bg-stone-50 dark:bg-stone-950/20">
          <div className="grid grid-cols-[1fr_90px_90px] gap-1 px-3 pt-2 mb-1">
            <span className="text-[8px] font-bold text-muted-foreground uppercase">Categoria</span>
            <span className="text-[8px] font-bold text-muted-foreground uppercase text-right">Estimado</span>
            <span className="text-[8px] font-bold text-muted-foreground uppercase text-right">Real</span>
          </div>
          {catTotals.map(ct => (
            <div key={ct.key} className="grid grid-cols-[1fr_90px_90px] gap-1 px-3 py-1 items-center">
              <span className="text-[11px] font-medium">{ct.emoji} {ct.label}</span>
              <span className="text-[11px] tabular-nums text-right">{formatCurrency(ct.estimated)}</span>
              <span className="text-[11px] tabular-nums text-right">{formatCurrency(ct.actual)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_90px_90px] gap-1 px-3 py-2 border-t border-border/40 items-center">
            <span className="text-xs font-black uppercase">TOTAL</span>
            <span className="text-xs font-black tabular-nums text-right">{formatCurrency(grandEstimated)}</span>
            <span className="text-xs font-black tabular-nums text-right">{formatCurrency(grandActual)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
