---
title: "feat(device): Add Resolution Profiles for Kindle Paperwhite 5 (11th Gen - 1236x1648) and Oasis"
labels: ["enhancement", "hacktoberfest", "kindle"]
---

### Summary
PaperDeck currently renders at 800x600 landscape, optimized for the Kindle Touch 3 (KT3) and earlier 6-inch 167/212 PPI devices. We want to introduce selectable resolution profiles so modern devices like the Kindle Paperwhite 5 (11th Gen, 6.8", 1236x1648 at 300 PPI) and Kindle Oasis can display ultra-sharp, high-density layouts.

### Proposed Solution
- Add a `resolutionProfile` field to `KindleDevice` config:
  - `standard` (800x600 - default)
  - `retina-paperwhite` (1236x1648 / landscape 1648x1236)
  - `voyage-oasis` (1072x1448 / landscape 1448x1072)
- Dynamically set the Puppeteer capture viewport in `src/main/` based on the active Kindle device's profile.
- Adjust base font scale and grid sizing with CSS media queries or profile classes in `render/dashboard.html`.

### Tasks
- [ ] Extend `KindleDevice` interface in `src/shared/types.ts`.
- [ ] Update render page viewport logic in `src/main/render.ts`.
- [ ] Add device profile selector in `src/renderer/src/views/KindleView.tsx`.
- [ ] Test layout rendering at 1648x1236 resolution.
