---
title: "feat(widget): Add Pomodoro Focus Timer Widget with E-Ink Break Alerts"
labels: ["enhancement", "hacktoberfest", "widgets"]
---

### Summary
Add an integrated Pomodoro focus timer to PaperDeck. The timer can be started/paused from the desktop app (or tray) and displays a large, readable countdown and session tally on the Kindle.

### Proposed Features
- 25-minute focus session / 5-minute break cycle (configurable).
- Large pixel-font countdown timer on the e-ink screen.
- Auto-triggers Kindle notification banner (`/api/notify`) when time expires.
- Simple start/pause/reset controls in the desktop control panel and system tray.

### Tasks
- [ ] Create `backend/collectors/pomodoro.js` managing active timer state in memory.
- [ ] Add endpoints `POST /api/pomodoro/start`, `POST /api/pomodoro/pause`, `POST /api/pomodoro/reset`.
- [ ] Implement card template in `render/dashboard.html`.
- [ ] Add interactive UI component in `src/renderer/src/views/WidgetsView.tsx` or Topbar.
- [ ] Add unit tests in `test/pomodoro-collector.test.js`.
