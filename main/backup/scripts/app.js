function getParams(){
  const p = new URLSearchParams(location.search);
  return {
    q: p.get('q') || '',
    status: p.get('status') || 'all',
    sort: p.get('sort') || 'order',
    car: p.get('car') || null
  };
}
function setParams({q,status,sort,car}){
  const p = new URLSearchParams(location.search);
  if (q !== undefined) p.set('q', q);
  if (status !== undefined) p.set('status', status);
  if (sort !== undefined) p.set('sort', sort);
  if (car !== undefined && car !== null) p.set('car', car);
  const url = location.pathname + '?' + p.toString() + location.hash;
  history.replaceState(null, '', url);
}

async function loadData(){ const r=await fetch('data/vehicles.json'); return await r.json(); }
function statusClass(t,c){ const s=(t||'').toLowerCase(); if(s.includes('progress')||s.includes('rebuild'))return'bg-yellow-400 text-black'; if(c>0||s.includes('running')||s.includes('complete'))return'bg-green-500 text-black'; return'bg-rose-400 text-black'; }

function timelineRow(h, idx, vid){
  const hasImgs = Array.isArray(h.images) && h.images.length;
  const btn = hasImgs ? `<button class="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs mt-1 timeline-view" data-vid="${vid}" data-idx="${idx}">View photos (${h.images.length})</button>` : '';
  return `<li class="step text-sm text-slate-300">
    <span class="font-semibold">${h.date||''}</span> — ${h.event||''}
    ${btn}
  </li>`;
}

function vehicleCard(v){
  const badge=statusClass(v.status,(v.completedFixes||[]).length);
  const nick=v.nickname?`<div class="text-sm text-slate-400">${v.nickname}</div>`:'';
  const hist=(v.history&&v.history.length)?v.history.map((h,i)=>timelineRow(h,i,v.id)).join(''):'<p class="text-sm text-slate-400">No timeline yet.</p>';
  const tags=(v.tags||[]).map(t=>`<span class="badge bg-slate-800 border border-slate-700 text-slate-200">${t}</span>`).join('');
  const fixes=(v.completedFixes||[]).map(fx=>{ const title=fx.title||'Completed fix'; const img=fx.image||fx; const link=fx.link||null;
    return `<img src="${img}" alt="${title}" loading="lazy" class="w-full h-20 object-cover rounded cursor-pointer lightboxable" data-src="${img}" data-title="${title}" ${link?`data-link="${link}"`:''}>`; }).join('');
  return `<article id="card-${v.id}" class="group glass rounded-2xl border border-slate-800 overflow-hidden hover:shadow-glow transition">
    <div class="relative"><img src="${v.photo}" alt="${v.name}" loading="lazy" class="w-full h-48 object-cover">
      <span class="absolute top-3 right-3 ${badge} px-2 py-1 rounded-md text-xs font-bold shadow">${v.status}</span></div>
    <div class="p-4">
      <header class="flex items-start justify-between gap-3">
        <h3 class="text-xl font-extrabold"><a href="#car=${encodeURIComponent(v.id)}" class="hover:underline">${v.name}</a></h3>
      </header>
      ${nick}
      <div class="mt-2 flex flex-wrap gap-2">${tags}</div>
      <p class="mt-3 text-sm"><span class="text-slate-400">Next fix:</span> <span class="font-semibold">${v.nextFix}</span></p>
      <div class="mt-3 h-2 bg-slate-800 rounded"><div class="h-2 bg-aqua rounded" style="width:${v.percentComplete||0}%"></div></div>
      <details class="mt-4"><summary class="cursor-pointer select-none font-semibold text-aqua">📅 Timeline</summary>
        <ul class="mt-3 space-y-2">${hist}</ul></details>
      ${fixes?`<div class="mt-4"><p class="text-sm text-slate-400 mb-2">Completed fixes (tap to preview):</p><div class="grid grid-cols-3 gap-2">${fixes}</div></div>`:''}
    </div></article>`;
}

function renderGallery(list){ const g=document.getElementById('galleryImages'); g.innerHTML=''; list.forEach(v=>(v.completedFixes||[]).forEach(fx=>{ const img=fx.image||fx, title=fx.title||'Completed fix'; const el=document.createElement('img'); el.src=img; el.alt=title; el.loading='lazy'; el.className='w-full h-40 object-cover rounded cursor-pointer lightboxable'; el.dataset.src=img; el.dataset.title=title; if(fx.link) el.dataset.link=fx.link; g.appendChild(el);})); }

const Lightbox = (()=>{
  let images = []; let index = 0; let link = null; let title = '';
  const lb = ()=>document.getElementById('lightbox');
  const img=()=>document.getElementById('lightboxImg');
  const cap=()=>document.getElementById('lightboxCaption');
  const btn=()=>document.getElementById('lightboxLink');
  const idx=()=>document.getElementById('lightboxIndex');
  function show(){
    img().src = images[index];
    cap().textContent = title || '';
    idx().textContent = images.length>1 ? `${index+1} / ${images.length}` : '';
    if (link) { btn().href = link; btn().classList.remove('hidden'); } else { btn().classList.add('hidden'); }
    lb().classList.remove('hidden'); lb().classList.add('flex');
  }
  function hide(){ lb().classList.add('hidden'); lb().classList.remove('flex'); images=[]; index=0; link=null; title=''; img().src=''; cap().textContent=''; idx().textContent=''; }
  function prev(){ if(!images.length) return; index = (index-1+images.length)%images.length; show(); }
  function next(){ if(!images.length) return; index = (index+1)%images.length; show(); }
  function openSingle(src, t, l){ images=[src]; index=0; title=t||''; link=l||null; show(); }
  function openMany(arr, t){ images=arr.slice(); index=0; title=t||''; link=null; show(); }
  function bind(){
    document.getElementById('lightboxClose').addEventListener('click', hide);
    document.getElementById('lightbox').addEventListener('click', (e)=>{ if(e.target.id==='lightbox') hide(); });
    document.getElementById('lightboxPrev').addEventListener('click', prev);
    document.getElementById('lightboxNext').addEventListener('click', next);
  }
  return { bind, openSingle, openMany };
})();

function filterByStatus(list,s){ if(s==='inprogress') return list.filter(v=>(v.status||'').toLowerCase().includes('progress')||(v.status||'').toLowerCase().includes('rebuild')); if(s==='completed') return list.filter(v=>(v.completedFixes||[]).length>0||(v.status||'').toLowerCase().includes('complete')); if(s==='pending') return list.filter(v=>!((v.status||'').toLowerCase().includes('progress')||(v.completedFixes||[]).length>0)); return list; }
function sortVehicles(list,by){
  if(by==='order') return [...list].sort((a,b)=> (a.order ?? 9999) - (b.order ?? 9999));
  if(by==='progress') return [...list].sort((a,b)=>(b.percentComplete||0)-(a.percentComplete||0));
  return [...list].sort((a,b)=>a.name.localeCompare(b.name));
}
function applyFocusPanels(data){ const f=data.find(v=>v.flags&&v.flags.focus), n=data.find(v=>v.flags&&v.flags.nextUp);
  const ft=document.getElementById('focusText'), nt=document.getElementById('nextUpText'), fp=document.getElementById('focusProgress');
  if(f){ ft.textContent=`${f.name}${f.nickname?' ('+f.nickname+')':''}: ${f.nextFix}`; fp.style.width=(f.percentComplete||0)+'%'; }
  else if(data.length){ ft.textContent=`${data[0].name}: ${data[0].nextFix}`; fp.style.width=(data[0].percentComplete||0)+'%'; }
  if(n){ nt.textContent=`${n.name}${n.nickname?' ('+n.nickname+')':''}: ${n.nextFix}`; }
  else if(data.length>1){ nt.textContent=`${data[1].name}: ${data[1].nextFix}`; }
}
function handleDeepLink(){
  const params = getParams();
  const hashMatch = (location.hash||'').match(/#car=([^&]+)/);
  const id = params.car || (hashMatch ? decodeURIComponent(hashMatch[1]) : null);
  if(!id) return;
  const el=document.getElementById('card-'+id);
  if(!el) return;
  el.scrollIntoView({behavior:'smooth',block:'start'}); const det=el.querySelector('details'); if(det) det.open=true; el.classList.add('ring-2','ring-aqua'); setTimeout(()=>el.classList.remove('ring-2','ring-aqua'),1500);
}

async function init(){
  const data = await loadData();
  const vehiclesEl = document.getElementById('vehicles');
  const searchEl = document.getElementById('searchInput');
  const statusEl = document.getElementById('statusFilter');
  const sortEl = document.getElementById('sortBy');
  const params = getParams();

  // Seed controls from URL
  searchEl.value = params.q;
  statusEl.value = params.status;
  sortEl.value = params.sort;

  function render(){
    const q = (searchEl.value||'').toLowerCase();
    const st = statusEl.value;
    const by = sortEl.value;
    setParams({q: searchEl.value, status: st, sort: by, car: getParams().car}); // preserve ?car

    let list = data;
    if (q) list = list.filter(v => v.name.toLowerCase().includes(q) || (v.nickname||'').toLowerCase().includes(q) || (v.tags||[]).some(t => t.toLowerCase().includes(q)));
    list = filterByStatus(list, st);
    list = sortVehicles(list, by);

    vehiclesEl.innerHTML = list.map(vehicleCard).join('');
    bindTimelinePhotoButtons(data);
    bindLightboxables();
    handleDeepLink();
  }

  function bindLightboxables(){
    Lightbox.bind();
    document.body.addEventListener('click', (e)=>{
      const t = e.target;
      if (t.classList.contains('lightboxable')){
        Lightbox.openSingle(t.dataset.src, t.dataset.title, t.dataset.link);
      }
    }, { once: true });
  }

  function bindTimelinePhotoButtons(allData){
    document.querySelectorAll('.timeline-view').forEach(btn => {
      btn.addEventListener('click', () => {
        const vid = btn.dataset.vid;
        const idx = parseInt(btn.dataset.idx, 10);
        const v = allData.find(x => x.id === vid);
        const entry = v && v.history[idx];
        if (entry && Array.isArray(entry.images) && entry.images.length){
          Lightbox.openMany(entry.images, `${v.name} — ${entry.date}`);
        }
      });
    });
  }

  applyFocusPanels(data);
  searchEl.addEventListener('input', render);
  statusEl.addEventListener('change', render);
  sortEl.addEventListener('change', render);
  window.addEventListener('hashchange', handleDeepLink);
  window.addEventListener('popstate', render); // react to URL changes
  render();
  renderGallery(data);
}

init();
