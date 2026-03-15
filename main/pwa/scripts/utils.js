// --- Utility functions ---

export function slug(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function formatDateForFilename(date) {
  const d = date instanceof Date ? date : new Date(date);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function vehicleImageSlug(vehicle) {
  // Derive image directory from existing photo path: "assets/images/linda/cover.jpg" -> "linda"
  const match = (vehicle.photo || '').match(/assets\/images\/([^/]+)\//);
  if (match) return match[1];
  return slug(vehicle.nickname || vehicle.id || vehicle.name);
}

export function statusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s.includes('running') || s.includes('mot')) return 'badge-running';
  if (s.includes('progress')) return 'badge-progress';
  if (s.includes('pending')) return 'badge-pending';
  return 'badge-backlog';
}

let toastTimer = null;
export function showToast(message, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className = `toast toast-${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.remove('show'); }, 2500);
}
