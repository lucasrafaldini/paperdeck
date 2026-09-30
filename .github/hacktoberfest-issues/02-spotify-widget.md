---
title: "feat(widget): Add Spotify Now Playing Widget (Track, Artist, Progress Bar)"
labels: ["enhancement", "hacktoberfest", "widgets"]
---

### Summary
Add a Spotify widget to display the currently playing track, artist name, album name, and a visual progress bar on the Kindle e-ink screen (similar to the Apple Music widget).

### Proposed Features
- Live track name, artist, and album.
- Progress bar showing current time / duration.
- Dithered 1-bit or 2-bit monochrome album artwork thumbnail or icon.
- Read from local Spotify Desktop client process / AppleScript (macOS) or Spotify Web API via user refresh token.

### Tasks
- [ ] Create `backend/collectors/spotify.js` supporting local OS queries (AppleScript on macOS, Windows Media Manager, or Spotify API token).
- [ ] Register collector in `backend/collectors/index.js` and `backend/config.js`.
- [ ] Add card template to `render/dashboard.html`.
- [ ] Add configuration controls in `src/renderer/src/views/LayoutEditor.tsx`.
- [ ] Add unit test in `test/spotify-collector.test.js`.
