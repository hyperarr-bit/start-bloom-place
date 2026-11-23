/**
 * /dia (23/11) — a página aparece inteira sem este arquivo (HTML e CSS no dia.html). Aqui: medição, o toque nos botões e o checkout.
 *   • 1º botão ("Quero meu dia organizado") e o link "Ver o preço": descem até o #preco; aqui só mede e anima a descida. Nunca abrem pagamento.
 *   • botão do preço e do fecho: abrem o checkout Stripe de sempre por cima (a Stripe só carrega neste toque).
 *   • voltou do banco (3DS por redirecionamento): o checkout reabre e pergunta ao servidor (o endereço nunca prova pagamento).
 *   • já pagou nesta aba (6 h): no lugar do checkout, o passo a passo de entrar no app (o mesmo pós-compra da /organizar e da /tudo).
 * O pedaço pesado (pixel, medição, checkout: ./payment, pela porta ./dia-carga) NÃO é importado aqui em cima: ele só é pedido depois
 * que a imagem do topo terminou (teto de 1,5 s), pra não disputar a rede com ela. Os eventos e os toques esperam essa promessa, na ordem.
 */
type Carga=typeof import('./dia-carga');

const CHAVE_COMPRA='oferta-pos-compra'; // a mesma de src/landing/pos-compra-app.ts (CHAVE_COMPRA_POS), sem baixar o pedaço à toa
const temCompra=()=>{try{return !!sessionStorage.getItem(CHAVE_COMPRA)}catch{return false}};
/** quanto tempo o bloco precisa ficar na tela pra contar como visto (a descida animada do 1º botão passa por cima sem contar) */
export const PARADA_MS=600;
/** teto de espera pela imagem do topo antes de pedir o pedaço pesado */
export const TETO_IMAGEM_MS=1500;

if(!document.documentElement.hasAttribute('data-desligada')){
 // a mesma conta de QA do payment.ts (a tarja não espera o pedaço pesado: sem salto de layout na prévia)
 const QA=new URLSearchParams(location.search).get('qa')==='1'||!['coreaplicativo.com.br','www.coreaplicativo.com.br'].includes(location.hostname);
 if(QA){const strip=document.createElement('div');strip.className='dia-qa';strip.textContent='PRÉVIA · PAGAMENTO SIMULADO · SEM COBRANÇA';document.body.prepend(strip)}

 // voltou do banco: não espera imagem nenhuma (o segredo sai do endereço assim que o payment.ts carrega)
 const voltou=new URLSearchParams(location.search).has('payment_intent');
 const imagemDoTopo=new Promise<void>(ok=>{
  const img=document.querySelector<HTMLImageElement>('.fone img');
  if(voltou||!img||img.complete){ok();return}
  const fim=()=>{clearTimeout(teto);ok()};
  const teto=setTimeout(fim,TETO_IMAGEM_MS);
  img.addEventListener('load',fim,{once:true});img.addEventListener('error',fim,{once:true});
 });
 const carga:Promise<Carga>=imagemDoTopo.then(()=>import('./dia-carga'));
 carga.catch(()=>{/* sem rede pro pedaço: a página segue inteira; o toque de pagar mostra o aviso */});
 /** os eventos esperam o pedaço pesado e saem na ordem em que foram pedidos */
 const event=(name:string,data:Record<string,unknown>={})=>{void carga.then(m=>m.event(name,data)).catch(()=>{/* noop */})};

 void carga.then(m=>m.initPixel()).catch(()=>{/* noop */});
 event('landing_view');

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
  try{const [m]=await Promise.all([carga,import('../completo/checkout.css'),import('./style.css')]);await m.openPayment(voltando?m.bankReturn??undefined:undefined)}
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

 // os dois links pro preço: medem e descem com animação por JS (sem `scroll-behavior: smooth` no CSS, que animava também a volta
 // do checkout e fazia a página "voar"). Sem JavaScript o href="#preco" continua levando ao preço.
 for(const a of document.querySelectorAll<HTMLElement>('[data-cta]'))a.addEventListener('click',e=>{
  event('landing_cta',{onde:a.dataset.cta});
  const preco=document.getElementById('preco');
  if(preco&&typeof preco.scrollIntoView==='function'){e.preventDefault();preco.scrollIntoView({behavior:'smooth',block:'start'})}
 });
 for(const b of document.querySelectorAll<HTMLElement>('[data-checkout]'))b.addEventListener('click',e=>{
  e.preventDefault();
  event('landing_checkout_click',{onde:b.dataset.checkout});
  void mostrarCompra('ja_comprou').then(ja=>{if(!ja)void checkout(b)});
 });
 // os selos das lojas do passo 2 são imagem, sem link (antes da compra ninguém é mandado pra loja): só conta quem tenta tocar
 for(const s of document.querySelectorAll<HTMLElement>('[data-selo]'))s.addEventListener('click',()=>event('dia_selo_toque',{loja:s.dataset.selo}));

 if('IntersectionObserver' in window){
  // threshold 0 + margem: bloco alto conta quando entra de verdade na tela (o .25 nunca bate nos altos).
  // Só conta o bloco que FICOU na tela por PARADA_MS: o que a descida animada atravessa não é "visto".
  const esperas=new Map<Element,ReturnType<typeof setTimeout>>();
  const visto=new IntersectionObserver(entries=>{for(const e of entries){
   const alvo=e.target;
   if(e.isIntersecting){
    if(!esperas.has(alvo))esperas.set(alvo,setTimeout(()=>{esperas.delete(alvo);visto.unobserve(alvo);event('landing_section_view',{secao:(alvo as HTMLElement).dataset.bloco})},PARADA_MS));
   }else{const t=esperas.get(alvo);if(t!==undefined){clearTimeout(t);esperas.delete(alvo)}}
  }},{threshold:0,rootMargin:'0px 0px -35% 0px'});
  for(const s of document.querySelectorAll('[data-bloco]'))visto.observe(s);
  // metade do cartão do preço à mostra, também parada (a volta do checkout e a descida não contam de passagem)
  const preco=document.getElementById('preco');
  if(preco){
   let espera:ReturnType<typeof setTimeout>|undefined;
   const metade=new IntersectionObserver(entries=>{for(const e of entries){
    if(e.isIntersecting&&e.intersectionRatio>=.5){espera??=setTimeout(()=>{metade.disconnect();event('landing_oferta_vista')},PARADA_MS)}
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
   if(n>ate){ate=n;event('dia_cartoes_arraste',{ate})}
  };
  trilho.addEventListener('scroll',()=>{if(!marcado){marcado=true;requestAnimationFrame(medir)}},{passive:true});
 }

 // a volta do banco sai do endereço já (recarregar depois não repete a conferência; a compra gravada na aba cuida do resto)
 if(voltou){
  void carga.then(m=>{
   const volta=m.bankReturn;
   if(!volta){void mostrarCompra('recarga');return}
   try{const limpa=new URL(location.href);for(const k of ['payment_intent','payment_intent_client_secret','redirect_status'])limpa.searchParams.delete(k);history.replaceState(history.state,'',`${limpa.pathname}${limpa.search}${limpa.hash}`)}catch{/* noop */}
   void mostrarCompra('volta_banco',volta.pi).then(ja=>{if(!ja)void checkout(undefined,true)});
  }).catch(()=>{/* noop */});
 }else void mostrarCompra('recarga');
}
