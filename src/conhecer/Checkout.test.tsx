import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ qa: false, email: vi.fn(), current: vi.fn(), verify: vi.fn(), create: vi.fn(), check: vi.fn(), finalize: vi.fn(), send: vi.fn(), password: vi.fn() }));
vi.mock('./telemetry', () => ({ get QA() { return h.qa; } }));
vi.mock('@/landing/pagamento', () => ({ emailAntesDoPix: h.email, emailDaSessaoAtual: h.current, entrarAntesDoPix: h.verify, gerarPix: h.create, conferirPix: h.check, finalizarConta: h.finalize, pedirCodigo: h.send }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { updateUser: h.password } } }));
vi.mock('@/components/site/SelosDasLojas', () => ({ SelosDasLojas: () => <a href="/baixar?origem=web_conhecer_pos_compra&loja=ios">Baixar no iPhone</a> }));
import { Checkout } from './Checkout';
import { CHECKOUT_COOKIE, CHECKOUT_OFFER, readCheckout, saveCheckout } from './checkout-state';
const order = () => ({ orderId: 'order-known', qrCode: '000201COREPIXKNOWN', qrCodeBase64: null, expiresAt: new Date(Date.now() + 1800000).toISOString(), criadoEm: Date.now(), oferta: CHECKOUT_OFFER });
const button = (name: string | RegExp) => screen.getByRole('button', { name });
async function emailAndSubmit() { await act(async () => { fireEvent.change(screen.getByLabelText('Seu e-mail'), { target: { value: 'pessoa@example.com' } }); fireEvent.click(button('Continuar para o Pix')); }); }
beforeEach(() => {
  h.qa = false; localStorage.clear(); for (const c of document.cookie.split(';')) document.cookie = `${c.split('=')[0].trim()}=; Max-Age=0; Path=/`;
  vi.clearAllMocks(); h.email.mockResolvedValue({ ok: true, via: 'nova' }); h.current.mockResolvedValue(null); h.verify.mockResolvedValue({ ok: true, via: 'codigo' }); h.create.mockResolvedValue(order()); h.check.mockResolvedValue(false); h.finalize.mockResolvedValue(undefined); h.send.mockResolvedValue(true); h.password.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });
describe('checkout real com serviços simulados', () => {
  it('prévia não lê pedido/email real nem chama autenticação, cobrança ou conferência', async () => {
    saveCheckout(order(), 'private-existing@example.com'); h.qa = true;
    render(<Checkout onBack={() => {}}/>);
    expect(screen.getByRole('status')).toHaveTextContent('Prévia de conferência — pagamento desativado');
    expect(screen.getByLabelText('Seu e-mail')).toHaveValue('');
    expect(button('Continuar para o Pix')).toBeDisabled();
    expect(screen.queryByText('private-existing@example.com')).toBeNull();
    expect(screen.queryByLabelText('Pix Copia e Cola')).toBeNull();
    // Even direct form submission cannot bypass the disabled button.
    fireEvent.change(screen.getByLabelText('Seu e-mail'), { target: { value: 'test@example.com' } });
    await act(async () => fireEvent.submit(screen.getByLabelText('Seu e-mail').closest('form')!));
    for (const mock of [h.current,h.email,h.create,h.check,h.verify,h.send,h.password,h.finalize]) expect(mock).not.toHaveBeenCalled();
    expect(readCheckout()?.email).toBe('private-existing@example.com');
  });

  it('duplo submit não gera duas cobranças e só usa oferta de 27,90', async () => {
    let finish!: (v: ReturnType<typeof order>) => void; h.create.mockReturnValue(new Promise(r => { finish = r; }));
    render(<Checkout onBack={() => {}}/>); await emailAndSubmit(); await waitFor(() => expect(h.create).toHaveBeenCalledTimes(1));
    fireEvent.submit(screen.getByLabelText('Seu e-mail').closest('form')!); expect(h.create).toHaveBeenCalledTimes(1);
    await act(async () => finish(order())); await screen.findByRole('button', { name: 'Copiar código Pix' });
    expect(h.create).toHaveBeenCalledWith('LN_sempre279', expect.any(String), 'pessoa@example.com');
    expect(readCheckout()?.pix.orderId).toBe('order-known');
  });
  it('conta existente recebe OTP antes do create; acesso ativo dispensa QR', async () => {
    h.email.mockResolvedValue({ existe: true }); h.create.mockResolvedValue({ jaTem: true, via: 'conta' }); const event = vi.fn();
    render(<Checkout onBack={() => {}} event={event}/>); await emailAndSubmit(); await screen.findByLabelText('Código do e-mail');
    expect(h.create).not.toHaveBeenCalled(); expect(h.send).toHaveBeenCalledWith('pessoa@example.com');
    fireEvent.change(screen.getByLabelText('Código do e-mail'), { target: { value: '123456' } }); fireEvent.click(button('Confirmar código'));
    await screen.findByRole('heading', { name: 'Você já tem o CORE.' }); expect(h.check).not.toHaveBeenCalled(); expect(screen.queryByText('Pix Copia e Cola')).toBeNull();
    expect(event).toHaveBeenCalledWith('jornada_existing_access', expect.any(Object)); expect(h.finalize).not.toHaveBeenCalled();
  });
  it('OTP inválido não gera pedido e pode reenviar depois do intervalo', async () => {
    h.email.mockResolvedValue({ existe: true }); h.verify.mockResolvedValue({ erro: 'raw auth detail', motivo: 'codigo_errado' });
    render(<Checkout onBack={() => {}}/>); await emailAndSubmit(); await screen.findByLabelText('Código do e-mail');
    fireEvent.change(screen.getByLabelText('Código do e-mail'), { target: { value: '111111' } }); fireEvent.click(button('Confirmar código'));
    await screen.findByRole('alert'); expect(screen.getByRole('alert')).toHaveTextContent('Código incorreto ou vencido'); expect(h.create).not.toHaveBeenCalled();
    expect(button(/Reenviar em/)).toBeDisabled();
  });
  it('erro de outra conta não troca sessão nem cria Pix', async () => {
    h.email.mockResolvedValue({ erro: 'internal other email', motivo: 'outra_conta' }); render(<Checkout onBack={() => {}}/>); await emailAndSubmit();
    await screen.findByRole('alert'); expect(h.create).not.toHaveBeenCalled(); expect(screen.queryByText('internal other email')).toBeNull();
  });
  it('reload retoma mesmo pedido, não cria outro nem confia em estado local pago', async () => {
    saveCheckout(order(), 'pessoa@example.com'); render(<Checkout onBack={() => {}}/>);
    await screen.findByRole('button', { name: 'Copiar código Pix' }); await waitFor(() => expect(h.check).toHaveBeenCalled());
    expect(h.create).not.toHaveBeenCalled(); expect(screen.queryByText('PAGAMENTO CONFIRMADO')).toBeNull();
    expect(screen.getByLabelText('Pix Copia e Cola')).toHaveValue('000201COREPIXKNOWN');
  });
  it('retorno do banco e Já paguei não liberam sem resposta paga do servidor', async () => {
    saveCheckout(order(), 'pessoa@example.com'); render(<Checkout onBack={() => {}}/>); await waitFor(() => expect(button('Já paguei — conferir')).toBeEnabled());
    fireEvent.click(button('Já paguei — conferir')); await screen.findByRole('status');
    expect(screen.getByRole('status')).toHaveTextContent('O pagamento ainda não foi confirmado nesta tela'); expect(screen.queryByText('PAGAMENTO CONFIRMADO')).toBeNull(); expect(h.finalize).not.toHaveBeenCalled();
  });
  it('confirmação positiva chama finalização uma vez e libera destinos reais', async () => {
    saveCheckout(order(), 'pessoa@example.com'); h.check.mockResolvedValue(true); const event = vi.fn();
    render(<Checkout onBack={() => {}} event={event} attribution={{ campanha: 'teste' }}/>);
    await screen.findByRole('heading', { name: 'Seu CORE está pronto.' });
    expect(h.finalize).toHaveBeenCalledTimes(1); expect(h.finalize).toHaveBeenCalledWith('order-known', expect.objectContaining({ origem: 'conhecer', campanha: 'teste' }));
    expect(screen.getByRole('link', { name: 'Abrir meu CORE' })).toHaveAttribute('href', '/home'); expect(localStorage.getItem('landing-comprou-v1')).toContain('LN_sempre279');
  });
  it('pedido expirado ainda é conferido; se pago não cria substituto', async () => {
    saveCheckout({ ...order(), expiresAt: new Date(Date.now() - 1000).toISOString() }, 'pessoa@example.com'); h.check.mockResolvedValue(true);
    render(<Checkout onBack={() => {}}/>); await screen.findByRole('heading', { name: 'Seu CORE está pronto.' }); expect(h.create).not.toHaveBeenCalled();
  });
  it('sem pagamento, só gera substituto expirado após escolha explícita', async () => {
    saveCheckout({ ...order(), expiresAt: new Date(Date.now() - 1000).toISOString() }, 'pessoa@example.com'); h.create.mockResolvedValue({ ...order(), orderId: 'replacement' });
    render(<Checkout onBack={() => {}}/>); await waitFor(() => expect(button('Não paguei — gerar outro Pix')).toBeEnabled()); expect(h.create).not.toHaveBeenCalled();
    fireEvent.click(button('Não paguei — gerar outro Pix')); await screen.findByRole('button', { name: 'Copiar código Pix' }); expect(readCheckout()?.pix.orderId).toBe('replacement'); expect(h.create).toHaveBeenCalledTimes(1);
  });
  it('recuperar sessão pelo e-mail retorna ao pedido original sem create', async () => {
    saveCheckout(order(), 'pessoa@example.com'); render(<Checkout onBack={() => {}}/>); fireEvent.click(button('Recuperar acesso pelo e-mail'));
    await screen.findByLabelText('Código do e-mail'); fireEvent.change(screen.getByLabelText('Código do e-mail'), { target: { value: '123456' } }); fireEvent.click(button('Confirmar código'));
    await screen.findByRole('button', { name: 'Copiar código Pix' }); expect(h.create).not.toHaveBeenCalled(); expect(readCheckout()?.pix.orderId).toBe('order-known');
  });
  it('resposta atrasada após desmontar não finaliza acesso na tela abandonada', async () => {
    saveCheckout(order(), 'pessoa@example.com'); let finish!: (v: boolean) => void; h.check.mockReturnValue(new Promise(r => { finish = r; }));
    const view = render(<Checkout onBack={() => {}}/>); await waitFor(() => expect(h.check).toHaveBeenCalledTimes(1)); view.unmount(); await act(async () => finish(true)); expect(h.finalize).not.toHaveBeenCalled();
  });
  it('senha opcional só altera password da mesma conta após pagamento', async () => {
    saveCheckout(order(), 'pessoa@example.com'); h.check.mockResolvedValue(true); h.current.mockResolvedValue('pessoa@example.com');
    render(<Checkout onBack={() => {}}/>); await screen.findByRole('heading', { name: 'Seu CORE está pronto.' });
    fireEvent.click(screen.getByText('Prefere entrar com senha? Criar senha'));
    fireEvent.change(screen.getByLabelText('Senha (pelo menos 8 caracteres)'), { target: { value: 'test-password' } }); fireEvent.change(screen.getByLabelText('Repita a senha'), { target: { value: 'test-password' } }); fireEvent.click(button('Salvar senha'));
    await screen.findByText('Senha salva. Seu acesso está pronto.'); expect(h.password).toHaveBeenCalledWith({ password: 'test-password' });
  });
  it('create demorado libera a tela e a resposta tardia permanece recuperável sem novo QR', async () => {
    vi.useFakeTimers(); let finish!: (v: ReturnType<typeof order>) => void;
    h.create.mockReturnValue(new Promise(r => { finish = r; }));
    render(<Checkout onBack={() => {}}/>); await emailAndSubmit();
    expect(h.create).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(25001); });
    expect(screen.getByRole('alert')).toHaveTextContent('Não consegui concluir');
    expect(button('Continuar para o Pix')).toBeEnabled();
    await act(async () => finish(order()));
    expect(readCheckout()?.pix.orderId).toBe('order-known');
    await emailAndSubmit();
    expect(button('Copiar código Pix')).toBeInTheDocument(); expect(h.create).toHaveBeenCalledTimes(1);
  });
  it('recuperar, voltar e recuperar novamente respeita intervalo do código', async () => {
    saveCheckout(order(), 'pessoa@example.com'); render(<Checkout onBack={() => {}}/>);
    await act(async () => fireEvent.click(button('Recuperar acesso pelo e-mail')));
    await screen.findByLabelText('Código do e-mail');
    await act(async () => fireEvent.click(button('Voltar ao Pix')));
    await act(async () => fireEvent.click(button('Recuperar acesso pelo e-mail')));
    expect(h.send).toHaveBeenCalledTimes(1); expect(screen.getByLabelText('Código do e-mail')).toBeInTheDocument();
  });
  it('falha de medição não quebra compra confirmada', async () => {
    saveCheckout(order(), 'pessoa@example.com'); h.check.mockResolvedValue(true);
    render(<Checkout onBack={() => {}} event={() => { throw new Error('analytics unavailable'); }}/>);
    await screen.findByRole('heading', { name: 'Seu CORE está pronto.' }); expect(h.finalize).toHaveBeenCalledTimes(1);
  });
  it('erro de geração não mostra diagnóstico técnico ao visitante', async () => {
    h.create.mockResolvedValue({ erro: 'internal stack trace', onde: 'production gateway detail' });
    render(<Checkout onBack={() => {}}/>); await emailAndSubmit();
    expect(screen.getByRole('alert')).toHaveTextContent('Não consegui abrir o pagamento'); expect(screen.queryByText(/internal stack trace|production gateway detail/)).toBeNull();
  });

});
