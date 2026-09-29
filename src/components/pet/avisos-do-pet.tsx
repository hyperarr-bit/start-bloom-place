/**
 * AVISOS DO PET e "PÔR NA HOME" (29/09).
 *
 * Os módulos que ficam no topo do uso têm as duas coisas: presença na Home e
 * lembrete no horário. Aqui as duas nascem DESLIGADAS e são oferecidas no
 * lugar certo: o aviso na carteirinha (é lá que a data mora), a Home no fim
 * do HOJE. "Agora não" some e não volta (pet-dicas-prefs).
 */
import { useState } from "react";
import { Bell, Home } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { isNativeShell } from "@/lib/native-shell";
import { armarAvisos } from "@/lib/armar-avisos";
import { CHAVE_LEMBRETE } from "@/lib/pet";
import { algumLigadoPet, type PrefsLembretePet } from "@/lib/pet-avisos";
import { BotaoPet, CartaoPet, Pata } from "./kit";
import type { UsePet } from "./use-pet";

const HORAS = [7, 8, 9, 10, 12, 18, 20];
export const CHAVE_WIDGETS_HOME = "core-home-widgets-v2";

export const AvisosDoPet = ({ dados }: { dados: UsePet }) => {
  const { prefsLembrete: p, salvarPrefsLembrete, get } = dados;
  const noApp = isNativeShell();

  const aplicar = async (novas: PrefsLembretePet) => {
    salvarPrefsLembrete(novas);
    // pede a permissão no 1º "ligar" (no Android 13+ a recusa é definitiva: só aqui, nunca na abertura)
    await armarAvisos(get, { [CHAVE_LEMBRETE]: novas }, algumLigadoPet(novas), { nome: "pet_avisos_permissao", total: 1 });
  };

  return (
    <CartaoPet titulo="Avisos" dataCard="AVISOS DO PET">
      <label className="flex items-start gap-3 px-3.5 py-3 min-h-[56px]">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-foreground">Vacina, vermífugo, antipulgas</span>
          <span className="block text-[12.5px] text-muted-foreground leading-snug mt-0.5">No dia de cada um, às {String(p.hora).padStart(2, "0")}:00. Vacina, consulta e banho também na véspera.</span>
        </span>
        <Switch checked={p.cuidados} onCheckedChange={(v) => void aplicar({ ...p, cuidados: v })} aria-label="Avisos de vacina, vermífugo e antipulgas" />
      </label>
      {p.cuidados && (
        <div className="px-3.5 pb-3 -mt-1 flex flex-wrap gap-1.5">
          {HORAS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={p.hora === h}
              onClick={() => void aplicar({ ...p, hora: h })}
              className={`rounded-full px-3 min-h-[36px] text-[12.5px] font-semibold tabular-nums ${p.hora === h ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
            >
              {String(h).padStart(2, "0")}:00
            </button>
          ))}
        </div>
      )}
      <label className="flex items-start gap-3 px-3.5 py-3 min-h-[56px] border-t border-border">
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-foreground">Remédio na hora</span>
          <span className="block text-[12.5px] text-muted-foreground leading-snug mt-0.5">Na hora de cada dose. Marcou no HOJE? O aviso daquela dose não vem.</span>
        </span>
        <Switch checked={p.remedios} onCheckedChange={(v) => void aplicar({ ...p, remedios: v })} aria-label="Avisos de remédio na hora" />
      </label>
      {!noApp && (
        <p className="px-3.5 py-2.5 border-t border-dashed border-border text-[12px] text-muted-foreground">
          No site o aviso não toca — ele toca no app do celular, com a mesma conta.
        </p>
      )}
    </CartaoPet>
  );
};

/** Bilhete de fim do HOJE: pôr o Pet de hoje na Home (ou ligar os avisos, se já está na Home). */
export const DicaDoPet = ({ dados, onAvisos }: { dados: UsePet; onAvisos: () => void }) => {
  const { get, set, dicas, salvarDicas, prefsLembrete } = dados;
  const [feito, setFeito] = useState<string | null>(null);
  const widgets = get<unknown>(CHAVE_WIDGETS_HOME, []);
  const naHome = Array.isArray(widgets) && widgets.some((w) => (w as { id?: string })?.id === "pet");

  if (feito) {
    return <p className="text-[12.5px] font-semibold text-[hsl(var(--pet-ok))] px-1" role="status">{feito}</p>;
  }

  const oferta: "home" | "avisos" | null = !naHome && dicas.home !== "nao" ? "home" : !algumLigadoPet(prefsLembrete) && dicas.avisos !== "nao" ? "avisos" : null;
  if (!oferta) return null;

  const porNaHome = () => {
    const atuais = get<unknown>(CHAVE_WIDGETS_HOME, []);
    // lista gravada que não é lista (lixo): não sobrescreve o que não entende
    if (atuais != null && !Array.isArray(atuais)) return;
    set(CHAVE_WIDGETS_HOME, [...(Array.isArray(atuais) ? atuais : []), { id: "pet", size: "large" }]);
    setFeito("Pronto: o Pet de hoje está na sua Home.");
    toast("Pet de hoje na Home 🐾");
  };

  return (
    <div className="rounded-xl border border-dashed border-[hsl(var(--pet-mel))] bg-[hsl(var(--pet-mel-suave)/0.5)] px-3.5 py-3" data-card="DICA DO PET">
      <div className="flex items-start gap-2.5">
        <span className="text-[hsl(var(--pet-mel))] mt-0.5"><Pata className="w-5 h-5" /></span>
        <p className="text-[13px] leading-snug text-foreground">
          {oferta === "home"
            ? <>Quer ver o <b>Pet de hoje</b> na tela inicial? Dá pra marcar a comida e o passeio de lá.</>
            : <>Quer um <b>aviso no dia</b> da vacina, do vermífugo e do antipulgas? Ele nasce desligado.</>}
        </p>
      </div>
      <div className="mt-2.5 flex gap-2">
        <BotaoPet variante="secundario" onClick={oferta === "home" ? porNaHome : onAvisos} className="flex-1 min-h-[40px] text-[12.5px] bg-card border border-border" data-testid={oferta === "home" ? "dica-home" : "dica-avisos"}>
          {oferta === "home" ? <><Home className="w-4 h-4" aria-hidden="true" /> Pôr na Home</> : <><Bell className="w-4 h-4" aria-hidden="true" /> Ver os avisos</>}
        </BotaoPet>
        <BotaoPet variante="fantasma" onClick={() => salvarDicas(oferta === "home" ? { home: "nao" } : { avisos: "nao" })} className="min-h-[40px] text-[12.5px] text-muted-foreground">Agora não</BotaoPet>
      </div>
    </div>
  );
};
