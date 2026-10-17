/**
 * O LEMBRETE DE MANHÃ DA ROTINA (1.0.16, "Rotina pronta em 3 toques", 3ª pergunta) — o que este arquivo trava:
 *   · 1 aviso por dia, na hora escolhida (15 min depois de acordar), nos próximos 10 dias, nunca no passado;
 *   · hoje: o que já foi marcado sai ("Falta: …"); tudo marcado = sem aviso hoje; sem hábito = nada;
 *   · faixa própria 1820000 (nenhum outro tipo, nem as réguas do teste, encostam nela);
 *   · nasce desligado; dado torto vira o padrão; o reagendador (assinatura + agendamento) conhece o tipo.
 */
process.env.TZ = "America/Sao_Paulo";

import { describe, it, expect } from "vitest";
import {
  CHAVE_LEMBRETE_ROTINA_MANHA, LEMBRETE_MANHA_PADRAO, horaDoLembreteDaManha, lerDadosRotinaManha, lerLembreteRotinaManha,
  planejarRotinaManha, textoDaManha, type DadosRotinaManha,
} from "@/lib/rotina-manha";
import { BASES_LEMBRETES, FAIXAS_AVULSAS, agendarRotinaManha } from "@/lib/notificacoes";
import { assinaturaDos, lerDadosDosLembretes, reagendarTudo } from "@/lib/reagendar";
import { lerPrefs } from "@/lib/prefs-notificacoes";

const BASE = BASES_LEMBRETES.rotinaManha;
const SABADO_6H = new Date(2026, 9, 17, 6, 0); // 17/10/2026, sábado
const HABITOS = ["Beber água", "Treinar", "Estudar", "Dormir cedo"];
const dados = (p: Partial<DadosRotinaManha> = {}): DadosRotinaManha => ({
  prefs: { ligado: true, hora: "07:15" }, habitos: HABITOS, feitosHoje: [], ...p,
});
const leitor = (d: Record<string, unknown>) => <T,>(k: string, f: T): T => (k in d ? (d[k] as T) : f);

describe("a hora e as prefs", () => {
  it("15 minutos depois de acordar, passando da meia-noite sem quebrar", () => {
    expect(horaDoLembreteDaManha("07:00")).toBe("07:15");
    expect(horaDoLembreteDaManha("6:30")).toBe("06:45");
    expect(horaDoLembreteDaManha("23:50")).toBe("00:05");
    expect(horaDoLembreteDaManha("lixo")).toBe("07:15");
  });
  it("nasce desligado; dado torto vira o padrão", () => {
    expect(LEMBRETE_MANHA_PADRAO.ligado).toBe(false);
    expect(lerLembreteRotinaManha(undefined)).toEqual({ ligado: false, hora: "07:15" });
    expect(lerLembreteRotinaManha({ ligado: "sim", hora: "25:00" })).toEqual({ ligado: false, hora: "07:15" });
    expect(lerLembreteRotinaManha({ ligado: true, hora: "6:05" })).toEqual({ ligado: true, hora: "06:05" });
    // a chave termina em -prefs: é ajuste, não dia anotado
    expect(CHAVE_LEMBRETE_ROTINA_MANHA.endsWith("-prefs")).toBe(true);
  });
});

describe("o texto", () => {
  it("a lista do dia (no máximo 4 + 'e mais N'), o que falta quando já marcou algo, nada quando marcou tudo", () => {
    expect(textoDaManha(HABITOS)).toEqual({ title: "☀️ Bom dia! Sua rotina de hoje", body: "Beber água · Treinar · Estudar · Dormir cedo" });
    expect(textoDaManha([...HABITOS, "Ler", "Meditar"])?.body).toBe("Beber água · Treinar · Estudar · Dormir cedo e mais 2");
    expect(textoDaManha(HABITOS, ["Beber água"])?.body).toBe("Falta: Treinar · Estudar · Dormir cedo");
    expect(textoDaManha(HABITOS, HABITOS)).toBeNull();
    expect(textoDaManha([])).toBeNull();
  });
});

describe("o plano", () => {
  it("1 por dia às 07:15 nos próximos 10 dias (hoje incluso, se ainda não passou), ids na faixa própria", () => {
    const avisos = planejarRotinaManha(dados(), BASE, SABADO_6H);
    expect(avisos).toHaveLength(11);
    expect(avisos[0].quando).toEqual(new Date(2026, 9, 17, 7, 15));
    expect(avisos[10].quando).toEqual(new Date(2026, 9, 27, 7, 15));
    for (const a of avisos) {
      expect(a.quando.getHours() * 60 + a.quando.getMinutes()).toBe(7 * 60 + 15);
      expect(a.id >= BASE && a.id < BASE + 10000).toBe(true);
    }
    expect(new Set(avisos.map((a) => a.id)).size).toBe(11);
    expect(new Set(avisos.map((a) => a.quando.toDateString())).size).toBe(11); // nunca 2 no mesmo dia
  });
  it("depois da hora, hoje sai (nada no passado)", () => {
    const avisos = planejarRotinaManha(dados(), BASE, new Date(2026, 9, 17, 9, 0));
    expect(avisos).toHaveLength(10);
    expect(avisos[0].quando).toEqual(new Date(2026, 9, 18, 7, 15));
  });
  it("hoje com algo marcado diz o que falta; amanhã volta a lista inteira; tudo marcado = sem o de hoje", () => {
    const parcial = planejarRotinaManha(dados({ feitosHoje: ["Beber água"] }), BASE, SABADO_6H);
    expect(parcial[0].body).toBe("Falta: Treinar · Estudar · Dormir cedo");
    expect(parcial[1].body).toBe("Beber água · Treinar · Estudar · Dormir cedo");
    const tudo = planejarRotinaManha(dados({ feitosHoje: HABITOS }), BASE, SABADO_6H);
    expect(tudo).toHaveLength(10);
    expect(tudo[0].quando.getDate()).toBe(18);
  });
  it("desligado ou sem hábito: nada", () => {
    expect(planejarRotinaManha(dados({ prefs: { ligado: false, hora: "07:15" } }), BASE, SABADO_6H)).toEqual([]);
    expect(planejarRotinaManha(dados({ habitos: [] }), BASE, SABADO_6H)).toEqual([]);
  });
});

describe("o dado vem da Rotina", () => {
  it("hábitos na ordem da tabela e os marcados HOJE pela grade desta semana", () => {
    // sábado 17/10: a semana começa na segunda 12/10
    const d = lerDadosRotinaManha(leitor({
      [CHAVE_LEMBRETE_ROTINA_MANHA]: { ligado: true, hora: "07:15" },
      "rotina-habits": HABITOS,
      "rotina-habits-week": "2026-10-12",
      "rotina-habits-checked": { "SÁBADO": [true, false, false, false] },
    }), "2026-10-17");
    expect(d).toEqual({ prefs: { ligado: true, hora: "07:15" }, habitos: HABITOS, feitosHoje: ["Beber água"] });
  });
  it("grade de outra semana não conta como hoje (cai no log por data)", () => {
    const d = lerDadosRotinaManha(leitor({
      "rotina-habits": HABITOS, "rotina-habits-week": "2026-10-05", "rotina-habits-checked": { "SÁBADO": [true, true, true, true] },
      "rotina-habit-log": { "2026-10-17": ["Treinar"] },
    }), "2026-10-17");
    expect(d.feitosHoje).toEqual(["Treinar"]);
  });
});

describe("faixa 1820000 e o reagendador", () => {
  const LARGURA = 10000;
  const sobrepoe = (a: number, b: number) => a < b + LARGURA && b < a + LARGURA;
  it("ninguém divide a faixa com a Rotina de manhã — nem os tipos da central, nem as réguas do teste", () => {
    expect(BASE).toBe(1820000);
    for (const [tipo, base] of Object.entries(BASES_LEMBRETES)) if (tipo !== "rotinaManha") expect(sobrepoe(BASE, base), tipo).toBe(false);
    for (const [regua, base] of Object.entries(FAIXAS_AVULSAS)) expect(sobrepoe(BASE, base), regua).toBe(false);
  });
  it("ligar, mudar a hora e marcar hoje mudam a assinatura; desligado, o dado não entra nela", () => {
    const prefs = lerPrefs(undefined);
    const base = { "rotina-habits": HABITOS };
    const desligado = assinaturaDos(lerDadosDosLembretes(leitor(base)), prefs);
    const ligado = assinaturaDos(lerDadosDosLembretes(leitor({ ...base, [CHAVE_LEMBRETE_ROTINA_MANHA]: { ligado: true, hora: "07:15" } })), prefs);
    const outraHora = assinaturaDos(lerDadosDosLembretes(leitor({ ...base, [CHAVE_LEMBRETE_ROTINA_MANHA]: { ligado: true, hora: "08:15" } })), prefs);
    expect(ligado).not.toBe(desligado);
    expect(outraHora).not.toBe(ligado);
    // ligado: marcar um hábito hoje muda o plano (o de hoje passa a dizer o que falta)
    const hoje = new Date();
    const dia = ["DOMINGO", "SEGUNDA", "TERÇA", "QUARTA", "QUINTA", "SEXTA", "SÁBADO"][hoje.getDay()];
    const seg = new Date(hoje); seg.setDate(hoje.getDate() - ((hoje.getDay() + 6) % 7));
    const semana = `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, "0")}-${String(seg.getDate()).padStart(2, "0")}`;
    const marcado = assinaturaDos(lerDadosDosLembretes(leitor({
      ...base, [CHAVE_LEMBRETE_ROTINA_MANHA]: { ligado: true, hora: "07:15" }, "rotina-habits-week": semana, "rotina-habits-checked": { [dia]: [true] },
    })), prefs);
    expect(marcado).not.toBe(ligado);
  });
  it("reagendarTudo conta o tipo (0 no navegador: sem plugin) e agendarRotinaManha desligado não quebra", async () => {
    const r = await reagendarTudo(leitor({ "rotina-habits": HABITOS, [CHAVE_LEMBRETE_ROTINA_MANHA]: { ligado: true, hora: "07:15" } }), lerPrefs(undefined));
    expect(r.rotinaManha).toBe(0);
    await expect(agendarRotinaManha(dados({ prefs: { ligado: false, hora: "07:15" } }))).resolves.toBe(0);
  });
});
