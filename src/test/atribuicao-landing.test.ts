import { describe, it, expect } from "vitest";
import { ATRIBUICAO_KEY, capturarAtribuicao, linkPlayAtribuido, linkAppleAtribuido } from "@/landing/atribuicao";
import { limparAtribuicaoLanding } from "../../supabase/functions/_shared/atribuicao-landing";
import { linhaEventoRevenueCat } from "../../supabase/functions/_shared/registro-revenuecat";

const storage = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) || null, setItem: (k: string, v: string) => { m.set(k, v); } }; };
const href = 'https://play.google.com/store/apps/details?id=br.com.coreaplicativo.app&referrer='+encodeURIComponent('utm_source=web&utm_campaign=web_landing');
const c = { clickId: "12345678-1234-1234-1234-123456789abc", lp: "atual", pix: "b", onde: "pos_compra", path: "/organizar?email=private", forçado: false };

describe("origem da landing e elo com a instalação", () => {
  it("separa campanha Apple pré/pós-compra e QA sem enviar identificador de pessoa", () => {
    const href = "https://apps.apple.com/br/app/core/id6806913181";
    const u = new URL(linkAppleAtribuido(href, c));
    expect(u.searchParams.get("pt")).toBe("129384060");
    expect(u.searchParams.get("ct")).toBe("core_lp_atual_pos");
    expect(u.toString()).not.toContain(c.clickId);
    expect(linkAppleAtribuido(href, {...c, lp: "v2", onde: "prova"})).toContain("ct=core_lp_v2_pre");
    expect(linkAppleAtribuido(href, {...c, forçado: true})).toContain("ct=core_lp_qa");
    expect(linkAppleAtribuido("https://apps.apple.com/app/id123", c)).toBe("https://apps.apple.com/app/id123");
  });
  it("preserva campanha no retorno e indica que a origem não veio de novo anúncio", () => {
    const s = storage(); capturarAtribuicao('?utm_campaign=primeira&ad_id=123', s, 1000);
    expect(capturarAtribuicao('', s, 2000)).toMatchObject({ utm_campaign: 'primeira', ad_id: '123', atrib_origem: 'retorno_30d' });
    expect(capturarAtribuicao('?utm_campaign=segunda', s, 3000)).not.toHaveProperty('ad_id');
    expect(capturarAtribuicao('', s, 3000 + 30 * 86400000)).toEqual({ atrib_origem: 'sem_sinal' });
  });
  it("QA, storage indisponível e JSON quebrado não contaminam nem interrompem", () => {
    const s = storage(); capturarAtribuicao('?utm_campaign=qa', s, 1000, true); expect(s.getItem(ATRIBUICAO_KEY)).toBeNull();
    s.setItem(ATRIBUICAO_KEY, 'broken'); expect(capturarAtribuicao('', s)).toEqual({ atrib_origem: 'sem_sinal' });
    expect(capturarAtribuicao('?utm_campaign=real', null)).toMatchObject({ utm_campaign: 'real' });
  });
  it("transporta só o elo aleatório, braço e etapa; preserva a proteção de pós-compra", () => {
    const u = new URL(linkPlayAtribuido(href, c)), p = new URLSearchParams(u.searchParams.get('referrer')!);
    expect(u.searchParams.get('id')).toBe('br.com.coreaplicativo.app');
    expect(p.get('core_link_id')).toBe(c.clickId); expect(p.get('core_etapa')).toBe('pos_compra');
    expect(p.get('utm_campaign')).toBe('web_landing'); expect(p.get('core_path')).toBe('/organizar');
    expect(u.href).not.toContain('email');
  });
  it("visita pré-compra não ganha instrução de já comprador nas versões antigas", () => {
    const p = new URLSearchParams(new URL(linkPlayAtribuido(href, { ...c, onde: 'prova', forçado: true })).searchParams.get('referrer')!);
    expect(p.get('utm_campaign')).toBe('landing_pre_compra'); expect(p.get('core_etapa')).toBe('pre_compra'); expect(p.get('core_qa')).toBe('1');
    const foreign = 'https://evil.example/?id=br.com.coreaplicativo.app'; expect(linkPlayAtribuido(foreign, c)).toBe(foreign);
  });
  it("a ponte do pedido rejeita ids inválidos e não aceita privilégios/valores do cliente", () => {
    expect(limparAtribuicaoLanding({ landing_session_id: 'x' })).toBeNull();
    const p = limparAtribuicaoLanding({ landing_session_id: c.clickId, landing_device_id: c.clickId, braco_lp: 'atual', braco_pix: 'b', user_id: 'attacker', amount_cents: 1, atrib: { utm_campaign: 'camp', email: 'private', access_token: 'secret' } });
    expect(p).not.toHaveProperty('user_id'); expect(p).not.toHaveProperty('amount_cents'); expect(p?.atrib).toEqual({ utm_campaign: 'camp' });
  });
});

describe("histórico de cobrança do RevenueCat", () => {
  const base = { id: 'event-original', type: 'INITIAL_PURCHASE', environment: 'PRODUCTION', store: 'APP_STORE', app_user_id: '$RCAnonymousID:one', aliases: ['$RCAnonymousID:one'], transaction_id: 'tx1', original_transaction_id: 'chain1', purchased_at_ms: 1794000000000, event_timestamp_ms: 1794001000000, expiration_at_ms: 1794259200000, price: 0, price_in_purchased_currency: 0, currency: 'BRL', period_type: 'TRIAL' };
  it("conserva trial anônimo, zero real e início original sem inventar comprador", () => {
    expect(linhaEventoRevenueCat(base)).toMatchObject({ id: base.id, user_id: null, ids_anonimos: ['$RCAnonymousID:one'], price: 0, purchased_at: new Date(base.purchased_at_ms).toISOString(), period_type: 'TRIAL' });
  });
  it("renovação é outra cobrança da mesma cadeia; reentrega conserva o id", () => {
    const r = { ...base, id: 'event-renewal', type: 'RENEWAL', transaction_id: 'tx2', price_in_purchased_currency: 97.9, is_trial_conversion: true };
    expect(linhaEventoRevenueCat(r)).toMatchObject({ id: 'event-renewal', transaction_id: 'tx2', original_transaction_id: 'chain1', price_in_purchased_currency: 97.9, is_trial_conversion: true });
    expect(linhaEventoRevenueCat(r)).toEqual(linhaEventoRevenueCat({ ...r }));
  });
  it("preserva mudança de conta sem escolher arbitrariamente o dono e remove atributos pessoais", () => {
    const r = linhaEventoRevenueCat({ ...base, type: 'TRANSFER', transferred_from: ['$RCAnonymousID:old'], transferred_to: ['account'], subscriber_attributes: { core_device_id: { value: c.clickId }, '$email': { value: 'private' }, '$ip': { value: 'private' } } });
    expect(r?.user_id).toBeNull(); expect(r?.ids_anonimos).toContain('$RCAnonymousID:old');
    expect(JSON.stringify(r)).not.toContain('private'); expect(r?.payload).toMatchObject({ core_attributes: { core_device_id: c.clickId } });
  });
  it("eventos de cancelamento não viram compras e datas ausentes não viram agora", () => {
    expect(linhaEventoRevenueCat({ id: 'cancel', type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' })).toMatchObject({ type: 'CANCELLATION', motivo: 'UNSUBSCRIBE', purchased_at: null, price: null });
    expect(linhaEventoRevenueCat({ ...base, type: 'TEST' })).toBeNull(); expect(linhaEventoRevenueCat({ type: 'RENEWAL' })).toBeNull();
  });
});
