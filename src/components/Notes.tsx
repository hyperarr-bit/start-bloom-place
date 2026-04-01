import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Note {
  id: string;
  text: string;
}

interface NotesProps {
  notes: Note[];
  setNotes: (notes: Note[]) => void;
}

export const Notes = ({ notes, setNotes }: NotesProps) => {
  const [newNote, setNewNote] = useState("");

  const addNote = () => {
    if (newNote.trim()) {
      setNotes([...notes, { id: Date.now().toString(), text: newNote }]);
      setNewNote("");
    }
  };

  const deleteNote = (id: string) => setNotes(notes.filter((n) => n.id !== id));

  return (
    <div className="bg-card-dividas rounded-lg border border-card-dividas-border overflow-hidden animate-fade-in">
      <div className="bg-accent text-accent-foreground px-4 py-2 flex items-center gap-2">
        <span className="font-bold text-xs tracking-wide">ANOTAÇÕES</span>
        <span>📝</span>
      </div>
      <div className="p-3 space-y-1.5">
        {notes.length === 0 && (
          <p className="text-[10px] text-muted-foreground py-2">Anote lembretes, metas e ideias financeiras...</p>
        )}
        {notes.map((note) => (
          <div key={note.id} className="flex items-start gap-2 group text-sm">
            <span className="text-accent mt-0.5">•</span>
            <span className="flex-1 text-xs">{note.text}</span>
            <button onClick={() => deleteNote(note.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive">
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        <div className="flex gap-1 pt-1">
          <Input
            placeholder="Nova anotação..."
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNote()}
            className="h-7 text-xs border-0 bg-transparent shadow-none px-0 focus-visible:ring-0"
          />
          <button onClick={addNote} className="text-muted-foreground hover:text-foreground transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
