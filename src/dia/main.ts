/**
 * /dia (23/11) — a página aparece inteira sem este arquivo (HTML e CSS no dia.html). Aqui: medição, o toque nos botões e o checkout.
 *   • 1º botão ("Quero meu dia organizado"): é um link pro #preco; aqui só mede. Nunca abre pagamento.
 *   • botão do preço e do fecho: abrem o checkout Stripe de sempre por cima (a Stripe só carrega neste toque).
 *   • voltou do banco (3DS por redirecionamento): o checkout reabre e pergunta ao servidor (o endereço nunca prova pagamento).
 *   • já pagou nesta aba (6 h): no lugar do checkout, o passo a passo de entrar no app (o mesmo pós-compra da /organizar e da /tudo).
 */
import {event,initPixel,openPayment,bankReturn,QA} from './payment';

const CHAVE_COMPRA='oferta-pos-compra'; // a mesma de src/landing/pos-compra-app.ts (CHAVE_COMPRA_POS), sem baixar o pedaço à toa
const temCompra=()=>{try{return !!sessionStorage.getItem(CHAVE_COMPRA)}catch{return false}};

if(!document.documentElement.hasAttribute('data-desligada')){
 if(QA){const strip=document.createElement('div');strip.className='dia-qa';strip.textContent='PRÉVIA · PAGAMENTO SIMULADO · SEM COBRANÇA';document.body.prepend(strip)}
 initPixel();event('landing_view');

 let abrindo=false;
 const erroDe=(botao?:HTMLElement)=>{
  if(!botao)return null;
  let p=botao.parentElement!.querySelector<HTMLElement>('.dia-erro');
  if(!p){p=document.createElement('p');p.className='dia-erro';p.setAttribute('role','alert');p.hidden=true;botao.insertAdjacentElement('afterend',p)}
  return p;
 };
 async function checkout(botao?:HTMLElement,voltando=false){
  if(abrindo)return;abrindo=true;
  const erro=erroDe(botao);if(erro)erro.hidden=true;
  botao?.setAttribute('aria-busy','true');
  // o CSS do checkout só entra aqui, no toque de pagar (não segura a primeira pintura da página)
  try{await Promise.all([import('../completo/checkout.css'),import('./style.css')]);await openPayment(voltando?bankReturn:undefined)}
  catch(e){
   event('landing_erro',{onde:'dia_checkout_load',msg:String((e as Error)?.message??e).slice(0,80)});
   if(erro){erro.hidden=false;erro.textContent='Não conseguimos abrir o pagamento agora. Tente de novo.'}
  }finally{abrindo=false;botao?.removeAttribute('aria-busy')}
 }
 /** já pagou nesta aba: o caminho pro app em tela cheia. false = não há compra válida (segue o checkout) */
 async function mostrarCompra(via:string,soPi?:string):Promise<boolean>{
  if(!temCompra())return false;
  try{
   const m=await import('@/landing/pos-compra-app');
   const c=m.lerCompraPos();
   if(!c||(soPi&&c.pi!==soPi))return false;
   if(!document.querySelector("[data-testid='pos-tela-cheia']"))m.abrirPosCompraTelaCheia({...c,evento:event},via);
   return true;
  }catch{event('landing_erro',{onde:'chunk_pos_compra'});return false}
 }

 for(const a of document.querySelectorAll<HTMLElement>('[data-cta]'))a.addEventListener('click',()=>event('landing_cta',{onde:a.dataset.cta}));
 for(const b of document.querySelectorAll<HTMLElement>('[data-checkout]'))b.addEventListener('click',e=>{
  e.preventDefault();
  event('landing_checkout_click',{onde:b.dataset.checkout});
  void mostrarCompra('ja_comprou').then(ja=>{if(!ja)void checkout(b)});
 });

 if('IntersectionObserver' in window){
  // threshold 0 + margem: bloco alto conta quando entra de verdade na tela (o .25 nunca bate nos altos)
  const visto=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){event('landing_section_view',{secao:(e.target as HTMLElement).dataset.bloco});visto.unobserve(e.target)}},{threshold:0,rootMargin:'0px 0px -35% 0px'});
  for(const s of document.querySelectorAll('[data-bloco]'))visto.observe(s);
  const preco=document.getElementById('preco');
  if(preco){const metade=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.5)){metade.disconnect();event('landing_oferta_vista')}},{threshold:.5});metade.observe(preco)}
 }

 // o trilho dos cartões: 1 evento a cada cartão novo mais à direita (conta quando 60% dele está à mostra)
 const trilho=document.getElementById('trilho');
 if(trilho){
  const cartoes=[...trilho.querySelectorAll<HTMLElement>('.cartao')];
  let ate=1,marcado=false;
  const medir=()=>{
   marcado=false;
   const r=trilho.getBoundingClientRect();let n=0;
   cartoes.forEach((c,i)=>{const b=c.getBoundingClientRect();if(Math.min(b.right,r.right)-Math.max(b.left,r.left)>=b.width*.6)n=i+1});
   if(n>ate){ate=n;event('dia_cartoes_arraste',{ate})}
  };
  trilho.addEventListener('scroll',()=>{if(!marcado){marcado=true;requestAnimationFrame(medir)}},{passive:true});
 }

 // a volta do banco sai do endereço já (recarregar depois não repete a conferência; a compra gravada na aba cuida do resto)
 if(bankReturn){
  try{const limpa=new URL(location.href);for(const k of ['payment_intent','payment_intent_client_secret','redirect_status'])limpa.searchParams.delete(k);history.replaceState(history.state,'',`${limpa.pathname}${limpa.search}${limpa.hash}`)}catch{/* noop */}
  void mostrarCompra('volta_banco',bankReturn.pi).then(ja=>{if(!ja)void checkout(undefined,true)});
 }else void mostrarCompra('recarga');
}
