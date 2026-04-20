const MENU_ID = "find-manga";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: MENU_ID,
    title: "Find Manga",
    contexts: ["selection"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;

  const selected = info.selectionText.trim();

  if (!/^\d{6}$/.test(selected)) {
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => alert("FindManga: Vui lòng bôi đen đúng 6 chữ số.")
    });
    return;
  }

  chrome.tabs.create({ url: `https://nhentai.website/g/${selected}` });
});
