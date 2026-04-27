// ── FULL HEIGHT ───────────────────────────────────────────────────
// Strategy:
//   1. Sync pass: set body to screen.availHeight-90 so the browser renders
//      the popup at maximum height on first paint (avoids visible grow).
//   2. rAF pass: clamp to window.innerHeight (the true popup viewport after
//      the browser has capped it). This prevents body > viewport, which
//      would make <html> scrollable and cause the header to scroll away.
(function initHeight() {
  const MAX            = 900;
  const CHROME_TOOLBAR = 90;
  // First pass — opens popup at full height
  document.body.style.height = Math.min(screen.availHeight - CHROME_TOOLBAR, MAX) + "px";
  // Second pass — clamp to real viewport so html never overflows
  requestAnimationFrame(() => {
    const real = window.innerHeight;
    if (real > 0) document.body.style.height = real + "px";
  });
})();

// ── AUTO THEME (time-based) ───────────────────────────────────────
// Day  06:00–19:59 → light   |   Night 20:00–05:59 → dark
(function initTheme() {
  function apply() {
    const h = new Date().getHours();
    document.documentElement.dataset.theme = (h >= 6 && h < 20) ? "light" : "dark";
  }
  apply();
  // Fire again at the boundary of every new hour
  (function scheduleHourly() {
    const now = new Date();
    const msToNextHour = (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1_000;
    setTimeout(() => { apply(); scheduleHourly(); }, msToNextHour);
  })();
})();

const BASE_URL  = "https://nhentai.website/g/";
const META_TTL  = 7 * 24 * 60 * 60 * 1000;

let mangaCodes  = [];
let javCodes    = [];
let mangaTags   = [];
let javTags     = [];
let activeMangaTab = "all";
let activeJavTab   = "all";
let activeSection  = "manga";

// ── STORAGE ──────────────────────────────────────────────────────
function loadStorage(cb) {
  chrome.storage.local.get(["codes", "javCodes", "tags", "javTags"], data => {
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

// ── META FETCH (Manga) ────────────────────────────────────────────
function extractImgUrl(el, base) {
  if (!el) return null;
  const attrs = ["data-src","data-lazy-src","data-original","data-lazy","data-url","src"];
  for (const a of attrs) {
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
    const html = await resp.text();
    const doc  = new DOMParser().parseFromString(html, "text/html");

    const titleEl = doc.querySelector("#info h1 .pretty") || doc.querySelector("#info h1") ||
                    doc.querySelector("h1.title .pretty")  || doc.querySelector("h1.title") ||
                    doc.querySelector("h1");
    const title = titleEl?.textContent?.trim() || null;

    const imgEl = doc.querySelector("#cover img") || doc.querySelector("img#cover-img") ||
                  doc.querySelector(".cover img")  || doc.querySelector("[class*='cover'] img") ||
                  doc.querySelector("img[itemprop='image']") ||
                  Array.from(doc.querySelectorAll("img")).find(el => {
                    const s = el.getAttribute("data-src") || el.getAttribute("src") || "";
                    return s && !s.startsWith("data:") && /galleries|cover|thumb/i.test(s);
                  });
    const thumb = extractImgUrl(imgEl, "https://nhentai.website");

    const meta = { title, thumb, fetchedAt: Date.now() };
    cache[code] = meta;
    await setMetaCache(cache);
    return meta;
  } catch {
    return { title: null, thumb: null, fetchedAt: Date.now() };
  }
}

// ── SVG ICONS ────────────────────────────────────────────────────
const ICO_OPEN  = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`;
const ICO_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
const ICO_IMG   = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
const ICO_EMPTY = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;

// ── MANGA CARD ────────────────────────────────────────────────────
function buildMangaCard(item, onDelete) {
  const card = document.createElement("div");
  card.className = "code-card";

  // Thumb
  const tw = document.createElement("div");
  tw.className = "card-thumb-wrap";
  const ph = document.createElement("div");
  ph.className = "card-thumb-placeholder skeleton";
  ph.innerHTML = ICO_IMG;
  tw.appendChild(ph);

  // Body
  const body   = document.createElement("div"); body.className = "card-body";
  const top    = document.createElement("div"); top.className = "card-top";
  const num    = document.createElement("span"); num.className = "code-num"; num.textContent = item.code;
  const badge  = document.createElement("span");

  if (item.tag) {
    badge.className = "code-tag manga-tag";
    badge.textContent = `#${item.tag}`;
  } else {
    badge.className = "code-tag no-tag";
    badge.textContent = "untagged";
  }

  top.appendChild(num);
  top.appendChild(badge);

  const title   = document.createElement("p");
  title.className = "code-title loading skeleton";

  const footer  = document.createElement("div"); footer.className = "card-footer";
  const actions = document.createElement("div"); actions.className = "code-actions";

  const btnO = document.createElement("button"); btnO.className = "btn-open"; btnO.title = "Open manga"; btnO.innerHTML = ICO_OPEN;
  btnO.addEventListener("click", () => chrome.tabs.create({ url: `${BASE_URL}${item.code}` }));

  const btnD = document.createElement("button"); btnD.className = "btn-delete"; btnD.title = "Remove"; btnD.innerHTML = ICO_TRASH;
  btnD.addEventListener("click", onDelete);

  actions.append(btnO, btnD);
  footer.appendChild(actions);
  body.append(top, title, footer);
  card.append(tw, body);

  fetchMeta(item.code).then(meta => {
    title.classList.remove("loading","skeleton");
    if (meta.title) { title.textContent = meta.title; }
    else            { title.textContent = "Title unavailable"; title.classList.add("unavailable"); }

    if (meta.thumb) {
      const img = document.createElement("img");
      img.className = "card-thumb";
      img.alt = meta.title || item.code;
      img.src = meta.thumb;
      img.onload  = () => ph.replaceWith(img);
      img.onerror = () => { ph.classList.remove("skeleton"); ph.innerHTML = ICO_IMG; };
    } else {
      ph.classList.remove("skeleton");
    }
  });

  return card;
}

// ── JAV CARD ─────────────────────────────────────────────────────
function buildJavCard(item, onDelete) {
  const card = document.createElement("div");
  card.className = "jav-card";

  // Thumb
  const tw = document.createElement("div");
  tw.className = "jav-thumb-wrap";

  if (item.thumb) {
    const img = document.createElement("img");
    img.className = "jav-thumb";
    img.src = item.thumb;
    img.alt = item.code;
    tw.appendChild(img);
  } else {
    const ph = document.createElement("div");
    ph.className = "jav-thumb-placeholder";
    ph.innerHTML = ICO_IMG;
    tw.appendChild(ph);
  }

  // Body
  const body   = document.createElement("div"); body.className = "card-body";
  const top    = document.createElement("div"); top.className = "card-top";
  const num    = document.createElement("span"); num.className = "code-num"; num.textContent = item.code;

  top.appendChild(num);

  if (item.tag) {
    const badge = document.createElement("span");
    badge.className = "code-tag jav-tag";
    badge.textContent = `#${item.tag}`;
    top.appendChild(badge);
  }

  const footer  = document.createElement("div"); footer.className = "card-footer";
  const actions = document.createElement("div"); actions.className = "code-actions";

  const btnD = document.createElement("button"); btnD.className = "btn-delete"; btnD.title = "Remove"; btnD.innerHTML = ICO_TRASH;
  btnD.addEventListener("click", onDelete);

  actions.appendChild(btnD);
  footer.appendChild(actions);
  body.append(top, footer);
  card.append(tw, body);
  return card;
}

// ── RENDER ────────────────────────────────────────────────────────
function renderManga() {
  const list = document.getElementById("manga-code-list");
  list.innerHTML = "";

  const filtered = activeMangaTab === "all"
    ? mangaCodes
    : mangaCodes.filter(c => (c.tag || "") === activeMangaTab);

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
    : javCodes.filter(c => (c.tag || "") === activeJavTab);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state">${ICO_EMPTY}<span>No JAV codes saved yet.<br>Right-click any text → Find Manga → Save JAV.</span></div>`;
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
  const set = new Set(mangaCodes.map(c => c.tag || ""));
  mangaTags.forEach(t => set.add(t));
  const named = [...set].filter(t => t !== "").sort();
  const hasUntagged = mangaCodes.some(c => !c.tag);
  return ["all", ...named, ...(hasUntagged ? [""] : [])];
}

function getJavTabs() {
  const set = new Set(javCodes.map(c => c.tag || ""));
  javTags.forEach(t => set.add(t));
  const named = [...set].filter(t => t !== "").sort();
  const hasUntagged = javCodes.some(c => !c.tag);
  return ["all", ...named, ...(hasUntagged ? [""] : [])];
}

function renderTabs(navId, tabs, activeTab, setActive, afterClick) {
  const nav = document.getElementById(navId);
  nav.innerHTML = "";
  tabs.forEach(tab => {
    const btn = document.createElement("button");
    btn.className = "tab" + (tab === activeTab ? " active" : "");
    btn.textContent = tab === "all" ? "All" : tab === "" ? "Untagged" : `#${tab}`;
    btn.addEventListener("click", () => { setActive(tab); renderTabs(navId, tabs, tab, setActive, afterClick); afterClick(); });
    nav.appendChild(btn);
  });
}

function renderMangaTabs() {
  renderTabs("manga-tab-nav", getMangaTabs(), activeMangaTab,
    t => { activeMangaTab = t; }, renderManga);
}
function renderJavTabs() {
  renderTabs("jav-tab-nav", getJavTabs(), activeJavTab,
    t => { activeJavTab = t; }, renderJav);
}

// ── SETTINGS ─────────────────────────────────────────────────────
function renderTagChips(ulId, tags, onDelete) {
  const ul = document.getElementById(ulId);
  ul.innerHTML = "";
  if (!tags.length) {
    const li = document.createElement("li");
    li.style.cssText = "color:var(--muted);font-size:11px;border:none;background:none;padding:4px 0";
    li.textContent = "No tags yet.";
    ul.appendChild(li);
    return;
  }
  tags.forEach(tag => {
    const li  = document.createElement("li");
    li.innerHTML = `<span class="chip-hash">#</span>${tag}`;
    const btn = document.createElement("button");
    btn.className = "btn-del-tag";
    btn.textContent = "×";
    btn.addEventListener("click", () => onDelete(tag));
    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function setupSettings() {
  const btn   = document.getElementById("btn-settings");
  const panel = document.getElementById("settings-panel");
  btn.addEventListener("click", () => panel.classList.toggle("hidden"));

  // Manga tag add
  const addMT = () => {
    const inp = document.getElementById("input-manga-tag");
    const raw = inp.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
    if (!raw || raw==="all" || mangaTags.includes(raw)) { inp.value=""; return; }
    saveMangaTags([...mangaTags, raw]);
    inp.value = "";
    renderTagChips("manga-tag-list", mangaTags, deleteMangaTag);
    renderMangaTabs();
  };
  document.getElementById("btn-add-manga-tag").addEventListener("click", addMT);
  document.getElementById("input-manga-tag").addEventListener("keydown", e => e.key==="Enter" && addMT());

  // JAV tag add
  const addJT = () => {
    const inp = document.getElementById("input-jav-tag");
    const raw = inp.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g,"");
    if (!raw || raw==="all" || javTags.includes(raw)) { inp.value=""; return; }
    saveJavTags([...javTags, raw]);
    inp.value = "";
    renderTagChips("jav-tag-list", javTags, deleteJavTag);
    renderJavTabs();
  };
  document.getElementById("btn-add-jav-tag").addEventListener("click", addJT);
  document.getElementById("input-jav-tag").addEventListener("keydown", e => e.key==="Enter" && addJT());
}

function deleteMangaTag(tag) {
  saveMangaTags(mangaTags.filter(t => t!==tag));
  renderTagChips("manga-tag-list", mangaTags, deleteMangaTag);
  renderMangaTabs(); renderManga();
}
function deleteJavTag(tag) {
  saveJavTags(javTags.filter(t => t!==tag));
  renderTagChips("jav-tag-list", javTags, deleteJavTag);
  renderJavTabs(); renderJav();
}

// ── SECTION TOGGLE ────────────────────────────────────────────────
function setupSections() {
  document.querySelectorAll(".sec-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const sec = btn.dataset.sec;
      if (sec === activeSection) return;
      activeSection = sec;
      document.querySelectorAll(".sec-btn").forEach(b => b.classList.toggle("active", b.dataset.sec === sec));
      document.getElementById("section-manga").classList.toggle("hidden", sec !== "manga");
      document.getElementById("section-jav").classList.toggle("hidden",   sec !== "jav");
    });
  });
}

// ── INIT ──────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadStorage(() => {
    setupSections();
    setupSettings();
    renderTagChips("manga-tag-list", mangaTags, deleteMangaTag);
    renderTagChips("jav-tag-list",   javTags,   deleteJavTag);
    renderMangaTabs(); renderManga();
    renderJavTabs();   renderJav();
  });

  // Live reload when JAV form saves a new entry
  chrome.storage.onChanged.addListener(changes => {
    if (changes.javCodes) {
      javCodes = changes.javCodes.newValue || [];
      renderJavTabs(); renderJav();
    }
  });
});
