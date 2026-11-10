import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  qa: true, event: vi.fn(), initPixel: vi.fn(), readCheckout: vi.fn(), checkout: vi.fn(), theme: vi.fn(), meta: vi.fn(),
}));
vi.mock('./telemetry', () => ({
  get QA() { return h.qa; }, event: h.event, initPixel: h.initPixel,
  attribution: { path: '/vitalicio', jornada_session_id: 'test-journey' }, journeySession: 'test-journey',
}));
vi.mock('./checkout-state', async importOriginal => ({
  ...await importOriginal<typeof import('./checkout-state')>(), readCheckout: h.readCheckout,
}));
vi.mock('@/components/ThemeToggle', () => ({ ThemeToggle: (props: unknown) => { h.theme(props); return <span>Tema de teste</span>; } }));
vi.mock('@/pages/venda/rastreio', () => ({ eventoMeta: h.meta }));
vi.mock('./Checkout', () => ({ default: (props: { onBack: () => void; attribution: unknown }) => {
  h.checkout(props);
  return <section aria-label="Checkout simulado"><p>Pagamento real substituído no teste.</p><button onClick={props.onBack}>Voltar à oferta do checkout</button></section>;
} }));
import Journey from './Journey';

const click = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', { name }));
const stage = () => screen.getByTestId('conhecer-journey').getAttribute('data-stage');
const frame = () => document.querySelector<HTMLIFrameElement>('iframe[title^="Demonstração do CORE"]')!;
function message(data: Record<string, unknown>, origin = location.origin, source: MessageEventSource | null = frame()?.contentWindow) {
  act(() => window.dispatchEvent(new MessageEvent('message', { data, origin, source })));
}
async function moveHistory(direction: 'back' | 'forward', next: string) {
  const previousPosition = history.state?.position;
  act(() => { window.history[direction](); });
  await waitFor(() => { expect(history.state?.position).not.toBe(previousPosition); expect(stage()).toBe(next); });
}
function expectDemo(module: string, tab: string) {
  expect(stage()).toBe('demo');
  const url = new URL(frame().getAttribute('src')!, location.origin);
  expect(url.pathname).toBe('/vitalicio/demo');
  expect(url.searchParams.get('m')).toBe(module);
  expect(url.searchParams.get('aba')).toBe(tab);
  expect(screen.getByRole('combobox', { name: 'Módulo da demonstração' })).toHaveValue(module);
}

beforeEach(() => {
  vi.clearAllMocks(); h.qa = true; h.readCheckout.mockReturnValue(null);
  sessionStorage.clear(); localStorage.clear();
  history.replaceState(null, '', '/vitalicio?utm_source=ig&utm_campaign=campaign-test&fbclid=click-test');
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const routes = [
  { entry: /Tudo, sinceramente/, context: /Vamos começar pelo que você quer ver/, choice: /Ver meu mês financeiro/, module: 'financas', tab: 'dashboard' },
  { entry: /Tudo, sinceramente/, context: /Vamos começar pelo que você quer ver/, choice: /Ver minha semana/, module: 'rotina', tab: 'semana' },
  { entry: /Meu dinheiro/, context: /O que você quer enxergar melhor/, choice: /Entender o mês/, module: 'financas', tab: 'dashboard' },
  { entry: /Meu dinheiro/, context: /O que você quer enxergar melhor/, choice: /Organizar os gastos/, module: 'financas', tab: 'financeiro' },
  { entry: /Minha rotina/, context: /O que você quer organizar primeiro/, choice: /Cuidar dos meus hábitos/, module: 'rotina', tab: 'semana' },
  { entry: /Minha rotina/, context: /O que você quer organizar primeiro/, choice: /Planejar os próximos dias/, module: 'rotina', tab: 'mes' },
];

describe('jornada de perguntas restaurada, com checkout isolado', () => {
  it.each(routes)('$entry → $choice abre $module/$tab e segue pelo acesso completo', async r => {
    render(<Journey/>);
    expect(stage()).toBe('entry');
    expect(screen.getByRole('heading', { name: 'Por onde você quer começar?' })).toBeInTheDocument();
    click(r.entry);
    expect(stage()).toBe('context');
    expect(screen.getByRole('heading', { name: r.context })).toBeInTheDocument();
    expect(frame()).toBeNull();
    click(r.choice);
    expectDemo(r.module, r.tab);
    expect(new URL(frame().src).searchParams.get('qa')).toBe('1');
    message({ type: 'conhecer:ready', module: r.module });
    expect(screen.queryByText('Carregando o app…')).toBeNull();
    click('Conhecer o acesso completo');
    expect(stage()).toBe('value');
    expect(screen.getByRole('heading', { name: 'Seu CORE vem com tudo isso.' })).toBeInTheDocument();
    expect(h.checkout).not.toHaveBeenCalled();
    click('Ver meu acesso ao CORE');
    expect(stage()).toBe('offer');
    expect(screen.getByText('Pagamento único no Pix.', { exact: false })).toBeInTheDocument();
    expect(h.checkout).not.toHaveBeenCalled();
    click('Continuar com Pix');
    await screen.findByRole('region', { name: 'Checkout simulado' });
    expect(stage()).toBe('checkout');
    expect(h.checkout).toHaveBeenCalledWith(expect.objectContaining({ attribution: expect.objectContaining({ path: '/vitalicio' }) }));
    expect(h.event).toHaveBeenCalledWith('jornada_comprar', { oferta: 'LN_sempre279' });
    expect(h.meta).not.toHaveBeenCalled(); // QA cannot initiate the real ad conversion call.
    expect(new URL(location.href).searchParams.get('utm_campaign')).toBe('campaign-test');
    expect(new URL(location.href).searchParams.get('fbclid')).toBe('click-test');
  });

  it('voltar e avançar restauram contexto, módulo e aba sem recriar o iframe', async () => {
    render(<Journey/>); click(/Minha rotina/); click(/Planejar os próximos dias/);
    expectDemo('rotina', 'mes');
    const originalFrame = frame();
    const command = vi.spyOn(originalFrame.contentWindow!, 'postMessage');
    message({ type: 'conhecer:ready', module: 'rotina' });
    message({ type: 'conhecer:tab', module: 'rotina', tab: 'mes' });
    click('Conhecer o acesso completo');
    await moveHistory('back', 'demo');
    expect(frame()).toBe(originalFrame);
    expect(screen.getByRole('combobox', { name: 'Módulo da demonstração' })).toHaveValue('rotina');
    await moveHistory('back', 'context');
    expect(screen.getByRole('heading', { name: /O que você quer organizar primeiro/ })).toBeInTheDocument();
    await moveHistory('forward', 'demo');
    expect(frame()).toBe(originalFrame);
    expect(screen.getByRole('combobox', { name: 'Módulo da demonstração' })).toHaveValue('rotina');
    expect(new URL(frame().src).searchParams.get('aba')).toBe('mes');
    await moveHistory('forward', 'value');
    click('Voltar ao app');
    expect(stage()).toBe('demo');
    expect(frame()).toBe(originalFrame);
    // Change the module and tab, then return to the older demo entry. Merely
    // keeping the latest React state would restore the wrong module here.
    fireEvent.change(screen.getByRole('combobox', { name: 'Módulo da demonstração' }), { target: { value: 'financas' } });
    message({ type: 'conhecer:tab', module: 'financas', tab: 'financeiro' });
    click('Conhecer o acesso completo');
    await moveHistory('back', 'demo');
    expect(screen.getByRole('combobox', { name: 'Módulo da demonstração' })).toHaveValue('financas');
    expect(command).toHaveBeenLastCalledWith({ type: 'conhecer:module', module: 'financas', tab: 'financeiro' }, location.origin);
    await moveHistory('back', 'demo');
    expect(screen.getByRole('combobox', { name: 'Módulo da demonstração' })).toHaveValue('rotina');
    expect(command).toHaveBeenLastCalledWith({ type: 'conhecer:module', module: 'rotina', tab: 'mes' }, location.origin);
    expect(frame()).toBe(originalFrame);
  });

  it('só aceita mensagens vindas do iframe e da mesma origem', () => {
    render(<Journey/>); click(/Meu dinheiro/); click(/Entender o mês/);
    message({ type: 'conhecer:value' }, 'https://example.com');
    expect(stage()).toBe('demo');
    message({ type: 'conhecer:value' }, location.origin, window);
    expect(stage()).toBe('demo');
    message({ type: 'conhecer:value' });
    expect(stage()).toBe('value');
  });

  it('Ver acesso permite ir direto à oferta e voltar ao começo sem exigir demo', async () => {
    render(<Journey/>); click('Ver acesso');
    expect(stage()).toBe('offer'); expect(frame()).toBeNull();
    click('Voltar'); await waitFor(() => expect(stage()).toBe('entry'));
    click('Ver acesso'); click('Continuar com Pix');
    await screen.findByRole('region', { name: 'Checkout simulado' });
    click('Voltar à oferta do checkout');
    expect(stage()).toBe('offer'); expect(frame()).toBeNull();
  });

  it('pular a demo pelo contexto mantém a apresentação de todos os módulos', () => {
    render(<Journey/>); click(/Meu dinheiro/); click('Prefiro conhecer o que está incluído');
    expect(stage()).toBe('value'); expect(frame()).toBeNull();
    expect(screen.getByText(/Você pode começar pelo dinheiro/)).toBeInTheDocument();
    click('Ver meu acesso ao CORE'); expect(stage()).toBe('offer');
  });

  it('QA começa pelas perguntas mesmo com pedido salvo e mantém retorno direto de checkout', async () => {
    h.readCheckout.mockReturnValue({ email: 'private@example.com', pix: { orderId: 'private-order' } });
    const view = render(<Journey/>);
    expect(stage()).toBe('entry'); expect(h.readCheckout).not.toHaveBeenCalled();
    expect(h.theme).toHaveBeenCalledWith(expect.objectContaining({ trackChanges: false }));
    expect(screen.queryByText('private@example.com')).toBeNull();
    view.unmount(); history.replaceState(null, '', '/vitalicio?qa=1&etapa=checkout');
    render(<Journey/>);
    await screen.findByRole('region', { name: 'Checkout simulado' });
    expect(h.readCheckout).not.toHaveBeenCalled(); expect(h.meta).not.toHaveBeenCalled();
  });

  it('em produção, pedido existente retoma checkout em vez de obrigar refazer perguntas', async () => {
    h.qa = false; h.readCheckout.mockReturnValue({ email: 'saved@example.com', pix: { orderId: 'saved-order' } });
    render(<Journey/>);
    await screen.findByRole('region', { name: 'Checkout simulado' });
    expect(stage()).toBe('checkout'); expect(frame()).toBeNull();
    expect(h.meta).not.toHaveBeenCalled(); // Resuming an existing order is not a new checkout click.
  });
});
