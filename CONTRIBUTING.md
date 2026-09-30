# Contributing to PaperDeck 🎃

Thank you for your interest in contributing to **PaperDeck**! We welcome contributors of all skill levels, especially during **Hacktoberfest**!

---

## 🎃 Hacktoberfest Guidelines

PaperDeck proudly participates in Hacktoberfest. To ensure a rewarding experience for everyone and maintain project quality:

1. **Quality Over Quantity:** Only meaningful PRs will be accepted. Minor typo fixes across multiple PRs or whitespace churn will be labeled as `invalid` / `spam`.
2. **Follow Existing Patterns:** Keep TypeScript types strict, write clean modular code, and include tests for new backend collectors or utilities.
3. **Check Open Issues:** Comment on an existing issue or open a new one proposing your feature before submitting a large PR.
4. **Pass Automated Checks:** Every PR must pass `npm test`, `npm run typecheck`, and `npm run build`.

---

## 💡 Good First Issues & Contribution Ideas

Looking for ideas to contribute? Here are great areas to get started:

### 1. New Dashboard Widgets
Create and integrate new data collectors and UI cards:
- **Weather Widget:** Hourly/daily forecast using free APIs like Open-Meteo.
- **Spotify / Now Playing:** Current song, artist, and playback progress bar.
- **Home Assistant:** Room temperature, smart lights status, or energy sensors.
- **GitHub Tracker:** Pending PR reviews, notifications, or repo release updates.
- **Productivity & Focus:** Pomodoro timer, Habitica daily tasks, or streak counter.
- **Cryptocurrency / Stock Ticker:** Live pricing with sparkline graphs.

### 2. Localization & Translations
- Add new language translations to `locales/` (e.g., Spanish `es.json`, French `fr.json`, German `de.json`, Japanese `ja.json`).
- Ensure all UI keys in `locales/en.json` are properly mirrored.

### 3. Virtual Pet (Memtchi) Enhancements
- Add new pet evolutions, pixel sprites, animations, or humorous status messages.
- New mini-interactions or daily challenges.

### 4. Kindle & Hardware Compatibility
- Test and document scripts for different Kindle models (Oasis, Voyage, Paperwhite 4/5, Kobo devices running InkBox).
- Power efficiency enhancements and standby scheduling.

### 5. Testing & Documentation
- Unit tests for backend collectors and renderer components.
- Setup walkthrough guides and troubleshooting guides for different OS environments.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: `>= 24.0.0`
- **npm**: `>= 10.0.0`
- **Git**

### Installation

1. Fork the repository on GitHub: [https://github.com/lucasrafaldini/paperdeck](https://github.com/lucasrafaldini/paperdeck)
2. Clone your fork locally:
   ```bash
   git clone https://github.com/<your-username>/paperdeck.git
   cd paperdeck
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

- **Development Mode (Electron + Vite):**
  ```bash
  npm run dev
  ```
- **Type Checking (TypeScript):**
  ```bash
  npm run typecheck
  ```
- **Running Tests (Node test runner):**
  ```bash
  npm test
  ```
- **Building App Package:**
  ```bash
  npm run build
  ```

---

## 📐 Project Architecture

PaperDeck consists of three core components:

```
kindle-dashboard/
├── backend/            # Express/Node server running on port 8787
│   ├── collectors/     # Data collectors (Claude, Antigravity, OpenCode, System, etc.)
│   ├── config.js       # Runtime configuration store
│   └── server.js       # Serves /dash.png, /api/usage, /api/ping
├── render/             # Puppeteer/HTML render template rendered to 800x600 PNG
│   └── dashboard.html  # High-contrast e-ink layout & widget cards
├── src/
│   ├── main/           # Electron main process (IPC, SSH Kindle manager, background worker)
│   ├── preload/        # Secure contextBridge bridges
│   ├── renderer/       # React 19 UI (Desktop dashboard control panel & layout editor)
│   └── shared/         # Shared TypeScript interfaces & types
└── kindle/             # Shell scripts running on the jailbroken Kindle (FBInk display loop)
```

---

## 🚀 Submitting a Pull Request

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-new-widget
   ```
2. Commit your changes with clear, descriptive commit messages:
   ```bash
   git commit -m "feat(widget): add open-meteo weather collector and card"
   ```
3. Verify all checks pass:
   ```bash
   npm run typecheck
   npm test
   npm run build
   ```
4. Push your branch to GitHub:
   ```bash
   git push origin feature/my-new-widget
   ```
5. Open a Pull Request against the `main` branch of `lucasrafaldini/paperdeck`.
6. Fill in the PR template detailing your changes and test coverage.

---

## 🛡️ Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project you agree to abide by its terms.
