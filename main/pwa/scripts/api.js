// --- API client ---

export function setApiBase(url) {
  localStorage.setItem('charsos_apiBase', url.replace(/\/+$/, ''));
}

export function getApiBase() {
  return localStorage.getItem('charsos_apiBase') || '';
}

function getToken() {
  return localStorage.getItem('charsos_token');
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${getToken()}`,
    'Content-Type': 'application/json',
  };
}

export async function authenticate(pin) {
  const base = getApiBase();
  const res = await fetch(`${base}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) throw new Error('Invalid PIN');
  const data = await res.json();
  localStorage.setItem('charsos_token', data.token);
  return data;
}

export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function logout() {
  localStorage.removeItem('charsos_token');
}

export async function loadVehicles() {
  const base = getApiBase();
  const res = await fetch(`${base}/api/vehicles`, { headers: authHeaders() });
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error('Failed to load vehicles');
  return await res.json();
}

export async function saveVehicles(vehicles) {
  const base = getApiBase();

  // Step 1: Get a pre-signed S3 URL (small request, passes WAF)
  const urlRes = await fetch(`${base}/api/vehicles/save-url`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (urlRes.status === 401) { logout(); throw new Error('Session expired'); }
  if (!urlRes.ok) throw new Error('Failed to get save URL');
  const { uploadUrl } = await urlRes.json();

  // Step 2: PUT directly to S3 (bypasses CloudFront WAF)
  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vehicles, null, 2),
  });
  if (!putRes.ok) throw new Error('Failed to upload data');

  // Step 3: Trigger CloudFront invalidation
  const confirmRes = await fetch(`${base}/api/vehicles/confirm-save`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!confirmRes.ok) throw new Error('Saved but failed to invalidate cache');
  return await confirmRes.json();
}

export async function getCoverUploadUrl(vehicleSlug) {
  const base = getApiBase();
  const res = await fetch(`${base}/api/cover-upload-url`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ vehicleSlug }),
  });
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error('Failed to get cover upload URL');
  return await res.json();
}

export async function getUploadUrls(vehicleSlug, date, extensions) {
  const base = getApiBase();
  const res = await fetch(`${base}/api/upload-urls`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ vehicleSlug, date, count: extensions.length, extensions }),
  });
  if (res.status === 401) { logout(); throw new Error('Session expired'); }
  if (!res.ok) throw new Error('Failed to get upload URLs');
  return await res.json();
}

export function uploadFileToS3(presignedUrl, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    });
    xhr.addEventListener('load', () => xhr.status < 400 ? resolve() : reject(new Error('Upload failed')));
    xhr.addEventListener('error', () => reject(new Error('Upload failed')));
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type || 'image/jpeg');
    xhr.send(file);
  });
}
