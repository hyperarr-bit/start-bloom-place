import { describe, it, expect } from "vitest";
import { aplicarMigracao, temConteudo, TravelTrip, TravelTripsStore, mesDaChave } from "./types";
import { localDayKey } from "@/lib/utils";

/**
 * Guarda da migração de "travel-budget-v2" (objeto único) pra
 * "travel-trips-v2" (lista). Existe porque tem gente com viagem salva na
 * chave antiga: se este redutor errar, o dado dessas pessoas some sem aviso.
 */

const viagem = (patch: Partial<TravelTrip> = {}): TravelTrip => ({
  id: "antiga-1",
  destination: "",
  startDate: "",
  endDate: "",
  photoUrl: "",
  places: [],
  categories: { passagens: [], hotel: [] },
  ...patch,
});

const storeVazio = (): TravelTripsStore => ({ trips: [], ativoId: "", migrouDoObjetoUnico: false });

describe("migração viagem única → lista", () => {
  it("traz a viagem antiga na primeira carga e carimba que já migrou", () => {
    const antiga = viagem({ destination: "Buenos Aires", startDate: "2026-03-10" });
    const store = aplicarMigracao(storeVazio(), antiga);

    expect(store.trips).toHaveLength(1);
    expect(store.trips[0].destination).toBe("Buenos Aires");
    expect(store.ativoId).toBe("antiga-1");
    expect(store.migrouDoObjetoUnico).toBe(true);
  });

  it("não migra de novo (nada de viagem duplicada a cada abertura)", () => {
    const antiga = viagem({ destination: "Buenos Aires" });
    const uma = aplicarMigracao(storeVazio(), antiga);
    const duas = aplicarMigracao(uma, antiga);

    expect(duas.trips).toHaveLength(1);
    expect(duas).toBe(uma); // nem toca no objeto
  });

  it("ignora a viagem em branco que ficava salva só de abrir a aba", () => {
    const store = aplicarMigracao(storeVazio(), viagem());
    expect(store.trips).toHaveLength(0);
    // segue SEM carimbo: se o dado de verdade chegar atrasado (chave pesada
    // buscada depois do boot), ainda dá tempo de migrar.
    expect(store.migrouDoObjetoUnico).toBe(false);
  });

  it("chave antiga chegando atrasada não derruba as viagens novas", () => {
    const jaExistente: TravelTrip = viagem({ id: "nova-1", destination: "Salvador" });
    const store = aplicarMigracao(
      { trips: [jaExistente], ativoId: "nova-1", migrouDoObjetoUnico: false },
      viagem({ destination: "Buenos Aires" }),
    );

    expect(store.trips.map(t => t.destination)).toEqual(["Buenos Aires", "Salvador"]);
  });

  it("não duplica se a viagem antiga já estiver na lista", () => {
    const antiga = viagem({ destination: "Buenos Aires" });
    const store = aplicarMigracao(
      { trips: [antiga], ativoId: "antiga-1", migrouDoObjetoUnico: false },
      antiga,
    );

    expect(store.trips).toHaveLength(1);
    expect(store.migrouDoObjetoUnico).toBe(true);
  });

  it("temConteudo pega viagem que só tem custo lançado", () => {
    expect(temConteudo(viagem({ categories: { hotel: [{ id: "1", description: "Hotel", estimated: 900, actual: 0 }] } }))).toBe(true);
    expect(temConteudo(viagem({ places: [{ id: "1", name: "Caminito", category: "turistico", notes: "", mapsLink: "", status: "quero_ir" }] }))).toBe(true);
    expect(temConteudo(null)).toBe(false);
  });
});

describe("mês do passeio", () => {
  it("passeio da noite do último dia do mês NÃO escorrega pro mês seguinte", () => {
    // 31/08 às 22h no Brasil (UTC-3) já é 01/09 em UTC — é exatamente aí que
    // o caminho errado (derivar o mês pelo horário UTC) tira o passeio do
    // total de agosto. localDayKey lê o calendário LOCAL, então o dia fica
    // onde a pessoa viveu ele.
    const noite = new Date(2026, 7, 31, 22, 0, 0);
    expect(localDayKey(noite)).toBe("2026-08-31");
    expect(mesDaChave(localDayKey(noite))).toBe("2026-08");
    // e a virada de fato acontece no calendário local, não antes
    expect(mesDaChave(localDayKey(new Date(2026, 8, 1, 0, 30)))).toBe("2026-09");
  });
});
