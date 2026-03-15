// --- UI rendering functions ---

import { statusBadgeClass, todayISO, vehicleImageSlug, formatDateForFilename, showToast } from './utils.js';

// --- Login View ---

export function renderLogin(container, { onLogin, apiBase }) {
  container.innerHTML = `
    <div class="view-enter flex flex-col items-center justify-center min-h-[70vh] px-6">
      <img src="assets/images/char-sos-logo.svg" class="w-20 h-20 mb-6" alt="CharSOS">
      <h2 class="text-2xl font-extrabold mb-2" style="font-family: Anton, sans-serif;">CharSOS Editor</h2>
      <p class="text-slate-400 text-sm mb-8">Enter your PIN to continue</p>

      <div class="w-full max-w-xs space-y-4">
        <div>
          <label class="block text-xs text-slate-400 mb-1">API URL</label>
          <input id="apiBaseInput" type="url" placeholder="https://xxxxx.execute-api.region.amazonaws.com"
            value="${apiBase || ''}"
            class="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder-slate-500 focus:border-aqua focus:outline-none">
        </div>
        <div>
          <label class="block text-xs text-slate-400 mb-1">PIN</label>
          <input id="pinInput" type="password" inputmode="numeric" pattern="[0-9]*" placeholder="Enter PIN"
            class="w-full px-4 py-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-100 text-center text-xl tracking-widest placeholder-slate-500 focus:border-aqua focus:outline-none">
        </div>
        <button id="loginBtn"
          class="w-full py-3 rounded-lg bg-aqua text-slate-900 font-semibold text-base active:scale-95 transition-transform">
          Unlock
        </button>
        <p id="loginError" class="text-red-400 text-sm text-center hidden"></p>
      </div>
    </div>
  `;

  const pinInput = container.querySelector('#pinInput');
  const loginBtn = container.querySelector('#loginBtn');
  const apiBaseInput = container.querySelector('#apiBaseInput');
  const errorEl = container.querySelector('#loginError');

  async function doLogin() {
    errorEl.classList.add('hidden');
    loginBtn.disabled = true;
    loginBtn.textContent = 'Unlocking...';
    try {
      await onLogin(pinInput.value, apiBaseInput.value.trim());
    } catch (err) {
      errorEl.textContent = err.message || 'Login failed';
      errorEl.classList.remove('hidden');
      loginBtn.disabled = false;
      loginBtn.textContent = 'Unlock';
    }
  }

  loginBtn.addEventListener('click', doLogin);
  pinInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
}

// --- Vehicle List View ---

export function renderVehicleList(container, vehicles, { onSelect }) {
  const sorted = [...vehicles].sort((a, b) => (a.order || 0) - (b.order || 0));

  container.innerHTML = `
    <div class="view-enter px-4 py-4 space-y-3">
      <div class="flex items-center justify-between mb-2">
        <h2 class="text-lg font-extrabold" style="font-family: Anton, sans-serif;">Vehicles</h2>
        <span class="text-xs text-slate-400">${vehicles.length} vehicles</span>
      </div>
      ${sorted.map(v => vehicleCard(v)).join('')}
    </div>
  `;

  container.querySelectorAll('[data-vehicle-id]').forEach(card => {
    card.addEventListener('click', () => onSelect(card.dataset.vehicleId));
  });
}

function vehicleCard(v) {
  const badgeClass = statusBadgeClass(v.status);
  const pct = v.percentComplete || 0;
  const focusBorder = (v.flags?.focus || v.flags?.nextUp) ? 'border-aqua' : 'border-slate-800';
  const focusLabel = v.flags?.focus ? '<span class="text-[10px] text-aqua font-semibold uppercase tracking-wider">Current Focus</span>' :
    v.flags?.nextUp ? '<span class="text-[10px] text-yellow-400 font-semibold uppercase tracking-wider">Next Up</span>' : '';

  return `
    <div data-vehicle-id="${v.id}" class="card-press cursor-pointer rounded-xl border ${focusBorder} bg-slate-900/50 p-3 flex gap-3 items-center">
      <div class="w-16 h-16 rounded-lg bg-slate-800 flex-shrink-0 overflow-hidden">
        ${v.photo ? `<img src="../${v.photo}" class="w-full h-full object-cover" alt="" onerror="this.style.display='none'">` : ''}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-semibold text-sm truncate">${v.name}</span>
          ${v.nickname ? `<span class="text-xs text-slate-400">${v.nickname}</span>` : ''}
        </div>
        ${focusLabel}
        <div class="flex items-center gap-2 mt-1">
          <span class="text-[11px] px-2 py-0.5 rounded-full ${badgeClass}">${v.status || 'Unknown'}</span>
        </div>
        <div class="mt-1.5 flex items-center gap-2">
          <div class="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full bg-aqua rounded-full" style="width: ${pct}%"></div>
          </div>
          <span class="text-[10px] text-slate-400">${pct}%</span>
        </div>
        ${v.nextFix ? `<p class="text-[11px] text-slate-400 mt-1 truncate">Next: ${v.nextFix}</p>` : ''}
      </div>
      <svg class="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </div>
  `;
}

// --- Vehicle Detail View ---

export function renderVehicleDetail(container, vehicle, { onSaveMeta, onSelectEntry, onAddEntry, onSelectFix, onAddFix }) {
  const v = vehicle;
  const history = v.history || [];
  const fixes = v.completedFixes || [];

  container.innerHTML = `
    <div class="view-enter px-4 py-4 space-y-4">
      <!-- Header card -->
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
        <div class="flex gap-3 items-start">
          <div class="w-20 h-20 rounded-lg bg-slate-800 overflow-hidden flex-shrink-0">
            ${v.photo ? `<img src="../${v.photo}" class="w-full h-full object-cover" alt="" onerror="this.style.display='none'">` : ''}
          </div>
          <div class="flex-1">
            <h2 class="text-lg font-extrabold" style="font-family: Anton, sans-serif;">${v.name}</h2>
            ${v.nickname ? `<p class="text-sm text-slate-400">${v.nickname}</p>` : ''}
            <span class="inline-block text-xs px-2 py-0.5 rounded-full mt-1 ${statusBadgeClass(v.status)}">${v.status || ''}</span>
          </div>
        </div>
      </div>

      <!-- Metadata form -->
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Details</h3>

        <label class="block">
          <span class="text-xs text-slate-400">Name</span>
          <input id="metaName" value="${esc(v.name)}" class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Nickname</span>
          <input id="metaNickname" value="${esc(v.nickname)}" class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block">
            <span class="text-xs text-slate-400">Status</span>
            <input id="metaStatus" value="${esc(v.status)}" class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
          </label>
          <label class="block">
            <span class="text-xs text-slate-400">Progress %</span>
            <input id="metaPercent" type="number" min="0" max="100" value="${v.percentComplete || 0}" class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
          </label>
        </div>
        <label class="block">
          <span class="text-xs text-slate-400">Next Fix</span>
          <input id="metaNextFix" value="${esc(v.nextFix)}" class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Cover Photo URL</span>
          <input id="metaPhoto" value="${esc(v.photo)}" class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
        </label>

        <div class="flex gap-4 pt-1">
          <label class="flex items-center gap-2 text-sm">
            <input id="metaFocus" type="checkbox" ${v.flags?.focus ? 'checked' : ''} class="w-5 h-5 rounded bg-slate-800 border-slate-600 text-aqua focus:ring-aqua">
            <span>Focus</span>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <input id="metaNextUp" type="checkbox" ${v.flags?.nextUp ? 'checked' : ''} class="w-5 h-5 rounded bg-slate-800 border-slate-600 text-aqua focus:ring-aqua">
            <span>Next Up</span>
          </label>
        </div>

        <button id="saveMetaBtn" class="w-full py-3 rounded-lg bg-aqua text-slate-900 font-semibold text-sm active:scale-95 transition-transform mt-2">
          Save Details
        </button>
      </div>

      <!-- Timeline -->
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Timeline</h3>
          <button id="addEntryBtn" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-aqua font-semibold active:scale-95 transition-transform">+ Add</button>
        </div>
        ${history.length === 0 ? '<p class="text-sm text-slate-500">No timeline entries yet</p>' : ''}
        ${history.map((h, i) => timelineCard(h, i)).join('')}
      </div>

      <!-- Completed Fixes -->
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Completed Fixes</h3>
          <button id="addFixBtn" class="text-xs px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-aqua font-semibold active:scale-95 transition-transform">+ Add</button>
        </div>
        ${fixes.length === 0 ? '<p class="text-sm text-slate-500">No completed fixes yet</p>' : ''}
        ${fixes.map((fx, i) => fixCard(fx, i)).join('')}
      </div>
    </div>
  `;

  // Bind meta save
  container.querySelector('#saveMetaBtn').addEventListener('click', () => {
    onSaveMeta({
      name: container.querySelector('#metaName').value,
      nickname: container.querySelector('#metaNickname').value,
      status: container.querySelector('#metaStatus').value,
      percentComplete: parseInt(container.querySelector('#metaPercent').value) || 0,
      nextFix: container.querySelector('#metaNextFix').value,
      photo: container.querySelector('#metaPhoto').value,
      flags: {
        focus: container.querySelector('#metaFocus').checked,
        nextUp: container.querySelector('#metaNextUp').checked,
      },
    });
  });

  // Bind timeline entry clicks
  container.querySelectorAll('[data-entry-idx]').forEach(card => {
    card.addEventListener('click', () => onSelectEntry(parseInt(card.dataset.entryIdx)));
  });

  // Bind add entry
  container.querySelector('#addEntryBtn').addEventListener('click', onAddEntry);

  // Bind fix clicks
  container.querySelectorAll('[data-fix-idx]').forEach(card => {
    card.addEventListener('click', () => onSelectFix(parseInt(card.dataset.fixIdx)));
  });

  // Bind add fix
  container.querySelector('#addFixBtn').addEventListener('click', onAddFix);
}

function timelineCard(h, idx) {
  const imageCount = (h.images || []).length;
  return `
    <div data-entry-idx="${idx}" class="card-press cursor-pointer flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center text-xs text-slate-300 font-semibold">
        ${imageCount > 0 ? `<span class="text-aqua">${imageCount} <span class="text-[9px]">img</span></span>` : '<svg class="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>'}
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold truncate">${esc(h.event || 'Untitled')}</p>
        <p class="text-xs text-slate-400">${h.date || 'No date'}</p>
      </div>
      <svg class="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </div>
  `;
}

function fixCard(fx, idx) {
  const title = typeof fx === 'string' ? fx : (fx.title || 'Untitled fix');
  return `
    <div data-fix-idx="${idx}" class="card-press cursor-pointer flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
      <div class="flex-shrink-0 w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center">
        <svg class="w-4 h-4 text-green-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
      </div>
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold truncate">${esc(title)}</p>
      </div>
      <svg class="w-4 h-4 text-slate-500 flex-shrink-0" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
    </div>
  `;
}

// --- Timeline Entry Edit View ---

export function renderTimelineEntry(container, vehicle, entryIdx, { onSave, onDelete, onUploadPhotos, cdnBase }) {
  const entry = vehicle.history[entryIdx];
  if (!entry) { container.innerHTML = '<p class="p-4 text-red-400">Entry not found</p>'; return; }

  const images = entry.images || [];
  const imgSlug = vehicleImageSlug(vehicle);

  container.innerHTML = `
    <div class="view-enter px-4 py-4 space-y-4">
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Timeline Entry</h3>

        <label class="block">
          <span class="text-xs text-slate-400">Date</span>
          <input id="entryDate" type="date" value="${entry.date || ''}"
            class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Event</span>
          <textarea id="entryEvent" rows="3"
            class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none resize-none">${esc(entry.event || '')}</textarea>
        </label>

        <button id="saveEntryBtn" class="w-full py-3 rounded-lg bg-aqua text-slate-900 font-semibold text-sm active:scale-95 transition-transform">
          Save Entry
        </button>
      </div>

      <!-- Photos -->
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Photos (${images.length})</h3>

        ${images.length > 0 ? `
          <div class="thumb-grid">
            ${images.map((img, i) => `
              <div class="relative group">
                <img src="${cdnBase ? cdnBase + '/' + img : img}" alt="" class="w-full aspect-square object-cover rounded-lg border border-slate-700" onerror="this.src='';this.alt='?'">
                <button data-remove-img="${i}" class="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-600/80 text-white text-xs flex items-center justify-center">&times;</button>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-sm text-slate-500">No photos yet</p>'}

        <!-- URL list for manual editing -->
        <details class="text-xs">
          <summary class="text-slate-400 cursor-pointer">Image URLs</summary>
          <div id="imageUrlList" class="mt-2 space-y-2">
            ${images.map((img, i) => `
              <div class="flex gap-2">
                <input data-img-url="${i}" value="${esc(img)}" class="flex-1 px-3 py-2 rounded bg-slate-800 border border-slate-700 text-slate-300 text-xs focus:border-aqua focus:outline-none">
                <button data-remove-img="${i}" class="px-2 text-red-400 text-sm">&times;</button>
              </div>
            `).join('')}
            <button id="addImgUrlBtn" class="text-aqua text-xs font-semibold">+ Add URL</button>
          </div>
        </details>

        <div class="grid grid-cols-2 gap-3 pt-2">
          <label class="block">
            <div class="w-full py-3 rounded-lg bg-slate-800 border border-slate-700 text-center text-sm font-semibold text-aqua cursor-pointer active:scale-95 transition-transform">
              <svg class="w-5 h-5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><circle cx="12" cy="13" r="3"/></svg>
              Camera
            </div>
            <input id="cameraInput" type="file" accept="image/*" capture="environment" class="hidden">
          </label>
          <label class="block">
            <div class="w-full py-3 rounded-lg bg-slate-800 border border-slate-700 text-center text-sm font-semibold text-aqua cursor-pointer active:scale-95 transition-transform">
              <svg class="w-5 h-5 inline-block mr-1 -mt-0.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
              Gallery
            </div>
            <input id="galleryInput" type="file" accept="image/*" multiple class="hidden">
          </label>
        </div>

        <div id="uploadStatus" class="hidden space-y-2">
          <p id="uploadText" class="text-xs text-slate-400"></p>
          <div class="upload-progress">
            <div id="uploadBar" class="upload-progress-bar" style="width: 0%"></div>
          </div>
        </div>
      </div>

      <!-- Delete -->
      <button id="deleteEntryBtn" class="w-full py-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 font-semibold text-sm active:scale-95 transition-transform">
        Delete Entry
      </button>
    </div>
  `;

  // Bind save
  container.querySelector('#saveEntryBtn').addEventListener('click', () => {
    onSave({
      date: container.querySelector('#entryDate').value,
      event: container.querySelector('#entryEvent').value,
    });
  });

  // Bind delete
  container.querySelector('#deleteEntryBtn').addEventListener('click', () => {
    if (confirm('Delete this timeline entry?')) onDelete();
  });

  // Bind photo upload
  const handleFiles = (files) => { if (files.length > 0) onUploadPhotos(Array.from(files)); };
  container.querySelector('#cameraInput').addEventListener('change', (e) => handleFiles(e.target.files));
  container.querySelector('#galleryInput').addEventListener('change', (e) => handleFiles(e.target.files));

  // Bind image removal
  container.querySelectorAll('[data-remove-img]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.removeImg);
      images.splice(idx, 1);
      entry.images = images;
      renderTimelineEntry(container, vehicle, entryIdx, { onSave, onDelete, onUploadPhotos, cdnBase });
    });
  });

  // Bind add URL manually
  const addUrlBtn = container.querySelector('#addImgUrlBtn');
  if (addUrlBtn) {
    addUrlBtn.addEventListener('click', () => {
      images.push('');
      entry.images = images;
      renderTimelineEntry(container, vehicle, entryIdx, { onSave, onDelete, onUploadPhotos, cdnBase });
    });
  }

  // Bind URL edits
  container.querySelectorAll('[data-img-url]').forEach(input => {
    input.addEventListener('change', () => {
      const idx = parseInt(input.dataset.imgUrl);
      images[idx] = input.value;
      entry.images = images;
    });
  });
}

export function showUploadProgress(container, current, total, percent) {
  const status = container.querySelector('#uploadStatus');
  const text = container.querySelector('#uploadText');
  const bar = container.querySelector('#uploadBar');
  if (!status) return;
  status.classList.remove('hidden');
  text.textContent = `Uploading ${current}/${total}...`;
  bar.style.width = `${Math.round(percent * 100)}%`;
}

export function hideUploadProgress(container) {
  const status = container.querySelector('#uploadStatus');
  if (status) status.classList.add('hidden');
}

// --- Fix Edit View ---

export function renderFixEdit(container, vehicle, fixIdx, { onSave, onDelete }) {
  const fixes = vehicle.completedFixes || [];
  const fx = fixes[fixIdx];
  if (!fx) { container.innerHTML = '<p class="p-4 text-red-400">Fix not found</p>'; return; }

  const title = typeof fx === 'string' ? fx : (fx.title || '');
  const image = typeof fx === 'string' ? '' : (fx.image || '');
  const link = typeof fx === 'string' ? '' : (fx.link || '');

  container.innerHTML = `
    <div class="view-enter px-4 py-4 space-y-4">
      <div class="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
        <h3 class="text-sm font-semibold text-slate-300 uppercase tracking-wider">Completed Fix</h3>

        <label class="block">
          <span class="text-xs text-slate-400">Title</span>
          <input id="fixTitle" value="${esc(title)}"
            class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Image URL</span>
          <input id="fixImage" value="${esc(image)}"
            class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
        </label>
        <label class="block">
          <span class="text-xs text-slate-400">Link (optional)</span>
          <input id="fixLink" value="${esc(link)}"
            class="mt-1 w-full px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 focus:border-aqua focus:outline-none">
        </label>

        <button id="saveFixBtn" class="w-full py-3 rounded-lg bg-aqua text-slate-900 font-semibold text-sm active:scale-95 transition-transform">
          Save Fix
        </button>
      </div>

      <button id="deleteFixBtn" class="w-full py-3 rounded-lg bg-red-900/30 border border-red-800/50 text-red-400 font-semibold text-sm active:scale-95 transition-transform">
        Delete Fix
      </button>
    </div>
  `;

  container.querySelector('#saveFixBtn').addEventListener('click', () => {
    onSave({
      title: container.querySelector('#fixTitle').value,
      image: container.querySelector('#fixImage').value,
      link: container.querySelector('#fixLink').value,
    });
  });

  container.querySelector('#deleteFixBtn').addEventListener('click', () => {
    if (confirm('Delete this completed fix?')) onDelete();
  });
}

// --- Loading spinner ---

export function renderLoading(container) {
  container.innerHTML = `
    <div class="flex items-center justify-center min-h-[50vh]">
      <div class="spinner"></div>
    </div>
  `;
}

// --- Helper ---

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
