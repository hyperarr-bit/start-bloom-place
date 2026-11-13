import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Check, ChevronLeft, Layers3, CalendarDays, Wallet, ShieldCheck} from 'lucide-react';
import {Demo} from './Demo';
import {Area,moduleIcons} from './model';
import {event,initPixel,openPayment,QA,bankReturn} from './payment';
import './style.css';
import './checkout.css';

type Screen='choice'|'demo'|'offer';
function Journey(){
 const [screen,setScreen]=useState<Screen>(bankReturn?'offer':'choice');
 const [area,setArea]=useState<Area>('tudo');
 const [demoOpen,setDemoOpen]=useState(false);
 const [generation,setGeneration]=useState(0);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const scroll=useRef<HTMLDivElement>(null);
 const heading=useRef<HTMLHeadingElement>(null);
 useEffect(()=>{initPixel();event('landing_view');if(bankReturn){openPayment(bankReturn).catch(()=>setError('Não conseguimos consultar o pagamento. Tente novamente antes de fazer outra compra.'));}},[]);
 useEffect(()=>{scroll.current?.scrollTo(0,0);event('completo_step_view',{step:screen,area});heading.current?.focus({preventScroll:true});},[screen]);
 function go(next:Screen){if(next==='demo')setDemoOpen(true);setScreen(next);setError('');}
 function choose(next:Area){setArea(next);setDemoOpen(false);setGeneration(g=>g+1);event('completo_area_selected',{area:next});}
 async function checkout(){if(busy)return;setBusy(true);setError('');event('completo_checkout_click',{area});try{await openPayment()}catch{setError('Não conseguimos abrir o pagamento. Tente novamente.')}finally{setBusy(false)}}
 return <div className={`product product-${screen}`}>
  {QA&&<div className="prototype-strip">PRÉVIA · PAGAMENTO SIMULADO · SEM COBRANÇA</div>}
  <header className="product-header"><div>{screen!=='choice'?<button className="icon-button" aria-label="Voltar uma etapa" onClick={()=>go(screen==='offer'?'demo':'choice')}><ChevronLeft size={22}/></button>:<img src="/completo/core-logo-black.webp" alt="CORE" width="84" height="23"/>}</div><span className="product-location">{screen==='choice'?'Seu começo':screen==='demo'?'Conheça o app':'Seu acesso'}</span><span className="step-indicator">{screen==='choice'?'1':screen==='demo'?'2':'3'} de 3</span></header>
  <div ref={scroll} className="product-scroll">
   {screen==='choice'&&<section className="choice-screen screen-pad"><p className="eyebrow">16 ÁREAS. UM SÓ CORE.</p><h1 ref={heading} tabIndex={-1}>A vida toda.<br/>Um começo seu.</h1><p className="lead">Dinheiro, rotina e tudo que faz parte do seu dia, no mesmo app.</p><div className="module-mosaic" aria-label="Os 16 módulos do CORE">{moduleIcons.map((icon,i)=><span key={i} aria-hidden="true">{icon}</span>)}</div><h2>Por onde você quer começar?</h2><p className="support">Isso muda a demonstração. Todos os módulos continuam incluídos.</p><div className="area-options" role="radiogroup" aria-label="Área para começar">{([{key:'tudo',icon:Layers3,title:'Quero organizar tudo',sub:'Um lugar para as diferentes partes da vida.'},{key:'financas',icon:Wallet,title:'Meu dinheiro',sub:'Gastos, contas e o mês inteiro.'},{key:'rotina',icon:CalendarDays,title:'Minha rotina',sub:'Hábitos, tarefas e próximos dias.'}] as const).map(({key,icon:Icon,title,sub})=><button key={key} role="radio" aria-checked={area===key} tabIndex={area===key?0:-1} onKeyDown={e=>{const order:Area[]=['tudo','financas','rotina'];const delta=/Arrow(Down|Right)/.test(e.key)?1:/Arrow(Up|Left)/.test(e.key)?-1:0;if(delta){e.preventDefault();choose(order[(order.indexOf(key)+delta+3)%3]);const group=e.currentTarget.parentElement;requestAnimationFrame(()=>group?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus())}}} className={`area-option ${area===key?'selected':''}`} onClick={()=>choose(key)}><span className={`area-icon ${key}`}><Icon size={21}/></span><span><strong>{title}</strong><small>{sub}</small></span><span className="radio-dot">{area===key&&<span/>}</span></button>)}</div><p className="choice-note">Explore sem cadastro, com dados de exemplo.</p></section>}
   <div hidden={screen!=='demo'} className="demo-screen"><div className="demo-intro"><h1 ref={screen==='demo'?heading:undefined} tabIndex={-1}>Explore o CORE por dentro.</h1><p>Olhe as áreas que quiser. Não precisa completar uma tarefa.</p></div>{demoOpen&&<Demo key={generation} initial={area==='tudo'?'home':area} onOffer={()=>go('offer')} onReady={()=>event('completo_demo_ready',{area})}/>}</div>
   {screen==='offer'&&<section className="paywall-screen screen-pad"><p className="eyebrow">ACESSO VITALÍCIO</p><h1 ref={heading} tabIndex={-1}>Seu CORE,<br/>por inteiro.</h1><p className="lead">{area==='financas'?'Comece pelo dinheiro. Organize também o resto da vida.':area==='rotina'?'Comece pela rotina. Tenha suas outras áreas por perto.':'Finanças, rotina e mais 14 áreas para organizar sua vida.'}</p><ul className="benefits"><li><Check/><span><strong>Todos os 16 módulos</strong><small>Finanças, rotina, saúde, estudos e mais.</small></span></li><li><Check/><span><strong>Uma conta nos seus dispositivos</strong><small>iPhone, Android e computador.</small></span></li><li><Check/><span><strong>Acesso vitalício ao CORE</strong><small>Pagamento único. Sem mensalidade ou renovação.</small></span></li></ul><div className="lifetime-price"><span>CORE completo · vitalício</span><strong>R$ 67,90</strong><p>Uma única vez, no Pix ou cartão.</p></div><div className="guarantee"><ShieldCheck size={23}/><div><strong>7 dias de garantia</strong><p>Se não for para você, devolvemos 100% do valor.</p></div></div><p className="access-explanation">Após a confirmação, entre no app com o e-mail da compra. As instruções de acesso chegam por e-mail.</p><button className="demo-again" onClick={()=>go('demo')}>Olhar o app novamente</button><div className="legal-links"><a href="/termos" target="_blank" rel="noopener">Termos</a><span>·</span><a href="/privacidade" target="_blank" rel="noopener">Privacidade</a></div></section>}
  </div>
  <footer className="product-footer">{error&&<p role="alert" className="payment-error">{error}</p>}{screen==='choice'?<><button className="primary" onClick={()=>go('demo')}>Ver o CORE por dentro</button><span className="footer-note">Demonstração com dados de exemplo.</span></>:screen==='demo'?<><button className="primary" onClick={()=>go('offer')}>Conhecer o acesso completo</button><span className="footer-note">Todos os 16 módulos, em uma única conta.</span></>:<><button className="primary" disabled={busy} onClick={checkout}>{busy?'Abrindo pagamento…':'Quero meu CORE por R$ 67,90'}</button><span className="footer-note">Pix ou cartão. Pagamento único, sem assinatura.</span></>}</footer>
 </div>
}
class Boundary extends React.Component<{children:React.ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true}}render(){return this.state.failed?<main className="fallback"><h1>Vamos tentar novamente.</h1><p>Não foi possível carregar esta tela. Se já pagou, seu acesso continua vinculado ao e-mail da compra.</p><button onClick={()=>location.reload()}>Recarregar</button><a href="/entrar">Entrar no CORE</a></main>:this.props.children}}
createRoot(document.getElementById('root')!).render(<Boundary><Journey/></Boundary>);
