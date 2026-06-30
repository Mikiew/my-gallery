// ─── OWNER TOKEN HANDLING ───
// You unlock owner mode once by visiting:  yoursite.com/?key=YOUR_SECRET_TOKEN
// That stores the token in YOUR browser's localStorage only. It is never
// sent to other visitors and is not embedded anywhere in the page source.
// To "log out" of owner mode on a device, run: localStorage.removeItem('uploadToken')
(function captureTokenFromURL() {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('key');
  if (key) {
    localStorage.setItem('uploadToken', key);
    // Clean the token out of the visible URL so it's not in browser history/shared links
    params.delete('key');
    const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', cleanUrl);
  }
})();

const ownerToken = localStorage.getItem('uploadToken') || null;

// ─── FAVORITES (per-browser, anyone can use this — not tied to ownership) ───
function getFavorites() {
  try {
    return JSON.parse(localStorage.getItem('favorites') || '[]');
  } catch {
    return [];
  }
}

function isFavorite(filename) {
  return getFavorites().includes(filename);
}

function toggleFavorite(filename) {
  const favs = getFavorites();
  const idx = favs.indexOf(filename);
  if (idx === -1) {
    favs.push(filename);
  } else {
    favs.splice(idx, 1);
  }
  localStorage.setItem('favorites', JSON.stringify(favs));
  return favs.includes(filename);
}

// ─── ELEMENTS ───
const fileInput      = document.getElementById('file-input');
const grid            = document.getElementById('gallery-grid');
const emptyState      = document.getElementById('empty-state');
const emptyTitle      = document.getElementById('empty-title');
const emptySub        = document.getElementById('empty-sub');
const statPhotos      = document.getElementById('stat-photos');
const ownerControls    = document.getElementById('owner-controls');
const lightbox        = document.getElementById('lightbox');
const lbImg            = document.getElementById('lb-img');
const lbFilename      = document.getElementById('lb-filename');
const lbClose          = document.getElementById('lb-close');
const lbDelete        = document.getElementById('lb-delete');
const lbFavorite      = document.getElementById('lb-favorite');
const panelTabs        = document.querySelectorAll('.panel-tab');
const toastEl          = document.getElementById('toast');

let currentLightboxFile = null;
let allPhotos = []; // cache of last-loaded photo list, so filtering doesn't need a refetch
let currentFilter = 'all';

// ─── TOAST ───
function showToast(message, isError = false) {
  toastEl.textContent = message;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 2800);
}

// ─── OWNER UI ───
if (ownerToken) {
  ownerControls.style.display = '';
  lbDelete.style.display = '';
}

// ─── LOAD PHOTOS (public endpoint, works for everyone) ───
async function loadPhotos() {
  try {
    const res = await fetch('/api/photos');
    const data = await res.json();
    allPhotos = data.photos || [];
    renderPhotos();
  } catch (err) {
    showToast('Could not load photos.', true);
  }
}

function renderPhotos() {
  const photos = currentFilter === 'favorites'
    ? allPhotos.filter(p => isFavorite(p.filename))
    : allPhotos;

  grid.innerHTML = '';
  statPhotos.textContent = allPhotos.length;

  if (photos.length === 0) {
    emptyState.style.display = '';
    grid.style.display = 'none';
    if (currentFilter === 'favorites') {
      emptyTitle.textContent = 'No favorites yet';
      emptySub.textContent = 'Click the star on a photo to add it here.';
    } else {
      emptyTitle.textContent = 'No photos yet';
      emptySub.textContent = ownerToken
        ? 'Click "Upload" above to add some.'
        : 'Check back soon.';
    }
    return;
  }

  emptyState.style.display = 'none';
  grid.style.display = '';

  photos.forEach(photo => {
    const fav = isFavorite(photo.filename);
    const card = document.createElement('div');
    card.className = 'photo-card';
    card.innerHTML = `
      <img src="/photos/${encodeURIComponent(photo.filename)}" loading="lazy" alt="">
      <button class="photo-card-star${fav ? ' is-favorite' : ''}" title="Toggle favorite">&#9733;</button>
    `;
    card.querySelector('img').addEventListener('click', () => openLightbox(photo.filename));
    card.querySelector('.photo-card-star').addEventListener('click', e => {
      e.stopPropagation();
      const nowFav = toggleFavorite(photo.filename);
      e.currentTarget.classList.toggle('is-favorite', nowFav);
      if (currentFilter === 'favorites' && !nowFav) {
        renderPhotos(); // remove it from the favorites view immediately
      }
    });
    grid.appendChild(card);
  });
}

// ─── LIGHTBOX ───
function openLightbox(filename) {
  currentLightboxFile = filename;
  lbImg.src = `/photos/${encodeURIComponent(filename)}`;
  lbFilename.textContent = filename;
  lbFavorite.classList.toggle('is-favorite', isFavorite(filename));
  lightbox.classList.add('open');
}

function closeLightbox() {
  lightbox.classList.remove('open');
  currentLightboxFile = null;
}

lbClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ─── FAVORITE TOGGLE (lightbox) ───
lbFavorite.addEventListener('click', () => {
  if (!currentLightboxFile) return;
  const nowFav = toggleFavorite(currentLightboxFile);
  lbFavorite.classList.toggle('is-favorite', nowFav);
  renderPhotos(); // keep grid stars + favorites filter in sync
});

// ─── FILTER TABS ───
panelTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    panelTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentFilter = tab.dataset.filter || 'all';
    renderPhotos();
  });
});

// ─── UPLOAD (owner only) ───
if (fileInput) {
  fileInput.addEventListener('change', async e => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    if (!ownerToken) {
      showToast('You are not authorized to upload.', true);
      return;
    }

    const formData = new FormData();
    files.forEach(f => formData.append('photos', f));

    showToast('Uploading...');

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'x-upload-token': ownerToken },
        body: formData
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Upload failed.', true);
        return;
      }

      showToast(`Uploaded ${data.uploaded.length} photo(s).`);
      loadPhotos();
    } catch (err) {
      showToast('Upload failed.', true);
    }

    fileInput.value = '';
  });
}

// ─── DELETE (owner only) ───
if (lbDelete) {
  lbDelete.addEventListener('click', async () => {
    if (!currentLightboxFile || !ownerToken) return;
    if (!confirm('Delete this photo permanently?')) return;

    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(currentLightboxFile)}`, {
        method: 'DELETE',
        headers: { 'x-upload-token': ownerToken }
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Delete failed.', true);
        return;
      }

      showToast('Photo deleted.');
      closeLightbox();
      loadPhotos();
    } catch (err) {
      showToast('Delete failed.', true);
    }
  });
}

// ─── INIT ───
loadPhotos();
