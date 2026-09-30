---
title: "feat(widget): Add Home Assistant Entity Monitoring Widget (Lights, Climate, Sensors)"
labels: ["enhancement", "hacktoberfest", "widgets"]
---

### Summary
Allow smart home enthusiasts to display key sensor readings from a local [Home Assistant](https://www.home-assistant.io/) instance on their e-ink Kindle dashboard.

### Proposed Features
- Connect via Home Assistant Long-Lived Access Token and local URL (e.g., `http://homeassistant.local:8123`).
- Display customizable entity states:
  - Temperature & humidity sensors.
  - Active lights count / smart plug power draw (W).
  - Door / window contact sensor alerts.
- Configurable entity IDs in the PaperDeck layout settings.

### Tasks
- [ ] Create `backend/collectors/homeassistant.js` with configurable URL and token via widget options.
- [ ] Implement entity fetch logic with 30s cache.
- [ ] Design high-contrast card in `render/dashboard.html` showing 3 to 6 selected entities.
- [ ] Add settings inputs in `src/renderer/src/views/LayoutEditor.tsx`.
- [ ] Add unit test in `test/homeassistant-collector.test.js`.
