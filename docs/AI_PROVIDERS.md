# AI Providers Integration Guide

PaperDeck tracks real-time quota, rate limits, and session metrics from your local AI tools and developer agents. All data collection happens **100% locally on your computer**—no credentials, cookies, or telemetry are ever uploaded to external servers.

---

## 🧭 Architecture Summary

```
┌────────────────────────────────────────────────────────┐
│                      Host Machine                      │
│                                                        │
│  [Claude Code]      ~/.claude/.credentials.json        │
│  [OpenCode]         ~/.local/share/opencode/opencode.db│
│  [Antigravity]      127.0.0.1:<PORT> (Language Server) │
│  [OpenAI Codex]     ~/.codex/auth.json                 │
│         │                                              │
│         ▼                                              │
│  [PaperDeck Collectors] (backend/collectors/)          │
│         │                                              │
│         ▼                                              │
│  [E-Ink Renderer] ────► http://<IP>:8787/dash.png      │
└────────────────────────────────────────────────────────┘
```

---

## 1. Claude Code (Anthropic) 🟣

### How It Works
PaperDeck checks for either:
1. **Claude Code CLI**: `~/.claude/.credentials.json` (OAuth access token and expiry).
2. **Claude Desktop**: `~/Library/Application Support/Claude/plan-usage-history.json` (macOS).

### Metrics Monitored
- 5-hour rolling usage limit & progress bar.
- 7-day token quota & resets.
- 7-day historical usage trend chart.
- Real-time rate limit reset countdown (e.g. "Resets in 1h 45m").

### Setup Instructions
1. Install Claude Code CLI:
   ```bash
   npm install -g @anthropic-ai/claude-code
   ```
2. Log in:
   ```bash
   claude
   ```
3. Authenticate in your browser. PaperDeck will detect your credentials automatically.

### Troubleshooting
- **Status: Expired Token**: Run `claude` once in terminal to trigger automatic OAuth refresh. In the PaperDeck UI, navigate to **Logins** and click **Login** next to Claude.

---

## 2. OpenCode 🟢

### How It Works
PaperDeck reads your local SQLite database created by OpenCode at:
- **macOS/Linux**: `~/.local/share/opencode/opencode.db`
- **Configuration**: `~/.config/opencode/opencode.json`
- **Environment Override**: Set `OPENCODE_DB_PATH=/path/to/opencode.db` if using a custom location.

### Metrics Monitored
- Process status (Running / Idle).
- Active LLM model (e.g. `claude-3-7-sonnet`, `gemini-2.5-flash`).
- Total sessions count and messages exchanged.
- Token consumption statistics.

### Setup Instructions
1. Install and launch OpenCode.
2. Start any conversation or session so the SQLite database is created.
3. In PaperDeck **Customize Layout**, drag or enable the **OpenCode** card.

### Troubleshooting
- **Status: DB not accessible**: Ensure OpenCode has been run at least once. If using Docker or custom paths, set `OPENCODE_DB_PATH` in your environment before launching PaperDeck.

---

## 3. Antigravity AI (Google DeepMind) 🔵

### How It Works
PaperDeck dynamically discovers the running Antigravity `language_server` on localhost:
- Detects the process command-line arguments to obtain `--csrf_token`.
- Identifies the listening local port using `lsof`.
- Polls Language Server metrics API for quota windows (5-hour and 7-day).
- Reads brain session files and transcripts from `~/.gemini/antigravity/brain/`.

### Metrics Monitored
- 5-hour quota percentage bar.
- 7-day weekly quota and reset timers.
- Active session step counters and model indicators.

### Setup Instructions
1. Launch the Antigravity IDE or run the Antigravity CLI.
2. Start any agentic coding session.
3. PaperDeck automatically discovers the local process and displays live quota bars on your Kindle.

### Troubleshooting
- **Card displays "Waiting for session"**: The language server only starts when an Antigravity workspace or agent session is active. Once an active session begins, the metrics populate automatically.

---

## 4. OpenAI Codex 🟢

### How It Works
PaperDeck monitors local credentials and rollout files:
- **Credentials**: `~/.codex/auth.json`
- **Sessions & Rollouts**: `~/.codex/sessions/`
- **WSL Discovery**: Automatically scans WSL distros (`\\wsl.localhost\<distro>\home\<user>\.codex`) on Windows.

### Metrics Monitored
- Primary rate limit window (token count / limit).
- Weekly rate limit window.
- Historical rollout activity.

### Setup Instructions
1. Install the Codex CLI or VS Code extension.
2. Log in:
   ```bash
   codex login
   ```
3. PaperDeck reads the token expiration and session rollouts.

---

## 5. OmniRouter & Other Widgets

- **OmniRouter**: Upstream AI gateway metrics for multi-model load balancing. Configurable via widget options in the Layout Editor.
- **Mac Hardware**: Direct, zero-config local monitoring for CPU, RAM, disk, and uptime.
- **Apple Music**: Reads currently playing track, artist, album, and scrubber position via macOS AppleScript.
- **Site Scraper / RSS**: Add any custom website URL or RSS feed to scrape latest headlines directly to e-ink.
