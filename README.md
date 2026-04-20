<<<<<<< HEAD
# find-manga
=======
# FindManga

A lightweight Microsoft Edge extension that lets you open a manga entry directly from any 6-digit code on a webpage — no copy-pasting required.

## How it works

1. Highlight any 6-digit number on a page
2. Right-click → **Find Manga**
3. A new tab opens at `https://nhentai.website/g/[number]`

If the selected text is not exactly 6 digits, an alert will notify you instead of opening a wrong URL.

## Project structure

```
FindManga/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.js       # Service worker — context menu logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Installation (Edge Developer Mode)

1. Open Edge and navigate to `edge://extensions/`
2. Toggle **Developer mode** on (bottom-left corner)
3. Click **Load unpacked**
4. Select the `FindManga` folder
5. The extension is now active — no restart needed

## Permissions

| Permission | Reason |
| --- | --- |
| `contextMenus` | Adds the "Find Manga" item to the right-click menu |

No host permissions, no data collection, no network requests from the extension itself.

## Requirements

- Microsoft Edge 88+ (Manifest V3 support)
- Works on any webpage
>>>>>>> 6d5b0ed (first commit)
