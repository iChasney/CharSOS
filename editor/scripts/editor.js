let vehicles = [];
let currentId = null;
let lastGenerated = [];
const $ = (id) => document.getElementById(id);

function setStatus(msg){ $('statusMsg').textContent = msg; setTimeout(()=> $('statusMsg').textContent='', 2500); }

function loadFromLocal(){
  try { const raw = localStorage.getItem('charscars_vehicles'); if (raw){ vehicles = JSON.parse(raw); return true; } } catch(_) {}
  return false;
}
function saveToLocal(){ localStorage.setItem('charscars_vehicles', JSON.stringify(vehicles, null, 2)); setStatus('Saved to browser storage.'); }

function renderVehicleSelect(){
  const sel = $('vehicleSelect');
  sel.innerHTML = vehicles.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
  if (!currentId && vehicles.length) currentId = vehicles[0].id;
  sel.value = currentId || '';
  sel.onchange = () => { currentId = sel.value; renderCurrentVehicle(); };
}

function getCurrent(){ return vehicles.find(v => v.id === currentId); }

function renderOrderList(){
  const list = $('orderList');
  const sorted = [...vehicles].sort((a,b)=>(a.order ?? 9999)-(b.order ?? 9999));
  list.innerHTML = sorted.map(v => `
    <li class="flex items-center justify-between gap-3 px-3 py-2" draggable="true" data-id="${v.id}">
      <span class="flex items-center gap-2">
        <span class="cursor-grab select-none">☰</span>
        <strong>${v.name||'(unnamed vehicle)'}</strong>
        ${v.nickname ? `<span class="text-xs text-slate-400">(${v.nickname})</span>` : ''}
      </span>
      <span class="text-xs text-slate-400">order: ${v.order ?? ''}</span>
    </li>`).join('');
  enableDrag(list);
}

function enableDrag(list){
  let dragEl = null;
  list.querySelectorAll('li').forEach(li => {
    li.addEventListener('dragstart', e => { dragEl = li; li.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
    li.addEventListener('dragend', ()=> { if (dragEl) dragEl.classList.remove('dragging'); dragEl=null; });
  });
  list.addEventListener('dragover', e => {
    e.preventDefault();
    const after = getDragAfterElement(list, e.clientY);
    const dragging = list.querySelector('.dragging');
    if (!dragging) return;
    if (after == null) list.appendChild(dragging);
    else list.insertBefore(dragging, after);
  });
  function getDragAfterElement(container, y){
    const els = [...container.querySelectorAll('li:not(.dragging)')];
    return els.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) return { offset, element: child };
      else return closest;
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }
}

function applyOrder(){
  const ids = [...$('orderList').querySelectorAll('li')].map(li => li.dataset.id);
  ids.forEach((id, i) => { const v = vehicles.find(x => x.id===id); if (v) v.order = i+1; });
  setStatus('Order applied.'); renderOrderList(); renderPreview();
}

function renderCurrentVehicle(){
  const v = getCurrent();
  if (!v){
    $('nameInput').value = $('nicknameInput').value = $('orderInput').value = $('photoInput').value = '';
    $('statusInput').value = $('nextFixInput').value = ''; $('percentInput').value = 0;
    $('flagFocus').checked = false; $('flagNext').checked = false;
    $('timelineList').innerHTML = '<div class="text-xs text-slate-500">No vehicle selected. Import a JSON or add a new one.</div>';
    $('fixesList').innerHTML = '<div class="text-xs text-slate-500">No vehicle selected.</div>';
    renderPreview();
    return;
  }
  $('nameInput').value = v.name || '';
  $('nicknameInput').value = v.nickname || '';
  $('orderInput').value = v.order ?? '';
  $('photoInput').value = v.photo || '';
  $('statusInput').value = v.status || '';
  $('nextFixInput').value = v.nextFix || '';
  $('percentInput').value = v.percentComplete ?? 0;
  $('flagFocus').checked = !!(v.flags && v.flags.focus);
  $('flagNext').checked = !!(v.flags && v.flags.nextUp);
  renderTimeline(v);
  renderFixes(v);
  renderPreview();
}

function renderTimeline(v){
  const list = $('timelineList');
  if (!v.history) v.history = [];
  list.innerHTML = v.history.map((h, idx) => timelineRow(h, idx)).join('');
  bindTimelineRowHandlers(v);
}
function timelineRow(h, idx){
  const images = Array.isArray(h.images) ? h.images : [];
  const imgsHtml = images.map((url, i) => `<div class="flex gap-2 items-center">
      <input data-idx="${idx}" data-i="${i}" data-field="img" value="${url}" class="flex-1 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-xs">
      <button data-idx="${idx}" data-i="${i}" data-action="imgdel" class="px-2 py-1 rounded bg-rose-500 text-black text-xs">✕</button>
    </div>`).join('');
  return `<div class="grid grid-cols-12 gap-2 items-start p-2 rounded border border-slate-800 bg-slate-950">
    <input data-idx="${idx}" data-field="date" value="${h.date||''}" placeholder="YYYY-MM-DD" class="col-span-3 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm">
    <input data-idx="${idx}" data-field="event" value="${(h.event||'').replace(/"/g,'&quot;')}" placeholder="What happened?" class="col-span-7 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm">
    <div class="col-span-2 flex gap-2 justify-end">
      <button data-action="up" data-idx="${idx}" class="px-2 py-1 rounded bg-slate-800 border border-slate-700">↑</button>
      <button data-action="down" data-idx="${idx}" class="px-2 py-1 rounded bg-slate-800 border border-slate-700">↓</button>
      <button data-action="del" data-idx="${idx}" class="px-2 py-1 rounded bg-rose-500 text-black">✕</button>
    </div>
    <div class="col-span-12">
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs text-slate-400">Images</span>
        <button data-action="imgadd" data-idx="${idx}" class="px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs">+ Add image</button>
      </div>
      <div class="space-y-1">${imgsHtml || '<div class="text-xs text-slate-500">No images</div>'}</div>
    </div>
  </div>`;
}
function bindTimelineRowHandlers(v){
  document.querySelectorAll('#timelineList input').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = +inp.dataset.idx;
      if (inp.dataset.field === 'img'){
        const i = +inp.dataset.i;
        if (!Array.isArray(v.history[idx].images)) v.history[idx].images = [];
        v.history[idx].images[i] = inp.value;
      } else {
        v.history[idx][inp.dataset.field] = inp.value;
      }
      renderPreview();
    });
  });
  document.querySelectorAll('#timelineList button').forEach(btn => {
    const action = btn.dataset.action; const idx = +btn.dataset.idx;
    btn.addEventListener('click', () => {
      if (action === 'del'){ v.history.splice(idx,1); }
      if (action === 'up' && idx>0){ [v.history[idx-1], v.history[idx]] = [v.history[idx], v.history[idx-1]]; }
      if (action === 'down' && idx < v.history.length-1){ [v.history[idx+1], v.history[idx]] = [v.history[idx], v.history[idx+1]]; }
      if (action === 'imgadd'){ if (!Array.isArray(v.history[idx].images)) v.history[idx].images = []; v.history[idx].images.push(''); }
      if (action === 'imgdel'){ const i = +btn.dataset.i; v.history[idx].images.splice(i,1); }
      renderTimeline(v); renderPreview();
    });
  });
}

function renderFixes(v){
  const list = $('fixesList');
  if (!v.completedFixes) v.completedFixes = [];
  list.innerHTML = v.completedFixes.map((fx, idx) => {
    const title = fx.title || ''; const image = fx.image || fx || ''; const link = fx.link || '';
    return `<div class="grid grid-cols-12 gap-2 items-start p-2 rounded border border-slate-800 bg-slate-950">
      <input data-idx="${idx}" data-field="title" value="${title}" placeholder="Title" class="col-span-3 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm">
      <input data-idx="${idx}" data-field="image" value="${image}" placeholder="Image URL" class="col-span-6 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm">
      <input data-idx="${idx}" data-field="link" value="${link}" placeholder="Optional link URL" class="col-span-2 px-3 py-2 rounded bg-slate-900 border border-slate-700 text-sm">
      <div class="col-span-1 flex justify-end">
        <button data-action="fixdel" data-idx="${idx}" class="px-2 py-1 rounded bg-rose-500 text-black">✕</button>
      </div>
    </div>`;
  }).join('') || '<div class="text-xs text-slate-500">No completed fixes</div>';

  document.querySelectorAll('#fixesList input').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = +inp.dataset.idx;
      if (!v.completedFixes[idx] || typeof v.completedFixes[idx] !== 'object') v.completedFixes[idx] = {};
      v.completedFixes[idx][inp.dataset.field] = inp.value;
      renderPreview();
    });
  });
  document.querySelectorAll('#fixesList button').forEach(btn => {
    btn.addEventListener('click', () => { const idx = +btn.dataset.idx; v.completedFixes.splice(idx,1); renderFixes(v); renderPreview(); });
  });
}

function addFix(){ const v = getCurrent(); if (!v) return; if (!v.completedFixes) v.completedFixes=[]; v.completedFixes.push({title:'', image:'', link:''}); renderFixes(v); renderPreview(); }

function renderPreview(){ $('jsonPreview').value = JSON.stringify(vehicles, null, 2); }

function saveMeta(){
  const v = getCurrent(); if (!v) return;
  v.name = $('nameInput').value;
  v.nickname = $('nicknameInput').value;
  v.order = $('orderInput').value ? parseInt($('orderInput').value,10) : undefined;
  v.photo = $('photoInput').value;
  v.status = $('statusInput').value;
  v.nextFix = $('nextFixInput').value;
  v.percentComplete = Math.max(0, Math.min(100, parseInt($('percentInput').value||'0',10)));
  v.flags = { focus: $('flagFocus').checked, nextUp: $('flagNext').checked };
  setStatus('Vehicle details updated.');
  renderVehicleSelect();
  renderOrderList();
  renderPreview();
}

function downloadJson(){
  const blob = new Blob([JSON.stringify(vehicles, null, 2)], {type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'vehicles.json'; a.click();
  URL.revokeObjectURL(url);
}
function copyJson(){ navigator.clipboard.writeText(JSON.stringify(vehicles, null, 2)); setStatus('Copied JSON to clipboard.'); }

// --- Photo uploader stub ---
function loadCdnBase(){ $('cdnBase').value = localStorage.getItem('charscars_cdnBase') || ''; }
function saveCdnBase(){ localStorage.setItem('charscars_cdnBase', $('cdnBase').value || ''); }
function slug(s){ return (s||'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,''); }

function generateTargetUrls(files, target){
  const v = getCurrent(); if (!v) return [];
  const base = ($('cdnBase').value || '').replace(/\/+$/,''); // trim trailing slashes
  const today = new Date().toISOString().slice(0,10);
  const out = [];
  for (let i=0;i<files.length;i++){
    const file = files[i];
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const fname = `${slug(v.id||v.name||'vehicle')}-${today}-${i+1}.${ext}`;
    let path = '';
    if (target === 'timeline'){ path = `${base}/${slug(v.id||v.name||'vehicle')}/timeline/${fname}`; }
    else { path = `${base}/${slug(v.id||v.name||'vehicle')}/fixes/${fname}`; }
    out.push(path);
  }
  return out;
}

function insertGeneratedUrls(urls, target){
  const v = getCurrent(); if (!v) return;
  if (target === 'timeline'){
    const lastRow = document.querySelector('#timelineList input[data-field="event"]:focus') || document.querySelector('#timelineList input[data-field="date"]:focus');
    let idx = lastRow ? parseInt(lastRow.dataset.idx,10) : (v.history && v.history.length ? v.history.length-1 : 0);
    if (!v.history) v.history = [];
    if (!v.history[idx]) v.history[idx] = {date:'',event:'',images:[]};
    if (!Array.isArray(v.history[idx].images)) v.history[idx].images = [];
    v.history[idx].images.push(...urls);
    renderTimeline(v);
  } else {
    if (!v.completedFixes) v.completedFixes = [];
    urls.forEach(u => v.completedFixes.push({ title: '', image: u, link: '' }));
    renderFixes(v);
  }
  renderPreview();
}

function bindUploader(){
  $('genUrls').addEventListener('click', () => {
    saveCdnBase();
    const files = $('filePicker').files;
    if (!files || !files.length){ setStatus('Choose one or more image files first.'); return; }
    if (!vehicles.length){ setStatus('Load a JSON file first.'); return; }
    const target = $('uploadTarget').value;
    lastGenerated = generateTargetUrls(files, target);
    $('generatedUrls').value = lastGenerated.join('\\n');
    insertGeneratedUrls(lastGenerated, target);
    setStatus('Generated URLs inserted.');
  });
  $('copyUrls').addEventListener('click', () => {
    if (!lastGenerated.length) { setStatus('No URLs generated yet.'); return; }
    navigator.clipboard.writeText(lastGenerated.join('\\n'));
    setStatus('Copied generated URLs.');
  });
  $('cdnBase').addEventListener('change', saveCdnBase);
}

// --- Bindings ---
function bindTop(){
  $('addEntry').addEventListener('click', () => { const v=getCurrent(); if(!v){ setStatus('Load a JSON file and select a vehicle first.'); return; } if(!v.history) v.history=[]; v.history.push({date:'', event:'', images:[]}); renderTimeline(v); renderPreview(); });
  $('addFix').addEventListener('click', addFix);
  $('saveMeta').addEventListener('click', saveMeta);
  $('saveLocal').addEventListener('click', saveToLocal);
  $('downloadJson').addEventListener('click', downloadJson);
  $('copyJson').addEventListener('click', copyJson);
  $('applyOrder').addEventListener('click', applyOrder);
  $('fileInput').addEventListener('change', async (e)=>{
    const file = e.target.files[0]; if (!file) return;
    try { vehicles = JSON.parse(await file.text()); currentId = vehicles[0]?.id || null; renderAll(); setStatus('Loaded from file.'); }
    catch { setStatus('Invalid JSON file.'); }
  });
  bindUploader();
}

function renderAll(){
  renderVehicleSelect();
  renderOrderList();
  renderCurrentVehicle();
  renderPreview();
}

async function init(){
  loadCdnBase();
  if (!loadFromLocal()) { vehicles = []; currentId = null; }
  else { currentId = vehicles[0]?.id || null; }
  bindTop();
  renderAll();
}
init();
