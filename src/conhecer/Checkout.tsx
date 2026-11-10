import React, { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Check, Copy, Loader2, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StoreLinks } from './StoreLinks';
import { supabase } from '@/integrations/supabase/client';
import { conferirPix, emailAntesDoPix, emailDaSessaoAtual, entrarAntesDoPix, finalizarConta, gerarPix, pedirCodigo } from '@/landing/pagamento';
import { marcarCompra } from '@/landing/marcador';
import type { PixLanding } from '@/landing/regras';
import { CHECKOUT_EMAIL, CHECKOUT_OFFER, CHECKOUT_PRICE_LABEL, expired, expiresAt, readCheckout, saveCheckout } from './checkout-state';

import { QA } from './telemetry';
import { CHECKOUT_SOURCE } from './attribution';

const PREVIEW_NOTICE = 'Prévia de conferência — pagamento desativado';
type Phase = 'email' | 'code' | 'pix' | 'access';
export type CheckoutProps = {
  onBack: () => void;
  onStage?: (stage: string) => void;
  attribution?: Record<string, unknown>;
  event?: (name: string, props: Record<string, unknown>) => void;
};
// A quick unmount/remount must not issue a second create while the first one is still in flight.
function deadline<T>(promise: Promise<T>, ms = 20000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('request_timeout')), ms);
    promise.then(value => { clearTimeout(timer); resolve(value); }, error => { clearTimeout(timer); reject(error); });
  });
}
let creation: { email: string; promise: ReturnType<typeof gerarPix> } | null = null;
function createOnce(email: string) {
  if (QA) return Promise.resolve({ erro: PREVIEW_NOTICE, onde: 'preview' } as const);
  if (creation) return creation.email === email ? creation.promise : Promise.resolve({ erro: 'Pagamento em andamento.', onde: 'busy' } as const);
  const run = async () => {
    const pending = readCheckout();
    if (pending && pending.email === email && !expired(pending.pix)) return pending.pix;
    const result = await gerarPix(CHECKOUT_OFFER, CHECKOUT_SOURCE.url, email);
    if ('orderId' in result) saveCheckout(result, email);
    return result;
  };
  // Web Locks coordinates tabs when available; the stored order is reread inside the lock.
  const promise = navigator.locks?.request ? navigator.locks.request('core-conhecer-pix-create', run) : run();
  creation = { email, promise };
  void promise.finally(() => { if (creation?.promise === promise) creation = null; }).catch(() => {});
  return promise;
}

export function Checkout({ onBack, onStage, attribution = {}, event }: CheckoutProps) {
  const [saved] = useState(() => QA ? null : readCheckout());
  const [email, setEmail] = useState(saved?.email ?? '');
  const [pix, setPix] = useState<PixLanding | null>(saved?.pix ?? null);
  const [phase, setPhase] = useState<Phase>(saved ? 'pix' : 'email');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [already, setAlready] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordAgain, setPasswordAgain] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const alive = useRef(true), busyRef = useRef(false), checkingRef = useRef(false), confirmed = useRef<string | null>(null);
  const pixRef = useRef(pix); pixRef.current = pix;
  const phaseRef = useRef(phase); phaseRef.current = phase;
  const callbacks = useRef({ onStage, event, attribution }); callbacks.current = { onStage, event, attribution };
  const emit = (name: string, props: Record<string, unknown> = {}) => { try { callbacks.current.event?.('jornada_' + name, { offer: CHECKOUT_OFFER, ...props }); } catch { /* Measurement never blocks checkout. */ } };
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { try { callbacks.current.onStage?.(phase); } catch { /* Checkout remains usable. */ } emit('checkout_stage', { stage: phase, resumed: !!saved }); }, [phase]);
  useEffect(() => { if (QA || saved) return; let cancelled = false; void emailDaSessaoAtual().then(e => { if (!cancelled && e) setEmail(previous => previous || e); }).catch(() => {}); return () => { cancelled = true; }; }, [saved]);
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  async function exclusive(action: () => Promise<void>) {
    if (QA) { setError(PREVIEW_NOTICE); return; }
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError(''); setNotice('');
    try { await action(); } catch { if (alive.current) setError('Não consegui concluir agora. Tente novamente em alguns segundos.'); }
    finally { busyRef.current = false; if (alive.current) setBusy(false); }
  }
  function access(existing: boolean, order?: PixLanding) {
    if (QA || !alive.current) return;
    setAlready(existing); setError(''); setNotice(''); setPhase('access');
    marcarCompra({ oferta: CHECKOUT_OFFER, email });
    if (order) {
      saveCheckout(order, email);
      void finalizarConta(order.orderId, { ...callbacks.current.attribution, origem: 'conhecer', path: '/vitalicio' }).catch(() => {});
      emit('payment_confirmed', { order_id: order.orderId });
    } else emit('existing_access', {});
  }
  async function check(order: PixLanding, manual = false): Promise<boolean> {
    if (QA) return false;
    if (checkingRef.current || confirmed.current === order.orderId) return confirmed.current === order.orderId;
    checkingRef.current = true; if (alive.current) setChecking(true);
    try {
      const paid = await deadline(conferirPix(order, CHECKOUT_SOURCE.url), 15000);
      if (!alive.current || pixRef.current?.orderId !== order.orderId) return paid;
      if (paid) { confirmed.current = order.orderId; access(false, order); }
      else if (manual) setNotice('O pagamento ainda não foi confirmado nesta tela. Se você já pagou, aguarde um pouco e confira novamente. Não precisa pagar de novo.');
      return paid;
    } catch {
      if (alive.current && manual) setError('Não consegui conferir agora. Seu pedido continua aqui. Tente novamente.');
      return false;
    } finally { checkingRef.current = false; if (alive.current) setChecking(false); }
  }
  useEffect(() => {
    if (QA || phase !== 'pix' || !pix) return;
    let stopped = false, timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (stopped || document.visibilityState === 'hidden') return;
      await check(pix);
      if (!stopped && phaseRef.current === 'pix') timer = setTimeout(poll, expired(pix) ? 12000 : 3000);
    };
    const visible = () => { if (timer) clearTimeout(timer); if (document.visibilityState !== 'hidden') void poll(); };
    void poll(); document.addEventListener('visibilitychange', visible);
    return () => { stopped = true; if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', visible); };
  }, [pix?.orderId, phase]);

  async function create(emailValue: string) {
    if (QA) { setError(PREVIEW_NOTICE); return; }
    const recovered = readCheckout();
    const current = pixRef.current ?? (recovered?.email === emailValue ? recovered.pix : null);
    if (current && !expired(current)) { pixRef.current = current; setPix(current); setPhase('pix'); return; }
    if (current && await check(current, true)) return;
    const response = await deadline(createOnce(emailValue), 25000);
    if ('orderId' in response) {
      saveCheckout(response, emailValue); // Preserve even if the visitor went back while the response was arriving.
      if (!alive.current) return;
      confirmed.current = null; pixRef.current = response; setPix(response); setPhase('pix'); setNotice('');
      emit('pix_generated', { order_id: response.orderId, gateway: 'asaas' });
    } else if (alive.current && 'jaTem' in response) access(true);
    else if (alive.current) { setError('Não consegui abrir o pagamento agora. Tente novamente em alguns segundos.'); emit('checkout_error', { where: 'create' }); }
  }
  async function submitEmail(e: React.FormEvent) {
    e.preventDefault(); const clean = email.trim().toLowerCase();
    if (!CHECKOUT_EMAIL.test(clean)) { setError('Confira seu e-mail antes de continuar.'); return; }
    await exclusive(async () => {
      setEmail(clean);
      const result = await deadline(emailAntesDoPix(clean));
      if (!alive.current) return;
      if ('ok' in result) { emit('email_ready', { via: result.via }); await create(clean); }
      else if ('existe' in result) {
        setPhase('code'); setRecovering(false); setCode('');
        const sent = await deadline(pedirCodigo(clean)); if (!alive.current) return;
        setCodeSent(sent); if (sent) setResendAt(Date.now() + 30000);
        else setError('Não consegui enviar o código. Tente reenviar em alguns segundos.');
      } else { setError(result.motivo === 'outra_conta' ? 'Você já está conectado com outro e-mail neste aparelho. Use o e-mail dessa conta ou entre na conta desejada.' : result.motivo === 'invalido' ? 'Confira seu e-mail antes de continuar.' : 'Não consegui preparar seu acesso agora. Tente novamente.'); emit('checkout_error', { where: 'email', reason: result.motivo }); }
    });
  }
  async function sendCode(recover = false) {
    if (QA) { setError(PREVIEW_NOTICE); return; }
    if (Date.now() < resendAt) {
      if (recover) { setRecovering(true); setPhase('code'); setNotice('O código já foi enviado. Confira seu e-mail.'); }
      return;
    }
    await exclusive(async () => {
      if (recover) { setRecovering(true); setPhase('code'); setCode(''); }
      const sent = await deadline(pedirCodigo(email)); if (!alive.current) return;
      setCodeSent(sent); if (sent) { setResendAt(Date.now() + 30000); setNotice('Código enviado. Confira também a caixa de spam.'); }
      else setError('Não consegui enviar o código agora. Tente novamente.');
    });
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    await exclusive(async () => {
      const result = await deadline(entrarAntesDoPix(email, code));
      if (!alive.current) return;
      if (!('ok' in result)) { setError('Código incorreto ou vencido. Confira ou peça outro código.'); return; }
      emit('account_verified', { recovery: recovering });
      if (recovering && pixRef.current) { setPhase('pix'); setNotice('Acesso recuperado. Vamos conferir seu pedido.'); }
      else await create(email);
    });
  }
  async function copy() {
    if (!pix || expired(pix)) return;
    try { await navigator.clipboard.writeText(pix.qrCode); setNotice('Código copiado. Abra o app do seu banco e escolha Pix Copia e Cola.'); emit('pix_copied', { order_id: pix.orderId }); }
    catch { setNotice('Selecione o código abaixo e copie para o app do seu banco.'); }
  }
  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8 || password !== passwordAgain) { setError('Use pelo menos 8 caracteres e repita a mesma senha.'); return; }
    await exclusive(async () => {
      const currentEmail = await deadline(emailDaSessaoAtual());
      if (currentEmail?.toLowerCase() !== email.toLowerCase()) { setError('Entre com o e-mail da compra para definir sua senha.'); return; }
      const { error: failure } = await deadline(supabase.auth.updateUser({ password }));
      if (!alive.current) return;
      if (failure) { setError('Não consegui salvar a senha. Você ainda pode entrar com um código enviado ao seu e-mail.'); return; }
      setPassword(''); setPasswordAgain(''); setPasswordSaved(true); setNotice('Senha salva. Seu acesso está pronto.');
    });
  }
  const isExpired = pix ? expired(pix, now) : false;
  const minutes = pix ? Math.max(0, Math.ceil((expiresAt(pix) - now) / 60000)) : 0;
  return <section className="j-panel conhecer-checkout" aria-label="Pagamento e acesso ao CORE">
    {phase !== 'access' && <button className="j-back" type="button" disabled={busy} onClick={onBack}><ArrowLeft size={16}/>Voltar</button>}
    {QA && <p className="j-notice" role="status">{PREVIEW_NOTICE}</p>}
    {error && <p className="j-notice" role="alert">{error}</p>}
    {notice && <p className="j-notice" role="status">{notice}</p>}
    {phase === 'email' && <>
      <p className="j-eyebrow">SEU ACESSO AO CORE</p><h1>Qual e-mail você<br/>vai usar no app?</h1>
      <p className="j-lead">Seu acesso fica nesse e-mail, no celular e no computador.</p>
      <div className="j-order"><span>CORE vitalício · 16 módulos</span><b>{CHECKOUT_PRICE_LABEL}</b></div>
      <form onSubmit={submitEmail}>
        <label className="j-label" htmlFor="conhecer-email">Seu e-mail</label><Input id="conhecer-email" type="email" autoComplete="email" inputMode="email" required maxLength={254} value={email} disabled={busy || QA} onChange={e => setEmail(e.target.value)}/>
        <p className="j-help">Pagamento único no Pix. Sem mensalidade. A senha é opcional e fica para depois.</p>
        <Button type="submit" className="j-cta" disabled={busy || QA}>{busy ? <><Loader2 className="animate-spin" size={18}/>Preparando seu acesso…</> : 'Continuar para o Pix'}</Button>
      </form><a className="j-text-link j-skip" href="/entrar">Já tenho acesso ao CORE</a>
    </>}
    {phase === 'code' && <>
      <Mail size={28}/><h1>{recovering ? 'Recupere seu pedido.' : 'Entre na sua conta.'}</h1>
      <p className="j-lead">{codeSent ? 'Enviamos um código para' : 'Use um código enviado para'} <b className="j-email">{email}</b>.</p>
      <p className="j-help">{recovering ? 'Seu pedido permanece o mesmo. Não é uma nova compra.' : 'Se você já tem acesso, não será necessário pagar de novo.'}</p>
      <form onSubmit={verify}><label className="j-label" htmlFor="conhecer-code">Código do e-mail</label><Input id="conhecer-code" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} value={code} disabled={busy || QA} onChange={e => setCode(e.target.value.replace(/\D/g, ''))}/><Button type="submit" className="j-cta" disabled={busy || QA}>{busy ? 'Conferindo…' : 'Confirmar código'}</Button></form>
      <button className="j-text-link j-skip" type="button" disabled={busy || QA || now < resendAt} onClick={() => void sendCode()}>{now < resendAt ? `Reenviar em ${Math.ceil((resendAt - now) / 1000)}s` : 'Reenviar código'}</button>
      <button className="j-text-link j-skip" type="button" disabled={busy || QA} onClick={() => { setPhase(recovering ? 'pix' : 'email'); setError(''); setCode(''); }}>{recovering ? 'Voltar ao Pix' : 'Corrigir e-mail'}</button>
    </>}
    {phase === 'pix' && pix && <>
      <p className="j-eyebrow">{isExpired ? 'CÓDIGO EXPIRADO' : 'PAGAMENTO SEGURO'}</p><h1>{isExpired ? 'O prazo deste Pix terminou.' : 'Seu CORE, a um Pix.'}</h1>
      <div className="j-order"><span>CORE vitalício · pagamento único</span><b>{CHECKOUT_PRICE_LABEL}</b></div><p className="j-help">Acesso para <b className="j-email">{email}</b></p>
      {!isExpired && <><div className="j-pix-real" style={{ background: '#fff', padding: 20, borderRadius: 16, width: 'fit-content', margin: '20px auto' }}><QRCodeSVG value={pix.qrCode} size={192} title="QR code do pagamento Pix"/></div><Button className="j-cta" onClick={() => void copy()}><Copy size={18}/>Copiar código Pix</Button><label className="j-label" htmlFor="conhecer-pix-code">Pix Copia e Cola</label><textarea id="conhecer-pix-code" readOnly value={pix.qrCode} onFocus={e => e.target.select()} rows={3} style={{ width: '100%', resize: 'vertical', overflowWrap: 'anywhere', fontSize: 12, padding: 10, border: '1px solid var(--border)', borderRadius: 10 }}/><p className="j-help">Válido por cerca de {minutes} {minutes === 1 ? 'minuto' : 'minutos'}. Use o aplicativo do seu banco para pagar.</p></>}
      <Button variant="outline" className="j-cta" disabled={checking || busy || QA} onClick={() => void check(pix, true)}>{checking ? 'Conferindo pagamento…' : 'Já paguei — conferir'}</Button>
      {isExpired && <><p className="j-help">Se você já pagou, confira antes de gerar outro código. Seu acesso chega pelo e-mail informado.</p><Button className="j-cta" disabled={busy || checking || QA} onClick={() => void exclusive(() => create(email))}>{busy ? 'Preparando…' : 'Não paguei — gerar outro Pix'}</Button></>}
      <button className="j-text-link j-skip" type="button" disabled={busy || QA} onClick={() => void sendCode(true)}>Recuperar acesso pelo e-mail</button><p className="j-included"><ShieldCheck size={16}/>7 dias de garantia.</p>
    </>}
    {phase === 'access' && <>
      <div className="j-success-icon"><Check size={28}/></div><p className="j-eyebrow">{already ? 'ACESSO JÁ ATIVO' : 'PAGAMENTO CONFIRMADO'}</p><h1>{already ? 'Você já tem o CORE.' : 'Seu CORE está pronto.'}</h1>
      <p className="j-lead">Entre com <b className="j-email">{email}</b>. Você pode receber um código no e-mail para acessar sua conta.</p><p className="j-included"><Check size={16}/>Não precisa comprar de novo no app.</p>
      <a href="/home" className="j-cta" onClick={() => emit('open_core', {})}>Abrir meu CORE</a><StoreLinks onClick={data=>emit('loja_click',data)}/>
      {!already && !passwordSaved && <details style={{ marginTop: 20 }}><summary>Prefere entrar com senha? Criar senha</summary><form onSubmit={savePassword} style={{ marginTop: 12 }}><label className="j-label" htmlFor="conhecer-password">Senha (pelo menos 8 caracteres)</label><Input id="conhecer-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} disabled={busy || QA}/><label className="j-label" htmlFor="conhecer-password-again">Repita a senha</label><Input id="conhecer-password-again" type="password" autoComplete="new-password" required minLength={8} value={passwordAgain} onChange={e => setPasswordAgain(e.target.value)} disabled={busy || QA}/><Button type="submit" className="j-cta" disabled={busy || QA}>{busy ? 'Salvando…' : 'Salvar senha'}</Button></form></details>}
    </>}
    <p className="j-help" style={{ marginTop: 20 }}>Precisa de ajuda? <a href="mailto:contato@coreaplicativo.com.br">contato@coreaplicativo.com.br</a></p>
  </section>;
}
export default Checkout;
