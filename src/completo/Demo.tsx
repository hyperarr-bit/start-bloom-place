import {useEffect,useRef,useState} from 'react';
import {moduleNames} from './model';

/** Real product bundle, copied with its network-blocking infrastructure. No CSS enters this iframe. */
export function Demo({initial,onOffer,onReady}:{initial:string;onOffer:()=>void;onReady:()=>void}) {
 const frame=useRef<HTMLIFrameElement>(null);
 const [module,setModule]=useState(initial);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [retry,setRetry]=useState(0);
 const [requestGeneration,setRequestGeneration]=useState(0);
 const [sourceModule,setSourceModule]=useState(initial);
 const desired=useRef(initial);
 const pending=useRef<string|null>(initial);
 const readyCallback=useRef(onReady);readyCallback.current=onReady;
 const offerCallback=useRef(onOffer);offerCallback.current=onOffer;
 useEffect(()=>{
  const timeout=setTimeout(()=>setStatus(s=>s==='loading'?'error':s),18000);
  function receive(event:MessageEvent){
   if(event.source!==frame.current?.contentWindow||event.origin!==location.origin||!event.data||typeof event.data!=='object')return;
   const data=event.data;
   if(data.type==='core-real-ready'){
    if(!Object.prototype.hasOwnProperty.call(moduleNames,data.module))return;
    if(pending.current&&data.module!==pending.current)return;
    pending.current=null;desired.current=data.module;setModule(data.module);
    setStatus('ready');clearTimeout(timeout);readyCallback.current();
   }
   if(data.type==='core-real-route'&&Object.prototype.hasOwnProperty.call(moduleNames,data.module)&&(!pending.current||data.module===pending.current)){setModule(data.module);desired.current=data.module;}
   if(data.type==='core-real-error'){clearTimeout(timeout);setStatus('error');}
   if(data.type==='core-real-offer')offerCallback.current();
   if(data.type==='core-real-focus-controls')document.getElementById('demo-module')?.focus();
  }
  addEventListener('message',receive);return()=>{clearTimeout(timeout);removeEventListener('message',receive)};
 },[retry,requestGeneration]);
 function navigate(next:string){
  desired.current=next;pending.current=next;setModule(next);setStatus('loading');setRequestGeneration(g=>g+1);
  frame.current?.contentWindow?.postMessage({type:'core-real-navigate',module:next},location.origin);
 }
 return <div className="real-demo">
  <div className="demo-toolbar"><label htmlFor="demo-module">Explorar</label><select id="demo-module" disabled={status==='loading'} value={module} onChange={e=>navigate(e.target.value)}>{Object.entries(moduleNames).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
  <p className="example-label">Demonstração com dados de exemplo</p>
  <div className="demo-frame-wrap" aria-busy={status==='loading'}>
   {status==='loading'&&<div className="demo-status" role="status"><span className="spinner"/>Abrindo o CORE…</div>}
   {status==='error'&&<div className="demo-status"><strong>Não foi possível carregar a demonstração.</strong><p>Você pode tentar novamente ou conhecer o acesso.</p><button className="secondary" onClick={()=>{setStatus('loading');pending.current=module;desired.current=module;setSourceModule(module);setRetry(r=>r+1)}}>Tentar novamente</button><button className="text-button" onClick={onOffer}>Conhecer o acesso</button></div>}
   <iframe key={retry} ref={frame} title={`${moduleNames[module]} do CORE, dados de exemplo`} src={`/completo/app-real/index.html?module=${encodeURIComponent(sourceModule)}&retry=${retry}`} sandbox="allow-scripts allow-same-origin" hidden={status==='error'}/>
  </div>
 </div>;
}
