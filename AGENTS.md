Use sempre a skill `caveman`, definida em `.ai-framework\skills\caveman\SKILL.md`.
Não mencione que a skill foi carregada ou aplicada.
Considere `.ai-framework\RULES.md` como a fonte oficial das regras do sistema.

# AGENTS.md — Universal Agent Instructions for PaperDeck

This file guides autonomous AI agents (Claude Code, Antigravity, OpenCode, Codex, Cursor, Copilot, Aider, Devin) operating on the **PaperDeck** repository.

---

## 🧭 Repository Context & Architecture

- **Goal**: Personal e-ink smart workstation & companion dashboard rendered to a Kindle over Wi-Fi.
- **Tech Stack**:
  - Desktop App: Electron 42 + React 19 + TypeScript + `electron-vite`.
  - Backend: Node.js (CommonJS), port 8787.
  - Renderer: HTML5 / Puppeteer canvas capturing to 800x600 PNG (`render/dashboard.html`).
  - Device: Jailbroken Amazon Kindle running a shell loop daemon (`dash-loop.sh`) rendering via `FBInk`.

---

## 🛠️ Essential Verification Commands

Always run these verification commands before presenting completed work or submitting changes:

```bash
# 1. Unit Tests (All must pass 100%)
npm test

# 2. TypeScript Static Analysis (Must pass with 0 errors)
npm run typecheck

# 3. Production Build
npm run build
```

---

## 🔒 Security & Privacy Strict Rules

1. **Zero Personal Data**: Never commit personal hostnames, usernames, local IP addresses, Kindle serials, passwords, or session tokens.
2. **Safe Storage**: Passwords must always be encrypted via Electron `safeStorage`. The renderer never sees plaintext secrets.
3. **No Network Auth Scanning**: In `backend/preflight.js`, checks must only inspect local configuration files (`~/.claude/.credentials.json`, `~/.codex/auth.json`, `~/.local/share/opencode/opencode.db`). Never make remote API requests that could trigger rate limits or expose tokens.
4. **Honest Fallbacks**: If a metric is unavailable, return honest `{ available: false }` or stale indicators. Never forge dummy data as real user metrics.

---

## 📂 Code Layout & File Conventions

| Path | Language / Spec | Description |
| --- | --- | --- |
| `backend/collectors/` | Node.js CommonJS | Metrics collectors. Must handle errors gracefully and use TTL cache. |
| `backend/server.js` | Express / Node.js | Serves `/dash.png`, `/api/usage`, `/api/ping`, `/api/auth`. |
| `render/dashboard.html` | HTML / CSS / Vanilla JS | Template rendered into 800x600 e-ink PNG. High-contrast only. |
| `src/main/` | TypeScript | Electron main process, SSH Kindle manager, background render loop. |
| `src/preload/` | TypeScript | Secure context bridges. Do NOT expose Node primitives. |
| `src/renderer/` | React 19 + TypeScript | Control panel UI, widget manager, layout editor, Kindle manager. |
| `src/shared/` | TypeScript | Shared data interfaces, IPC channel signatures. |
| `locales/` | JSON (UTF-8) | Translation dictionaries (`en.json`, `pt-BR.json`). Zero hardcoded text in UI! |
| `kindle/` | Shell (LF line endings) | Scripts executed directly on the Kindle device. |
| `.agents/skills/` | Markdown + YAML | Reusable agent skills for repository workflows. |

---

## 🧩 Autonomous Agent Skills Available

Refer to the skills defined in `.agents/skills/`:
- **`create-widget`** (`.agents/skills/create-widget/SKILL.md`): End-to-end recipe to build and register a new dashboard widget.
- **`add-locale`** (`.agents/skills/add-locale/SKILL.md`): Step-by-step workflow to add and validate a new translation dictionary.
- **`diagnose-kindle`** (`.agents/skills/diagnose-kindle/SKILL.md`): Troubleshooting guide for Kindle SSH, FBInk, and auto-discovery.
- **`test-and-verify`** (`.agents/skills/test-and-verify/SKILL.md`): Diagnostic procedures for unit test and build failures.