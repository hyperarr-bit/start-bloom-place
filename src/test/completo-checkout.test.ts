import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {abrirCheckout,_zerar,OpcoesCheckout} from '@/landing/stripe-checkout';
const criar=vi.fn();const status=vi.fn();const elements=vi.fn();const confirmPixPayment=vi.fn();const pixel=vi.fn();
const options:OpcoesCheckout={pk:'pk_test_QA',precoCentavos:6790,parcelasMax:1,producao:false,somentePix:true,layout:'novo',storagePrefix:'completo',trocaCartao:false,evento:vi.fn(),pixel,atrib:{utm_campaign:'qa'},sessao:'session-completo',aparelho:'device',urlChegada:'https://www.coreaplicativo.com.br/completo?utm_campaign=qa',fbclid:null};
const flush=async()=>{await new Promise(r=>setTimeout(r,20))};
beforeEach(()=>{vi.stubGlobal('scrollTo',vi.fn());document.body.innerHTML='';sessionStorage.clear();vi.clearAllMocks();criar.mockResolvedValue({ok:true,pi:'pi_completo',clientSecret:'pi_completo_secret_QA'});status.mockResolvedValue({ok:true,pago:false,status:'requires_action'});confirmPixPayment.mockResolvedValue({paymentIntent:{id:'pi_completo',status:'requires_action',next_action:{pix_display_qr_code:{data:'QR_SIMULADO_NAO_PAGAVEL'}}}});(window as any).__ofertaApi={criar,status};(window as any).__stripeFalso={elements,confirmPixPayment};});
afterEach(()=>{_zerar();delete (window as any).__ofertaApi;delete (window as any).__stripeFalso;vi.unstubAllGlobals()});
it('uses the new visible summary and Pix only without mounting a card element',async()=>{await abrirCheckout(options);await flush();expect(document.querySelector('.oc-order-card')?.textContent).toContain('67,90');expect(document.querySelector('.oc-guarantee')).not.toBeNull();expect(document.querySelector('[data-metodo="card"]')).toBeNull();expect(elements).not.toHaveBeenCalled();});
it('isolates pending orders from /oferta and sends the source and campaign without a client-controlled price',async()=>{sessionStorage.setItem('oferta-stripe-ref','previous-oferta-order');await abrirCheckout(options);await flush();const body=criar.mock.calls[0][0];expect(body.ref).not.toBe('previous-oferta-order');expect(sessionStorage.getItem('oferta-stripe-ref')).toBe('previous-oferta-order');expect(sessionStorage.getItem('completo-stripe-ref')).toBe(body.ref);expect(body.url).toBe(options.urlChegada);expect(body.atrib.utm_campaign).toBe('qa');expect(body).not.toHaveProperty('amount');expect(body).not.toHaveProperty('precoCentavos');});
it('validates email and never emits Purchase for generating an unpaid Pix',async()=>{await abrirCheckout(options);await flush();(document.querySelector('#oc-pagar') as HTMLElement).click();expect(confirmPixPayment).not.toHaveBeenCalled();const input=document.querySelector('#oc-email') as HTMLInputElement;input.value='qa@example.com';input.dispatchEvent(new Event('input'));(document.querySelector('#oc-pagar') as HTMLElement).click();await flush();expect(confirmPixPayment).toHaveBeenCalledOnce();expect(document.querySelector('[data-testid="oferta-pix"]')).not.toBeNull();expect(document.querySelector('[data-testid="oferta-pago"]')).toBeNull();expect(pixel.mock.calls.some(c=>c[0]==='Purchase')).toBe(false);expect(document.querySelector('#oc-trocar')).toBeNull();});

it('offers card in the new layout and handles a declined payment without emitting Purchase',async()=>{
 const confirmPayment=vi.fn().mockResolvedValue({error:{message:'Cartão recusado.',type:'card_error'}});
 elements.mockReturnValue({create:()=>({mount:()=>{},on:(event:string,fn:()=>void)=>{if(event==='ready')queueMicrotask(fn)},destroy:()=>{}}),submit:async()=>({})});
 Object.assign((window as any).__stripeFalso,{createPaymentMethod:async()=>({paymentMethod:{id:'pm_qa'}}),confirmPayment});
 await abrirCheckout({...options,somentePix:false});await flush();
 expect(document.querySelector('.oc-form-intro')?.textContent).toContain('escolha como pagar');
 expect(document.querySelector('.oc-step:last-of-type')?.textContent).toContain('Forma de pagamento');
 (document.querySelector('[data-metodo="card"]') as HTMLElement).click();
 const input=document.querySelector('#oc-email') as HTMLInputElement;input.value='qa@example.com';input.dispatchEvent(new Event('input'));
 (document.querySelector('#oc-pagar') as HTMLElement).click();await flush();
 expect(confirmPayment).toHaveBeenCalledOnce();expect(document.querySelector('#oc-erro')?.textContent).toContain('Cartão recusado');expect(pixel.mock.calls.some(c=>c[0]==='Purchase')).toBe(false);
});

it('a succeeded return parameter still requires confirmation from the server',async()=>{
 status.mockResolvedValue({ok:false,pago:false});
 await abrirCheckout({...options,somentePix:false,voltaDoBanco:{pi:'pi_completo',status:'succeeded'}});
 expect(status).toHaveBeenCalledWith(expect.objectContaining({pi:'pi_completo'}));
 expect(document.querySelector('[data-testid="oferta-pago"]')).toBeNull();
 expect(document.querySelector('[data-testid="oferta-recebido"]')?.textContent).toContain('Ainda não conseguimos confirmar');
 expect(pixel.mock.calls.some(c=>c[0]==='Purchase')).toBe(false);
});
