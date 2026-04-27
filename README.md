# FindManga

A Microsoft Edge extension for saving, organising, and opening **Manga** and **Japanese Movie** codes directly from any webpage via right-click.

## Features

- Highlight any text → right-click → **Find Manga** context menu
- **Manga** — open a 6-digit code instantly, or save it with an optional tag
- **Japanese Movies** — save a movie code with a pasted thumbnail, optional tag, description, and rating via a dedicated form
- **Code Library popup** — two separate sections (Manga / J-Movie), each with tag-tab navigation and a 2-column card grid
- **Rating** — 10-star scale with 0.5-step precision; hover to preview, click to set, click same value to clear
- **Description** — free-text notes attached to any saved code
- **Share / Export** — select cards and export to a `.zip` file containing all data and thumbnails
- **Import** — drop a `.zip` export to import codes with duplicate-resolution per item
- Auto-fetches manga title and cover thumbnail; results cached locally for 7 days
- **Auto light/dark theme** — light from 06:00–19:59, dark from 20:00–05:59, switches automatically
- Full-height popup, smooth scrolling, custom styled scrollbar
- Tag changes rebuild the right-click menu in real time (no restart needed)

---

## Context Menu

Highlight any text on a webpage, right-click, and select **Find Manga**:

```
Find Manga
├── Keep looking              → opens nhentai.website/g/[code] in a new tab
├── Save code
│   ├── Save anyway           → saves untagged (visible under "All")
│   └── Save by tag           → choose from your custom Manga tags
└── Save Japanese Movie       → opens the Save Japanese Movie form window
```

> **Keep looking** and **Save code** require exactly a 6-digit number to be selected.  
> **Save Japanese Movie** accepts any selected text as a pre-filled code suggestion.

---

## Popup — Code Library

Click the extension icon to open the library.

### Header buttons

| Button | Action |
|---|---|
| **Manga / J-Movie** toggle | Switch between the two library sections |
| ↓ Import icon | Open the Import modal to load a `.zip` export |
| ↑ Share icon | Enter share mode — checkboxes appear on every card |
| ⚙ Gear icon | Open the tag management panel |

### Manga section

| Element | Description |
|---|---|
| **Tag tabs** | `All` + your custom tags; filters the card grid |
| **Cards (2-column grid)** | Cover thumbnail, title, code, tag badge, description (2-line), star rating, **Open** and **Delete** buttons |
| **Click a card** | Opens the edit modal to set/update description and rating |

### J-Movie section

| Element | Description |
|---|---|
| **Tag tabs** | `All` + your custom J-Movie tags |
| **Cards (2-column grid)** | Pasted thumbnail, code, tag badge, description (2-line), star rating, **Delete** button |
| **Click a card** | Opens the edit modal to set/update description and rating |

---

## Rating

Each saved code (Manga or Japanese Movie) supports a **0–10 star rating** with **0.5-step** precision.

- **Hover** left half of a star → preview half-star value  
- **Hover** right half → preview full-star value  
- **Click** to confirm the rating  
- **Click the same value again** to clear the rating  
- Displayed on cards as a compact read-only star row with numeric score

---

## Save Japanese Movie Form

Triggered by **Save Japanese Movie** in the right-click menu. Opens as a small popup window.

1. **Thumbnail** — click the paste zone or press `Ctrl+V` anywhere to paste an image from the clipboard
2. **Movie Code** — enter or edit the code (pre-filled if text was selected)
3. **Tag** — pick an existing J-Movie tag from the dropdown, or type a new one
4. **Description** — optional free-text notes (max 500 characters)
5. **Rating** — optional 10-star rating with 0.5-step precision
6. Click **Save** — the entry appears in the popup's J-Movie section immediately

---

## Share & Import

### Export (Share)

1. Click the **↑ share icon** in the header — share mode activates
2. Checkboxes appear on every card; click any card to select/deselect it
3. A **bottom bar** shows the selection count and an **Export ZIP** button
4. Click **Export ZIP** — a file named `findmanga-[timestamp].zip` downloads automatically
5. Click the share icon again (or **Cancel**) to exit share mode

The ZIP contains:

```
findmanga-[timestamp].zip
├── manifest.json        # Version and export date
├── data.json            # All selected items (code, tag, description, rating, title, thumbUrl)
└── thumbs/
    └── jav_[code].jpg   # Japanese Movie thumbnails extracted from storage
```

> Manga thumbnails are stored as nhentai URLs — the recipient's extension fetches them automatically.

### Import

1. Click the **↓ import icon** in the header
2. Drag-and-drop (or browse) a `.zip` file exported by FindManga
3. A preview lists every item to be imported with type, code, and tag
4. If **no duplicates** → imports immediately
5. If **duplicates found** → a conflict screen shows each duplicate with a **Keep old / Replace** toggle per item
6. Confirm — the library updates and re-renders instantly

---

## Project Structure

```
FindManga/
├── manifest.json        # Extension manifest (Manifest V3)
├── background.js        # Service worker — context menus & storage logic
├── popup.html           # Library popup UI
├── popup.css            # Library popup styles
├── popup.js             # Library popup logic (fetch, tags, rating, share, import)
├── movie-form.html        # Save Japanese Movie form UI
├── movie-form.css         # Save Japanese Movie form styles
├── movie-form.js          # Save Japanese Movie form logic (paste, rating, save)
├── jszip.min.js         # JSZip v3 — used for ZIP export and import
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
| `storage` | Persists saved codes, tags, thumbnails, ratings, and metadata cache locally |
| `scripting` | Shows in-page alerts for invalid selections |
| `activeTab` | Reads the current tab context for script injection |
| `host_permissions` → `nhentai.website` | Fetches manga title and cover thumbnail |

No data is sent to any third-party service. Everything is stored in your browser's local extension storage. ZIP exports stay on your device and are shared manually.

---

## Requirements

- Microsoft Edge 88+ (Manifest V3)
- Works on any webpage
