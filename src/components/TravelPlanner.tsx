import { useState } from "react";
import { Plus, Trash2, Plane, Hotel, Utensils, Camera, Car, Ticket, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";

interface TravelExpense {
  id: string;
  category: "passagem" | "hospedagem" | "alimentacao" | "passeios" | "transporte" | "outros";
  description: string;
  estimatedCost: number;
  actualCost?: number;
  paid: boolean;
}

interface Trip {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  budget: number;
  savedAmount: number;
  expenses: TravelExpense[];
}

interface TravelPlannerProps {
  trips: Trip[];
  setTrips: (trips: Trip[]) => void;
}

const categoryIcons = {
  passagem: Plane,
  hospedagem: Hotel,
  alimentacao: Utensils,
  passeios: Camera,
  transporte: Car,
  outros: Ticket,
};

const categoryLabels = {
  passagem: "Passagens",
  hospedagem: "Hospedagem",
  alimentacao: "Alimentação",
  passeios: "Passeios",
  transporte: "Transporte",
  outros: "Outros",
};

export const TravelPlanner = ({ trips, setTrips }: TravelPlannerProps) => {
  const [showTripForm, setShowTripForm] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<string | null>(null);
  const [newTrip, setNewTrip] = useState<Partial<Trip>>({ expenses: [] });
  const [newExpense, setNewExpense] = useState<Partial<TravelExpense>>({ category: "passagem", paid: false });

  const addTrip = () => {
    if (!newTrip.destination || !newTrip.budget) return;
    const trip: Trip = {
      id: Date.now().toString(),
      destination: newTrip.destination,
      startDate: newTrip.startDate || "",
      endDate: newTrip.endDate || "",
      budget: newTrip.budget,
      savedAmount: newTrip.savedAmount || 0,
      expenses: [],
    };
    setTrips([...trips, trip]);
    setNewTrip({ expenses: [] });
    setShowTripForm(false);
  };

  const deleteTrip = (id: string) => {
    setTrips(trips.filter((t) => t.id !== id));
    if (selectedTrip === id) setSelectedTrip(null);
  };

  const addExpense = (tripId: string) => {
    if (!newExpense.description || !newExpense.estimatedCost) return;
    const expense: TravelExpense = {
      id: Date.now().toString(),
      category: newExpense.category || "outros",
      description: newExpense.description,
      estimatedCost: newExpense.estimatedCost,
      actualCost: newExpense.actualCost,
      paid: newExpense.paid || false,
    };
    setTrips(
      trips.map((t) =>
        t.id === tripId ? { ...t, expenses: [...t.expenses, expense] } : t
      )
    );
    setNewExpense({ category: "passagem", paid: false });
  };

  const deleteExpense = (tripId: string, expenseId: string) => {
    setTrips(
      trips.map((t) =>
        t.id === tripId
          ? { ...t, expenses: t.expenses.filter((e) => e.id !== expenseId) }
          : t
      )
    );
  };

  const toggleExpensePaid = (tripId: string, expenseId: string) => {
    setTrips(
      trips.map((t) =>
        t.id === tripId
          ? {
              ...t,
              expenses: t.expenses.map((e) =>
                e.id === expenseId ? { ...e, paid: !e.paid } : e
              ),
            }
          : t
      )
    );
  };

  const updateSavedAmount = (tripId: string, amount: number) => {
    setTrips(trips.map((t) => (t.id === tripId ? { ...t, savedAmount: amount } : t)));
  };

  const activeTrip = selectedTrip ? trips.find((t) => t.id === selectedTrip) : null;

  return (
    <div className="space-y-4">
      {/* Trip Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {trips.map((trip) => {
          const totalEstimated = trip.expenses.reduce((sum, e) => sum + e.estimatedCost, 0);
          const totalPaid = trip.expenses.filter((e) => e.paid).reduce((sum, e) => sum + (e.actualCost || e.estimatedCost), 0);
          const progress = trip.budget > 0 ? (trip.savedAmount / trip.budget) * 100 : 0;
          const daysUntil = trip.startDate
            ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <div
              key={trip.id}
              className={`bg-card rounded-lg border cursor-pointer transition-all ${
                selectedTrip === trip.id
                  ? "border-primary ring-2 ring-primary/20"
                  : "border-border hover:border-primary/50"
              }`}
              onClick={() => setSelectedTrip(trip.id)}
            >
              <div className="p-3">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {trip.destination}
                    </p>
                    {trip.startDate && trip.endDate && (
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(trip.startDate).toLocaleDateString("pt-BR")} -{" "}
                        {new Date(trip.endDate).toLocaleDateString("pt-BR")}
                      </p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTrip(trip.id);
                    }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>

                {daysUntil !== null && daysUntil > 0 && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded px-2 py-1 mb-2">
                    <p className="text-[10px] text-blue-400 text-center">
                      ✈️ Faltam {daysUntil} dias
                    </p>
                  </div>
                )}

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Orçamento:</span>
                    <span>R$ {trip.budget.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Guardado:</span>
                    <span className="text-green-400">R$ {trip.savedAmount.toLocaleString("pt-BR")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Custos estimados:</span>
                    <span className="text-orange-400">R$ {totalEstimated.toLocaleString("pt-BR")}</span>
                  </div>
                </div>

                <div className="mt-2">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span>Progresso</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Trip Card */}
        <div
          className="bg-card rounded-lg border border-dashed border-border p-3 flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors min-h-[180px]"
          onClick={() => setShowTripForm(true)}
        >
          <div className="text-center">
            <Plus className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-xs text-muted-foreground">Nova Viagem</p>
          </div>
        </div>
      </div>

      {/* New Trip Form */}
      {showTripForm && (
        <div className="bg-card rounded-lg border border-border p-4 space-y-3">
          <h4 className="text-xs font-bold">PLANEJAR NOVA VIAGEM</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Input
              placeholder="Destino"
              value={newTrip.destination || ""}
              onChange={(e) => setNewTrip({ ...newTrip, destination: e.target.value })}
              className="h-8 text-xs"
            />
            <Input
              type="number"
              placeholder="Orçamento total"
              value={newTrip.budget || ""}
              onChange={(e) => setNewTrip({ ...newTrip, budget: parseFloat(e.target.value) || 0 })}
              className="h-8 text-xs"
            />
            <Input
              type="date"
              placeholder="Data ida"
              value={newTrip.startDate || ""}
              onChange={(e) => setNewTrip({ ...newTrip, startDate: e.target.value })}
              className="h-8 text-xs"
            />
            <Input
              type="date"
              placeholder="Data volta"
              value={newTrip.endDate || ""}
              onChange={(e) => setNewTrip({ ...newTrip, endDate: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={addTrip} className="h-7 text-xs">
              Criar Viagem
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowTripForm(false)} className="h-7 text-xs">
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {/* Selected Trip Details */}
      {activeTrip && (
        <div className="bg-card rounded-lg border border-border">
          <div className="table-header-dark flex items-center justify-between">
            <span className="text-xs font-bold">CUSTOS - {activeTrip.destination.toUpperCase()}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Valor guardado"
                className="h-6 text-[10px] w-32"
                defaultValue={activeTrip.savedAmount}
                onBlur={(e) => updateSavedAmount(activeTrip.id, parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          {/* Add Expense Form */}
          <div className="p-3 border-b border-border bg-muted/30">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
              <select
                value={newExpense.category}
                onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value as any })}
                className="h-8 text-xs rounded-md border border-input bg-background px-2"
              >
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <Input
                placeholder="Descrição"
                value={newExpense.description || ""}
                onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                placeholder="Custo estimado"
                value={newExpense.estimatedCost || ""}
                onChange={(e) => setNewExpense({ ...newExpense, estimatedCost: parseFloat(e.target.value) || 0 })}
                className="h-8 text-xs"
              />
              <Input
                type="number"
                placeholder="Custo real (opcional)"
                value={newExpense.actualCost || ""}
                onChange={(e) => setNewExpense({ ...newExpense, actualCost: parseFloat(e.target.value) || undefined })}
                className="h-8 text-xs"
              />
              <Button size="sm" onClick={() => addExpense(activeTrip.id)} className="h-8 text-xs">
                <Plus className="w-3 h-3 mr-1" /> Adicionar
              </Button>
            </div>
          </div>

          {/* Expenses List */}
          <div className="divide-y divide-border">
            {activeTrip.expenses.length === 0 ? (
              <div className="p-6 text-center">
                <Plane className="w-6 h-6 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">Adicione os custos da viagem</p>
              </div>
            ) : (
              activeTrip.expenses.map((expense) => {
                const Icon = categoryIcons[expense.category];
                return (
                  <div
                    key={expense.id}
                    className={`p-2 flex items-center gap-3 ${expense.paid ? "bg-green-500/5" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={expense.paid}
                      onChange={() => toggleExpensePaid(activeTrip.id, expense.id)}
                      className="w-4 h-4"
                    />
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs flex-1 truncate">{expense.description}</span>
                    <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                      {categoryLabels[expense.category]}
                    </span>
                    <span className="text-xs text-right w-24">
                      R$ {expense.estimatedCost.toLocaleString("pt-BR")}
                    </span>
                    {expense.actualCost && (
                      <span className="text-xs text-green-400 w-24 text-right">
                        Real: R$ {expense.actualCost.toLocaleString("pt-BR")}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteExpense(activeTrip.id, expense.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary by Category */}
          {activeTrip.expenses.length > 0 && (
            <div className="p-3 bg-muted/30 border-t border-border">
              <p className="text-[10px] font-bold mb-2">RESUMO POR CATEGORIA</p>
              <div className="grid grid-cols-3 lg:grid-cols-6 gap-2">
                {Object.entries(categoryLabels).map(([key, label]) => {
                  const total = activeTrip.expenses
                    .filter((e) => e.category === key)
                    .reduce((sum, e) => sum + e.estimatedCost, 0);
                  if (total === 0) return null;
                  const Icon = categoryIcons[key as keyof typeof categoryIcons];
                  return (
                    <div key={key} className="text-center">
                      <Icon className="w-4 h-4 mx-auto text-muted-foreground mb-1" />
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                      <p className="text-xs font-bold">R$ {total.toLocaleString("pt-BR")}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
