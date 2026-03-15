// --- Main application controller ---

import * as api from './api.js';
import * as ui from './ui.js';
import { todayISO, vehicleImageSlug, formatDateForFilename, showToast } from './utils.js';

const State = {
  vehicles: [],
  currentVehicleId: null,
  dirty: false,
};

const $ = (id) => document.getElementById(id);

// --- Routing ---

function router() {
  const hash = location.hash.slice(1) || '';
  const parts = hash.split('/');
  const route = parts[0];

  const app = $('app');
  const backBtn = $('backBtn');
  const saveBtn = $('saveBtn');
  const headerTitle = $('headerTitle');

  // Defaults
  backBtn.classList.add('hidden');
  saveBtn.classList.add('hidden');
  headerTitle.textContent = 'CharSOS';

  // Auth check
  if (route !== 'login' && route !== '' && !api.isAuthenticated()) {
    location.hash = '#login';
    return;
  }

  switch (route) {
    case 'login':
    case '':
      if (api.isAuthenticated()) { location.hash = '#vehicles'; return; }
      renderLogin();
      break;

    case 'vehicles':
      if (State.vehicles.length === 0) {
        loadVehicles().then(() => renderVehicleList()).catch(() => {});
      } else {
        renderVehicleList();
      }
      break;

    case 'vehicle':
      renderVehicleDetail(parts[1]);
      break;

    case 'timeline':
      renderTimelineEntry(parts[1], parseInt(parts[2]));
      break;

    case 'fix':
      renderFixEdit(parts[1], parseInt(parts[2]));
      break;

    default:
      location.hash = api.isAuthenticated() ? '#vehicles' : '#login';
  }
}

// --- View Controllers ---

function renderLogin() {
  ui.renderLogin($('app'), {
    apiBase: api.getApiBase(),
    onLogin: async (pin, apiBase) => {
      if (apiBase) api.setApiBase(apiBase);
      await api.authenticate(pin);
      await loadVehicles();
      location.hash = '#vehicles';
    },
  });
}

async function loadVehicles() {
  ui.renderLoading($('app'));
  try {
    State.vehicles = await api.loadVehicles();
    State.dirty = false;
  } catch (err) {
    if (err.message === 'Session expired') {
      location.hash = '#login';
      return;
    }
    showToast(err.message, 'error');
    throw err;
  }
}

function renderVehicleList() {
  const headerTitle = $('headerTitle');
  headerTitle.textContent = 'CharSOS';

  // Show global save button if dirty
  const saveBtn = $('saveBtn');
  if (State.dirty) {
    saveBtn.classList.remove('hidden');
    saveBtn.onclick = saveToS3;
  }

  ui.renderVehicleList($('app'), State.vehicles, {
    onSelect: (id) => { location.hash = `#vehicle/${id}`; },
  });
}

function renderVehicleDetail(vehicleId) {
  const v = State.vehicles.find(v => v.id === vehicleId);
  if (!v) { location.hash = '#vehicles'; return; }

  State.currentVehicleId = vehicleId;

  $('backBtn').classList.remove('hidden');
  $('backBtn').onclick = () => { location.hash = '#vehicles'; };
  $('headerTitle').textContent = v.nickname || v.name;

  // Show save to S3 if dirty
  const saveBtn = $('saveBtn');
  if (State.dirty) {
    saveBtn.classList.remove('hidden');
    saveBtn.onclick = saveToS3;
  }

  ui.renderVehicleDetail($('app'), v, {
    onSaveMeta: (meta) => {
      v.name = meta.name;
      v.nickname = meta.nickname;
      v.status = meta.status;
      v.percentComplete = meta.percentComplete;
      v.nextFix = meta.nextFix;
      v.photo = meta.photo;
      v.flags = meta.flags;
      State.dirty = true;
      showToast('Details updated (save to publish)');
      renderVehicleDetail(vehicleId);
    },
    onSelectEntry: (idx) => { location.hash = `#timeline/${vehicleId}/${idx}`; },
    onAddEntry: () => {
      if (!v.history) v.history = [];
      v.history.unshift({ date: todayISO(), event: '', images: [] });
      State.dirty = true;
      location.hash = `#timeline/${vehicleId}/0`;
    },
    onSelectFix: (idx) => { location.hash = `#fix/${vehicleId}/${idx}`; },
    onAddFix: () => {
      if (!v.completedFixes) v.completedFixes = [];
      v.completedFixes.push({ title: '', image: '', link: '' });
      State.dirty = true;
      location.hash = `#fix/${vehicleId}/${v.completedFixes.length - 1}`;
    },
  });
}

function renderTimelineEntry(vehicleId, entryIdx) {
  const v = State.vehicles.find(v => v.id === vehicleId);
  if (!v || !v.history || !v.history[entryIdx]) { location.hash = `#vehicle/${vehicleId}`; return; }

  $('backBtn').classList.remove('hidden');
  $('backBtn').onclick = () => { location.hash = `#vehicle/${vehicleId}`; };
  $('headerTitle').textContent = 'Timeline Entry';

  const saveBtn = $('saveBtn');
  if (State.dirty) {
    saveBtn.classList.remove('hidden');
    saveBtn.onclick = saveToS3;
  }

  ui.renderTimelineEntry($('app'), v, entryIdx, {
    cdnBase: '', // Images use relative paths from main site root
    onSave: (data) => {
      v.history[entryIdx].date = data.date;
      v.history[entryIdx].event = data.event;
      State.dirty = true;
      showToast('Entry updated (save to publish)');
      renderTimelineEntry(vehicleId, entryIdx);
    },
    onDelete: () => {
      v.history.splice(entryIdx, 1);
      State.dirty = true;
      showToast('Entry deleted');
      location.hash = `#vehicle/${vehicleId}`;
    },
    onUploadPhotos: (files) => handlePhotoUpload(v, entryIdx, files),
  });
}

function renderFixEdit(vehicleId, fixIdx) {
  const v = State.vehicles.find(v => v.id === vehicleId);
  if (!v || !v.completedFixes || !v.completedFixes[fixIdx]) { location.hash = `#vehicle/${vehicleId}`; return; }

  $('backBtn').classList.remove('hidden');
  $('backBtn').onclick = () => { location.hash = `#vehicle/${vehicleId}`; };
  $('headerTitle').textContent = 'Completed Fix';

  ui.renderFixEdit($('app'), v, fixIdx, {
    onSave: (data) => {
      v.completedFixes[fixIdx] = { title: data.title, image: data.image, link: data.link };
      State.dirty = true;
      showToast('Fix updated (save to publish)');
      location.hash = `#vehicle/${vehicleId}`;
    },
    onDelete: () => {
      v.completedFixes.splice(fixIdx, 1);
      State.dirty = true;
      showToast('Fix deleted');
      location.hash = `#vehicle/${vehicleId}`;
    },
  });
}

// --- Photo Upload ---

async function handlePhotoUpload(vehicle, entryIdx, files) {
  const entry = vehicle.history[entryIdx];
  const imgSlug = vehicleImageSlug(vehicle);
  const dateStr = formatDateForFilename(entry.date || new Date());

  const extensions = files.map(f => {
    const ext = (f.name.split('.').pop() || 'jpg').toLowerCase();
    return ext === 'jpeg' ? 'jpg' : ext;
  });

  const container = $('app');

  try {
    // Get pre-signed URLs
    ui.showUploadProgress(container, 0, files.length, 0);
    const { uploads } = await api.getUploadUrls(imgSlug, dateStr, extensions);

    // Upload each file
    for (let i = 0; i < files.length; i++) {
      await api.uploadFileToS3(uploads[i].uploadUrl, files[i], (pct) => {
        const overall = (i + pct) / files.length;
        ui.showUploadProgress(container, i + 1, files.length, overall);
      });
    }

    // Insert CDN URLs into entry
    if (!entry.images) entry.images = [];
    for (const u of uploads) {
      entry.images.push(u.cdnUrl);
    }

    State.dirty = true;
    ui.hideUploadProgress(container);
    showToast(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);

    // Re-render to show new images
    renderTimelineEntry(vehicle.id, entryIdx);

  } catch (err) {
    ui.hideUploadProgress(container);
    showToast(err.message || 'Upload failed', 'error');
  }
}

// --- Save to S3 ---

async function saveToS3() {
  const saveBtn = $('saveBtn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';

  try {
    await api.saveVehicles(State.vehicles);
    State.dirty = false;
    saveBtn.classList.add('hidden');
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    showToast('Published to site!');
  } catch (err) {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save';
    if (err.message === 'Session expired') {
      location.hash = '#login';
      return;
    }
    showToast(err.message || 'Save failed', 'error');
  }
}

// --- Unsaved changes warning ---

window.addEventListener('beforeunload', (e) => {
  if (State.dirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// --- Init ---

window.addEventListener('hashchange', router);
router();
