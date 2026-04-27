# FindManga

A Microsoft Edge extension for saving, organising, and opening **Manga** and **JAV** codes directly from any webpage via right-click.

## Features

- Highlight any text → right-click → **Find Manga** context menu
- **Manga** — open a 6-digit code instantly, or save it with an optional tag
- **JAV** — save a JAV code with a pasted thumbnail and optional tag via a dedicated form
- **Code Library popup** — two separate sections (Manga / JAV), each with tag-tab navigation and a 2-column card grid
- Auto-fetches manga title and cover thumbnail; results cached locally for 7 days
- **Auto light/dark theme** — light from 06:00–19:59, dark from 20:00–05:59, switches automatically
- Full-height popup, smooth scrolling, custom styled scrollbar
- Tag changes rebuild the right-click menu in real time (no restart needed)

---

## Context Menu

Highlight any text on a webpage, right-click, and select **Find Manga**:

```
Find Manga
├── Keep looking       → opens nhentai.website/g/[code] in a new tab
├── Save code
│   ├── Save anyway    → saves untagged (visible under "All")
│   └── Save by tag    → choose from your custom Manga tags
└── Save JAV           → opens the Save JAV form window
```

> **Keep looking** and **Save code** require exactly a 6-digit number to be selected.  
> **Save JAV** accepts any selected text as a pre-filled code suggestion.

---

## Popup — Code Library

Click the extension icon to open the library.

### Manga section

| Element | Description |
|---|---|
| **Manga / JAV toggle** | Switch between the two sections |
| **Tag tabs** | `All` + your custom tags; filters the card grid |
| **Cards (2-column grid)** | Cover thumbnail (fetched live), title, 6-digit code, tag badge, **Open** and **Delete** buttons |
| **Gear icon** | Manage Manga tags (add / remove); updates the right-click menu immediately |

### JAV section

| Element | Description |
|---|---|
| **Tag tabs** | `All` + your custom JAV tags |
| **Cards (2-column grid)** | Thumbnail you pasted, JAV code, tag badge, **Delete** button |
| **Gear icon** | Manage JAV tags independently from Manga tags |

---

## Save JAV Form

Triggered by **Save JAV** in the right-click menu. Opens as a small popup window.

1. **Thumbnail** — click the paste zone (or press `Ctrl+V` anywhere on the form) to paste an image from the clipboard
2. **JAV Code** — enter or edit the code (pre-filled if text was selected)
3. **Tag** — pick an existing JAV tag from the dropdown, or type a new one in the text field
4. Click **Save** — the entry appears in the popup's JAV section immediately

---

## Project Structure

```
FindManga/
├── manifest.json        # Extension manifest (Manifest V3)
├── background.js        # Service worker — context menus & storage logic
├── popup.html           # Library popup UI
├── popup.css            # Library popup styles
├── popup.js             # Library popup logic (fetch, tags, rendering)
├── jav-form.html        # Save JAV form UI
├── jav-form.css         # Save JAV form styles
├── jav-form.js          # Save JAV form logic (paste, save, toast)
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Installation (Edge Developer Mode)

1. Open Edge and navigate to `edge://extensions/`
2. Enable **Developer mode** (toggle in the bottom-left)
3. Click **Load unpacked** and select the `FindManga` folder
4. The extension is active — no restart required

---

## Permissions

| Permission | Reason |
|---|---|
| `contextMenus` | Adds the right-click Find Manga menu |
| `storage` | Persists saved codes, tags, and metadata cache locally |
| `scripting` | Shows in-page alerts for invalid selections |
| `activeTab` | Reads the current tab context for script injection |
| `host_permissions` → `nhentai.website` | Fetches manga title and cover thumbnail |

No data is sent to any third-party service. Everything is stored in your browser's local extension storage.

---

## Requirements

- Microsoft Edge 88+ (Manifest V3)
- Works on any webpage
