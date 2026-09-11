import { useNavigate } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { useLifeHubData } from "@/hooks/use-life-hub-data";
import { useUserData } from "@/hooks/use-user-data";
import { ProgressBar } from "@/components/home/ProgressBar";
import { WidgetSize } from "@/hooks/use-home-widgets";
import { localDayKey } from "@/lib/utils";

export const ReadingWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const data = useLifeHubData();
  const { get, set } = useUserData();

  const updateProgress = (newProgress: number, e: React.MouseEvent | React.ChangeEvent) => {
    e.stopPropagation();
    const pct = Math.min(100, Math.max(0, newProgress));
    const books = get<any[]>("lib-books", []);
    // 11/09: gravava só `progress`, que a Biblioteca ignora (lá é
    // currentPage/pages) — o widget e o módulo viviam em campos diferentes.
    // Agora converte em página quando o livro tem total; `progress` fica só
    // pra livro sem páginas cadastradas.
    const updated = books.map((b: any) =>
      b.status === "lendo"
        ? (Number(b.pages) > 0
            ? { ...b, currentPage: Math.round((pct / 100) * Number(b.pages)), progress: pct }
            : { ...b, progress: pct })
        : b
    );
    set("lib-books", updated);
    const hoje = localDayKey();
    const log = get<string[]>("lib-read-log", []);
    if (!log.includes(hoje)) set("lib-read-log", [...log.slice(-60), hoje]);
  };

  if (size === "small") {
    return (
      <button onClick={() => navigate("/biblioteca")} className="w-full text-left bg-card rounded-2xl p-4 shadow-sm hover:shadow-md border border-border/50 transition-all">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-400/20">
            <BookOpen className="w-4 h-4 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Leitura</h3>
            {data.currentBook ? (
              <>
                <p className="text-xs font-medium truncate">{data.currentBook}</p>
                <ProgressBar value={data.readingProgress} max={100} colorClass="bg-orange-500" />
              </>
            ) : (
              <p className="text-[10px] text-muted-foreground">Nenhum livro ativo</p>
            )}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border/50">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => navigate("/biblioteca")} className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-orange-400/20">
            <BookOpen className="w-4 h-4 text-orange-600" />
          </div>
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Leitura</h3>
        </button>
      </div>

      {data.currentBook ? (
        <>
          <p className="text-sm font-bold truncate">{data.currentBook}</p>
          <div className="mt-2">
            <ProgressBar value={data.readingProgress} max={100} colorClass="bg-orange-500" />
          </div>
          <div className="mt-3 flex items-center gap-3" onClick={e => e.stopPropagation()}>
            <input
              type="range"
              min={0}
              max={100}
              value={data.readingProgress}
              onChange={(e) => updateProgress(parseInt(e.target.value), e)}
              className="flex-1 h-1.5 accent-orange-500 cursor-pointer"
            />
            <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{data.readingProgress}%</span>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum livro ativo</p>
      )}
    </div>
  );
};
