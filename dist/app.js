const kinds = {
  home: { name: 'Home', label: 'Kandang' },
  away: { name: 'Away', label: 'Tandang' },
  third: { name: 'Third', label: 'Ketiga' },
};
const descriptions2026 = {
  home: 'Putih dengan kerah dan manset hijau tua serta tiga garis merah muda di bahu.',
  away: 'Hijau tua dengan detail putih gading dan pola geometris dari inisial klub.',
  third: 'Merah muda dengan detail putih gading dan motif geometris yang terinspirasi kerajinan Amerika Latin.',
};
const official = 'https://static.realmadrid.com/StaticFiles/RealMadridResponsive/especiales/en/shirts-and-kits/index.html';
const history = 'https://www.footylogos.com/kits/real-madrid-history';
const labelFor = (year, separator = '/') => year + separator + String(year + 1).slice(2);
const madridKits = Array.from({ length: 13 }, (_, index) => 2026 - index).flatMap(year => Object.keys(kinds).map(kind => ({
  year,
  kind,
  season: labelFor(year),
  src: 'assets/' + labelFor(year, '-') + '-' + kind + '.webp',
  sponsor: year >= 2020 ? 'Emirates Fly Better' : 'Fly Emirates',
  description: year === 2026 ? descriptions2026[kind] : '',
  source: year === 2026 ? official : history,
  maker: 'adidas',
  cutout: true,
})));
const clubs = clubCatalog.map(club => {
  const local = club.id === 'real-madrid' ? madridKits : [];
  const items = new Map([...club.kits, ...local].map(kit => [kit.year + '-' + kit.kind, kit]));
  return { ...club, kits: [...items.values()].map(kit => ({
    ...kit, ...kinds[kit.kind], club: club.name, season: labelFor(kit.year),
    id: [club.id, kit.year, kit.kind].join('.'),
  })).sort((a, b) => b.year - a.year || Object.keys(kinds).indexOf(a.kind) - Object.keys(kinds).indexOf(b.kind)) };
}).sort((a, b) => a.name.localeCompare(b.name));
const cardsPerPage = 8;
const rackRadius = 3;
const state = { season: 3, rackKind: 'home', kind: 'all', year: 'all', limit: cardsPerPage };
let club;
let kits;
let years;
let rackEntries;

const byId = id => document.getElementById(id);
const seasons = byId('seasons');
const stage = byId('stage');
const rack = byId('rack');
const rackTypes = byId('rack-types');
const previous = byId('previous');
const next = byId('next');
const filters = byId('filters');
const seasonFilter = byId('season-filter');
const cards = byId('cards');
const more = byId('more');
const details = byId('details');
const directory = byId('clubs');
const clubSearch = byId('club-search');
const countryFilter = byId('country-filter');
const clubList = byId('club-list');
const compare = byId('compare');
const saved = byId('saved');
const zoom = byId('photo-zoom');
const rackCompare = byId('rack-compare');
const detailCompare = byId('detail-compare');
const detailSave = byId('detail-save');
const kitIndex = new Map(clubs.flatMap(item => item.kits.map(kit => [kit.id, kit])));
const savedStorageKey = 'kit-archive:incaran:v1';
const pageParams = new URL(location.href).searchParams;
const comparison = [...new Set(pageParams.getAll('bandingkan'))].filter(id => kitIndex.has(id)).slice(0, 2);
let savedKits = readSavedKits();
let activeDetail;
let toastTimer;

function shirtImage(kit, lazy = false) {
  const image = document.createElement('img');
  image.className = 'shirt';
  image.src = kit.src;
  image.alt = 'Jersey ' + kit.club + ' ' + kit.name + ' ' + kit.season;
  image.decoding = 'async';
  image.loading = lazy ? 'lazy' : 'eager';
  image.draggable = false;
  image.addEventListener('error', () => {
    const message = document.createElement('span');
    message.className = 'photo-missing';
    message.textContent = 'Foto belum bisa dimuat';
    image.replaceWith(message);
  }, { once: true });
  return image;
}

function rackKit(index = state.season) {
  return rackEntries[index];
}

function updateRack(index, button) {
  const kit = rackKit(index);
  const distance = index - state.season;
  const active = distance === 0;
  button.style.setProperty('--distance', distance);
  button.style.setProperty('--lean', Math.sign(distance));
  button.style.setProperty('--depth', Math.abs(distance));
  button.style.zIndex = String(rackEntries.length - Math.abs(distance));
  button.classList.toggle('selected', active);
  button.classList.toggle('off-rack', Math.abs(distance) > rackRadius);
  button.tabIndex = active ? 0 : -1;
  button.setAttribute('aria-label', (active ? 'Lihat detail jersey ' : 'Pilih jersey ') + kit.name + ' ' + kit.season);
  if (Math.abs(distance) <= rackRadius && button.dataset.src !== kit.src) {
    button.querySelector('.rack-image').replaceChildren(shirtImage(kit));
    button.dataset.src = kit.src;
  }
  button.classList.toggle('photo-item', !kit.cutout);
}

function changeSeason(index, animate = true) {
  if (index < 0 || index >= rackEntries.length) return;

  state.season = index;
  const kit = rackKit();
  state.rackKind = kit.kind;
  Array.from(rack.children).forEach((button, buttonIndex) => updateRack(buttonIndex, button));
  byId('current-type').textContent = kit.name.toUpperCase() + ' KIT';
  byId('current-season').textContent = kit.season;
  previous.disabled = index === 0;
  next.disabled = index === rackEntries.length - 1;
  Array.from(seasons.children).forEach((button, buttonIndex) => {
    button.setAttribute('aria-pressed', String(buttonIndex === index));
  });
  for (const button of rackTypes.children) {
    button.setAttribute('aria-pressed', String(button.dataset.kind === kit.kind));
  }
  syncKitActions();

  if (animate && document.activeElement !== seasons.children[index]) {
    const button = seasons.children[index];
    const left = button.offsetLeft;
    if (left < seasons.scrollLeft || left + button.offsetWidth > seasons.scrollLeft + seasons.clientWidth) {
      seasons.scrollTo({ left: left - (seasons.clientWidth - button.offsetWidth) / 2,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
  }
}

function buildCard(kit) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'card';
  card.setAttribute('aria-label', 'Lihat detail jersey ' + kit.club + ' ' + kit.name + ' ' + kit.season);

  const media = document.createElement('span');
  media.className = 'card-media';
  const chip = document.createElement('span');
  chip.className = 'type-chip';
  chip.textContent = kit.name.toUpperCase();
  const image = document.createElement('span');
  image.className = 'kit-image';
  image.append(shirtImage(kit, true));
  media.append(chip, image);

  const caption = document.createElement('span');
  caption.className = 'card-caption';
  caption.innerHTML = '<span><strong></strong><small></small></span><span class="launch" aria-hidden="true">↗</span>';
  caption.querySelector('strong').textContent = kit.season;
  caption.querySelector('small').textContent = kit.club + ' · ' + kit.name;
  card.append(media, caption);
  card.addEventListener('click', () => showDetails(kit));
  return card;
}

function renderCollection(append = false) {
  const matches = kits.filter(kit =>
    (state.kind === 'all' || kit.kind === state.kind) &&
    (state.year === 'all' || kit.year === Number(state.year))
  );
  const visible = matches.slice(0, state.limit);

  if (append) {
    const start = cards.childElementCount;
    cards.append(...visible.slice(start).map(buildCard));
    cards.children[start]?.focus({ preventScroll: true });
  } else {
    cards.replaceChildren(...visible.map(buildCard));
  }
  more.hidden = visible.length >= matches.length;
  byId('result-count').textContent = matches.length
    ? 'Menampilkan ' + visible.length + ' dari ' + matches.length + ' jersey'
    : 'Belum ada jersey untuk filter ini.';
}

function showDetails(kit) {
  activeDetail = kit;
  const image = document.createElement('span');
  image.className = 'kit-image';
  image.append(shirtImage(kit));
  byId('detail-media').replaceChildren(image);
  byId('detail-title').textContent = kit.name + ' ' + kit.season;
  byId('detail-club').textContent = kit.club.toUpperCase();
  byId('detail-description').textContent = kit.description || '';
  byId('detail-description').hidden = !kit.description;
  byId('detail-season').textContent = kit.season;
  byId('detail-kind').textContent = kit.name + ' · ' + kit.label;
  byId('detail-maker').textContent = kit.maker || 'Belum tercatat';
  byId('detail-sponsor').textContent = kit.sponsor || '';
  byId('sponsor-row').hidden = !kit.sponsor;
  byId('detail-source').href = kit.source;
  byId('detail-action-status').textContent = '';
  syncKitActions();
  details.showModal();
}

function readSavedKits() {
  try {
    const stored = JSON.parse(localStorage.getItem(savedStorageKey) || '[]');
    return new Set(Array.isArray(stored) ? stored.filter(id => kitIndex.has(id)) : []);
  } catch {
    return new Set();
  }
}

function syncKitActions() {
  const activeRack = rackKit();
  for (const [button, kit] of [[rackCompare, activeRack], [detailCompare, activeDetail]]) {
    const selected = Boolean(kit && comparison.includes(kit.id));
    button.classList.toggle('in-comparison', selected);
    button.textContent = selected ? '✓ Dipilih' : '+ Bandingkan';
  }
  const isSaved = Boolean(activeDetail && savedKits.has(activeDetail.id));
  detailSave.setAttribute('aria-pressed', String(isSaved));
  detailSave.textContent = isSaved ? '✓ Tersimpan' : 'Simpan incaran';
  byId('compare-count').textContent = comparison.length ? ' ' + comparison.length : '';
  byId('saved-count').textContent = savedKits.size ? ' ' + savedKits.size : '';
}

function reportAction(message) {
  if (details.open) {
    byId('detail-action-status').textContent = message;
    return;
  }
  const toast = byId('action-toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3800);
}

function toggleSaved(kit) {
  const wasSaved = savedKits.has(kit.id);
  if (wasSaved) savedKits.delete(kit.id);
  else savedKits.add(kit.id);
  let persisted = true;
  try {
    localStorage.setItem(savedStorageKey, JSON.stringify([...savedKits]));
  } catch {
    persisted = false;
  }
  syncKitActions();
  if (saved.open) renderSaved();
  if (!persisted) reportAction('Daftar incaran hanya tersimpan selama halaman ini terbuka.');
  else if (details.open) reportAction(wasSaved ? 'Dihapus dari incaran.' : 'Masuk daftar incaran.');
}

function addToComparison(kit) {
  if (comparison.includes(kit.id) || comparison.length === 2) {
    openComparison();
    return;
  }
  comparison.push(kit.id);
  syncKitActions();
  if (comparison.length === 2) openComparison();
  else reportAction('Jersey pertama dipilih. Pilih satu jersey lagi.');
}

function comparePhoto(kit) {
  const photo = document.createElement('button');
  photo.type = 'button';
  photo.className = 'compare-photo';
  photo.setAttribute('aria-label', 'Perbesar foto ' + kit.club + ' ' + kit.name + ' ' + kit.season);
  const mark = document.createElement('span');
  mark.textContent = '↗';
  mark.setAttribute('aria-hidden', 'true');
  photo.append(shirtImage(kit), mark);
  photo.addEventListener('click', () => {
    byId('zoom-title').textContent = kit.club + ' · ' + kit.name + ' ' + kit.season;
    byId('zoom-media').replaceChildren(shirtImage(kit));
    zoom.showModal();
  });
  return photo;
}

function compareCard(kit) {
  const card = document.createElement('article');
  card.className = 'compare-card';
  const heading = document.createElement('h3');
  heading.textContent = kit.club;
  const facts = document.createElement('dl');
  for (const [label, value] of [
    ['Musim', kit.season], ['Jenis', kit.name], ['Produsen', kit.maker], ['Sponsor', kit.sponsor],
  ]) {
    const term = document.createElement('dt');
    const definition = document.createElement('dd');
    term.textContent = label;
    definition.textContent = value || 'Belum tercatat';
    facts.append(term, definition);
  }
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'utility';
  remove.textContent = 'Keluarkan';
  remove.setAttribute('aria-label', 'Keluarkan ' + kit.club + ' ' + kit.name + ' ' + kit.season + ' dari perbandingan');
  remove.addEventListener('click', () => {
    comparison.splice(comparison.indexOf(kit.id), 1);
    syncKitActions();
    renderComparison();
    byId('compare-back').focus();
  });
  card.append(comparePhoto(kit), heading, facts, remove);
  return card;
}

function renderComparison() {
  const panels = [0, 1].map(index => {
    const kit = kitIndex.get(comparison[index]);
    if (kit) return compareCard(kit);
    const empty = document.createElement('div');
    empty.className = 'compare-empty';
    empty.textContent = index === 0 ? 'Jersey pertama' : 'Jersey kedua';
    return empty;
  });
  byId('compare-grid').replaceChildren(...panels);
  byId('compare-note').textContent = comparison.length === 2
    ? 'Ketuk foto untuk memperbesar.'
    : 'Tekan + Bandingkan pada rak atau detail jersey untuk memilih dua jersey.';
  byId('share-compare').disabled = comparison.length !== 2;
  byId('share-field').hidden = true;
  byId('share-status').textContent = '';
}

function openComparison() {
  renderComparison();
  if (!compare.open) compare.showModal();
}

async function copyComparison() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  for (const id of comparison) url.searchParams.append('bandingkan', id);
  const status = byId('share-status');
  try {
    await navigator.clipboard.writeText(url.href);
    status.textContent = 'Link disalin. Siapa saja bisa membukanya.';
  } catch {
    byId('share-field').hidden = false;
    const input = byId('share-url');
    input.value = url.href;
    input.focus();
    input.select();
    status.textContent = 'Salin link dari kolom di atas.';
  }
}

function renderSaved() {
  const items = [...savedKits].reverse().map(id => buildCard(kitIndex.get(id)));
  byId('saved-grid').replaceChildren(...items);
  byId('saved-note').textContent = items.length
    ? items.length + ' jersey tersimpan di browser ini.'
    : 'Buka detail jersey dan pilih Simpan incaran untuk mulai.';
}

rackCompare.addEventListener('click', () => addToComparison(rackKit()));
detailCompare.addEventListener('click', () => addToComparison(activeDetail));
detailSave.addEventListener('click', () => toggleSaved(activeDetail));
byId('nav-compare').addEventListener('click', openComparison);
byId('nav-saved').addEventListener('click', () => {
  renderSaved();
  saved.showModal();
});
for (const [id, modal] of [['close-compare', compare], ['compare-back', compare], ['close-saved', saved], ['close-zoom', zoom]]) {
  byId(id).addEventListener('click', () => modal.close());
}
byId('share-compare').addEventListener('click', copyComparison);
window.addEventListener('storage', event => {
  if (event.key !== savedStorageKey && event.key !== null) return;
  savedKits = readSavedKits();
  syncKitActions();
  if (saved.open) renderSaved();
});

function buildRackItem(kit, index) {
  const hanger = document.createElement('button');
  hanger.type = 'button';
  hanger.className = 'rack-item';
  hanger.innerHTML = '<span class="hanger" aria-hidden="true"><svg viewBox="0 0 120 52"><path class="hook" d="M60 29V18c0-5 8-4 8-11a8 8 0 0 0-16 0"/><path class="wood" d="M60 26 9 46a2 2 0 0 0 1 4h100a2 2 0 0 0 1-4L60 26Z"/></svg></span><span class="rack-image"></span>';
  hanger.addEventListener('click', () => {
    if (state.season === index) showDetails(rackKit());
    else changeSeason(index);
  });
  return hanger;
}

function buildSeasonButton(kit, index) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = years.length === 1 ? kit.season + ' · ' + kit.name : kit.season;
  button.addEventListener('click', () => changeSeason(index));
  return button;
}

function renderRack(preferredYear) {
  const shelfOrder = ['away', 'home', 'third'];
  rackEntries = years.length === 1
    ? [...kits].sort((a, b) => shelfOrder.indexOf(a.kind) - shelfOrder.indexOf(b.kind))
    : kits.filter(kit => kit.kind === state.rackKind);
  rack.replaceChildren(...rackEntries.map(buildRackItem));
  seasons.replaceChildren(...rackEntries.map(buildSeasonButton));
  const nearest = rackEntries.reduce((best, kit, index) =>
    Math.abs(kit.year - preferredYear) < Math.abs(rackEntries[best].year - preferredYear) ? index : best, 0);
  const oneSeason = rackEntries.findIndex(kit => kit.kind === state.rackKind);
  changeSeason(years.length === 1 ? Math.max(0, oneSeason) : nearest, false);
}

function selectClub(selected) {
  club = selected;
  kits = club.kits;
  years = [...new Set(kits.map(kit => kit.year))];
  state.rackKind = kits.some(kit => kit.kind === 'home') ? 'home' : kits[0].kind;
  state.kind = 'all';
  state.year = 'all';
  state.limit = cardsPerPage;
  document.title = club.name + ' — Kit Archive';
  byId('club-name').textContent = club.name.toUpperCase();
  byId('club-name').classList.toggle('long-title', club.name.length > 22);
  byId('club-location').textContent = (club.country + ' / ' + club.league).toUpperCase();
  byId('collection-club').textContent = club.name.toUpperCase();
  byId('timeline-label').textContent = years.length === 1 ? 'JENIS JERSEY' : 'LINI MASA';
  previous.setAttribute('aria-label', years.length === 1 ? 'Jersey sebelumnya' : 'Musim lebih baru');
  next.setAttribute('aria-label', years.length === 1 ? 'Jersey berikutnya' : 'Musim lebih lama');
  seasonFilter.replaceChildren(new Option('Semua musim', 'all'), ...years.map(year => new Option(labelFor(year), year)));
  for (const button of [...rackTypes.children, ...filters.children]) {
    const kind = button.dataset.kind;
    button.hidden = kind !== 'all' && !kits.some(kit => kit.kind === kind);
    button.setAttribute('aria-pressed', String(kind === 'all'));
  }
  renderRack(club.id === 'real-madrid' ? 2023 : years.length > 6 ? years[2] : years[0]);
  renderCollection();
}

function searchText(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

function renderClubs() {
  const query = searchText(clubSearch.value.trim());
  const country = countryFilter.value;
  const matches = clubs.filter(item =>
    (!country || item.country === country) &&
    searchText(item.name + ' ' + item.id + ' ' + item.league).replaceAll('-', ' ').includes(query.replaceAll('-', ' ')));
  byId('club-count').textContent = matches.length ? matches.length + ' klub' : 'Klub belum ada di koleksi ini.';
  clubList.replaceChildren(...matches.map(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'club-option';
    const name = document.createElement('strong');
    const countryName = document.createElement('small');
    name.textContent = item.name;
    countryName.textContent = item.country;
    if (item === club) button.setAttribute('aria-current', 'true');
    button.append(name, countryName);
    button.addEventListener('click', () => {
      selectClub(item);
      const url = new URL(location.href);
      url.searchParams.set('klub', item.id);
      if (location.protocol !== 'file:') window.history.replaceState(null, '', url);
      directory.close();
      byId('choose-club').focus({ preventScroll: true });
      byId('atas').scrollIntoView({ block: 'start' });
    });
    return button;
  }));
}

const countries = [...new Set(clubs.map(item => item.country))].sort((a, b) => a.localeCompare(b, 'id'));
countryFilter.replaceChildren(new Option('Semua negara', ''), ...countries.map(country => new Option(country)));
clubSearch.addEventListener('input', renderClubs);
countryFilter.addEventListener('change', renderClubs);
for (const id of ['choose-club', 'nav-clubs']) {
  byId(id).addEventListener('click', () => {
    renderClubs();
    directory.showModal();
  });
}
byId('close-clubs').addEventListener('click', () => directory.close());
previous.addEventListener('click', () => changeSeason(state.season - 1));
next.addEventListener('click', () => changeSeason(state.season + 1));
byId('rack-details').addEventListener('click', () => showDetails(rackKit()));
rackTypes.addEventListener('click', event => {
  const button = event.target.closest('[data-kind]');
  if (!button) return;
  const kind = button.dataset.kind;
  if (kind === state.rackKind) return;
  if (years.length === 1) {
    changeSeason(rackEntries.findIndex(kit => kit.kind === kind));
    return;
  }
  const year = rackKit().year;
  state.rackKind = kind;
  renderRack(year);
});
stage.addEventListener('keydown', event => {
  const offset = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
  if (offset) {
    event.preventDefault();
    changeSeason(state.season + offset);
  }
});

let drag;
let suppressClick = false;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
stage.addEventListener('pointerdown', event => {
  if (!event.isPrimary || event.button !== 0 || event.target.closest('.arrows, .stage-top, .stage-bottom')) return;
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false };
});
stage.addEventListener('pointermove', event => {
  if (drag?.id === event.pointerId) {
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    if (!drag.active && Math.abs(dx) > 9 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      drag.active = true;
      stage.setPointerCapture(event.pointerId);
      stage.classList.add('dragging');
    }
    if (drag.active) {
      const resisted = dx > 0 && state.season === 0 || dx < 0 && state.season === rackEntries.length - 1;
      stage.style.setProperty('--drag', (resisted ? dx * .18 : dx * .72) + 'px');
      return;
    }
  }
  if (event.pointerType === 'mouse' && !reduceMotion.matches) {
    const active = rack.querySelector('.selected');
    const box = active?.getBoundingClientRect();
    if (box && event.clientX >= box.left && event.clientX <= box.right &&
      event.clientY >= box.top && event.clientY <= box.bottom) {
      stage.style.setProperty('--tilt', ((event.clientX - box.left) / box.width - .5) * 15 + 'deg');
    } else stage.style.removeProperty('--tilt');
  }
});

function finishDrag(event, cancelled = false) {
  if (drag?.id !== event.pointerId) return;
  const dx = event.clientX - drag.x;
  const active = drag.active;
  drag = undefined;
  stage.classList.remove('dragging');
  stage.style.removeProperty('--drag');
  stage.style.removeProperty('--tilt');
  if (!active || cancelled) return;
  suppressClick = true;
  setTimeout(() => { suppressClick = false; }, 160);
  if (Math.abs(dx) < 38) return;
  const jump = Math.min(3, Math.max(1, Math.round(Math.abs(dx) / 150)));
  changeSeason(Math.max(0, Math.min(rackEntries.length - 1, state.season + (dx < 0 ? jump : -jump))));
}

stage.addEventListener('pointerup', finishDrag);
stage.addEventListener('pointercancel', event => finishDrag(event, true));
stage.addEventListener('pointerleave', event => {
  if (drag && !drag.active) finishDrag(event, true);
  stage.style.removeProperty('--tilt');
});
stage.addEventListener('click', event => {
  if (!suppressClick) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

filters.addEventListener('click', event => {
  const button = event.target.closest('[data-kind]');
  if (!button) return;

  state.kind = button.dataset.kind;
  state.limit = cardsPerPage;
  Array.from(filters.children).forEach(control => {
    control.setAttribute('aria-pressed', String(control === button));
  });
  renderCollection();
});
seasonFilter.addEventListener('change', () => {
  state.year = seasonFilter.value;
  state.limit = cardsPerPage;
  renderCollection();
});
more.addEventListener('click', () => {
  state.limit += cardsPerPage;
  renderCollection(true);
});
byId('close').addEventListener('click', () => details.close());
details.addEventListener('click', event => {
  if (event.target !== details) return;
  const bounds = details.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) details.close();
});

const requestedClub = pageParams.get('klub') || 'real-madrid';
selectClub(clubs.find(item => item.id === requestedClub) || clubs.find(item => item.id === 'real-madrid') || clubs[0]);
if (comparison.length) openComparison();

