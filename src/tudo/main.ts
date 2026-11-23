/**
 * /tudo (23/11) — a página de venda É o checkout. O formulário de pagamento (stripe-checkout.ts com montarEm + layout "cakto")
 * entra no fim da página quando a pessoa chega perto dele (o PaymentIntent só nasce aí, não em toda visita), ou na hora quando:
 *   • voltou do banco (3DS por redirecionamento: ?payment_intent=…&redirect_status=…);
 *   • a aba já tem um pedido (recarregou com o Pix gerado → o MESMO QR volta);
 *   • tocou em "Quero o meu CORE".
 * Já pagou nesta aba: no lugar do checkout, "Você já comprou", e o passo a passo de entrar no app (o mesmo da /organizar).
 */
import {event,initPixel,mountPayment,bankReturn,QA,STORAGE_PREFIX} from './payment';
import './style.css';
import './checkout.css';

const desligada=document.documentElement.hasAttribute('data-desligada');
if(!desligada){
 if(QA){const strip=document.createElement('div');strip.className='tudo-qa';strip.textContent='PRÉVIA · PAGAMENTO SIMULADO · SEM COBRANÇA';document.body.prepend(strip)}
 initPixel();event('landing_view');
 const alvo=document.getElementById('checkout-inline')!;
 let montado:Promise<void>|null=null;
 const montar=(volta?:{pi:string;status:string})=>{
  if(montado)return montado;
  montado=mountPayment(alvo,volta).catch(()=>{
   montado=null;event('landing_erro',{onde:'tudo_checkout_load'});
   alvo.innerHTML='<div class="ck-espera" role="alert"><b>O pagamento não carregou.</b><span>Confira a internet e tente de novo.</span><button type="button" class="ck-tentar">Tentar de novo</button></div>';
   alvo.querySelector('button')!.addEventListener('click',()=>{void montar()});
  });
  return montado;
 };
 let temPedido=false;try{temPedido=!!sessionStorage.getItem(`${STORAGE_PREFIX}-stripe-ref`)}catch{/* sem storage */}
 // a volta do banco sai da URL já (recarregar depois não repete a conferência; a compra gravada na aba cuida do resto)
 if(bankReturn){try{const limpa=new URL(location.href);for(const k of ['payment_intent','payment_intent_client_secret','redirect_status'])limpa.searchParams.delete(k);history.replaceState(history.state,'',`${limpa.pathname}${limpa.search}${limpa.hash}`)}catch{/* noop */}}
 const ligarFormulario=()=>{
  if(bankReturn){void montar(bankReturn).then(()=>document.getElementById('checkout')?.scrollIntoView({block:'start'}));return}
  if(temPedido){void montar();return}
  if('IntersectionObserver' in window){
   // ~350px antes de aparecer: o PaymentIntent só nasce pra quem chega de verdade perto do pagamento
   const perto=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){perto.disconnect();void montar()}},{rootMargin:'350px 0px'});
   perto.observe(alvo);
  }else void montar();
 };
 let jaComprou=false;
 for(const a of document.querySelectorAll<HTMLAnchorElement>('[data-ir-checkout]'))a.addEventListener('click',()=>{if(!jaComprou){event('landing_checkout_click',{placement:'oferta'});void montar()}});
 for(const a of document.querySelectorAll<HTMLAnchorElement>('[data-ir-oferta]'))a.addEventListener('click',()=>event('landing_ver_oferta_click',{placement:'topo'}));
 // já pagou nesta aba (6 h): nada de formulário novo nem PaymentIntent — no lugar do checkout, "Você já comprou", e o passo a passo
 // de entrar no app abre de novo (recarga, volta da loja, ou a volta do banco recarregada com a compra já gravada)
 let comprou=false;try{comprou=!!sessionStorage.getItem('oferta-pos-compra')}catch{/* sem storage */}
 if(!comprou)ligarFormulario();
 else void import('@/landing/pos-compra-app').then(m=>{
  const c=m.lerCompraPos();
  if(!c||(bankReturn&&c.pi!==bankReturn.pi)){ligarFormulario();return}
  jaComprou=true;
  const ctx={...c,evento:event};
  alvo.innerHTML='<div class="ck-ja" data-testid="tudo-ja-comprou"><b>Você já comprou o CORE ✓</b><span>Seu acesso é vitalício. Agora é só entrar no app com o seu e-mail.</span><button type="button" class="ck-tentar">Ver como entrar no app</button></div>';
  alvo.querySelector('button')!.addEventListener('click',()=>m.abrirPosCompraTelaCheia(ctx,'ja_comprou'));
  if(!document.querySelector("[data-testid='pos-compra']"))m.abrirPosCompraTelaCheia(ctx,bankReturn?'volta_banco':'recarga');
 },()=>{event('landing_erro',{onde:'chunk_pos_compra'});ligarFormulario()});
 // threshold 0 + margem: seção alta (cada área, o checkout) conta quando entra de verdade na tela (o .25 nunca batia nas altas)
 const visto=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){event('landing_section_view',{section:e.target.id||'topo'});visto.unobserve(e.target)}},{threshold:0,rootMargin:'0px 0px -35% 0px'});
 for(const s of document.querySelectorAll('.topo,.area,#oferta,#depoimentos,#checkout'))visto.observe(s);
}
