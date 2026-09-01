# Chromium-Based Desktop Web Browser

A sleek, fast, and feature-rich desktop web browser built directly on the **Chromium** engine and Electron runtime.

## 🚀 Features

- **Chromium Engine Core**: Full support for modern web standards (HTML5, ESNext, WebGL, WebSockets, WebRTC, Media Stream).
- **Internal `chrome://` URLs**:
  - `chrome://newtab` - Modern start page with quick search and shortcuts.
  - `chrome://version` - Details on Chromium, V8, Node, OS, and User Agent.
  - `chrome://about` & `chrome://chrome-urls` - Complete directory of working internal URLs.
  - `chrome://history` - Searchable browsing history log with deletion and clear data.
  - `chrome://bookmarks` - Interactive bookmark organizer.
  - `chrome://downloads` - Real-time download manager.
  - `chrome://settings` - Search engine preferences (Google, DuckDuckGo, Bing, Brave), homepage, themes.
  - `chrome://dino` - The classic Chromium T-Rex offline runner easter egg game!
  - Native diagnostics: `chrome://gpu`, `chrome://net-internals`, `chrome://webrtc-internals`, `chrome://media-internals`, `chrome://process-internals`, `chrome://blob-internals`.
- **Smart Omnibox**:
  - Automatically navigates to web URLs (`https://`, `http://`, `localhost`, IP, domain names).
  - Searches via your favorite search engine if text is a query.
  - Protocol badges (🔒 SSL HTTPS, ⚡ Chromium System, ⚠️ Insecure).
  - Loading animation bar.
- **Multi-Tab System**:
  - Infinite tabs with dynamic sizing, favicons, loading spinners, and close buttons.
  - Tab switching with `Ctrl+Tab` / `Ctrl+Shift+Tab`.
  - Middle-click to close tabs.
- **Bookmarks Bar**: 1-click bookmarks bar with ⭐ omnibox toggle (`Ctrl+D`).
- **DevTools**: Toggle native Chrome DevTools (`F12` / `Ctrl+Shift+I`).
- **In-Page Search**: Find on page (`Ctrl+F`) with count & match cycling.
- **Keyboard Shortcuts**:
  - `Ctrl + T`: Open New Tab
  - `Ctrl + W`: Close Active Tab
  - `Ctrl + L` / `Alt + D`: Focus Omnibox
  - `Ctrl + R` / `F5`: Reload Tab
  - `Ctrl + D`: Bookmark Current Page
  - `Ctrl + H`: History
  - `Ctrl + J`: Downloads
  - `Ctrl + B`: Bookmarks
  - `Ctrl + F`: Find in Page
  - `F12`: Chrome DevTools

## 📦 How to Run

1. Open your terminal in this directory:
   ```bash
   cd chromium-browser
   ```

2. Start the browser:
   ```bash
   npm start
   ```
