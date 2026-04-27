// ── FULL HEIGHT ───────────────────────────────────────────────────
(function initHeight() {
  const MAX = 900, TOOLBAR = 90;
  document.body.style.height = Math.min(screen.availHeight - TOOLBAR, MAX) + "px";
  requestAnimationFrame(() => {
    const real = window.innerHeight;
    if (real > 0) document.body.style.height = real + "px";
  });
})();

// ── AUTO THEME ────────────────────────────────────────────────────
(function initTheme() {
  function apply() {
    const h = new Date().getHours();
    document.documentElement.dataset.theme = (h >= 6 && h < 20) ? "light" : "dark";
  }
  apply();
  (function scheduleHourly() {
    const now = new Date();
    setTimeout(() => { apply(); scheduleHourly(); },
      (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1_000);
  })();
})();

// ── CONSTANTS ─────────────────────────────────────────────────────
const BASE_URL = "https://nhentai.website/g/";
const META_TTL = 7 * 24 * 60 * 60 * 1000;

// ── STATE ─────────────────────────────────────────────────────────
let mangaCodes    = [];
let javCodes      = [];
let mangaTags     = [];
let javTags       = [];
let activeMangaTab  = "all";
let activeJavTab    = "all";
let activeSection   = "manga";
let shareMode       = false;
let selectedItems   = new Set();   // keys: "manga|code|tag" or "jav|code|tag"

// edit modal state
let editModalItem   = null;   // { type, item, updateFn }
let editRatingCtrl  = null;

// ── STORAGE ───────────────────────────────────────────────────────
function loadStorage(cb) {
  chrome.storage.local.get(["codes","javCodes","tags","javTags"], data => {
    mangaCodes = data.codes    || [];
    javCodes   = data.javCodes || [];
    mangaTags  = data.tags     || [];
    javTags    = data.javTags  || [];
    cb();
  });
}
function saveMangaTags(t) { mangaTags = t; chrome.storage.local.set({ tags: t }); }
function saveJavTags(t)   { javTags   = t; chrome.storage.local.set({ javTags: t }); }
function saveMangaCodes(c){ mangaCodes = c; chrome.storage.local.set({ codes: c }); }
function saveJavCodes(c)  { javCodes   = c; chrome.storage.local.set({ javCodes: c }); }

// ── META CACHE ────────────────────────────────────────────────────
function extractImgUrl(el, base) {
  if (!el) return null;
  for (const a of ["data-src","data-lazy-src","data-original","data-lazy","data-url","src"]) {
    const v = el.getAttribute(a)?.trim();
    if (!v || v.startsWith("data:")) continue;
    try { return v.startsWith("http") ? v : new URL(v, base).href; } catch { continue; }
  }
  const ss = el.getAttribute("srcset");
  if (ss) {
    const f = ss.trim().split(/\s+/)[0];
    if (f && !f.startsWith("data:")) { try { return new URL(f, base).href; } catch {} }
  }
  return null;
}
async function getMetaCache() {
  return new Promise(r => chrome.storage.local.get(["metaCache"], ({metaCache={}}) => r(metaCache)));
}
async function setMetaCache(c) {
  return new Promise(r => chrome.storage.local.set({metaCache:c}, r));
}
async function fetchMeta(code) {
  const cache = await getMetaCache();
  const hit   = cache[code];
  if (hit && !hit.thumb?.startsWith("data:") && Date.now() - hit.fetchedAt < META_TTL) return hit;
  try {
    const resp = await fetch(`${BASE_URL}${code}/`, { credentials:"omit", cache:"default" });
    if (!resp.ok) throw new Error(resp.status);
    const doc = new DOMParser().parseFromString(await resp.text(), "text/html");
    const titleEl = doc.querySelector("#info h1 .pretty") || doc.querySelector("#info h1") ||
                    doc.querySelector("h1.title .pretty")  || doc.querySelector("h1.title") || doc.querySelector("h1");
    const title = titleEl?.textContent?.trim() || null;
    const imgEl = doc.querySelector("#cover img") || doc.querySelector("img#cover-img") ||
                  doc.querySelector(".cover img")  || doc.querySelector("[class*='cover'] img") ||
                  doc.querySelector("img[itemprop='image']") ||
                  Array.from(doc.querySelectorAll("img")).find(el => {
                    const s = el.getAttribute("data-src") || el.getAttribute("src") || "";
                    return s && !s.startsWith("data:") && /galleries|cover|thumb/i.test(s);
                  });
    const thumb = extractImgUrl(imgEl, "https://nhentai.website");
    const meta  = { title, thumb, fetchedAt: Date.now() };
    cache[code] = meta;
    await setMetaCache(cache);
    return meta;
  } catch {
    return { title: null, thumb: null, fetchedAt: Date.now() };
  }
}

// ── STAR RATING COMPONENT ─────────────────────────────────────────
// Returns a controller with getValue() / setValue().
// Renders into `container`. Pass opts.readOnly=true for display-only.
function StarRating(container, opts = {}) {
  let value     = opts.value  || 0;
  const MAX     = 10;
  const readOnly = opts.readOnly || false;
  const onChange = opts.onChange || (() => {});

  if (!readOnly) container.classList.add("star-rating");
  else           container.classList.add("star-display");

  function render(display) {
    container.innerHTML = "";
    for (let i = 1; i <= MAX; i++) {
      const ico  = document.createElement("span");
      ico.className = "star-ico";
      ico.textContent = "★";   // direct text node — color on element is always reliable
      const fill = display - (i - 1);
      if (fill >= 1)        ico.classList.add("full");
      else if (fill >= 0.5) ico.classList.add("half");
      if (!readOnly) {
        const lh = document.createElement("b"); lh.className = "sh l"; lh.dataset.v = (i - 0.5).toString();
        const rh = document.createElement("b"); rh.className = "sh r"; rh.dataset.v = i.toString();
        ico.append(lh, rh);
      }
      container.appendChild(ico);
    }
    if (display > 0) {
      const score = document.createElement("span");
      score.className = "star-score";
      score.textContent = Number.isInteger(display) ? String(display) : display.toFixed(1);
      container.appendChild(score);
    }
  }

  render(value);

  if (!readOnly) {
    container.addEventListener("mousemove", e => {
      const h = e.target.closest(".sh");
      if (h) render(parseFloat(h.dataset.v));
    });
    container.addEventListener("mouseleave", () => render(value));
    container.addEventListener("click", e => {
      const h = e.target.closest(".sh");
      if (!h) return;
      const v = parseFloat(h.dataset.v);
      value = (value === v) ? 0 : v;
      render(value);
      onChange(value);
    });
  }

  return {
    getValue: () => value,
    setValue: v  => { value = v; render(v); }
  };
}

// ── SVG ICONS ─────────────────────────────────────────────────────
const ICO_OPEN  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const ICO_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const ICO_IMG   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const ICO_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
const ICO_CHECK = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;

// ── ITEM KEY ──────────────────────────────────────────────────────
function itemKey(type, code, tag) { return `${type}|${code}|${tag||""}`; }

// ── MANGA CARD ────────────────────────────────────────────────────
function buildMangaCard(item, onDelete) {
  const key  = itemKey("manga", item.code, item.tag);
  const wrap = document.createElement("div");
  wrap.className = "card-check-wrap";

  // Checkbox overlay
  const chk = document.createElement("div");
  chk.className = "card-checkbox" + (selectedItems.has(key) ? " checked" : "");
  chk.innerHTML = ICO_CHECK;
  wrap.appendChild(chk);

  const card = document.createElement("div");
  card.className = "code-card clickable" + (selectedItems.has(key) ? " selected" : "");

  // Thumb
  const tw = document.createElement("div"); tw.className = "card-thumb-wrap";
  const ph = document.createElement("div"); ph.className = "card-thumb-placeholder skeleton"; ph.innerHTML = ICO_IMG;
  tw.appendChild(ph);

  // Body
  const body   = document.createElement("div"); body.className = "card-body";
  const top    = document.createElement("div"); top.className = "card-top";
  const num    = document.createElement("span"); num.className = "code-num"; num.textContent = item.code;
  const badge  = document.createElement("span");
  if (item.tag) { badge.className = "code-tag manga-tag"; badge.textContent = `#${item.tag}`; }
  else          { badge.className = "code-tag no-tag";    badge.textContent = "untagged"; }
  top.append(num, badge);

  const title  = document.createElement("p"); title.className = "code-title loading skeleton";

  // Description
  const desc = document.createElement("p"); desc.className = "card-desc";
  if (item.description) { desc.textContent = item.description; }
  else { desc.style.display = "none"; }

  // Star display
  const starWrap = document.createElement("div");
  if (item.rating) StarRating(starWrap, { value: item.rating, readOnly: true });
  else starWrap.style.display = "none";

  const footer  = document.createElement("div"); footer.className = "card-footer";
  const actions = document.createElement("div"); actions.className = "code-actions";
  const btnO = document.createElement("button"); btnO.className = "btn-open"; btnO.title = "Open manga"; btnO.innerHTML = ICO_OPEN;
  btnO.addEventListener("click", e => { e.stopPropagation(); chrome.tabs.create({ url: `${BASE_URL}${item.code}` }); });
  const btnD = document.createElement("button"); btnD.className = "btn-delete"; btnD.title = "Remove"; btnD.innerHTML = ICO_TRASH;
  btnD.addEventListener("click", e => { e.stopPropagation(); onDelete(); });
  actions.append(btnO, btnD);
  footer.appendChild(actions);
  body.append(top, title, desc, starWrap, footer);
  card.append(tw, body);

  // Click: share mode → toggle select; normal mode → edit modal
  card.addEventListener("click", e => {
    if (shareMode) { toggleSelect(key, card, chk); }
    else           { openEditModal({ type: "manga", item }); }
  });

  // Fetch meta async
  fetchMeta(item.code).then(meta => {
    title.classList.remove("loading","skeleton");
    title.textContent = meta.title || "Title unavailable";
    if (!meta.title) title.classList.add("unavailable");
    if (meta.thumb) {
      const img = document.createElement("img");
      img.className = "card-thumb"; img.alt = meta.title || item.code; img.src = meta.thumb;
      img.onload  = () => ph.replaceWith(img);
      img.onerror = () => { ph.classList.remove("skeleton"); };
    } else { ph.classList.remove("skeleton"); }
  });

  wrap.appendChild(card);
  return wrap;
}

// ── JAV CARD ──────────────────────────────────────────────────────
function buildJavCard(item, onDelete) {
  const key  = itemKey("jav", item.code, item.tag);
  const wrap = document.createElement("div");
  wrap.className = "card-check-wrap";

  const chk = document.createElement("div");
  chk.className = "card-checkbox" + (selectedItems.has(key) ? " checked" : "");
  chk.innerHTML = ICO_CHECK;
  wrap.appendChild(chk);

  const card = document.createElement("div");
  card.className = "jav-card clickable" + (selectedItems.has(key) ? " selected" : "");

  // Thumb
  const tw = document.createElement("div"); tw.className = "jav-thumb-wrap";
  if (item.thumb) {
    const img = document.createElement("img"); img.className = "jav-thumb"; img.src = item.thumb; img.alt = item.code;
    tw.appendChild(img);
  } else {
    const ph = document.createElement("div"); ph.className = "jav-thumb-placeholder"; ph.innerHTML = ICO_IMG;
    tw.appendChild(ph);
  }

  // Body
  const body  = document.createElement("div"); body.className = "card-body";
  const top   = document.createElement("div"); top.className = "card-top";
  const num   = document.createElement("span"); num.className = "code-num"; num.textContent = item.code;
  top.appendChild(num);
  if (item.tag) {
    const badge = document.createElement("span"); badge.className = "code-tag jav-tag"; badge.textContent = `#${item.tag}`;
    top.appendChild(badge);
  }

  const desc = document.createElement("p"); desc.className = "card-desc";
  if (item.description) { desc.textContent = item.description; }
  else { desc.style.display = "none"; }

  const starWrap = document.createElement("div");
  if (item.rating) StarRating(starWrap, { value: item.rating, readOnly: true });
  else starWrap.style.display = "none";

  const footer  = document.createElement("div"); footer.className = "card-footer";
  const actions = document.createElement("div"); actions.className = "code-actions";
  const btnD = document.createElement("button"); btnD.className = "btn-delete"; btnD.title = "Remove"; btnD.innerHTML = ICO_TRASH;
  btnD.addEventListener("click", e => { e.stopPropagation(); onDelete(); });
  actions.appendChild(btnD);
  footer.appendChild(actions);
  body.append(top, desc, starWrap, footer);
  card.append(tw, body);

  card.addEventListener("click", e => {
    if (shareMode) { toggleSelect(key, card, chk); }
    else           { openEditModal({ type: "jav", item }); }
  });

  wrap.appendChild(card);
  return wrap;
}

// ── TOGGLE SELECT (share mode) ────────────────────────────────────
function toggleSelect(key, card, chk) {
  if (selectedItems.has(key)) {
    selectedItems.delete(key);
    card.classList.remove("selected");
    chk.classList.remove("checked");
  } else {
    selectedItems.add(key);
    card.classList.add("selected");
    chk.classList.add("checked");
  }
  updateShareBar();
}

function updateShareBar() {
  const n = selectedItems.size;
  document.getElementById("share-count").textContent = n === 1 ? "1 selected" : `${n} selected`;
  document.getElementById("btn-do-share").disabled = n === 0;
}

// ── RENDER ────────────────────────────────────────────────────────
function renderManga() {
  const list = document.getElementById("manga-code-list");
  list.innerHTML = "";
  const filtered = activeMangaTab === "all"
    ? mangaCodes
    : mangaCodes.filter(c => (c.tag||"") === activeMangaTab);
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">${ICO_EMPTY}<span>No codes saved yet.<br>Highlight a 6-digit number and use the right-click menu.</span></div>`;
    return;
  }
  [...filtered].sort((a,b) => b.savedAt - a.savedAt).forEach(item => {
    list.appendChild(buildMangaCard(item, () => {
      saveMangaCodes(mangaCodes.filter(c => !(c.code===item.code && (c.tag||"")===(item.tag||""))));
      renderMangaTabs(); renderManga();
    }));
  });
}

function renderJav() {
  const list = document.getElementById("jav-code-list");
  list.innerHTML = "";
  const filtered = activeJavTab === "all"
    ? javCodes
    : javCodes.filter(c => (c.tag||"") === activeJavTab);
  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">${ICO_EMPTY}<span>No Japanese Movie codes saved yet.<br>Right-click any text → Find Manga → Save Japanese Movie.</span></div>`;
    return;
  }
  [...filtered].sort((a,b) => b.savedAt - a.savedAt).forEach(item => {
    list.appendChild(buildJavCard(item, () => {
      saveJavCodes(javCodes.filter(c => !(c.code===item.code && (c.tag||"")===(item.tag||""))));
      renderJavTabs(); renderJav();
    }));
  });
}

// ── TABS ──────────────────────────────────────────────────────────
function getMangaTabs() {
  const set = new Set(mangaCodes.map(c => c.tag||""));
  mangaTags.forEach(t => set.add(t));
  const named = [...set].filter(t => t!=="").sort();
  return ["all", ...named, ...(mangaCodes.some(c=>!c.tag) ? [""] : [])];
}
function getJavTabs() {
  const set = new Set(javCodes.map(c => c.tag||""));
  javTags.forEach(t => set.add(t));
  const named = [...set].filter(t => t!=="").sort();
  return ["all", ...named, ...(javCodes.some(c=>!c.tag) ? [""] : [])];
}
function renderTabs(navId, tabs, activeTab, setActive, afterClick) {
  const nav = document.getElementById(navId); nav.innerHTML = "";
  tabs.forEach(tab => {
    const btn = document.createElement("button");
    btn.className = "tab" + (tab === activeTab ? " active" : "");
    btn.textContent = tab === "all" ? "All" : tab === "" ? "Untagged" : `#${tab}`;
    btn.addEventListener("click", () => { setActive(tab); renderTabs(navId, tabs, tab, setActive, afterClick); afterClick(); });
    nav.appendChild(btn);
  });
}
function renderMangaTabs() { renderTabs("manga-tab-nav", getMangaTabs(), activeMangaTab, t=>{activeMangaTab=t;}, renderManga); }
function renderJavTabs()   { renderTabs("jav-tab-nav",   getJavTabs(),   activeJavTab,   t=>{activeJavTab=t;},   renderJav);   }

// ── SETTINGS ──────────────────────────────────────────────────────
function renderTagChips(ulId, tags, onDelete) {
  const ul = document.getElementById(ulId); ul.innerHTML = "";
  if (!tags.length) {
    const li = document.createElement("li");
    li.style.cssText = "color:var(--muted);font-size:11px;border:none;background:none;padding:4px 0";
    li.textContent = "No tags yet."; ul.appendChild(li); return;
  }
  tags.forEach(tag => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="chip-hash">#</span>${tag}`;
    const btn = document.createElement("button"); btn.className = "btn-del-tag"; btn.textContent = "×";
    btn.addEventListener("click", () => onDelete(tag));
    li.appendChild(btn); ul.appendChild(li);
  });
}
function setupSettings() {
  const btn   = document.getElementById("btn-settings");
  const panel = document.getElementById("settings-panel");
  btn.addEventListener("click", () => panel.classList.toggle("hidden"));

  const addMT = () => {
    const inp = document.getElementById("input-manga-tag");
    const raw = inp.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
    if (!raw || raw==="all" || mangaTags.includes(raw)) { inp.value=""; return; }
    saveMangaTags([...mangaTags, raw]); inp.value="";
    renderTagChips("manga-tag-list", mangaTags, deleteMangaTag); renderMangaTabs();
  };
  document.getElementById("btn-add-manga-tag").addEventListener("click", addMT);
  document.getElementById("input-manga-tag").addEventListener("keydown", e => e.key==="Enter" && addMT());

  const addJT = () => {
    const inp = document.getElementById("input-jav-tag");
    const raw = inp.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
    if (!raw || raw==="all" || javTags.includes(raw)) { inp.value=""; return; }
    saveJavTags([...javTags, raw]); inp.value="";
    renderTagChips("jav-tag-list", javTags, deleteJavTag); renderJavTabs();
  };
  document.getElementById("btn-add-jav-tag").addEventListener("click", addJT);
  document.getElementById("input-jav-tag").addEventListener("keydown", e => e.key==="Enter" && addJT());
}
function deleteMangaTag(tag) {
  saveMangaTags(mangaTags.filter(t=>t!==tag));
  renderTagChips("manga-tag-list", mangaTags, deleteMangaTag); renderMangaTabs(); renderManga();
}
function deleteJavTag(tag) {
  saveJavTags(javTags.filter(t=>t!==tag));
  renderTagChips("jav-tag-list", javTags, deleteJavTag); renderJavTabs(); renderJav();
}

// ── SECTION TOGGLE ────────────────────────────────────────────────
function setupSections() {
  document.querySelectorAll(".sec-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const sec = btn.dataset.sec;
      if (sec === activeSection) return;
      activeSection = sec;
      document.querySelectorAll(".sec-btn").forEach(b => b.classList.toggle("active", b.dataset.sec===sec));
      document.getElementById("section-manga").classList.toggle("hidden", sec!=="manga");
      document.getElementById("section-jav").classList.toggle("hidden",   sec!=="jav");
    });
  });
}

// ── EDIT MODAL ────────────────────────────────────────────────────
function openEditModal({ type, item }) {
  editModalItem = { type, item };

  // Fill header info
  document.getElementById("edit-modal-code").textContent = item.code;
  const tagEl = document.getElementById("edit-modal-tag");
  if (item.tag) {
    tagEl.textContent  = `#${item.tag}`;
    tagEl.className    = `code-tag ${type}-tag`;
    tagEl.style.display = "";
  } else {
    tagEl.style.display = "none";
  }

  // Fill description
  document.getElementById("edit-description").value = item.description || "";

  // Build rating widget
  const ratingEl = document.getElementById("edit-rating-widget");
  ratingEl.innerHTML = "";
  ratingEl.className = "star-rating lg";
  editRatingCtrl = StarRating(ratingEl, { value: item.rating || 0 });

  document.getElementById("edit-modal").classList.remove("hidden");
  document.getElementById("edit-description").focus();
}

function closeEditModal() {
  document.getElementById("edit-modal").classList.add("hidden");
  editModalItem  = null;
  editRatingCtrl = null;
}

function saveEditModal() {
  if (!editModalItem) return;
  const desc   = document.getElementById("edit-description").value.trim() || null;
  const rating = editRatingCtrl ? (editRatingCtrl.getValue() || null) : null;
  const { type, item } = editModalItem;

  if (type === "manga") {
    const idx = mangaCodes.findIndex(c => c.code===item.code && (c.tag||"")===(item.tag||""));
    if (idx !== -1) { mangaCodes[idx].description = desc; mangaCodes[idx].rating = rating; }
    saveMangaCodes(mangaCodes);
    renderManga();
  } else {
    const idx = javCodes.findIndex(c => c.code===item.code && (c.tag||"")===(item.tag||""));
    if (idx !== -1) { javCodes[idx].description = desc; javCodes[idx].rating = rating; }
    saveJavCodes(javCodes);
    renderJav();
  }
  closeEditModal();
}

function setupEditModal() {
  document.getElementById("edit-modal-close").addEventListener("click",  closeEditModal);
  document.getElementById("edit-modal-cancel").addEventListener("click", closeEditModal);
  document.getElementById("edit-modal-save").addEventListener("click",   saveEditModal);
  // Close on overlay click
  document.getElementById("edit-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("edit-modal")) closeEditModal();
  });
}

// ── SHARE MODE ────────────────────────────────────────────────────
function enterShareMode() {
  shareMode = true;
  selectedItems.clear();
  document.body.classList.add("share-mode");
  document.getElementById("share-bar").classList.remove("hidden");
  document.getElementById("btn-share").classList.add("share-active");
  updateShareBar();
  // Close settings panel if open
  document.getElementById("settings-panel").classList.add("hidden");
  // Re-render so checkboxes appear
  renderManga(); renderJav();
}

function exitShareMode() {
  shareMode = false;
  selectedItems.clear();
  document.body.classList.remove("share-mode");
  document.getElementById("share-bar").classList.add("hidden");
  document.getElementById("btn-share").classList.remove("share-active");
  renderManga(); renderJav();
}

function setupShareMode() {
  document.getElementById("btn-share").addEventListener("click", () => {
    if (shareMode) exitShareMode(); else enterShareMode();
  });
  document.getElementById("btn-cancel-share").addEventListener("click", exitShareMode);
  document.getElementById("btn-do-share").addEventListener("click", exportZip);
}

// ── EXPORT ZIP ────────────────────────────────────────────────────
async function exportZip() {
  if (!selectedItems.size) return;

  const btn = document.getElementById("btn-do-share");
  btn.disabled = true;
  btn.textContent = "Packing…";

  try {
    const zip      = new JSZip();
    const thumbsF  = zip.folder("thumbs");
    const mangaOut = [];
    const javOut   = [];
    const cache    = await getMetaCache();

    for (const key of selectedItems) {
      const [type, code, tag] = key.split("|");

      if (type === "manga") {
        const item = mangaCodes.find(c => c.code===code && (c.tag||"")===(tag||""));
        if (!item) continue;
        const meta = cache[code];
        mangaOut.push({
          code:        item.code,
          tag:         item.tag  || "",
          description: item.description || null,
          rating:      item.rating || null,
          title:       meta?.title || null,
          thumbUrl:    meta?.thumb || null,
          savedAt:     item.savedAt
        });

      } else if (type === "jav") {
        const item = javCodes.find(c => c.code===code && (c.tag||"")===(tag||""));
        if (!item) continue;
        let thumbFile = null;
        if (item.thumb) {
          const m = item.thumb.match(/^data:([^;]+);base64,(.+)$/);
          if (m) {
            const ext      = m[1].split("/")[1] || "jpg";
            const safeName = `jav_${item.code.replace(/[^a-zA-Z0-9-]/g,"_")}.${ext}`;
            thumbsF.file(safeName, m[2], { base64: true });
            thumbFile = `thumbs/${safeName}`;
          }
        }
        javOut.push({
          code:        item.code,
          tag:         item.tag  || "",
          description: item.description || null,
          rating:      item.rating || null,
          thumbFile,
          savedAt:     item.savedAt
        });
      }
    }

    zip.file("manifest.json", JSON.stringify({ version:"1.0", source:"FindManga", exportedAt: new Date().toISOString() }, null, 2));
    zip.file("data.json",     JSON.stringify({ manga: mangaOut, jav: javOut }, null, 2));

    const blob = await zip.generateAsync({ type:"blob", compression:"DEFLATE", compressionOptions:{ level:6 } });
    const ts   = new Date().toISOString().replace(/[:.]/g,"-").slice(0,19);
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `findmanga-${ts}.zip`; a.click();
    URL.revokeObjectURL(url);
    exitShareMode();

  } catch(err) {
    console.error("Export failed:", err);
    btn.textContent = "Export ZIP";
    btn.disabled = false;
  }
}

// ── IMPORT MODAL ──────────────────────────────────────────────────
function setupImportModal() {
  document.getElementById("btn-import").addEventListener("click", openImportModal);
  document.getElementById("import-modal-close").addEventListener("click", closeImportModal);
  document.getElementById("import-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("import-modal")) closeImportModal();
  });
  document.getElementById("conflict-modal-close").addEventListener("click", closeConflictModal);
  document.getElementById("conflict-modal").addEventListener("click", e => {
    if (e.target === document.getElementById("conflict-modal")) closeConflictModal();
  });
  document.getElementById("conflict-cancel").addEventListener("click", closeConflictModal);
}

function openImportModal() {
  const body = document.getElementById("import-modal-body");
  body.innerHTML = "";

  // Build drop zone
  const zone = document.createElement("div");
  zone.className = "import-drop-zone";
  zone.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <polyline points="7 10 12 15 17 10"/>
      <line x1="12" y1="15" x2="12" y2="3"/>
    </svg>
    <p>Drop your <strong>.zip</strong> file here</p>
    <small>or click to browse</small>
    <input type="file" id="import-file-input" accept=".zip">
  `;

  zone.addEventListener("click", () => zone.querySelector("input").click());
  zone.addEventListener("dragover", e => { e.preventDefault(); zone.classList.add("drag-over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", e => {
    e.preventDefault(); zone.classList.remove("drag-over");
    const f = e.dataTransfer.files[0];
    if (f) handleZipImport(f, body);
  });
  zone.querySelector("input").addEventListener("change", e => {
    const f = e.target.files[0];
    if (f) handleZipImport(f, body);
  });

  body.appendChild(zone);
  document.getElementById("import-modal").classList.remove("hidden");
}

function closeImportModal() {
  document.getElementById("import-modal").classList.add("hidden");
}

function closeConflictModal() {
  document.getElementById("conflict-modal").classList.add("hidden");
}

// ── ZIP IMPORT ────────────────────────────────────────────────────
async function handleZipImport(file, modalBody) {
  // Show loading
  modalBody.innerHTML = `<div class="import-drop-zone" style="pointer-events:none">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="animation:shimmer 1.5s infinite">
      <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0"/>
    </svg>
    <p>Reading file…</p>
  </div>`;

  try {
    const zip = await JSZip.loadAsync(file);

    const manifestFile = zip.file("manifest.json");
    if (!manifestFile) throw new Error("Not a valid FindManga export (manifest.json missing).");
    const manifest = JSON.parse(await manifestFile.async("string"));
    if (manifest.source !== "FindManga") throw new Error("File was not exported by FindManga.");

    const dataFile = zip.file("data.json");
    if (!dataFile) throw new Error("data.json missing from archive.");
    const { manga = [], jav = [] } = JSON.parse(await dataFile.async("string"));

    // Resolve JAV thumbnails from archive
    const resolvedJav = await Promise.all(jav.map(async item => {
      if (item.thumbFile) {
        const tf = zip.file(item.thumbFile);
        if (tf) {
          const b64 = await tf.async("base64");
          const ext = item.thumbFile.split(".").pop().toLowerCase();
          const mime = { jpg:"image/jpeg", jpeg:"image/jpeg", png:"image/png", webp:"image/webp" }[ext] || "image/jpeg";
          return { ...item, thumb: `data:${mime};base64,${b64}` };
        }
      }
      return { ...item, thumb: null };
    }));

    // Show preview + detect conflicts
    showImportPreview(modalBody, manga, resolvedJav);

  } catch(err) {
    modalBody.innerHTML = `<div class="import-drop-zone" style="pointer-events:none; border-color:var(--sakura)">
      <p style="color:var(--sakura)">${err.message}</p>
      <small>Please drop a valid FindManga .zip export.</small>
    </div>`;
  }
}

function showImportPreview(modalBody, manga, jav) {
  const allItems = [
    ...manga.map(m => ({ ...m, _type:"manga" })),
    ...jav.map(j => ({ ...j, _type:"jmovie" }))
  ];

  if (!allItems.length) {
    modalBody.innerHTML = `<p style="color:var(--muted);font-size:13px;text-align:center;padding:24px 0">No items found in this file.</p>`;
    return;
  }

  // Detect conflicts
  const mangaConflicts = manga.filter(m => mangaCodes.some(c => c.code===m.code && (c.tag||"")===(m.tag||"")));
  const javConflicts   = jav.filter(j => javCodes.some(c => c.code===j.code && (c.tag||"")===(j.tag||"")));

  const totalConflicts = mangaConflicts.length + javConflicts.length;

  const newCount = allItems.length - totalConflicts;

  modalBody.innerHTML = "";

  const summary = document.createElement("p");
  summary.className = "import-summary";
  summary.innerHTML = `<strong>${allItems.length}</strong> item${allItems.length!==1?"s":""} found · <strong>${newCount}</strong> new`;
  if (totalConflicts) summary.innerHTML += ` · <strong style="color:var(--sakura)">${totalConflicts}</strong> duplicate${totalConflicts!==1?"s":""}`;
  modalBody.appendChild(summary);

  const list = document.createElement("ul"); list.className = "import-preview-list";
  allItems.forEach(item => {
    const li = document.createElement("li"); li.className = "import-preview-item";
    const typeTag = document.createElement("span"); typeTag.className = `ipi-type ${item._type}`; typeTag.textContent = item._type === "jmovie" ? "J-Movie" : "Manga";
    const code    = document.createElement("span"); code.className = "ipi-code"; code.textContent = item.code;
    const tag     = document.createElement("span"); tag.className = "ipi-tag";  tag.textContent = item.tag ? `#${item.tag}` : "";
    li.append(typeTag, code, tag);
    list.appendChild(li);
  });
  modalBody.appendChild(list);

  // Action button
  const footer = document.createElement("div");
  footer.style.cssText = "display:flex;justify-content:flex-end;gap:8px;padding-top:4px";
  const cancelBtn = document.createElement("button"); cancelBtn.className = "btn-modal-secondary"; cancelBtn.textContent = "Cancel";
  cancelBtn.addEventListener("click", closeImportModal);
  const importBtn = document.createElement("button"); importBtn.className = "btn-modal-primary";
  importBtn.textContent = totalConflicts ? `Review ${totalConflicts} duplicate${totalConflicts!==1?"s":""}…` : "Import All";
  importBtn.addEventListener("click", () => {
    if (totalConflicts) {
      closeImportModal();
      showConflictModal(manga, jav, mangaConflicts, javConflicts);
    } else {
      doImport(manga, jav, new Map());
      closeImportModal();
    }
  });
  footer.append(cancelBtn, importBtn);
  modalBody.appendChild(footer);
}

// ── CONFLICT MODAL ────────────────────────────────────────────────
// decisions: Map<key, "keep"|"replace">
function showConflictModal(manga, jav, mangaConflicts, javConflicts) {
  const body      = document.getElementById("conflict-modal-body");
  const decisions = new Map();
  body.innerHTML  = "";

  const info = document.createElement("p"); info.className = "conflict-info";
  info.innerHTML = `These codes already exist in your library. Choose what to do with each one.`;
  body.appendChild(info);

  const list = document.createElement("ul"); list.className = "conflict-list";

  const addConflictItem = (item, type) => {
    const key = itemKey(type, item.code, item.tag);
    decisions.set(key, "keep");   // default: keep old

    const li = document.createElement("li"); li.className = "conflict-item";
    const typeTag = document.createElement("span"); typeTag.className = `ipi-type ${type}`; typeTag.textContent = type === "jmovie" ? "J-Movie" : "Manga";
    const code    = document.createElement("span"); code.className = "ci-code"; code.textContent = item.code;
    const tag     = document.createElement("span"); tag.className  = "ci-tag";  tag.textContent = item.tag ? `#${item.tag}` : "";

    const toggle  = document.createElement("div"); toggle.className = "ci-toggle";
    const keepBtn = document.createElement("button"); keepBtn.textContent = "Keep old"; keepBtn.className = "active-keep";
    const replBtn = document.createElement("button"); replBtn.textContent = "Replace";

    keepBtn.addEventListener("click", () => {
      decisions.set(key, "keep");
      keepBtn.className = "active-keep"; replBtn.className = "";
    });
    replBtn.addEventListener("click", () => {
      decisions.set(key, "replace");
      replBtn.className = "active-replace"; keepBtn.className = "";
    });

    toggle.append(keepBtn, replBtn);
    li.append(typeTag, code, tag, toggle);
    list.appendChild(li);
  };

  mangaConflicts.forEach(m => addConflictItem(m, "manga"));
  javConflicts.forEach(j => addConflictItem(j, "jmovie"));
  body.appendChild(list);

  document.getElementById("conflict-confirm").onclick = () => {
    doImport(manga, jav, decisions);
    closeConflictModal();
  };

  document.getElementById("conflict-modal").classList.remove("hidden");
}

// ── DO IMPORT ────────────────────────────────────────────────────
async function doImport(manga, jav, decisions) {
  const newManga = [...mangaCodes];
  const newJav   = [...javCodes];
  const cache    = await getMetaCache();

  manga.forEach(m => {
    const key      = itemKey("manga", m.code, m.tag);
    const existing = newManga.findIndex(c => c.code===m.code && (c.tag||"")===(m.tag||""));

    if (existing !== -1) {
      if ((decisions.get(key) || "keep") === "replace") {
        newManga[existing] = { code:m.code, tag:m.tag||"", description:m.description||null, rating:m.rating||null, savedAt:m.savedAt||Date.now() };
      }
    } else {
      newManga.push({ code:m.code, tag:m.tag||"", description:m.description||null, rating:m.rating||null, savedAt:m.savedAt||Date.now() });
    }

    // Update meta cache with exported title + thumbUrl
    if (m.title || m.thumbUrl) {
      cache[m.code] = { title: m.title||null, thumb: m.thumbUrl||null, fetchedAt: Date.now() };
    }
  });

  jav.forEach(j => {
    const key      = itemKey("jav", j.code, j.tag);
    const existing = newJav.findIndex(c => c.code===j.code && (c.tag||"")===(j.tag||""));

    if (existing !== -1) {
      if ((decisions.get(key) || "keep") === "replace") {
        newJav[existing] = { code:j.code, tag:j.tag||"", thumb:j.thumb||null, description:j.description||null, rating:j.rating||null, savedAt:j.savedAt||Date.now() };
      }
    } else {
      newJav.push({ code:j.code, tag:j.tag||"", thumb:j.thumb||null, description:j.description||null, rating:j.rating||null, savedAt:j.savedAt||Date.now() });
    }
  });

  await setMetaCache(cache);
  saveMangaCodes(newManga);
  saveJavCodes(newJav);
  renderMangaTabs(); renderManga();
  renderJavTabs();   renderJav();
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadStorage(() => {
    setupSections();
    setupSettings();
    setupEditModal();
    setupShareMode();
    setupImportModal();
    renderTagChips("manga-tag-list", mangaTags, deleteMangaTag);
    renderTagChips("jav-tag-list",   javTags,   deleteJavTag);
    renderMangaTabs(); renderManga();
    renderJavTabs();   renderJav();
  });

  chrome.storage.onChanged.addListener(changes => {
    if (changes.javCodes) { javCodes = changes.javCodes.newValue || []; renderJavTabs(); renderJav(); }
  });
});
