import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { X, Maximize2, Minimize2 } from "lucide-react";
import { WidgetId, WidgetSize } from "@/hooks/use-home-widgets";

interface SortableWidgetProps {
  id: WidgetId;
  size: WidgetSize;
  editing: boolean;
  onRemove: (id: WidgetId) => void;
  onToggleSize: (id: WidgetId) => void;
  children: React.ReactNode;
}

export const SortableWidget = ({ id, size, editing, onRemove, onToggleSize, children }: SortableWidgetProps) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${editing ? "animate-jiggle" : ""}`}
      {...(editing ? { ...attributes, ...listeners } : {})}
    >
      {editing && (
        <div className="absolute -top-1.5 -right-1.5 z-10 flex gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSize(id); }}
            className="w-5 h-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center shadow-sm border border-border/50"
          >
            {size === "small" ? <Maximize2 className="w-2.5 h-2.5" /> : <Minimize2 className="w-2.5 h-2.5" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(id); }}
            className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}
      {children}
    </div>
  );
};
