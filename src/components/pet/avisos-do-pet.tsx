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
import { avisosNoApp } from "@/lib/avisos-no-app";
import { armarAvisos } from "@/lib/armar-avisos";
import { CHAVE_LEMBRETE } from "@/lib/pet";
import { ANTECEDENCIAS, algumLigadoPet, type PrefsLembretePet } from "@/lib/pet-avisos";
import { BotaoPet, CartaoPet, Pata } from "./kit";
import type { UsePet } from "./use-pet";

const HORAS = [7, 8, 9, 10, 12, 18, 20];
export const CHAVE_WIDGETS_HOME = "core-home-widgets-v2";

export const AvisosDoPet = ({ dados }: { dados: UsePet }) => {
  const { prefsLembrete: p, salvarPrefsLembrete, get } = dados;

  /* Na web e na demo não há interruptor (30/09): o aviso é notificação do celular e ligar
     aqui seria botão morto. Fica só o recado de onde ele mora. */
  if (!avisosNoApp()) {
    return (
      <CartaoPet titulo="Avisos" dataCard="AVISOS DO PET">
        <p className="px-3.5 py-3 text-[12.5px] text-muted-foreground leading-snug" data-testid="avisos-pet-so-no-app">
          O aviso no dia da vacina, do vermífugo e do remédio toca no <b className="text-foreground">app do celular</b>, com a mesma conta. É lá que você liga (Pet → Saúde → Avisos) — ele nasce desligado.
        </p>
      </CartaoPet>
    );
  }

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
          <span className="block text-[12.5px] text-muted-foreground leading-snug mt-0.5">No dia de cada um, às {String(p.hora).padStart(2, "0")}:00. Vacina, consulta e banho também {p.antes === 0 ? "só no dia" : p.antes === 1 ? "na véspera" : `${p.antes === 7 ? "1 semana" : `${p.antes} dias`} antes`}.</span>
        </span>
        <Switch checked={p.cuidados} onCheckedChange={(v) => void aplicar({ ...p, cuidados: v })} aria-label="Avisos de vacina, vermífugo e antipulgas" />
      </label>
      {p.cuidados && (
        <div className="px-3.5 pb-3 -mt-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">Vacina, consulta e banho: avisar antes</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {ANTECEDENCIAS.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={p.antes === a}
                onClick={() => void aplicar({ ...p, antes: a })}
                className={`rounded-full px-3.5 min-h-[44px] text-[12.5px] font-semibold ${p.antes === a ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
              >
                {a === 0 ? "não" : a === 1 ? "véspera" : a === 3 ? "3 dias antes" : "1 semana antes"}
              </button>
            ))}
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-1.5">Horário</p>
        </div>
      )}
      {p.cuidados && (
        <div className="px-3.5 pb-3 -mt-2 flex flex-wrap gap-1.5">
          {HORAS.map((h) => (
            <button
              key={h}
              type="button"
              aria-pressed={p.hora === h}
              onClick={() => void aplicar({ ...p, hora: h })}
              className={`rounded-full px-3.5 min-h-[44px] text-[12.5px] font-semibold tabular-nums ${p.hora === h ? "bg-foreground text-background" : "bg-muted text-muted-foreground"}`}
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
  // na demonstração (/preview) não existe Home de verdade nem aviso: a dica só confundiria
  try { if (window.location.pathname.startsWith("/preview")) return null; } catch { /* noop */ }

  // o convite dos avisos só no app (na web o aviso não toca: seria botão morto)
  const oferta: "home" | "avisos" | null = !naHome && dicas.home !== "nao" ? "home" : avisosNoApp() && !algumLigadoPet(prefsLembrete) && dicas.avisos !== "nao" ? "avisos" : null;
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
        <BotaoPet variante="secundario" onClick={oferta === "home" ? porNaHome : onAvisos} className="flex-1 min-h-[44px] text-[12.5px] bg-card border border-border" data-testid={oferta === "home" ? "dica-home" : "dica-avisos"}>
          {oferta === "home" ? <><Home className="w-4 h-4" aria-hidden="true" /> Pôr na Home</> : <><Bell className="w-4 h-4" aria-hidden="true" /> Ver os avisos</>}
        </BotaoPet>
        <BotaoPet variante="fantasma" onClick={() => salvarDicas(oferta === "home" ? { home: "nao" } : { avisos: "nao" })} className="min-h-[44px] text-[12.5px] text-muted-foreground">Agora não</BotaoPet>
      </div>
    </div>
  );
};
