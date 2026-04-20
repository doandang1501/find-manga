# FindManga

A lightweight Microsoft Edge extension for saving and opening manga by 6-digit code — directly from any webpage via right-click.

## Features

- Highlight any 6-digit number → right-click → **Find Manga**
- Open the manga in a new tab instantly
- Save codes to a personal library with custom tags
- Browse saved codes through the popup with tag-based filtering

## How it works

1. Highlight a 6-digit number on any webpage
2. Right-click → **Find Manga**
3. Choose an action from the submenu:

```
Find Manga
├── Keep looking       → opens https://nhentai.website/g/[code]
└── Save code
    ├── Save anyway    → saves to #anyway
    └── Save by tag    → pick from your configured tags
```

## Popup — Code Library

Click the extension icon to open the library:

- **Tag navigation bar** — `All`, your custom tags, `#anyway`; defaults to **All**
- **Code cards** — show the 6-digit code, its tag, an open link, and a delete button
- **Gear icon** — manage tags (add / remove); new tags appear in the right-click menu immediately

## Project structure

```
FindManga/
├── manifest.json       # Extension manifest (Manifest V3)
├── background.js       # Service worker — context menu & storage logic
├── popup.html          # Extension popup UI
├── popup.css           # Popup styles
├── popup.js            # Popup logic
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

## Installation (Edge Developer Mode)

1. Open Edge and go to `edge://extensions/`
2. Enable **Developer mode** (bottom-left toggle)
3. Click **Load unpacked** and select the `FindManga` folder
4. The extension is active — no restart needed

## Permissions

| Permission | Reason |
| --- | --- |
| `contextMenus` | Adds the right-click menu |
| `storage` | Persists saved codes and tags locally |
| `scripting` | Shows in-page alerts for invalid selections |

No host permissions. No data leaves your browser.

## Requirements

<<<<<<< HEAD
- Microsoft Edge 88+ (Manifest V3 support)
- Works on any webpage
=======
- Microsoft Edge 88+ (Manifest V3)
>>>>>>> e51185a (Add feature)
