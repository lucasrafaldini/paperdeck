# CLAUDE.md — Agent & Developer Guide for PaperDeck

PaperDeck turns a jailbroken Kindle into a dedicated, ambient e-ink smart workstation & companion dashboard. The host computer (Electron) collects developer data, AI quotas, system metrics, and media status, renders a high-contrast 800x600 monochrome layout, and serves it over HTTP to a Kindle display daemon powered by FBInk.

---

## ⚡ Quick Reference Commands

```bash
# Development & Execution
npm run dev                # Launch Electron app in dev mode (Vite HMR)
npm run backend            # Run standalone backend API (:8787)
npm run supervisor         # Run standalone render loop (without Electron GUI)

# Validation & Quality (Run before every commit/PR)
npm test                   # Run full Node.js unit test suite
npm run typecheck          # Validate TypeScript for main, preload, and renderer
npm run build              # Full build (typecheck + electron-vite build)

# Packaging
npm run build:mac          # Package macOS application
npm run build:win          # Package Windows installer (.exe)
```

---

## 🏛️ Project Architecture

```
kindle-dashboard/
├── backend/                  # Local Node.js server (CommonJS, default port 8787)
│   ├── collectors/           # Data extractors (Claude, Antigravity, OpenCode, Codex, System, Pet)
│   ├── config.js             # Runtime configuration, layouts, and widget state
│   ├── preflight.js          # Local credential expiration checks (no remote network calls)
│   └── server.js             # Express API serving /dash.png, /api/usage, /api/auth, /api/ping
├── render/
│   └── dashboard.html        # Clean HTML/CSS/JS template captured into 800x600 e-ink PNG
├── src/                      # Electron Desktop Application (TypeScript)
│   ├── main/                 # Electron main process (lifecycle, IPC handlers, SSH client, timer)
│   ├── preload/              # Secure contextBridge bridges (strictly scoped, no raw ipcRenderer)
│   ├── renderer/             # React 19 UI (control panel, layout drag-and-drop, logs, settings)
│   └── shared/               # Shared TypeScript types and IPC contract interfaces
├── kindle/                   # Shell scripts running on Kindle (BusyBox / Upstart / FBInk loop)
├── locales/                  # Internationalization JSON dictionaries (en.json, pt-BR.json)
└── test/                     # Native Node.js test runner suite (`node:test`)
```

---

## 📐 Development Guidelines & Rules

### 1. Code Style & Modular Boundaries
- **Backend (`backend/` & `scripts/`)**: CommonJS (`require` / `module.exports`). Keep dependencies minimal.
- **Frontend & Main (`src/`)**: Modern TypeScript. Strict null checks, explicit return types where applicable.
- **IPC Protocol**: Never expose `ipcRenderer`, `require`, or `fs` to the renderer. Every IPC channel must be declared in:
  1. `src/main/index.ts` (handler)
  2. `src/preload/index.ts` (bridge function)
  3. `src/shared/types.ts` / `src/preload/index.d.ts` (typings)
- **State & Data Directory**: Packaged apps store data in Electron `userData` (`PaperDeck`). In dev mode, runtime files use `out/`.

### 2. Collector Implementation Recipe
When adding or editing collectors in `backend/collectors/`:
1. **Never block the main loop**: Use async I/O or cached results with a short TTL (15s–30s).
2. **Never throw uncaught errors**: Always wrap parser logic in `try/catch` and return honest fallback or `{ available: false }`.
3. **No raw tokens or secrets**: Never return raw API keys, bearer tokens, or sensitive account IDs in the returned payload.
4. **Follow the standard shape**:
   ```javascript
   async function collect() {
     return {
       available: true,
       data: { /* widget-specific metrics */ },
       updatedAt: new Date().toISOString()
     };
   }
   ```
5. **Add a unit test** in `test/<collector-name>.test.js`.

### 3. Internationalization (i18n)
- **Zero hardcoded strings** in UI components or status banners.
- All user-facing text belongs in `locales/<lang>.json` under appropriate namespaces (`ui`, `auth`, `dashboard`).
- When adding new keys, update `locales/en.json` first (the source of truth fallback).
- To add a new language, create `locales/<lang-code>.json`. The app discovers it automatically.

### 4. E-Ink Display Constraints (Kindle Rendering)
- Resolution is 800x600 landscape (Kindle Touch 3 / Paperwhite base).
- Use strictly high contrast: black (`#000`), white (`#fff`), and limited grayscale grays.
- Keep typography crisp, large, and legible from a distance.
- Avoid delicate thin lines or low-contrast gradients that look muddy on e-paper.

### 5. Security & Privacy Guardrails
- **Never commit real user identifiers**: serial numbers, real local IPs (e.g. `192.168.x.x`), real usernames (`outis`), passwords, or API keys.
- Use placeholders in documentation: `<IP_PC>`, `<IP_KINDLE>`, `<SSH_USER>`, `<SSH_PASSWORD>`.
- SSH passwords must be encrypted via Electron `safeStorage` and never sent in plain text to the renderer.

---

## 🤖 Working with AI Agents in PaperDeck

When acting as an autonomous agent in this codebase:
- Run `npm test` after any backend or collector modification.
- Run `npm run typecheck` after modifying TypeScript files in `src/`.
- Use the specialized agent skills in `.agents/skills/` for common workflows:
  - `create-widget`: scaffold and register a complete widget end-to-end.
  - `add-locale`: safely add and synchronize translations.
  - `diagnose-kindle`: inspect Kindle shell scripts and connection protocols.
  - `test-and-verify`: execute and diagnose test suites.
