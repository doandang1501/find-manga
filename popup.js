const BASE_URL = "https://nhentai.website/g/";

let allCodes = [];
let userTags = [];
let activeTab = "all";

// ── STORAGE HELPERS ──────────────────────────────────────────────
function loadStorage(cb) {
  chrome.storage.local.get(["codes", "tags"], ({ codes = [], tags = [] }) => {
    allCodes = codes;
    userTags = tags;
    cb();
  });
}

function saveTags(tags) {
  userTags = tags;
  chrome.storage.local.set({ tags });
}

function saveCodes(codes) {
  allCodes = codes;
  chrome.storage.local.set({ codes });
}

// ── TAB NAV ──────────────────────────────────────────────────────
function getAllTabs() {
  const tagSet = new Set(allCodes.map(c => c.tag));
  userTags.forEach(t => tagSet.add(t));
  tagSet.add("anyway");
  const sorted = ["all", ...Array.from(tagSet).filter(t => t !== "anyway").sort(), "anyway"];
  return sorted;
}

function renderTabs() {
  const nav = document.getElementById("tab-nav");
  const tabs = getAllTabs();
  nav.innerHTML = "";

  tabs.forEach(tab => {
    const btn = document.createElement("button");
    btn.className = "tab" + (tab === activeTab ? " active" : "");
    btn.textContent = tab === "all" ? "All" : `#${tab}`;
    btn.addEventListener("click", () => {
      activeTab = tab;
      renderTabs();
      renderCodes();
    });
    nav.appendChild(btn);
  });
}

// ── CODE LIST ─────────────────────────────────────────────────────
function getFilteredCodes() {
  if (activeTab === "all") return allCodes;
  return allCodes.filter(c => c.tag === activeTab);
}

function renderCodes() {
  const list = document.getElementById("code-list");
  const codes = getFilteredCodes();
  list.innerHTML = "";

  if (codes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = activeTab === "all"
      ? "No saved codes yet.\nHighlight a 6-digit number and use the right-click menu."
      : `No codes saved under #${activeTab}.`;
    list.appendChild(empty);
    return;
  }

  // Newest first
  [...codes].sort((a, b) => b.savedAt - a.savedAt).forEach(item => {
    const card = document.createElement("div");
    card.className = "code-card";

    const num = document.createElement("span");
    num.className = "code-num";
    num.textContent = item.code;

    const tag = document.createElement("span");
    tag.className = "code-tag";
    tag.textContent = `#${item.tag}`;

    const actions = document.createElement("div");
    actions.className = "code-actions";

    const btnOpen = document.createElement("button");
    btnOpen.className = "btn-open";
    btnOpen.title = "Open manga";
    btnOpen.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>`;
    btnOpen.addEventListener("click", () => {
      chrome.tabs.create({ url: `${BASE_URL}${item.code}` });
    });

    const btnDel = document.createElement("button");
    btnDel.className = "btn-delete";
    btnDel.title = "Remove";
    btnDel.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>`;
    btnDel.addEventListener("click", () => {
      const updated = allCodes.filter(c => !(c.code === item.code && c.tag === item.tag));
      saveCodes(updated);
      renderTabs();
      renderCodes();
    });

    actions.appendChild(btnOpen);
    actions.appendChild(btnDel);
    card.appendChild(num);
    card.appendChild(tag);
    card.appendChild(actions);
    list.appendChild(card);
  });
}

// ── SETTINGS PANEL ────────────────────────────────────────────────
function renderTagList() {
  const ul = document.getElementById("tag-list");
  ul.innerHTML = "";

  if (userTags.length === 0) {
    const li = document.createElement("li");
    li.style.color = "#555";
    li.style.fontSize = "12px";
    li.textContent = "No custom tags yet.";
    ul.appendChild(li);
    return;
  }

  userTags.forEach(tag => {
    const li = document.createElement("li");
    li.innerHTML = `<div><span>#</span>${tag}</div>`;

    const btn = document.createElement("button");
    btn.className = "btn-del-tag";
    btn.title = "Delete tag";
    btn.textContent = "×";
    btn.addEventListener("click", () => {
      const updated = userTags.filter(t => t !== tag);
      saveTags(updated);
      renderTagList();
      renderTabs();
      renderCodes();
    });

    li.appendChild(btn);
    ul.appendChild(li);
  });
}

function setupSettings() {
  const btn = document.getElementById("btn-settings");
  const panel = document.getElementById("settings-panel");

  btn.addEventListener("click", () => {
    panel.classList.toggle("hidden");
  });

  document.getElementById("btn-add-tag").addEventListener("click", addTag);
  document.getElementById("input-tag").addEventListener("keydown", e => {
    if (e.key === "Enter") addTag();
  });
}

function addTag() {
  const input = document.getElementById("input-tag");
  const raw = input.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!raw || raw === "anyway" || raw === "all" || userTags.includes(raw)) {
    input.value = "";
    return;
  }
  const updated = [...userTags, raw];
  saveTags(updated);
  input.value = "";
  renderTagList();
  renderTabs();
}

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadStorage(() => {
    setupSettings();
    renderTagList();
    renderTabs();
    renderCodes();
  });
});
