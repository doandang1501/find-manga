const BASE_URL = "https://nhentai.website/g/";

function buildMenus(tags = []) {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "find-manga",
      title: "Find Manga",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "keep-looking",
      parentId: "find-manga",
      title: "Keep looking",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "save-code",
      parentId: "find-manga",
      title: "Save code",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "save-anyway",
      parentId: "save-code",
      title: "Save anyway",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: "save-by-tag",
      parentId: "save-code",
      title: "Save by tag",
      contexts: ["selection"]
    });

    if (tags.length === 0) {
      chrome.contextMenus.create({
        id: "no-tags",
        parentId: "save-by-tag",
        title: "(No tags — add tags via extension popup)",
        enabled: false,
        contexts: ["selection"]
      });
    } else {
      tags.forEach(tag => {
        chrome.contextMenus.create({
          id: `tag:${tag}`,
          parentId: "save-by-tag",
          title: `#${tag}`,
          contexts: ["selection"]
        });
      });
    }
  });
}

function getTags(cb) {
  chrome.storage.local.get(["tags"], ({ tags = [] }) => cb(tags));
}

function saveCode(code, tag, tabId) {
  chrome.storage.local.get(["codes"], ({ codes = [] }) => {
    const exists = codes.some(c => c.code === code && c.tag === tag);
    if (!exists) {
      codes.push({ code, tag, savedAt: Date.now() });
      chrome.storage.local.set({ codes });
    }
    chrome.scripting.executeScript({
      target: { tabId },
      func: (c, t, dup) => alert(`FindManga: ${dup ? "Already saved" : "Saved"} ${c} → #${t}`),
      args: [code, tag, exists]
    });
  });
}

function validateCode(text) {
  return /^\d{6}$/.test((text || "").trim());
}

function alertInvalidCode(tabId) {
  chrome.scripting.executeScript({
    target: { tabId },
    func: () => alert("FindManga: Please select exactly 6 digits.")
  });
}

chrome.runtime.onInstalled.addListener(() => {
  getTags(buildMenus);
});

chrome.runtime.onStartup.addListener(() => {
  getTags(buildMenus);
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.tags) {
    buildMenus(changes.tags.newValue || []);
  }
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const selected = (info.selectionText || "").trim();
  const id = info.menuItemId;

  if (id === "keep-looking") {
    if (!validateCode(selected)) { alertInvalidCode(tab.id); return; }
    chrome.tabs.create({ url: `${BASE_URL}${selected}` });
    return;
  }

  if (id === "save-anyway") {
    if (!validateCode(selected)) { alertInvalidCode(tab.id); return; }
    saveCode(selected, "anyway", tab.id);
    return;
  }

  if (id.startsWith("tag:")) {
    if (!validateCode(selected)) { alertInvalidCode(tab.id); return; }
    saveCode(selected, id.slice(4), tab.id);
    return;
  }
});
