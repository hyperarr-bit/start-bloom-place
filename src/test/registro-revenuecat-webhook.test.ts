// Exercita o handler real com DB em memória e sem rede/segredos reais.
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { linhaEventoRevenueCat } from "../../supabase/functions/_shared/registro-revenuecat";

function webhook(falha = false) {
  const rows = new Map<string, unknown>(); let handler: (req: Request) => Promise<Response>;
  const upsert = vi.fn(async (r: Record<string, unknown>, opts: { ignoreDuplicates: boolean }) => {
    if (falha) return { error: { message: 'db unavailable' } };
    if (!opts.ignoreDuplicates || !rows.has(String(r.id))) rows.set(String(r.id), r);
    return { error: null };
  });
  const admin = { from: (table: string) => { if (table !== 'revenuecat_events') throw Error('unexpected '+table); return { upsert }; } };
  const raw = readFileSync(resolve(__dirname, '../../supabase/functions/revenuecat-webhook/index.ts'), 'utf8');
  const source = ts.transpileModule(raw.replace(/^import .*;\n/gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
  new Function('serve', 'createClient', 'Deno', 'linhaEventoRevenueCat', 'classificarEvento', 'console', source)(
    (h: typeof handler) => { handler = h; }, () => admin,
    { env: { get: (k: string) => k === 'REVENUECAT_WEBHOOK_SECRET' ? 'fixture-secret' : '' } },
    linhaEventoRevenueCat, () => ({ tipo: 'ignorar' }), { log: () => {} },
  );
  const send = (ev: Record<string, unknown>, auth = 'fixture-secret') => handler(new Request('https://fixture.test', { method: 'POST', headers: { Authorization: auth }, body: JSON.stringify({ event: ev }) }));
  return { send, rows, upsert };
}
describe('webhook: guardar antes de ignorar o anônimo', () => {
  const e = { id: 'one', type: 'INITIAL_PURCHASE', app_user_id: '$RCAnonymousID:test', price: 0, period_type: 'TRIAL' };
  it('autentica antes da escrita, preserva anônimo e deduplica reentrega', async () => {
    const w = webhook(); expect((await w.send(e, 'wrong')).status).toBe(401); expect(w.upsert).not.toHaveBeenCalled();
    expect((await w.send(e)).status).toBe(200); expect((await w.send(e)).status).toBe(200);
    expect(w.rows.size).toBe(1); expect(w.rows.get('one')).toMatchObject({ price: 0, user_id: null });
    expect(w.upsert).toHaveBeenCalledWith(expect.anything(), { onConflict: 'id', ignoreDuplicates: true });
  });
  it('falha de persistência pede reentrega e não confirma que guardou', async () => {
    const w = webhook(true); expect((await w.send(e)).status).toBe(500); expect(w.rows.size).toBe(0);
  });
  it('teste de integração do painel não entra no histórico financeiro', async () => {
    const w = webhook(); expect((await w.send({ ...e, type: 'TEST' })).status).toBe(200); expect(w.rows.size).toBe(0);
  });
});
