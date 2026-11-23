/**
 * /tudo (23/11) — a página de venda É o checkout. O formulário de pagamento (stripe-checkout.ts com montarEm + layout "cakto")
 * entra no fim da página quando a pessoa chega perto dele (o PaymentIntent só nasce aí, não em toda visita), ou na hora quando:
 *   • voltou do banco (3DS por redirecionamento: ?payment_intent=…&redirect_status=…);
 *   • a aba já tem um pedido (recarregou com o Pix gerado → o MESMO QR volta);
 *   • tocou em "Quero o meu CORE".
 * Recarregou depois de pagar: o passo a passo de entrar no app abre de novo (o mesmo da /organizar).
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
 if(bankReturn){void montar(bankReturn).then(()=>document.getElementById('checkout')?.scrollIntoView({block:'start'}))}
 else if(temPedido)void montar();
 else if('IntersectionObserver' in window){
  const perto=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){perto.disconnect();void montar()}},{rootMargin:'1400px 0px'});
  perto.observe(alvo);
 }else void montar();
 for(const a of document.querySelectorAll<HTMLAnchorElement>('[data-ir-checkout]'))a.addEventListener('click',()=>{event('landing_checkout_click',{placement:'oferta'});void montar()});
 // recarregou a aba depois de pagar (Instagram, volta da loja): o passo a passo de entrar no app abre de novo (6 h, só esta aba)
 let comprou=false;try{comprou=!!sessionStorage.getItem('oferta-pos-compra')}catch{/* sem storage */}
 if(comprou&&!bankReturn)void import('@/landing/pos-compra-app').then(m=>{const c=m.lerCompraPos();if(c&&!document.querySelector("[data-testid='pos-compra']"))m.abrirPosCompraTelaCheia({...c,evento:event},'recarga')},()=>event('landing_erro',{onde:'chunk_pos_compra'}));
 const visto=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){event('landing_section_view',{section:e.target.id||'topo'});visto.unobserve(e.target)}},{threshold:.25});
 for(const s of document.querySelectorAll('.topo,.modulos,#oferta,#depoimentos,#checkout'))visto.observe(s);
}
