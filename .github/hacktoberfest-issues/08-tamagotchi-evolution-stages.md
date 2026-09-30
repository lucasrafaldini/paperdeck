---
title: "feat(pet): Add Pet Evolution Stages & Animations to Memtchi Tamagotchi"
labels: ["enhancement", "hacktoberfest", "good first issue", "tamagotchi"]
---

### Summary
Enhance the Memtchi virtual pet widget with age progression, evolution stages (Egg -> Baby -> Teen -> Adult), and playful reactive animations on the e-ink screen.

### Proposed Features
- Evolution progression based on age / days alive and care quality (feeding and energy management).
- Multiple sprite sets for each stage (Egg hatching, Baby, Teen, and Adult forms).
- Extra reaction animations (e.g. dancing when happy, sleeping cap when resting, sick state if neglected).
- 1-bit pixel art bitmaps optimized for fast e-ink partial refresh.

### Tasks
- [ ] Add evolution stage state calculation to `backend/collectors/tamagotchi.js`.
- [ ] Add new pixel sprites to `backend/collectors/tamagotchi-sprites.js` and `src/renderer/src/components/TamagotchiBox.tsx`.
- [ ] Update pet card rendering in `render/dashboard.html`.
- [ ] Add unit test verifying evolution threshold transitions in `test/tamagotchi-and-sitescraper.test.js`.
