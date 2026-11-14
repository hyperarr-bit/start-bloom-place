(() => {
  const frame = document.getElementById('real-app-frame');
  const explorer = document.getElementById('app-explorer');
  const loading = document.getElementById('real-app-loading');
  const failure = document.getElementById('real-app-failure');
  const content = document.getElementById('real-app-content');
  const selector = document.getElementById('app-module-select');
  const accountNote = document.getElementById('app-account-note');
  const live = document.getElementById('app-live');
  const names = {home:'Início e organização',financas:'Finanças',rotina:'Rotina',saude:'Saúde',treino:'Treino',dieta:'Dieta',beleza:'Beleza',desenvolvimento:'Dev. Pessoal',casa:'Casa',biblioteca:'Biblioteca',estudos:'Estudos',mente:'Mente',carreira:'Carreira',relacionamentos:'Relações',detox:'Detox',pet:'Pet',viagens:'Viagens'};
  const guides = {home:'Na tela Início, toque em “Organizar” para escolher os módulos que aparecem.',financas:'Em Finanças, toque em “Meu financeiro” para registrar um gasto.',rotina:'Em Rotina, marque um hábito na grade da semana ou adicione um novo.'};
  let desiredModule = 'financas', pendingModule = null, booted = false, readyTimer;
  function updateControls(module) {
    if (!Object.prototype.hasOwnProperty.call(names, module)) return;
    desiredModule = module; selector.value = module;
    frame.title = names[module] + ' do CORE, com dados de exemplo';
    document.querySelectorAll('[data-demo-shortcut]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.demoShortcut === module)));
    document.getElementById('demo-guide').textContent = guides[module] || 'Explore ' + names[module] + ' com os dados de exemplo do CORE.';
  }
  function beginLoading() {
    clearTimeout(readyTimer); loading.hidden = false; failure.hidden = true; content.setAttribute('aria-busy','true');
    document.getElementById('load-real-app').hidden = true;
    readyTimer = setTimeout(() => { loading.hidden = true; failure.hidden = false; content.setAttribute('aria-busy','false'); }, 45000);
  }
  function ensureLoaded(force = false) {
    if (frame.hasAttribute('src') && !force) return;
    booted = false; pendingModule = desiredModule; accountNote.hidden = true; beginLoading();
    frame.src = '/completo/app-real/index.html?module=' + encodeURIComponent(desiredModule);
  }
  function sendNavigation() {
    frame.contentWindow.postMessage({type:'core-real-navigate',module:desiredModule}, location.protocol === 'file:' ? '*' : location.origin);
  }
  function selectModule(module, scroll = false) {
    if (!Object.prototype.hasOwnProperty.call(names, module)) return;
    const changed = module !== desiredModule;
    updateControls(module); accountNote.hidden = true; document.dispatchEvent(new CustomEvent('lp27:demo',{detail:{action:'module',module}}));
    if (!frame.hasAttribute('src')) ensureLoaded();
    else if (changed || failure.hidden === false) {
      pendingModule = module; beginLoading();
      if (booted) sendNavigation();
    }
    if (scroll) explorer.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',block:'start'});
  }
  document.querySelectorAll('[data-real-module]').forEach(b => b.addEventListener('click', () => selectModule(b.dataset.realModule, true)));
  document.querySelectorAll('[data-demo-shortcut]').forEach(b => b.addEventListener('click', () => selectModule(b.dataset.demoShortcut)));
  selector.addEventListener('change', () => selectModule(selector.value));
  document.getElementById('retry-real-app').addEventListener('click', () => ensureLoaded(true));
  document.getElementById('reset-real-app').addEventListener('click', () => {ensureLoaded(true); live.textContent='Recomeçando com os dados de exemplo.';});
  document.getElementById('load-real-app').addEventListener('click', () => ensureLoaded());
  window.addEventListener('message', event => {
    if (event.source !== frame.contentWindow || !event.data || typeof event.data !== 'object') return;
    if (location.protocol !== 'file:' && event.origin !== location.origin) return;
    const data = event.data;
    switch (data.type) {
      case 'core-real-ready': {
        if (!Object.prototype.hasOwnProperty.call(names, data.module)) return;
        booted = true;
        if (pendingModule && data.module !== pendingModule) {sendNavigation();return;}
        clearTimeout(readyTimer); pendingModule=null; updateControls(data.module);
        loading.hidden=true; failure.hidden=true; content.setAttribute('aria-busy','false');
        live.textContent=names[data.module]+' pronto para experimentar aqui na página.'; document.dispatchEvent(new CustomEvent('lp27:demo',{detail:{action:'ready',module:data.module}}));
        break;
      }
      case 'core-real-route':
        if (!pendingModule && Object.prototype.hasOwnProperty.call(names,data.module)) updateControls(data.module);
        break;
      case 'core-real-error':
        clearTimeout(readyTimer); loading.hidden=true; failure.hidden=false; content.setAttribute('aria-busy','false'); break;
      case 'core-real-offer':
        accountNote.hidden=false; break;
      case 'core-real-focus-controls':
        selector.focus({preventScroll:true}); break;
    }
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {ensureLoaded();observer.disconnect();}
    }, {rootMargin:'120px 0px',threshold:0.01});
    observer.observe(explorer);
  }
  const sticky = document.querySelector('.sticky-buy');
  const hero = document.querySelector('.hero-actions'); const offer = document.querySelector('.offer-card'); const footer = document.querySelector('.footer');
  function updateSticky() {
    const h=hero.getBoundingClientRect(),o=offer.getBoundingClientRect(),f=footer.getBoundingClientRect(),d=explorer.getBoundingClientRect();
    sticky.hidden=h.bottom>0 || (o.top<innerHeight && o.bottom>0) || (d.top<innerHeight && d.bottom>0) || f.top<innerHeight || document.activeElement===frame;
  }
  addEventListener('scroll',updateSticky,{passive:true});addEventListener('resize',updateSticky);addEventListener('focusin',updateSticky);addEventListener('blur',()=>setTimeout(updateSticky,0));updateSticky();
})();
