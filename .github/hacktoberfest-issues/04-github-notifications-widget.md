---
title: "feat(widget): Add GitHub Review Requests & Notifications Tracker Widget"
labels: ["enhancement", "hacktoberfest", "good first issue", "widgets"]
---

### Summary
Keep developer focus sharp by surfacing pending GitHub pull request review requests, unread notification counts, and CI status directly on the e-ink desk companion.

### Proposed Features
- Display pending PR review requests assigned to the authenticated user.
- Unread notification count badge.
- Recent workflow run statuses (passing / failing) for pinned repositories.
- Use `gh auth token` (from GitHub CLI) if installed, or a personal access token (PAT).

### Tasks
- [ ] Create `backend/collectors/github.js` querying the GitHub GraphQL / REST API.
- [ ] Support reading token from environment variable `GITHUB_TOKEN` or `gh auth token`.
- [ ] Design compact e-ink card in `render/dashboard.html`.
- [ ] Add unit tests in `test/github-collector.test.js`.
