/**
 * O DIA DO PET (29/09) — a rotina (tarefas de todo dia) + as doses dos
 * remédios com horário, com o que já foi marcado em `pet-routine-<dia>`.
 * Pura: a aba HOJE e o widget da Home montam a mesma lista daqui.
 */
import { localDayKey, parseLocalDay } from "@/lib/utils";
import { rotinaValida, tarefasDoPet, type Pet } from "@/lib/pet";
import { dosesDoDia, linhasDaCarteirinha, proximosCuidados, type LinhaDaCarteirinha } from "@/lib/pet-cuidados";

const DIAS = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
/** "Hoje · TER 29/09" — o título do cartão do dia (a caixa alta vem do CSS). */
export const tituloDoDia = (hoje: string) => {
  const d = parseLocalDay(hoje);
  return `Hoje · ${DIAS[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export interface ItemDeHoje {
  id: string;
  label: string;
  emoji: string;
  hora?: string;
  feito: boolean;
  tipo: "rotina" | "remedio";
}

export function rotaDeHoje(
  pet: Pet,
  tarefasGravadas: unknown,
  cuidadosBrutos: unknown,
  rotinaHojeBruta: unknown,
  hoje: string = localDayKey(),
): ItemDeHoje[] {
  const marcas = rotinaValida(rotinaHojeBruta)[pet.id] ?? {};
  const rotina: ItemDeHoje[] = tarefasDoPet(pet, tarefasGravadas).map((t) => ({
    id: t.id, label: t.label, emoji: t.emoji, hora: t.hora, feito: marcas[t.id] === true, tipo: "rotina",
  }));
  const doses: ItemDeHoje[] = hoje
    ? dosesDoDia(pet.id, cuidadosBrutos, hoje).map((d) => ({ id: d.id, label: d.label, emoji: "💊", hora: d.hora, feito: marcas[d.id] === true, tipo: "remedio" }))
    : [];
  return [...rotina, ...doses];
}

/** Resumo pra Home: por pet, quantos de quantos hoje e o cuidado mais urgente. */
export interface ResumoDoPet {
  pet: Pet;
  itens: ItemDeHoje[];
  feitos: number;
  urgente?: LinhaDaCarteirinha;
}

export function resumoDosPets(
  pets: Pet[],
  ler: <T>(k: string, f: T) => T,
  hoje: string = localDayKey(),
): ResumoDoPet[] {
  const cuidados = ler<unknown>("pet-cuidados", []);
  const registros = ler<unknown>("pet-health", []);
  const rotina = ler<unknown>(`pet-routine-${hoje}`, {});
  return pets.map((pet) => {
    const itens = rotaDeHoje(pet, ler<unknown>(`pet-routine-tasks-${pet.id}`, null), cuidados, rotina, hoje);
    const [urgente] = proximosCuidados(linhasDaCarteirinha(pet.id, cuidados, registros, hoje), 1);
    return { pet, itens, feitos: itens.filter((i) => i.feito).length, urgente };
  });
}
