/**
 * SEGURANÇA (21/10): de quem é o Pix? O elo pedido↔conta é o `pix_order_created` em analytics_events, que o cliente
 * conseguia gravar. Com `.limit(1)` sem ordem, uma linha forjada com o id de um pedido alheio podia levar o crédito.
 * Agora todo leitor passa por _shared/registro-pedido.ts: as linhas do pedido têm que concordar em conta e oferta.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import {
  LIMITE_REGISTROS, escolherRegistro, pedidosEmConflito, registroDoPedido, type RegistroPix,
} from "../../../supabase/functions/_shared/registro-pedido";

const PASTA = resolve(__dirname, "../../../supabase/functions");
const fonte = (f: string) => readFileSync(resolve(PASTA, f), "utf8");

const legit: RegistroPix = { user_id: "comprador", event_data: { order_id: "QR1", offer: "w27", gateway: "asaas" } };

/** Banco falso mínimo: analytics_events com o filtro que o helper usa (event_name + contains order_id + limit). */
function bancoFalso(linhas: Array<Record<string, unknown>>) {
  const chamadas: Array<{ limit: number }> = [];
  return {
    chamadas,
    from: (tabela: string) => {
      expect(tabela).toBe("analytics_events");
      const f: { nome?: string; oid?: string } = {};
      const q = {
        select: () => q,
        eq: (c: string, v: string) => { if (c === "event_name") f.nome = v; return q; },
        contains: (_c: string, v: { order_id: string }) => { f.oid = v.order_id; return q; },
        limit: async (n: number) => {
          chamadas.push({ limit: n });
          const data = linhas.filter((l) => l.event_name === f.nome && (l.event_data as { order_id?: string })?.order_id === f.oid).slice(0, n);
          return { data, error: null };
        },
      };
      return q;
    },
  };
}

describe("escolherRegistro (puro)", () => {
  it("uma linha do create → ela", () => {
    expect(escolherRegistro([legit])).toEqual({ linhas: [legit], conflito: false });
  });
  it("sem linha → nada, sem conflito", () => {
    expect(escolherRegistro([])).toEqual({ linhas: [], conflito: false });
    expect(escolherRegistro(null)).toEqual({ linhas: [], conflito: false });
  });
  it("linha forjada por OUTRA conta com o mesmo pedido → conflito, ninguém leva (nem na ordem inversa)", () => {
    const forjada: RegistroPix = { user_id: "atacante", event_data: { order_id: "QR1", offer: "w27" } };
    expect(escolherRegistro([legit, forjada])).toEqual({ linhas: [], conflito: true });
    expect(escolherRegistro([forjada, legit])).toEqual({ linhas: [], conflito: true });
  });
  it("mesma conta, oferta diferente (forjar a oferta) → conflito", () => {
    const outraOferta: RegistroPix = { user_id: "comprador", event_data: { order_id: "QR1", offer: "pv149" } };
    expect(escolherRegistro([legit, outraOferta]).conflito).toBe(true);
  });
  it("linha sem user_id (o que o papel anon grava) não conta", () => {
    const anon: RegistroPix = { user_id: null, event_data: { order_id: "QR1", offer: "lifetime" } };
    expect(escolherRegistro([anon, legit])).toEqual({ linhas: [legit], conflito: false });
    expect(escolherRegistro([anon])).toEqual({ linhas: [], conflito: false });
  });
  it("linhas repetidas que concordam (reenvio) → a primeira", () => {
    expect(escolherRegistro([legit, { ...legit }]).linhas).toHaveLength(1);
  });
});

describe("registroDoPedido (com o banco)", () => {
  it("lê até LIMITE_REGISTROS linhas (não .limit(1)) e devolve no formato antigo", async () => {
    const db = bancoFalso([{ event_name: "pix_order_created", ...legit }]);
    const reg = await registroDoPedido(db, "QR1");
    expect(db.chamadas[0].limit).toBe(LIMITE_REGISTROS);
    expect(LIMITE_REGISTROS).toBeGreaterThan(1);
    expect(reg?.[0]?.user_id).toBe("comprador");
  });
  it("forjada → [] e alarme no log", async () => {
    const db = bancoFalso([
      { event_name: "pix_order_created", user_id: "atacante", event_data: { order_id: "QR1", offer: "w27" } },
      { event_name: "pix_order_created", ...legit },
    ]);
    const logs: string[] = [];
    expect(await registroDoPedido(db, "QR1", (p) => logs.push(p))).toEqual([]);
    expect(logs.join(" ")).toMatch(/ALARME/);
  });
  it("evento de outro nome com o mesmo order_id não entra", async () => {
    const db = bancoFalso([
      { event_name: "pix_generated", user_id: "atacante", event_data: { order_id: "QR1" } },
      { event_name: "pix_order_created", ...legit },
    ]);
    expect((await registroDoPedido(db, "QR1"))[0].user_id).toBe("comprador");
  });
  it("id vazio → [] sem consultar", async () => {
    const db = bancoFalso([]);
    expect(await registroDoPedido(db, "")).toEqual([]);
    expect(db.chamadas).toHaveLength(0);
  });
});

describe("pedidosEmConflito (o reconcile, em lote)", () => {
  it("marca só o pedido que tem donos diferentes", () => {
    const s = pedidosEmConflito([
      { user_id: "a", event_data: { order_id: "Q1", offer: "w27" } },
      { user_id: "b", event_data: { order_id: "Q1", offer: "w27" } },
      { user_id: "c", event_data: { order_id: "Q2", offer: "w27" } },
    ]);
    expect([...s]).toEqual(["Q1"]);
  });
});

describe("todo leitor do pix_order_created passa pelo helper", () => {
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) andar(p);
      else if (p.endsWith(".ts")) arquivos.push(p);
    }
  };
  andar(PASTA);

  it("nenhuma função consulta o pix_order_created POR PEDIDO na mão (o .contains order_id)", () => {
    const culpados: string[] = [];
    for (const p of arquivos) {
      if (p.endsWith("_shared/registro-pedido.ts")) continue;
      // junta a consulta encadeada numa linha só e procura pix_order_created + contains(order_id) no mesmo comando
      const s = readFileSync(p, "utf8").replace(/\s*\n\s*\./g, ".");
      for (const cmd of s.split(";")) {
        if (/"pix_order_created"/.test(cmd) && /\.contains\(\s*"event_data",\s*\{\s*order_id/.test(cmd)) culpados.push(p.replace(PASTA + "/", ""));
      }
    }
    expect(culpados).toEqual([]);
  });

  it("os caminhos que creditam usam registroDoPedido / pedidosEmConflito", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts", "cakto-webhook/index.ts", "abacate-webhook/index.ts", "pagarme-webhook/index.ts", "abacate-pix/index.ts", "pagarme-pix/index.ts"]) {
      expect(fonte(f), f).toContain("registroDoPedido(");
    }
    const rec = fonte("pix-reconcile/index.ts");
    expect(rec).toContain("pedidosEmConflito(qrs)");
    expect(rec).toMatch(/if \(emConflito\.has\(oid\)\) continue;/);
  });
});

describe("sondas que devolviam dado de pedido alheio", () => {
  it("asaas-pix, pagarme-pix e abacate-pix não têm mais o probeOnly", () => {
    for (const f of ["asaas-pix/index.ts", "pagarme-pix/index.ts", "abacate-pix/index.ts"]) {
      expect(fonte(f), f).not.toMatch(/body\.probeOnly\s*===\s*true/);
    }
  });
  it("a sonda do pix-reconcile exige o RECONCILE_TOKEN (a anon key é pública)", () => {
    const s = fonte("pix-reconcile/index.ts");
    const i = s.indexOf('typeof body.probe === "string"');
    expect(i).toBeGreaterThan(0);
    const bloco = s.slice(i, i + 1200);
    expect(bloco).toMatch(/esperado && String\(body\.token \?\? ""\) === esperado/);
    expect(bloco.indexOf("unauthorized")).toBeGreaterThan(0);
    expect(bloco.indexOf("unauthorized")).toBeLessThan(bloco.indexOf("statusAsaas("));
  });
  it("check-subscription não loga o e-mail", () => {
    expect(fonte("check-subscription/index.ts")).not.toMatch(/logStep\([^)]*email: user\.email/);
  });
});
