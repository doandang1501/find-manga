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
let ratingCtrl  = null;   // StarRating controller for the form

// ── STAR RATING ───────────────────────────────────────────────────
function StarRating(container, opts = {}) {
  let value  = opts.value  || 0;
  const MAX  = 10;
  const onChange = opts.onChange || (() => {});

  function render(display) {
    container.innerHTML = "";
    for (let i = 1; i <= MAX; i++) {
      const ico = document.createElement("span");
      ico.className = "star-ico";
      ico.textContent = "★";   // direct text node — color on element is always reliable
      const fill = display - (i - 1);
      if (fill >= 1)        ico.classList.add("full");
      else if (fill >= 0.5) ico.classList.add("half");

      const lh = document.createElement("b"); lh.className = "sh l"; lh.dataset.v = (i - 0.5).toString();
      const rh = document.createElement("b"); rh.className = "sh r"; rh.dataset.v = i.toString();
      ico.append(lh, rh);
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

  return { getValue: () => value, setValue: v => { value = v; render(v); } };
}

// ── INIT ─────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const params  = new URLSearchParams(window.location.search);
  const preCode = params.get("code") || "";
  if (preCode) document.getElementById("input-code").value = preCode;

  chrome.storage.local.get(["javTags"], ({ javTags = [] }) => {
    const sel = document.getElementById("select-tag");
    javTags.forEach(tag => {
      const opt = document.createElement("option");
      opt.value = tag; opt.textContent = `#${tag}`;
      sel.appendChild(opt);
    });
  });

  setupPasteZone();
  ratingCtrl = StarRating(document.getElementById("rating-widget"));
  setupButtons();
});

// ── PASTE ZONE ────────────────────────────────────────────────────
function setupPasteZone() {
  const zone    = document.getElementById("paste-zone");
  const ph      = document.getElementById("paste-placeholder");
  const preview = document.getElementById("thumb-preview");
  const clearBtn= document.getElementById("btn-clear-thumb");

  zone.focus();
  document.addEventListener("paste", handlePaste);
  zone.addEventListener("paste", handlePaste);

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
    showToast("Movie code is required.", "error");
    document.getElementById("input-code").focus();
    return;
  }

  const newTag = document.getElementById("input-new-tag").value.trim()
    .toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const selTag = document.getElementById("select-tag").value;
  const tag    = newTag || selTag || "";

  const description = document.getElementById("input-description").value.trim() || null;
  const rating      = ratingCtrl ? (ratingCtrl.getValue() || null) : null;

  chrome.storage.local.get(["javCodes", "javTags"], ({ javCodes = [], javTags = [] }) => {
    const exists = javCodes.some(c => c.code === code && (c.tag || "") === tag);

    if (!exists) {
      javCodes.push({ code, tag, thumb: thumbBase64 || null, description, rating, savedAt: Date.now() });
      chrome.storage.local.set({ javCodes });
    }

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
  if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); }
  t.textContent = msg;
  t.className   = `toast ${type}`;
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add("show")));
  setTimeout(() => t.classList.remove("show"), 1800);
}
