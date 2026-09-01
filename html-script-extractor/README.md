# HTML & Script Harvester - Chrome Extension (Manifest V3)

A Chrome extension designed to extract raw server HTML, live rendered DOM, and capture every script a website loads or attempts to fetch.

---

## Key Features

1. **Raw Server HTML Extraction**: Fetches the original HTTP response directly from the web server before any browser parsing or DOM mutations.
2. **Rendered Live DOM Snapshot**: Captures the current dynamic state of the DOM tree after JavaScript execution.
3. **Comprehensive Script Harvester**:
   - **DOM Tags**: `<script src="...">` tags from `<head>` and `<body>`.
   - **Inline Scripts**: Full text content of all embedded `<script>` blocks.
   - **Dynamic Injections**: Intercepts `document.createElement('script')` and `document.write`.
   - **Web Workers & Service Workers**: Intercepts `new Worker()`, `new SharedWorker()`, and `navigator.serviceWorker.register()`.
   - **Network Requests**: Intercepts all JavaScript resources requested via network or `fetch()` / `XMLHttpRequest`.
4. **Interactive Inspector UI**:
   - Live script counter badge on the toolbar.
   - Real-time search and filter (External, Inline, Dynamic & Net).
   - Built-in source code viewer with JS beautifier / formatter.
   - Copy individual or all script URLs.
5. **One-Click ZIP Export**:
   - Exports a complete ZIP bundle containing:
     - `raw_server.html`
     - `rendered_dom.html`
     - `scripts/external/...` (all downloaded JavaScript files)
     - `scripts/inline/...` (all inline script files)
     - `metadata.json` (timestamp, URLs, sizes, and extraction status)

---

## How to Install in Google Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left.
4. Select the extension directory:
   ```
   c:\Users\geg\Documents\random\html-script-extractor
   ```
5. Pin the **HTML & Script Harvester** extension to your toolbar.

---

## How to Use

1. Navigate to any website (e.g., YouTube, GitHub, news sites, single-page web apps).
2. Click the extension icon in your Chrome toolbar.
3. Use the tabs to:
   - **Scripts**: View, filter, copy, and inspect all discovered scripts.
   - **Raw Server HTML**: Inspect and download the original server response.
   - **Rendered DOM**: View and download the dynamic live DOM snapshot.
   - **Source Viewer**: View and beautify individual script source code.
4. Click **Export ZIP** in the top header to download the complete package.
