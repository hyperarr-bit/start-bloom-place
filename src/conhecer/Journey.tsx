import { lazy,Suspense,useCallback,useEffect,useRef,useState } from 'react';
import { ArrowLeft,ArrowRight,Check,ChevronRight,ShieldCheck,Smartphone,X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ALL_MODULE_ICONS } from '@/lib/funnel';
import { criarCarregadorCompartilhado } from '@/landing/carregar';
import { event,attribution,initPixel,QA,journeySession } from './telemetry';
import { CHECKOUT_OFFER, CHECKOUT_PRICE,readCheckout } from './checkout-state';
import { hasLegacyStripeAttempt } from './legacy-return';
import './journey.css';

const loadCheckout=criarCarregadorCompartilhado(()=>import('./Checkout'),{aoFalhar:tentativa=>event('jornada_erro',{onde:'carregar_checkout',tentativa})});
const Checkout=lazy(()=>loadCheckout());
type Stage='entry'|'context'|'demo'|'value'|'offer'|'checkout';
type Area='financas'|'rotina'|'tudo';
type DemoRoute={area:Area,module:'financas'|'rotina',tab:string,demoVisited:boolean};
const steps=['Conhecer','Seu começo','No app','Tudo incluído','Seu acesso'];
const stages:Stage[]=['entry','context','demo','value','offer','checkout'];
const stepIndex:Record<Stage,number>={entry:0,context:1,demo:2,value:3,offer:4,checkout:4};
const choices={financas:[{title:'Entender o mês',sub:'Ver o painel, os gastos e o saldo juntos.',tab:'dashboard'},{title:'Organizar os gastos',sub:'Conhecer os registros e as contas do mês.',tab:'financeiro'}],rotina:[{title:'Cuidar dos meus hábitos',sub:'Ver a semana e marcar o que já fiz.',tab:'semana'},{title:'Planejar os próximos dias',sub:'Conhecer o planejamento do mês.',tab:'mes'}]};
const storage={get:(k:string)=>{try{return sessionStorage.getItem(k)}catch{return null}},set:(k:string,v:string)=>{try{sessionStorage.setItem(k,v)}catch{/* optional */}}};

export default function Journey(){
  const [stage,setStage]=useState<Stage>(()=>(!QA&&readCheckout())||new URLSearchParams(location.search).get('etapa')==='checkout'?'checkout':'entry');
  const [legacyAttempt]=useState(()=>{if(QA||readCheckout())return false;try{return hasLegacyStripeAttempt(sessionStorage)}catch{return false}});
  const [area,setArea]=useState<Area>('tudo');
  const [module,setModule]=useState<'financas'|'rotina'>('financas');
  const [tab,setTab]=useState('dashboard');
  const [demoMounted,setDemoMounted]=useState(false);
  const [demoVisited,setDemoVisited]=useState(false);
  const [demoReady,setDemoReady]=useState(false);
  const [slow,setSlow]=useState(false);
  const [frameVersion,setFrameVersion]=useState(0);
  const [frameSrc,setFrameSrc]=useState('');
  const [note,setNote]=useState('');
  const frame=useRef<HTMLIFrameElement>(null);
  const heading=useRef<HTMLDivElement>(null);
  const latest=useRef({stage,module,tab,area,demoVisited});latest.current={stage,module,tab,area,demoVisited};
  const readyRef=useRef(demoReady);readyRef.current=demoReady;
  const offerFrom=useRef<Stage>('entry');
  const editSeen=useRef(new Set<string>());
  const historyId=useRef(`${Date.now()}-${Math.random()}`);
  const position=useRef(0);
  const savedTabs=useRef<Record<string,string>>({});
  const checkpoint=useRef(stage);
  const prepareDemo=useCallback((route:DemoRoute)=>{
    setDemoMounted(true);
    if(frame.current&&readyRef.current)frame.current.contentWindow?.postMessage({type:'conhecer:module',module:route.module,tab:route.tab},location.origin);
    else{setDemoReady(false);setFrameSrc(`/vitalicio/demo?m=${route.module}&aba=${route.tab}${QA?'&qa=1':''}`)}
  },[]);
  const go=useCallback((next:Stage,overrides:Partial<DemoRoute>={})=>{
    if(latest.current.stage===next&&Object.keys(overrides).length===0)return;
    const route={...latest.current,...overrides,stage:next};
    latest.current=route;
    const u=new URL(location.href);u.searchParams.set('etapa',next);u.searchParams.set('aba',route.tab);position.current++;
    history.pushState({conhecer:historyId.current,...route,position:position.current},'',u);
    setArea(route.area);setModule(route.module);setTab(route.tab);setDemoVisited(route.demoVisited);setStage(next);setNote('');
  },[]);
  useEffect(()=>{
    initPixel();event('jornada_inicio',{visible:document.visibilityState==='visible',entrada:'perguntas_demo_restaurado_v1'});
    history.replaceState({conhecer:historyId.current,...latest.current,stage:checkpoint.current,position:0},'',location.href);
    const pop=(e:PopStateEvent)=>{
      const state=e.state;
      if(state?.conhecer!==historyId.current||!stages.includes(state.stage))return;
      if(!['tudo','financas','rotina'].includes(state.area)||!['financas','rotina'].includes(state.module)||typeof state.tab!=='string')return;
      const route:DemoRoute={area:state.area,module:state.module,tab:state.tab,demoVisited:state.demoVisited||state.stage==='demo'};
      latest.current={...route,stage:state.stage};position.current=state.position??0;
      setArea(route.area);setModule(route.module);setTab(route.tab);setDemoVisited(route.demoVisited);setStage(state.stage);setNote('');
      if(state.stage==='demo')prepareDemo(route);
    };
    window.addEventListener('popstate',pop);return()=>window.removeEventListener('popstate',pop);
  },[prepareDemo]);
  useEffect(()=>{
    window.scrollTo(0,0);heading.current?.focus({preventScroll:true});event('jornada_etapa',{etapa:stage,area,module});
    const started=Date.now();const exit=()=>event('jornada_saida_etapa',{etapa:stage,tempo_ms:Date.now()-started});
    window.addEventListener('pagehide',exit);return()=>{window.removeEventListener('pagehide',exit);exit()};
  },[stage]);
  useEffect(()=>{if(stage==='offer')void loadCheckout(false).catch(()=>{});},[stage]);
  const openDemo=(m:'financas'|'rotina',t:string)=>{
    event('jornada_demo_abrir',{module:m,aba:t});
    const route={...latest.current,module:m,tab:t,demoVisited:true};
    go('demo',route);prepareDemo(route);
  };
  useEffect(()=>{
    const listener=(e:MessageEvent)=>{
      if(e.origin!==location.origin||e.source!==frame.current?.contentWindow)return;
      const d=e.data;
      if(d?.type==='conhecer:ready'){setDemoReady(true);setSlow(false);event('jornada_demo_pronta',{module:d.module});}
      if(d?.type==='conhecer:value')go('value');
      if((d?.type==='conhecer:module'||d?.type==='conhecer:tab')&&['financas','rotina'].includes(d.module)&&typeof d.tab==='string'&&latest.current.stage==='demo'){
        savedTabs.current[d.module]=d.tab;setModule(d.module);setTab(d.tab);
        latest.current={...latest.current,module:d.module,tab:d.tab};
        const u=new URL(location.href);u.searchParams.set('aba',d.tab);
        history.replaceState({conhecer:historyId.current,...latest.current,position:position.current},'',u);
        if(d.type==='conhecer:module')event('jornada_demo_modulo',{module:d.module});
      }
      if(d?.type==='conhecer:edit'&&!editSeen.current.has(d.module)){editSeen.current.add(d.module);event('jornada_demo_edicao',{module:d.module});}
    };
    window.addEventListener('message',listener);return()=>window.removeEventListener('message',listener);
  },[go]);
  useEffect(()=>{if(!demoMounted||demoReady)return;const t=setTimeout(()=>setSlow(true),8000);return()=>clearTimeout(t)},[demoMounted,demoReady,frameVersion]);
  function selectArea(a:Area){const m=a==='rotina'?'rotina':'financas';event('jornada_area',{area:a});go('context',{area:a,module:m,tab:savedTabs.current[m]??(m==='rotina'?'semana':'dashboard'),demoVisited:false});}
  function back(){if(position.current>0){history.back();return;}const previous:Record<Stage,Stage>={entry:'entry',context:'entry',demo:'context',value:demoVisited?'demo':'context',offer:offerFrom.current,checkout:'offer'};go(previous[stage]);if(previous[stage]==='demo')prepareDemo(latest.current);}
  function buy(){
    event('jornada_comprar',{oferta:CHECKOUT_OFFER});
    if(!QA&&storage.get('conhecer-checkout-aberto')!=='1') {
      void import('@/pages/venda/rastreio').then(({eventoMeta})=>eventoMeta('InitiateCheckout',`conhecer_ic_${journeySession}`,{value:CHECKOUT_PRICE,currency:'BRL',content_name:'CORE vitalício · conhecer'})).catch(()=>{});
    }
    storage.set('conhecer-checkout-aberto','1');go('checkout');
  }
  const primary=(label:string,action:()=>void)=><Button className="j-cta" onClick={action}>{label}<ArrowRight size={18}/></Button>;
  const access=()=>{if(stage==='offer')return;offerFrom.current=stage;go('offer')};
  return <div className="j-root" data-testid="conhecer-journey" data-stage={stage}>
    {stage!=='demo'&&<><header className="j-header"><div className="j-brand">CORE</div><div className="j-header-actions"><button className="j-text-link" onClick={access}>Ver acesso</button><ThemeToggle trackChanges={!QA}/></div></header><div className="j-progress" aria-label={`Etapa ${stepIndex[stage]+1} de 5: ${steps[stepIndex[stage]]}`}>{steps.map((s,i)=><span key={s} title={s} className={i<=stepIndex[stage]?'j-progress-done':''}/>)}</div></>}
    <div ref={heading} tabIndex={-1} className={stage==='demo'?'j-main j-main-demo':'j-main'}>
      {!['entry','demo','checkout'].includes(stage)&&<button className="j-back" onClick={back}><ArrowLeft size={16}/>Voltar</button>}
      {note&&<p className="j-notice" role="status">{note}</p>}
      {legacyAttempt&&stage!=='demo'&&<p className="j-notice">Você já iniciou um pedido na página anterior. <a className="underline font-semibold" href="/oferta">Conferir meu pedido anterior</a> antes de começar outra compra.</p>}
      {stage==='entry'&&<section className="j-entry j-panel">
        <div className="j-module-icons" aria-label="16 módulos do CORE">{ALL_MODULE_ICONS.map(m=><span key={m.label} title={m.label}>{m.emoji}</span>)}</div>
        <h1>Um app pra<br/>vida inteira.</h1><p className="j-lead">Dinheiro, rotina e mais 14 áreas, no mesmo lugar.</p>
        <h2 className="j-question">Por onde você quer começar?</h2>
        <div className="j-options">{([['tudo','🎯','Tudo, sinceramente','Conhecer o app e o que vem junto.'],['financas','💰','Meu dinheiro','Gastos, contas e o mês inteiro.'],['rotina','📅','Minha rotina','Hábitos, tarefas e próximos dias.']] as const).map(([key,icon,title,desc])=><button key={key} onClick={()=>selectArea(key)}><span className={`j-area-icon j-area-${key}`}>{icon}</span><span><b>{title}</b><small>{desc}</small></span><ChevronRight size={19}/></button>)}</div>
        <p className="j-included"><Check size={15}/>Os 16 módulos vêm juntos, em qualquer escolha.</p>
        <div className="j-platforms"><Smartphone size={16}/>iPhone e Android<span>·</span>Computador</div>
        <p className="j-lab-detail">Você pode explorar Finanças e Rotina com dados de exemplo, sem cadastro.</p>
        <a className="j-text-link" href="/entrar" onClick={()=>event('jornada_login_click')}>Já tenho acesso</a>
      </section>}
      {stage==='context'&&<section className="j-panel"><p className="j-eyebrow">SEU PONTO DE PARTIDA</p><h1>{area==='tudo'?'Vamos começar pelo que você quer ver.':area==='rotina'?'O que você quer organizar primeiro?':'O que você quer enxergar melhor?'}</h1><p className="j-lead">Sua escolha abre uma parte diferente do app. Todos os módulos continuam incluídos.</p><div className="j-options">{area==='tudo'?(['financas','rotina'] as const).map(m=><button key={m} onClick={()=>openDemo(m,m==='financas'?'dashboard':'semana')}><span className={`j-area-icon j-area-${m}`}>{m==='financas'?'💰':'📅'}</span><span><b>{m==='financas'?'Ver meu mês financeiro':'Ver minha semana'}</b><small>{m==='financas'?'Um painel com gastos, receitas e saldo.':'Hábitos e tarefas nos dias da semana.'}</small></span><ChevronRight size={19}/></button>):choices[area].map(c=><button key={c.tab} onClick={()=>openDemo(area,c.tab)}><span><b>{c.title}</b><small>{c.sub}</small></span><ChevronRight size={19}/></button>)}</div><button className="j-text-link j-skip" onClick={()=>go('value')}>Prefiro conhecer o que está incluído</button></section>}
      {demoMounted&&<section hidden={stage!=='demo'} className="j-demo">
        <div className="j-demo-toolbar"><span>Demo · dados de exemplo</span><label className="sr-only" htmlFor="demo-module">Módulo da demonstração</label><select id="demo-module" value={module} onChange={e=>openDemo(e.target.value as 'financas'|'rotina',savedTabs.current[e.target.value]??(e.target.value==='financas'?'dashboard':'semana'))}><option value="financas">Finanças</option><option value="rotina">Rotina</option></select><button aria-label="Fechar demonstração" onClick={()=>go('value')}><X size={18}/></button></div>
        {!demoReady&&<div className="j-frame-loading" role="status"><p>{slow?'A demonstração está demorando para abrir.':'Carregando o app…'}</p>{slow&&<button className="j-text-link" onClick={()=>{setSlow(false);setFrameVersion(n=>n+1)}}>Tentar novamente</button>}<button className="j-text-link" onClick={()=>go('value')}>Continuar sem esperar</button></div>}
        <iframe key={frameVersion} ref={frame} title={`Demonstração do CORE — ${module==='financas'?'Finanças':'Rotina'}`} className={`j-app-frame ${demoReady?'':'j-frame-pending'}`} src={frameSrc} sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/>
        <div className="j-demo-footer"><div>{primary('Conhecer o acesso completo',()=>go('value'))}</div></div>
      </section>}
      {stage==='value'&&<section className="j-panel">
        <p className="j-eyebrow">UMA ÁREA É SÓ O COMEÇO</p><h1>Seu CORE vem<br/>com tudo isso.</h1><p className="j-lead">{area==='rotina'?'Você pode começar pela rotina.':area==='financas'?'Você pode começar pelo dinheiro.':'Você escolhe por onde começar.'} O resto já faz parte do mesmo acesso.</p>
        <div className="j-all-modules">{ALL_MODULE_ICONS.map(m=><div key={m.label}><span>{m.emoji}</span>{m.label}</div>)}</div>
        <div className="j-value-block"><h2>Chega de um app pra cada coisa.</h2><ul><li><Check/>As contas do mês com o dia de vencer.</li><li><Check/>O dia com o que fazer, marcado na hora.</li><li><Check/>Treino, dieta e metas no mesmo painel.</li></ul></div>
        <div className="j-proof"><p className="j-eyebrow">QUEM USA CONTA</p><h2>O que já contam sobre o CORE</h2><figure><blockquote>“Tudo que eu sempre quis num planner online.”</blockquote><figcaption>Google Play</figcaption></figure><figure><blockquote>“Muito bom pra quem quer se organizar em todas as áreas da vida.”</blockquote><figcaption>App Store</figcaption></figure></div>
        <div className="j-access-summary"><Smartphone/><div><b>No celular e no computador.</b><p>Entre com a mesma conta no iPhone, no Android ou no navegador.</p></div></div>
        {primary('Ver meu acesso ao CORE',access)}<button className="j-text-link j-skip" onClick={()=>openDemo(module,demoVisited?(savedTabs.current[module]??tab):(module==='financas'?'dashboard':'semana'))}>{demoVisited?'Voltar ao app':'Quero ver o app antes'}</button>
      </section>}
      {stage==='offer'&&<section className="j-panel"><p className="j-eyebrow">O CORE INTEIRO, COM VOCÊ</p><h1>Organize sua vida.<br/>No seu ritmo.</h1><p className="j-lead">Finanças, rotina e todos os 16 módulos no mesmo acesso.</p><div className="j-offer-card"><div className="j-offer-heading">ACESSO VITALÍCIO</div><div className="j-offer-body"><p className="j-price"><span>R$</span>{Math.floor(CHECKOUT_PRICE)}<small>,{CHECKOUT_PRICE.toFixed(2).split(".")[1]}</small></p><p className="j-price-caption">Pagamento único no Pix.<br/><b>Sem mensalidade. Não renova sozinho.</b></p><ul><li><Check/>Todos os 16 módulos incluídos.</li><li><Check/>iPhone, Android e computador.</li><li><Check/>Acesso com a mesma conta.</li></ul>{primary('Continuar com Pix',buy)}</div></div><div className="j-guarantee"><ShieldCheck/><p><b>7 dias de garantia.</b><br/>Se não gostar, solicite a devolução de 100% do valor em até 7 dias pelo suporte.</p></div><div className="j-faq"><h2>Como funciona depois?</h2><details><summary>Como recebo meu acesso?</summary><p>Informe o e-mail que vai usar no CORE. Após a confirmação do Pix, seu acesso fica vinculado a essa conta. As instruções também chegam por e-mail.</p></details><details><summary>Preciso pagar de novo no app?</summary><p>Não. Baixe o CORE e escolha “Entrar”, usando o mesmo e-mail da compra. Você pode usar a mesma conta no celular e no computador.</p></details><details><summary>É só o módulo que escolhi?</summary><p>Não. Todos os 16 módulos fazem parte do acesso, qualquer que tenha sido sua escolha inicial.</p></details><details><summary>Como peço ajuda ou reembolso?</summary><p>Fale com <a href="mailto:contato@coreaplicativo.com.br">contato@coreaplicativo.com.br</a> usando o e-mail da compra.</p></details></div><button className="j-text-link j-skip" onClick={()=>go('value')}>Rever tudo que está incluído</button></section>}
      {stage==='checkout'&&<Suspense fallback={<section className="j-panel"><p role="status">Abrindo seu pagamento…</p><button className="j-text-link" onClick={()=>go('offer')}>Voltar à oferta</button></section>}><Checkout onBack={()=>go('offer')} onStage={s=>event('jornada_checkout_etapa',{etapa:s})} attribution={attribution} event={event}/></Suspense>}
    </div>
    {stage!=='demo'&&<footer className="j-legal"><a href="/termos" target="_blank" rel="noopener">Termos</a><a href="/privacidade" target="_blank" rel="noopener">Privacidade</a><a href="mailto:contato@coreaplicativo.com.br">Suporte</a></footer>}
  </div>;
}
