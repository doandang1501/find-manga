const BASE_URL = "https://nhentai.website/g/";

function buildMenus(tags = []) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "find-manga",    title: "Find Manga", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "keep-looking",  parentId: "find-manga", title: "Keep looking",  contexts: ["selection"] });
    chrome.contextMenus.create({ id: "save-code",     parentId: "find-manga", title: "Save code",     contexts: ["selection"] });
    chrome.contextMenus.create({ id: "save-jav",      parentId: "find-manga", title: "Save JAV",      contexts: ["selection"] });

    // Save code sub-items
    // "Save anyway" = save with NO tag (appears in All only)
    chrome.contextMenus.create({ id: "save-anyway",   parentId: "save-code",  title: "Save anyway",   contexts: ["selection"] });
    chrome.contextMenus.create({ id: "save-by-tag",   parentId: "save-code",  title: "Save by tag",   contexts: ["selection"] });

    if (tags.length === 0) {
      chrome.contextMenus.create({ id: "no-tags", parentId: "save-by-tag", title: "(No tags — add via popup)", enabled: false, contexts: ["selection"] });
    } else {
      tags.forEach(tag =>
        chrome.contextMenus.create({ id: `tag:${tag}`, parentId: "save-by-tag", title: `#${tag}`, contexts: ["selection"] })
      );
    }
  });
}

function getTags(cb) {
  chrome.storage.local.get(["tags"], ({ tags = [] }) => cb(tags));
}

function validateCode(text) {
  return /^\d{6}$/.test((text || "").trim());
}

function alertBadCode(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => alert("FindManga: Please select exactly 6 digits.")
  });
}

function saveMangaCode(code, tag, tabId) {
  chrome.storage.local.get(["codes"], ({ codes = [] }) => {
    const exists = codes.some(c => c.code === code && c.tag === tag);
    if (!exists) {
      codes.push({ code, tag, savedAt: Date.now() });
      chrome.storage.local.set({ codes });
    }
    const label = tag ? `#${tag}` : "All (untagged)";
    chrome.scripting.executeScript({
      target: { tabId },
      func: (c, lbl, dup) => alert(`FindManga: ${dup ? "Already saved" : "Saved"} ${c} → ${lbl}`),
      args: [code, label, exists]
    });
  });
}

chrome.runtime.onInstalled.addListener(() => getTags(buildMenus));
chrome.runtime.onStartup.addListener(() => getTags(buildMenus));
chrome.storage.onChanged.addListener(changes => {
  if (changes.tags) buildMenus(changes.tags.newValue || []);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selected = (info.selectionText || "").trim();
  const id = info.menuItemId;

  if (id === "keep-looking") {
    if (!validateCode(selected)) { alertBadCode(tab.id); return; }
    chrome.tabs.create({ url: `${BASE_URL}${selected}` });
    return;
  }

  // "Save anyway" → tag: "" (no tag, appears in All)
  if (id === "save-anyway") {
    if (!validateCode(selected)) { alertBadCode(tab.id); return; }
    saveMangaCode(selected, "", tab.id);
    return;
  }

  if (id.startsWith("tag:")) {
    if (!validateCode(selected)) { alertBadCode(tab.id); return; }
    saveMangaCode(selected, id.slice(4), tab.id);
    return;
  }

  // Save JAV → open dedicated form window
  if (id === "save-jav") {
    const code = encodeURIComponent(selected);
    chrome.windows.create({
      url: chrome.runtime.getURL(`jav-form.html?code=${code}`),
      type: "popup",
      width: 520,
      height: 600,
      focused: true
    });
    return;
  }
});
