// ── AUTO THEME ────────────────────────────────────────────────────
(function initTheme() {
  function apply() {
    const h = new Date().getHours();
    document.documentElement.dataset.theme = (h >= 6 && h < 20) ? "light" : "dark";
  }
  apply();
  (function scheduleHourly() {
    const now = new Date();
    const ms = (60 - now.getMinutes()) * 60_000 - now.getSeconds() * 1_000;
    setTimeout(() => { apply(); scheduleHourly(); }, ms);
  })();
})();

let thumbBase64 = null;

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Pre-fill code from URL param
  const params = new URLSearchParams(window.location.search);
  const preCode = params.get("code") || "";
  if (preCode) document.getElementById("input-code").value = preCode;

  // Load existing JAV tags into select
  chrome.storage.local.get(["javTags"], ({ javTags = [] }) => {
    const sel = document.getElementById("select-tag");
    javTags.forEach(tag => {
      const opt = document.createElement("option");
      opt.value = tag;
      opt.textContent = `#${tag}`;
      sel.appendChild(opt);
    });
  });

  setupPasteZone();
  setupButtons();
});

// ── PASTE ZONE ────────────────────────────────────────────────────
function setupPasteZone() {
  const zone    = document.getElementById("paste-zone");
  const ph      = document.getElementById("paste-placeholder");
  const preview = document.getElementById("thumb-preview");
  const clearBtn= document.getElementById("btn-clear-thumb");

  // Focus paste zone so Ctrl+V works without clicking first
  zone.focus();

  // Paste anywhere on the page
  document.addEventListener("paste", handlePaste);
  zone.addEventListener("paste",     handlePaste);

  function handlePaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        const reader = new FileReader();
        reader.onload = ev => {
          thumbBase64 = ev.target.result;
          preview.src = thumbBase64;
          preview.classList.remove("hidden");
          ph.classList.add("hidden");
          clearBtn.classList.remove("hidden");
          zone.classList.add("has-image");
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  }

  clearBtn.addEventListener("click", e => {
    e.stopPropagation();
    thumbBase64 = null;
    preview.src = "";
    preview.classList.add("hidden");
    ph.classList.remove("hidden");
    clearBtn.classList.add("hidden");
    zone.classList.remove("has-image");
  });
}

// ── BUTTONS ───────────────────────────────────────────────────────
function setupButtons() {
  document.getElementById("btn-close").addEventListener("click",  () => window.close());
  document.getElementById("btn-cancel").addEventListener("click", () => window.close());
  document.getElementById("btn-save").addEventListener("click",   saveJav);
}

function saveJav() {
  const code = document.getElementById("input-code").value.trim();
  if (!code) {
    showToast("JAV code is required.", "error");
    document.getElementById("input-code").focus();
    return;
  }

  // Resolve tag: prefer new tag input, fall back to select
  const newTag = document.getElementById("input-new-tag").value.trim()
    .toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const selTag = document.getElementById("select-tag").value;
  const tag    = newTag || selTag || "";

  chrome.storage.local.get(["javCodes", "javTags"], ({ javCodes = [], javTags = [] }) => {
    const exists = javCodes.some(c => c.code === code && (c.tag||"") === tag);

    if (!exists) {
      javCodes.push({
        code,
        tag,
        thumb: thumbBase64 || null,
        savedAt: Date.now()
      });
      chrome.storage.local.set({ javCodes });
    }

    // If new tag was entered, persist it
    if (newTag && !javTags.includes(newTag)) {
      javTags.push(newTag);
      chrome.storage.local.set({ javTags });
    }

    const label = tag ? `#${tag}` : "All (untagged)";
    showToast(
      exists ? `Already saved: ${code}` : `Saved ${code} → ${label}`,
      exists ? "error" : "success"
    );
    setTimeout(() => window.close(), 900);
  });
}

// ── TOAST ─────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  let t = document.querySelector(".toast");
  if (!t) {
    t = document.createElement("div");
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.className   = `toast ${type}`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add("show"));
  });
  setTimeout(() => t.classList.remove("show"), 1800);
}
