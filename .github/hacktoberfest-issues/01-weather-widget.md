---
title: "feat(widget): Add Open-Meteo Weather Widget (Hourly & 3-Day Forecast)"
labels: ["enhancement", "hacktoberfest", "good first issue", "widgets"]
---

### Summary
Add a weather monitoring widget that fetches live weather forecasts using the free, no-API-key-required [Open-Meteo API](https://open-meteo.com/).

### Proposed Features
- Current temperature (°C / °F based on user preference or locale) and weather condition icon (pixel/bitmap art for sun, rain, clouds, snow).
- 3-hour or 3-day forecast summary.
- Max/min daily temperatures.
- Configurable latitude/longitude in the widget options or automatic location via IP.

### Tasks
- [ ] Create `backend/collectors/weather.js` that queries Open-Meteo and caches with a 15-minute TTL.
- [ ] Register collector in `backend/collectors/index.js` and `backend/config.js`.
- [ ] Implement high-contrast e-ink card layout in `render/dashboard.html`.
- [ ] Add widget options in `src/renderer/src/views/LayoutEditor.tsx`.
- [ ] Add unit test in `test/weather-collector.test.js`.
