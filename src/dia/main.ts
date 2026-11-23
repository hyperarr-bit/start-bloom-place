/**
 * /dia (23/11) — a página aparece inteira sem este arquivo (HTML e CSS no dia.html). Aqui: medição, o toque nos botões e o checkout.
 *   • 1º botão ("Quero meu dia organizado") e o link "Ver o preço": descem até o preço; aqui só mede e anima a descida. Nunca abrem pagamento.
 *     Em tela baixa (iPhone SE dentro do Instagram) a descida para com o botão de pagar à mostra, não com o alto do cartão.
 *   • botão do preço e do fecho: abrem o checkout Stripe de sempre por cima (a Stripe só carrega neste toque).
 *   • voltou do banco (3DS por redirecionamento): o checkout reabre e pergunta ao servidor (o endereço nunca prova pagamento).
 *   • já pagou nesta aba (6 h): no lugar do checkout, o passo a passo de entrar no app (o mesmo pós-compra da /organizar e da /tudo).
 * O pedaço pesado (pixel, medição, checkout: ./payment, pela porta ./dia-carga) NÃO é importado aqui em cima (import estático punha
 * os modulepreload de client/analytics no <head>): ele é pedido logo depois da PRIMEIRA PINTURA (dois quadros). Rodada 2: antes ele
 * esperava a imagem do topo e o landing_view saía ~0,85 s depois do da /tudo, encolhendo a base de visitas da /dia na comparação.
 * A imagem do topo já está em voo com prioridade alta desde o HTML. Os eventos e os toques esperam essa promessa, na ordem.
 * Rodada 3:
 *   • o pedaço pesado que falhou ao baixar (sem rede, deploy no meio) é pedido DE NOVO no toque seguinte (pegarCarga zera a guarda).
 *     Medido no Chromium: o navegador guarda a falha do import() e não baixa o mesmo arquivo de novo na mesma página; e depois de
 *     um deploy o arquivo antigo nem existe mais. Por isso, se o toque de pagar falha por causa do pedaço e há internet, a página
 *     RECARREGA uma vez (1 vez por aba) e abre o checkout sozinha na volta. Sem internet: fica o aviso, sem recarregar;
 *   • recarga com pedido guardado na aba (Pix gerado, o Instagram recarregou a aba na volta do banco): o checkout reabre sozinho,
 *     como na /tudo; o checkout compartilhado reaproveita a ref e o PI e mostra o mesmo QR, ou o pago com as lojas;
 *   • a medição usa a MESMA régua dos controles: bloco e oferta contam na entrada (landing_section_view com `secao` e `section`;
 *     landing_oferta_vista com via "bloco_15", como a /organizar). O que antes era filtro virou dado: `na_descida` marca o que foi
 *     atravessado pela descida animada do 1º botão, e `dia_oferta_parada` conta quem PAROU com metade do cartão do preço à mostra.
 */
import {ofertaDe,prefixoDaAba} from './oferta';
type Carga=typeof import('./dia-carga');

const CHAVE_COMPRA='oferta-pos-compra'; // a mesma de src/landing/pos-compra-app.ts (CHAVE_COMPRA_POS), sem baixar o pedaço à toa
const temCompra=()=>{try{return !!sessionStorage.getItem(CHAVE_COMPRA)}catch{return false}};
/** quanto tempo metade do cartão do preço precisa ficar na tela pra contar como "parou no preço" (dia_oferta_parada) */
export const PARADA_MS=600;
/** a descida animada do 1º botão acabou quando a página fica este tempo sem rolar (ou no teto, se nem começou a rolar) */
export const DESCIDA_PARADA_MS=200;
export const DESCIDA_TETO_MS=1500;
/** a recarga única por aba quando o pedaço pesado não baixa: "1" = recarregou, abrir o checkout na volta; "0" = já usada */
const CHAVE_ABRIR='dia-abrir-checkout';
/** se a aba não pinta (aberta em segundo plano), o pedaço pesado é pedido assim mesmo depois deste tempo */
export const TETO_PINTURA_MS=400;

if(!document.documentElement.hasAttribute('data-desligada')){
 // a mesma conta de QA do payment.ts (a tarja não espera o pedaço pesado: sem salto de layout na prévia)
 const QA=new URLSearchParams(location.search).get('qa')==='1'||!['coreaplicativo.com.br','www.coreaplicativo.com.br'].includes(location.hostname);
 if(QA){const strip=document.createElement('div');strip.className='dia-qa';strip.textContent='PRÉVIA · PAGAMENTO SIMULADO · SEM COBRANÇA';document.body.prepend(strip)}

 // voltou do banco: não espera imagem nenhuma (o segredo sai do endereço assim que o payment.ts carrega)
 const voltou=new URLSearchParams(location.search).has('payment_intent');
 const primeiraPintura=new Promise<void>(ok=>{
  if(voltou||typeof requestAnimationFrame!=='function'){ok();return}
  const teto=setTimeout(ok,TETO_PINTURA_MS);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{clearTimeout(teto);ok()}));
 });
 // o pedaço pesado: uma promessa guardada; se o download falhar, a guarda zera e o próximo toque (ou evento) pede de novo.
 // Na 1ª vez que ele chega: pixel + landing_view, antes de qualquer outro evento.
 //   ms_desde_abertura: quanto a medição demorou pra sair (pra comparar a base de visitas com a das outras páginas);
 //   volta_banco: a recarga da volta do 3DS não é visita nova (o relatório pode tirar)
 let cargaP:Promise<Carga>|null=null,iniciado=false;
 const pegarCarga=():Promise<Carga>=>cargaP??=primeiraPintura.then(()=>import('./dia-carga')).then(m=>{
  if(!iniciado){iniciado=true;try{m.initPixel()}catch{/* noop */}m.event('landing_view',{ms_desde_abertura:Math.round(performance.now()),...(voltou?{volta_banco:true}:{})})}
  return m;
 },e=>{cargaP=null;throw e});
 pegarCarga().catch(()=>{/* sem rede pro pedaço: a página segue inteira; o toque de pagar mostra o aviso e tenta de novo */});
 /** os eventos esperam o pedaço pesado e saem na ordem em que foram pedidos */
 const event=(name:string,data:Record<string,unknown>={})=>{void pegarCarga().then(m=>m.event(name,data)).catch(()=>{/* noop */})};

 let abrindo=false;
 const erroDe=(botao?:HTMLElement)=>{
  if(!botao)return null;
  let p=botao.parentElement!.querySelector<HTMLElement>('.dia-erro');
  if(!p){p=document.createElement('p');p.className='dia-erro';p.setAttribute('role','alert');p.hidden=true;botao.insertAdjacentElement('afterend',p)}
  return p;
 };
 /** reaberto = recarga com pedido guardado na aba (não rola a tela: ela abre no Pix já gerado, ou no pago) */
 async function checkout(botao?:HTMLElement,voltando=false,reaberto=false){
  if(abrindo)return;abrindo=true;
  const erro=erroDe(botao);if(erro)erro.hidden=true;
  botao?.setAttribute('aria-busy','true');
  // o CSS do checkout só entra aqui, no toque de pagar (não segura a primeira pintura da página)
  try{
   const [m]=await Promise.all([pegarCarga(),import('../completo/checkout.css'),import('./style.css')]);await m.openPayment(voltando?m.bankReturn??undefined:undefined);
   // celular: o campo de e-mail fica à mostra rolando SÓ o que faltar ('nearest'): se ele já cabe, a tela não rola e o resumo
   // com o preço ("Total da compra", "Pagamento único. Sem renovação.") continua em cima. Sem foco, pra não subir o teclado sozinho.
   if(!voltando&&!reaberto&&window.innerWidth<=700){const email=document.querySelector<HTMLElement>('#oc-email');if(email&&typeof email.scrollIntoView==='function')email.scrollIntoView({block:'nearest'})}
  }
  catch(e){
   // foi o pedaço pesado que não baixou (não o checkout em si), há internet e esta aba ainda não recarregou: recarrega 1 vez
   // e o checkout abre sozinho na volta (a falha de import() fica guardada pelo navegador; depois de deploy o arquivo antigo sumiu)
   if(!iniciado&&!voltando&&navigator.onLine!==false){
    let pode=false;try{pode=sessionStorage.getItem(CHAVE_ABRIR)===null;if(pode)sessionStorage.setItem(CHAVE_ABRIR,'1')}catch{pode=false}
    if(pode){location.reload();return}
   }
   event('landing_erro',{onde:'dia_checkout_load',msg:String((e as Error)?.message??e).slice(0,80)});
   if(erro){erro.hidden=false;erro.textContent='Não conseguimos abrir o pagamento agora. Confira a internet e toque de novo.'}
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

 // os dois links pro preço: medem e descem com animação por JS (sem `scroll-behavior: smooth` no CSS, que animava também a volta
 // do checkout e fazia a página "voar"). Sem JavaScript o href="#preco" continua levando ao preço.
 // enquanto a descida animada passa pelos blocos, o que entra na tela leva na_descida (dado, não filtro)
 let descendo=false,fimDescida:ReturnType<typeof setTimeout>|undefined;
 const acabouDescida=()=>{descendo=false};
 window.addEventListener('scroll',()=>{if(descendo){clearTimeout(fimDescida);fimDescida=setTimeout(acabouDescida,DESCIDA_PARADA_MS)}},{passive:true});
 for(const a of document.querySelectorAll<HTMLElement>('[data-cta]'))a.addEventListener('click',e=>{
  event('landing_cta',{onde:a.dataset.cta});
  descendo=true;clearTimeout(fimDescida);fimDescida=setTimeout(acabouDescida,DESCIDA_TETO_MS);
  const preco=document.getElementById('preco');
  if(!preco||typeof preco.scrollIntoView!=='function')return;
  e.preventDefault();
  // o cartão cabe do alto até o botão de pagar? para no alto dele. Não cabe (tela baixa)? para com o botão de pagar no pé da tela.
  const pagar=preco.querySelector<HTMLElement>('[data-checkout]');
  const ate=pagar?pagar.getBoundingClientRect().bottom-preco.getBoundingClientRect().top:0;
  if(pagar&&ate+32>window.innerHeight)pagar.scrollIntoView({behavior:'smooth',block:'end'});
  else preco.scrollIntoView({behavior:'smooth',block:'start'});
 });
 for(const b of document.querySelectorAll<HTMLElement>('[data-checkout]'))b.addEventListener('click',e=>{
  e.preventDefault();
  event('landing_checkout_click',{onde:b.dataset.checkout});
  void mostrarCompra('ja_comprou').then(ja=>{if(!ja)void checkout(b)});
 });
 // os selos das lojas do passo 2 são imagem, sem link (antes da compra ninguém é mandado pra loja): só conta quem tenta tocar
 for(const s of document.querySelectorAll<HTMLElement>('[data-selo]'))s.addEventListener('click',()=>event('dia_selo_toque',{loja:s.dataset.selo}));

 if('IntersectionObserver' in window){
  // A MESMA régua da /tudo: o bloco conta na entrada (threshold 0 + margem: bloco alto conta quando entra de verdade na tela;
  // o .25 nunca bate nos altos), 1 vez. `secao` e `section` levam o mesmo nome (os relatórios dos controles filtram por `section`).
  const naDescida=()=>descendo?{na_descida:true}:{};
  const visto=new IntersectionObserver(entries=>{for(const e of entries)if(e.isIntersecting){
   visto.unobserve(e.target);
   const nome=(e.target as HTMLElement).dataset.bloco;
   event('landing_section_view',{secao:nome,section:nome,...naDescida()});
  }},{threshold:0,rootMargin:'0px 0px -35% 0px'});
  for(const s of document.querySelectorAll('[data-bloco]'))visto.observe(s);
  const preco=document.getElementById('preco');
  if(preco){
   // "viu a oferta" = 15% do cartão do preço na tela, sem parada: o critério e o `via` da /organizar (landing.ts, "bloco_15")
   const entrou=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting&&e.intersectionRatio>=.15)){entrou.disconnect();event('landing_oferta_vista',{via:'bloco_15',...naDescida()})}},{threshold:.15});
   entrou.observe(preco);
   // a régua mais dura, à parte: metade do cartão à mostra e PARADA (a volta do checkout e a descida não contam de passagem)
   let espera:ReturnType<typeof setTimeout>|undefined;
   const metade=new IntersectionObserver(entries=>{for(const e of entries){
    if(e.isIntersecting&&e.intersectionRatio>=.5){espera??=setTimeout(()=>{metade.disconnect();event('dia_oferta_parada')},PARADA_MS)}
    else if(espera!==undefined){clearTimeout(espera);espera=undefined}
   }},{threshold:.5});
   metade.observe(preco);
  }
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
   if(n>ate){ate=n;event('dia_cartoes_arraste',{ate,cartao:cartoes[n-1].dataset.cartao})} // o nome vai junto: o relatório não depende da ordem dos cartões
  };
  trilho.addEventListener('scroll',()=>{if(!marcado){marcado=true;requestAnimationFrame(medir)}},{passive:true});
 }

 // pedido guardado nesta aba (a ref que o checkout compartilhado grava ao abrir; some quando paga): lido já, antes de qualquer toque
 let temPedido=false;try{temPedido=!!sessionStorage.getItem(`${prefixoDaAba(ofertaDe(document.documentElement.getAttribute('data-oferta')),QA)}-stripe-ref`)}catch{/* sem storage */}
 // esta carga é a recarga única do pedaço que não baixava: abrir o checkout já (e gastar a recarga: "0")
 let abrirJa=false;try{abrirJa=sessionStorage.getItem(CHAVE_ABRIR)==='1';if(abrirJa)sessionStorage.setItem(CHAVE_ABRIR,'0')}catch{/* sem storage */}
 // a volta do banco sai do endereço já (recarregar depois não repete a conferência; a compra gravada na aba cuida do resto)
 if(voltou){
  void pegarCarga().then(m=>{
   const volta=m.bankReturn;
   // limpa sempre, mesmo com um redirect_status fora da lista (aí não há o que conferir, mas o endereço não fica com o PI)
   try{const limpa=new URL(location.href);for(const k of ['payment_intent','payment_intent_client_secret','redirect_status'])limpa.searchParams.delete(k);history.replaceState(history.state,'',`${limpa.pathname}${limpa.search}${limpa.hash}`)}catch{/* noop */}
   if(!volta){void mostrarCompra('recarga');return}
   void mostrarCompra('volta_banco',volta.pi).then(ja=>{if(!ja)void checkout(undefined,true)});
  }).catch(()=>{/* noop */});
 }
 // recarga (o Instagram recarrega a aba quando a pessoa volta do app do banco): já pagou → o caminho pro app com as lojas;
 // tem pedido guardado → o checkout reabre no mesmo pedido (o mesmo QR do Pix, ou o pago se o Pix já caiu), 1 vez
 else void mostrarCompra('recarga').then(ja=>{
  if(ja)return;
  if(temPedido){event('dia_checkout_reaberto');void checkout(undefined,false,true)}
  else if(abrirJa){event('dia_checkout_reaberto',{via:'pedaco'});void checkout(document.querySelector<HTMLElement>('[data-checkout="oferta"]')??undefined)}
 });
}
