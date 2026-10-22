/**
 * CONTEÚDO PAGO SÓ PELO SERVIDOR (segurança, 21/10): o "Seu 2027" (`core-pacote-2027`) e o Kit / plano de 30 dias
 * (`core-kit-primeiro-mes`) só nascem depois do pagamento confirmado, gravados pelas funções; o cliente não grava
 * (a página não tenta e o useUserData pula). A recusa no banco está em rls-seguranca.test.ts (migração 20261022130000).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { CHAVE_KIT_CONTA, liberarKitDoBump } from "../../../supabase/functions/_shared/presente";
import { CHAVE_PACOTE_2027 } from "../../../supabase/functions/_shared/pacote-2027";
import { CHAVES_SO_DO_SERVIDOR, chaveSoDoServidor } from "@/lib/conteudo-pago";
import { CHAVE_KIT } from "@/lib/kit-primeiro-mes";
import { CHAVE_PACOTE_2027 as CHAVE_PACOTE_APP } from "@/lib/pacote-2027";

const RAIZ = resolve(__dirname, "../../..");
const ler = (f: string) => readFileSync(resolve(RAIZ, f), "utf8");

type Linha = { user_id: string; key: string; value: Record<string, unknown> };
function userDataFalso(inicial: Linha[] = []) {
  const tab = [...inicial];
  return {
    tab,
    from: () => {
      const f: Record<string, string> = {};
      const q = {
        select: () => q,
        eq: (c: string, v: string) => { f[c] = v; return q; },
        maybeSingle: async () => ({ data: tab.find((l) => l.user_id === f.user_id && l.key === f.key) ?? null, error: null }),
        upsert: async (d: Linha) => {
          const ex = tab.find((l) => l.user_id === d.user_id && l.key === d.key);
          if (ex) Object.assign(ex, d); else tab.push({ ...d });
          return { error: null };
        },
      };
      return q;
    },
  };
}

describe("as chaves batem nos dois lados", () => {
  it("app × servidor × lista do que só o servidor grava", () => {
    expect(CHAVE_KIT).toBe(CHAVE_KIT_CONTA);
    expect(CHAVE_PACOTE_APP).toBe(CHAVE_PACOTE_2027);
    expect([...CHAVES_SO_DO_SERVIDOR].sort()).toEqual([CHAVE_KIT, CHAVE_PACOTE_APP].sort());
    // a migração recusa exatamente essas
    const sql = ler("supabase/migrations/20261022130000_conteudo_pago_so_servidor.sql");
    for (const k of CHAVES_SO_DO_SERVIDOR) expect(sql).toContain(`'${k}'`);
  });
  it("progresso continua do cliente", () => {
    for (const k of ["core-kit-primeiro-mes-progresso", "core-pacote-2027-plano", "core-pacote-2027-cofrinho"]) expect(chaveSoDoServidor(k)).toBe(false);
  });
});

describe("liberarKitDoBump (o kit do order bump nasce no servidor)", () => {
  it("h279k / h149k → grava o kit na conta de quem pagou (área Dinheiro, origem bump)", async () => {
    for (const offer of ["h279k", "h149k"]) {
      const db = userDataFalso();
      expect(await liberarKitDoBump(db, { userId: "u1", orderId: `qr_${offer}`, offer, agora: new Date("2026-10-22T12:00:00Z") })).toBe("liberado");
      expect(db.tab).toEqual([{ user_id: "u1", key: CHAVE_KIT_CONTA, value: { comprado: true, em: "2026-10-22T12:00:00.000Z", pedido: `qr_${offer}`, origem: "bump", area: "dinheiro" } }]);
    }
  });
  it("plano sem bump (h279, hv279, w27) → nada gravado", async () => {
    for (const offer of ["h279", "hv279", "w27", "u2027"]) {
      const db = userDataFalso();
      expect(await liberarKitDoBump(db, { userId: "u1", orderId: "qr", offer })).toBe("sem_kit");
      expect(db.tab).toEqual([]);
    }
  });
  it("idempotente: quem já tem o kit fica com o 1º (o dia 1 do plano não muda)", async () => {
    const db = userDataFalso([{ user_id: "u1", key: CHAVE_KIT_CONTA, value: { comprado: true, pedido: "qr_antigo" } }]);
    expect(await liberarKitDoBump(db, { userId: "u1", orderId: "qr_novo", offer: "h279k" })).toBe("ja_tinha");
    expect(db.tab[0].value.pedido).toBe("qr_antigo");
  });
});

describe("os 3 caminhos que creditam Pix da Asaas gravam o kit do bump depois do crédito", () => {
  for (const [f, cliente] of [["asaas-pix/index.ts", "supabaseAdmin"], ["asaas-webhook/index.ts", "admin"], ["pix-reconcile/index.ts", "admin"]] as const) {
    it(f, () => {
      const s = ler(`supabase/functions/${f}`);
      const credito = s.indexOf(`await creditarPedido(${cliente}, {`);
      const kit = s.indexOf(`liberarKitDoBump(${cliente}, {`, credito);
      expect(credito).toBeGreaterThan(0);
      expect(kit).toBeGreaterThan(credito);
      // só depois de um crédito que não falhou
      expect(s.slice(credito, kit)).toMatch(/g\.r !== "erro" && g\.r !== "em_andamento"/);
    });
  }
  it("u2027 e pk99 continuam gravados pelo servidor nos 3 caminhos", () => {
    for (const f of ["asaas-pix/index.ts", "asaas-webhook/index.ts", "pix-reconcile/index.ts"]) {
      const s = ler(`supabase/functions/${f}`);
      expect(s, f).toContain("confirmarPacote2027(");
      expect(s, f).toContain("liberarPlano30(");
    }
  });
});

describe("o cliente nunca grava a chave paga", () => {
  const arquivos: string[] = [];
  const andar = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (!/\/(test|dev)$/.test(p)) andar(p); }
      else if (/\.(ts|tsx)$/.test(p)) arquivos.push(p);
    }
  };
  andar(resolve(RAIZ, "src"));

  it("nenhum arquivo do app faz upsert/set com a chave do kit ou do 2027", () => {
    const culpados: string[] = [];
    for (const p of arquivos) {
      const s = readFileSync(p, "utf8");
      if (/key:\s*(CHAVE_KIT|CHAVE_PACOTE_2027|CHAVE_KIT_CONTA)\b/.test(s) || /\bset\(\s*(CHAVE_KIT|CHAVE_PACOTE_2027)\s*,/.test(s)
        || /key:\s*"(core-kit-primeiro-mes|core-pacote-2027)"/.test(s)) culpados.push(p.replace(RAIZ + "/", ""));
    }
    expect(culpados).toEqual([]);
  });
  it("saíram o gravarKit e o gravarPacote2027 da página", () => {
    const conta = ler("src/pages/hoje/conta.ts");
    expect(conta).not.toMatch(/export async function gravarKit\b/);
    expect(conta).not.toMatch(/export async function gravarPacote2027\b/);
    for (const f of ["src/pages/hoje/FunilHoje.tsx", "src/missao/FunilMissaoCamada.tsx"]) {
      expect(ler(f), f).not.toMatch(/gravarKit\(|gravarPacote2027\(/);
    }
  });
  it("o useUserData não sobe chave paga (nem na migração do convidado)", () => {
    const s = ler("src/hooks/use-user-data.tsx");
    const persist = s.indexOf("const persistKey = useCallback(");
    expect(persist).toBeGreaterThan(0);
    const corpo = s.slice(persist, persist + 600);
    expect(corpo.indexOf("if (chaveSoDoServidor(key)) return;")).toBeGreaterThan(0);
    expect(corpo.indexOf("if (chaveSoDoServidor(key)) return;")).toBeLessThan(corpo.indexOf(".upsert("));
    expect(s).toMatch(/\.filter\(k => !chaveSoDoServidor\(k\)\)/);
  });
});
