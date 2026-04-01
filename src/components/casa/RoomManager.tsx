import { useState } from "react";
import { usePersistedState } from "@/hooks/use-persisted-state";
import { Plus, X, Trash2, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

interface RoomTask {
  id: string;
  text: string;
  done: boolean;
}

interface Room {
  id: string;
  name: string;
  color: string;
  tasks: RoomTask[];
}

const ROOM_COLORS = [
  { label: "Amarelo", value: "bg-yellow-200 dark:bg-yellow-900/40" },
  { label: "Lilás", value: "bg-purple-200 dark:bg-purple-900/40" },
  { label: "Verde", value: "bg-green-200 dark:bg-green-900/40" },
  { label: "Azul", value: "bg-blue-200 dark:bg-blue-900/40" },
  { label: "Rosa", value: "bg-pink-200 dark:bg-pink-900/40" },
  { label: "Cinza", value: "bg-gray-200 dark:bg-gray-700/40" },
  { label: "Laranja", value: "bg-orange-200 dark:bg-orange-900/40" },
  { label: "Ciano", value: "bg-cyan-200 dark:bg-cyan-900/40" },
];

const BODY_COLORS: Record<string, string> = {
  "bg-yellow-200 dark:bg-yellow-900/40": "bg-yellow-50 dark:bg-yellow-950/20",
  "bg-purple-200 dark:bg-purple-900/40": "bg-purple-50 dark:bg-purple-950/20",
  "bg-green-200 dark:bg-green-900/40": "bg-green-50 dark:bg-green-950/20",
  "bg-blue-200 dark:bg-blue-900/40": "bg-blue-50 dark:bg-blue-950/20",
  "bg-pink-200 dark:bg-pink-900/40": "bg-pink-50 dark:bg-pink-950/20",
  "bg-gray-200 dark:bg-gray-700/40": "bg-gray-50 dark:bg-gray-900/20",
  "bg-orange-200 dark:bg-orange-900/40": "bg-orange-50 dark:bg-orange-950/20",
  "bg-cyan-200 dark:bg-cyan-900/40": "bg-cyan-50 dark:bg-cyan-950/20",
};

const defaultRooms: Room[] = [
  { id: "1", name: "QUARTO CASAL", color: "bg-yellow-200 dark:bg-yellow-900/40", tasks: [] },
  { id: "2", name: "SALA DE ESTAR", color: "bg-orange-200 dark:bg-orange-900/40", tasks: [] },
  { id: "3", name: "COZINHA", color: "bg-green-200 dark:bg-green-900/40", tasks: [] },
  { id: "4", name: "BANHEIROS", color: "bg-cyan-200 dark:bg-cyan-900/40", tasks: [] },
  { id: "5", name: "LAVANDERIA", color: "bg-pink-200 dark:bg-pink-900/40", tasks: [] },
  { id: "6", name: "ÁREA EXTERNA", color: "bg-gray-200 dark:bg-gray-700/40", tasks: [] },
];

const RoomManager = () => {
  const [rooms, setRooms] = usePersistedState<Room[]>("casa-rooms", defaultRooms);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(ROOM_COLORS[0].value);
  const [newTaskInputs, setNewTaskInputs] = useState<Record<string, string>>({});

  const addRoom = () => {
    if (!newName.trim()) return;
    setRooms(prev => [...prev, {
      id: Date.now().toString(),
      name: newName.trim().toUpperCase(),
      color: newColor,
      tasks: [],
    }]);
    setNewName("");
    setShowAdd(false);
  };

  const removeRoom = (id: string) => {
    setRooms(prev => prev.filter(r => r.id !== id));
  };

  const addTask = (roomId: string) => {
    const text = newTaskInputs[roomId]?.trim();
    if (!text) return;
    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, tasks: [...r.tasks, { id: Date.now().toString(), text, done: false }] } : r
    ));
    setNewTaskInputs(prev => ({ ...prev, [roomId]: "" }));
  };

  const toggleTask = (roomId: string, taskId: string) => {
    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, tasks: r.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) } : r
    ));
  };

  const removeTask = (roomId: string, taskId: string) => {
    setRooms(prev => prev.map(r =>
      r.id === roomId ? { ...r, tasks: r.tasks.filter(t => t.id !== taskId) } : r
    ));
  };

  const doneCount = rooms.reduce((sum, r) => sum + r.tasks.filter(t => t.done).length, 0);
  const totalCount = rooms.reduce((sum, r) => sum + r.tasks.length, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black uppercase tracking-wide">COMPRAS E AFAZERES</h3>
          <p className="text-xs text-muted-foreground">
            {totalCount > 0 ? `${doneCount}/${totalCount} concluídos` : "Adicione tarefas aos cômodos"}
          </p>
        </div>
        <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="w-3 h-3" /> Cômodo
        </Button>
      </div>

      {/* Add Room Form */}
      {showAdd && (
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-xs font-bold">Novo Cômodo</p>
          <Input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Nome do cômodo (ex: Escritório)"
            className="text-sm h-9"
            onKeyDown={e => e.key === "Enter" && addRoom()}
          />
          <div className="flex gap-2 flex-wrap">
            {ROOM_COLORS.map(c => (
              <button
                key={c.value}
                onClick={() => setNewColor(c.value)}
                className={`w-8 h-8 rounded-lg ${c.value} border-2 transition-all ${newColor === c.value ? "border-foreground scale-110" : "border-transparent"}`}
                title={c.label}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-8 flex-1" onClick={addRoom}>Adicionar</Button>
            <Button size="sm" variant="outline" className="h-8" onClick={() => setShowAdd(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Room Cards */}
      {rooms.map(room => {
        const bodyColor = BODY_COLORS[room.color] || "bg-card";
        return (
          <div key={room.id} className={`rounded-2xl border border-border overflow-hidden ${bodyColor}`}>
            {/* Colored Header */}
            <div className={`${room.color} px-5 py-4 flex items-center justify-between`}>
              <h4 className="text-base font-black uppercase tracking-wide text-foreground">{room.name}</h4>
              <button
                onClick={() => removeRoom(room.id)}
                className="opacity-60 hover:opacity-100 transition-opacity"
                title="Remover cômodo"
              >
                <Trash2 className="w-4 h-4 text-foreground" />
              </button>
            </div>

            {/* Tasks */}
            <div className="p-4 space-y-1">
              {room.tasks.map(task => (
                <div key={task.id} className="flex items-center gap-3 py-2 group">
                  <Checkbox
                    checked={task.done}
                    onCheckedChange={() => toggleTask(room.id, task.id)}
                    className="w-5 h-5"
                  />
                  <span className={`text-sm flex-1 ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.text}
                  </span>
                  <button
                    onClick={() => removeTask(room.id, task.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              ))}

              {room.tasks.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 italic">Nenhuma tarefa ainda</p>
              )}

              {/* Add task inline */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                <Checkbox disabled className="w-5 h-5 opacity-30" />
                <Input
                  value={newTaskInputs[room.id] || ""}
                  onChange={e => setNewTaskInputs(prev => ({ ...prev, [room.id]: e.target.value }))}
                  placeholder="Adicionar item..."
                  className="text-sm h-8 border-0 bg-transparent shadow-none px-0 focus-visible:ring-0"
                  onKeyDown={e => e.key === "Enter" && addTask(room.id)}
                />
                {(newTaskInputs[room.id] || "").trim() && (
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => addTask(room.id)}>
                    <Plus className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RoomManager;
