/**
 * PET DE HOJE na Home (29/09) — widget OPCIONAL (regra: a Home de ninguém muda
 * sozinha; entra pelo seletor de widgets ou pelo "Pôr na Home" do módulo).
 *
 * Pequeno: o pet, quantos de quantos cuidados hoje e o cuidado com data mais
 * urgente. Grande: o quadradinho funciona daqui (marca em `pet-routine-<dia>`,
 * a mesma chave do módulo) — até 2 pets, 5 itens cada.
 */
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { useUserData } from "@/hooks/use-user-data";
import { WidgetSize } from "@/hooks/use-home-widgets";
import { localDayKey } from "@/lib/utils";
import { EMOJI_DA_ESPECIE, especieDe, marcarNaRotina, petsValidos } from "@/lib/pet";
import { resumoDosPets } from "@/lib/pet-hoje";
import { quandoTexto } from "@/lib/pet-cuidados";
import "@/components/pet/pet.css";

const Avatar = ({ foto, especie, nome }: { foto?: string; especie: string; nome: string }) =>
  foto ? <img src={foto} alt={`Foto de ${nome}`} className="w-9 h-9 rounded-xl object-cover shrink-0" />
    : <span className="w-9 h-9 rounded-xl grid place-items-center shrink-0 bg-[hsl(var(--pet-mel-suave))] text-lg" aria-hidden="true">{EMOJI_DA_ESPECIE[especieDe(especie)]}</span>;

export const PetWidget = ({ size = "small" }: { size?: WidgetSize }) => {
  const navigate = useNavigate();
  const { get, set } = useUserData();
  const hoje = localDayKey();
  const pets = petsValidos(get<unknown>("pet-list", []));
  const resumos = resumoDosPets(pets, get, hoje);

  if (!pets.length) {
    return (
      <button onClick={() => navigate("/pet")} className="tema-pet w-full text-left bg-card rounded-2xl p-4 shadow-sm border border-border/50">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">Pet de hoje</h3>
        <p className="text-xs text-muted-foreground">Cadastre seu pet: em 3 toques ele ganha RG, rotina e carteirinha.</p>
      </button>
    );
  }

  // a mesma marcação do HOJE do Pet (o 1º gesto grava a lista vista, pro app antigo mostrar a mesma rotina)
  const marcar = (petId: string, itemId: string, valor: boolean) => marcarNaRotina(get, set, petId, itemId, valor);

  if (size === "small") {
    const r = resumos[0];
    const urgente = resumos.map((x) => x.urgente).find((u) => u && (u.status === "atrasado" || u.status === "hoje" || u.status === "logo"));
    return (
      <button onClick={() => navigate("/pet")} className="tema-pet w-full text-left bg-card rounded-2xl p-4 shadow-sm hover:shadow-md border border-border/50 transition-all" data-testid="widget-pet">
        <div className="flex items-start gap-3">
          <Avatar foto={r.pet.photoUrl} especie={r.pet.species} nome={r.pet.name} />
          <div className="flex-1 min-w-0">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Pet de hoje</h3>
            <p className="text-xs font-semibold truncate">{resumos.map((x) => `${x.pet.name} ${x.feitos}/${x.itens.length}`).join(" · ")}</p>
            {urgente && <p className={`text-[10.5px] mt-0.5 truncate ${urgente.status === "atrasado" ? "text-[hsl(var(--pet-atraso))] font-bold" : "text-[hsl(var(--pet-logo))] font-bold"}`}>{urgente.nome}: {quandoTexto(urgente)}</p>}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="tema-pet w-full bg-card rounded-2xl p-4 shadow-sm border border-border/50" data-testid="widget-pet">
      <button onClick={() => navigate("/pet")} className="flex items-center gap-2 mb-1 min-h-[44px]">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pet de hoje</h3>
      </button>
      <div className="space-y-3">
        {resumos.slice(0, 2).map((r) => (
          <div key={r.pet.id}>
            <div className="flex items-center gap-2 mb-1">
              <Avatar foto={r.pet.photoUrl} especie={r.pet.species} nome={r.pet.name} />
              <p className="text-sm font-bold truncate flex-1">{r.pet.name}</p>
              <span className="text-[11px] font-semibold text-muted-foreground tabular-nums">{r.feitos}/{r.itens.length}</span>
            </div>
            <ul>
              {r.itens.slice(0, 5).map((i) => (
                <li key={i.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={i.feito}
                    onClick={() => marcar(r.pet.id, i.id, !i.feito)}
                    className="w-full flex items-center gap-2.5 min-h-[44px] text-left"
                  >
                    <span className={`w-5 h-5 rounded-[5px] border-2 grid place-items-center shrink-0 ${i.feito ? "bg-accent border-accent text-accent-foreground dark:text-background" : "border-foreground/30"}`}>
                      {i.feito && <Check className="w-3 h-3" strokeWidth={3.2} aria-hidden="true" />}
                    </span>
                    <span className="text-[15px] w-5 text-center" aria-hidden="true">{i.emoji}</span>
                    <span className={`text-[13px] flex-1 truncate ${i.feito ? "line-through text-muted-foreground" : ""}`}>{i.label}</span>
                    {i.hora && <span className="text-[11px] text-muted-foreground tabular-nums">{i.hora}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {r.urgente && (r.urgente.status === "atrasado" || r.urgente.status === "hoje" || r.urgente.status === "logo") && (
              <button onClick={() => navigate("/pet?aba=saude")} className={`mt-0.5 text-[11.5px] font-bold min-h-[44px] ${r.urgente.status === "atrasado" ? "text-[hsl(var(--pet-atraso))]" : "text-[hsl(var(--pet-logo))]"}`}>
                {r.urgente.nome}: {quandoTexto(r.urgente)} →
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
