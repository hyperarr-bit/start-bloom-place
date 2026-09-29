/**
 * RG DO PET (29/09) — a peça que abre o módulo: o documento do bicho, com a
 * foto em destaque e o que se pergunta no veterinário (espécie, raça, idade,
 * peso, sexo, castrado), microchip e o vet. Toque abre a ficha pra editar.
 * Campo vazio vira "—" e o rodapé convida a completar.
 */
import { Plus } from "lucide-react";
import { idadeCurta, NOME_DA_ESPECIE, especieDe, pesosDoPet, pesoTexto, type Pet } from "@/lib/pet";
import { FotoDoPet, Pata } from "./kit";

export const SeletorDePets = ({
  pets, selecionado, onEscolher, onNovo,
}: { pets: Pet[]; selecionado?: string; onEscolher: (id: string) => void; onNovo: () => void }) => (
  <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1" role="tablist" aria-label="Seus pets">
    {pets.map((p) => {
      const ativo = p.id === selecionado;
      return (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={ativo}
          onClick={() => onEscolher(p.id)}
          className="flex flex-col items-center gap-1 shrink-0 min-w-[56px] focus-visible:outline-none"
          data-testid={`pet-seletor-${p.id}`}
        >
          <span className={`rounded-full p-[3px] ${ativo ? "ring-2 ring-accent" : ""}`}>
            <FotoDoPet pet={p} className="w-11 h-11 rounded-full" emojiClass="text-xl" />
          </span>
          <span className={`text-[11.5px] leading-none max-w-[64px] truncate ${ativo ? "font-bold text-foreground" : "font-semibold text-muted-foreground"}`}>{p.name}</span>
        </button>
      );
    })}
    <button type="button" onClick={onNovo} className="flex flex-col items-center gap-1 shrink-0 min-w-[56px]" data-testid="pet-novo">
      <span className="p-[3px]">
        <span className="w-11 h-11 rounded-full border-[1.5px] border-dashed border-border grid place-items-center text-muted-foreground">
          <Plus className="w-4 h-4" aria-hidden="true" />
        </span>
      </span>
      <span className="text-[11.5px] leading-none font-semibold text-muted-foreground">Novo</span>
    </button>
  </div>
);

// span (não dl/dt/dd): o RG inteiro é um botão, e botão só aceita conteúdo de frase
const Campo = ({ rotulo, valor }: { rotulo: string; valor: string }) => (
  <span className="block min-w-0">
    <span className="block text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground leading-none">{rotulo}</span>
    <span className="block mt-1 text-[13.5px] font-semibold leading-tight truncate text-foreground">{valor || "—"}</span>
  </span>
);

export const RgDoPet = ({
  pet, numero, pesos, onAbrir, hoje,
}: { pet: Pet; numero: number; pesos: unknown; onAbrir: () => void; hoje: string }) => {
  const esp = especieDe(pet.species);
  const especie = pet.species?.trim() ? pet.species.trim().replace(/^./, (c) => c.toUpperCase()) : NOME_DA_ESPECIE[esp];
  const serie = pesosDoPet(pet, pesos);
  const peso = serie.length ? `${pesoTexto(serie[serie.length - 1].kg)} kg` : "";
  const sexo = pet.sexo === "macho" ? "Macho" : pet.sexo === "femea" ? "Fêmea" : "";
  const castrado = pet.castrado === true ? "Sim" : pet.castrado === false ? "Não" : "";
  const completo = !!(pet.chip || pet.vetNome);
  return (
    <button
      type="button"
      onClick={onAbrir}
      data-card="RG DO PET"
      aria-label={`RG de ${pet.name}. Toque pra editar`}
      className="relative block w-full text-left rounded-2xl border border-border bg-card overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="rg-do-pet"
    >
      <span className="pet-guilhoche" aria-hidden="true" />
      <span className="relative flex items-center gap-1.5 px-3.5 h-8 bg-[hsl(var(--pet-faixa))] text-[hsl(var(--pet-mel-tinta))]">
        <Pata className="w-3.5 h-3.5" />
        <span className="text-[10px] font-extrabold uppercase tracking-[0.12em]">RG do pet</span>
        <span className="ml-auto text-[10px] font-bold tracking-[0.08em] tabular-nums">Nº {String(numero).padStart(4, "0")}</span>
      </span>
      <span className="relative flex gap-3.5 p-3.5">
        <FotoDoPet pet={pet} className="w-[104px] h-[132px] rounded-[10px] shrink-0 shadow-[0_0_0_3px_hsl(var(--card)),0_0_0_4px_hsl(var(--border))] object-[50%_30%]" emojiClass="text-5xl" />
        <span className="min-w-0 flex-1">
          <span className="block text-[26px] font-extrabold tracking-tight leading-none mb-2.5 truncate text-foreground">{pet.name}</span>
          <span className="grid grid-cols-2 gap-x-2.5 gap-y-2">
            <Campo rotulo="Espécie" valor={especie} />
            <Campo rotulo="Raça" valor={pet.breed?.trim() ?? ""} />
            <Campo rotulo="Idade" valor={idadeCurta(pet, hoje)} />
            <Campo rotulo="Peso" valor={peso} />
            <Campo rotulo="Sexo" valor={sexo} />
            <Campo rotulo={pet.sexo === "femea" ? "Castrada" : "Castrado"} valor={castrado} />
          </span>
        </span>
      </span>
      <span className="relative flex items-center gap-2 px-3.5 py-2.5 border-t border-dashed border-border text-[12px] text-muted-foreground">
        <span className="text-[hsl(var(--pet-mel))]"><Pata className="w-5 h-5" /></span>
        {completo ? (
          <>
            <span className="truncate">{pet.chip ? `Chip ${pet.chip}` : "Sem microchip"}</span>
            {pet.vetNome && <span className="ml-auto truncate max-w-[45%]">{pet.vetNome}</span>}
          </>
        ) : (
          <span className="font-semibold">Toque pra completar: microchip, veterinário, alergias</span>
        )}
      </span>
    </button>
  );
};

/** Versão curta (outras abas): foto pequena + nome + espécie · idade. */
export const RgCurto = ({ pet, hoje }: { pet: Pet; hoje: string }) => (
  <div className="flex items-center gap-3">
    <FotoDoPet pet={pet} className="w-10 h-10 rounded-[10px]" emojiClass="text-lg" />
    <div className="min-w-0">
      <p className="text-[15px] font-extrabold leading-tight truncate">{pet.name}</p>
      <p className="text-[12px] text-muted-foreground truncate">{[pet.breed || NOME_DA_ESPECIE[especieDe(pet.species)], idadeCurta(pet, hoje)].filter((x) => x && x !== "—").join(" · ")}</p>
    </div>
  </div>
);
