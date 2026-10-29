import { ModuleTip } from "@/components/ModuleTip";
import { DicasDaBeleza, TEMA_BELEZA } from "@/components/beleza/kit";

/**
 * /dev/dicas — SÓ NO SERVIDOR DE DESENVOLVIMENTO (App.tsx monta a rota dentro de `import.meta.env.DEV`; some do build).
 * O cartão "Dicas para começar" (com a lâmpada, 29/10) de alguns módulos, no modo convidado deste navegador, pra
 * fotografar 390×844 claro/escuro: `?m=financas,rotina,saude,beleza`.
 */
export default function DevDicas() {
  const mods = (new URLSearchParams(window.location.search).get("m") ?? "financas,rotina,beleza").split(",");
  return (
    <div className="min-h-screen bg-background text-foreground px-4 py-5 space-y-2">
      {mods.map((m) => (
        <section key={m}>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1.5">{m}</p>
          {m === "beleza"
            ? <div className={`${TEMA_BELEZA} bg-bz-papel -mx-4 px-4 py-3`}><DicasDaBeleza /></div>
            : <ModuleTip moduleId={m} />}
        </section>
      ))}
    </div>
  );
}
