---
name: create-widget
description: Step-by-step workflow to scaffold, implement, and register a new dashboard widget in PaperDeck.
---

# Create Widget Skill

Use this skill whenever an agent needs to add a new widget or data card to PaperDeck.

## 1. Create Data Collector (`backend/collectors/<widget-name>.js`)
- Must use CommonJS.
- Must include a TTL cache (e.g. 15-30 seconds).
- Must catch all errors and return `{ available: false, error: err.message }` instead of throwing.
- Export `collect()` function.

```javascript
const CACHE_TTL_MS = 30000;
let cache = { at: 0, data: null };

async function collect() {
  const now = Date.now();
  if (cache.data && (now - cache.at < CACHE_TTL_MS)) {
    return cache.data;
  }
  try {
    const data = { /* collect your metrics here */ };
    cache = { at: now, data: { available: true, data, updatedAt: new Date().toISOString() } };
    return cache.data;
  } catch (err) {
    return { available: false, error: err.message, data: null };
  }
}

module.exports = { collect };
```

## 2. Register Collector in `backend/collectors/index.js`
- Import the new collector.
- Add it to `collectAll()` mapping.

## 3. Register Widget in `backend/config.js`
- Add to `AVAILABLE_WIDGETS` array with `{ id: '<widget-name>', name: '<Readable Name>' }`.
- Add default toggle/display options to `DEFAULT_WIDGET_OPTIONS`.

## 4. Add E-Ink Rendering Card in `render/dashboard.html`
- Add card rendering logic inside the `renderWidget(block, payload)` switch.
- Use high-contrast CSS (pure black `#000` text, white `#fff` background, `#333` borders).
- Ensure typography is crisp and legible on an 800x600 e-ink screen.

## 5. Register in Layout Editor (`src/renderer/src/views/LayoutEditor.tsx`)
- Add widget definition to `TOOL_CONFIG_OPTIONS`.
- Add preview card representation.

## 6. Write Unit Test (`test/<widget-name>-collector.test.js`)
- Test standard data collection and fallback error handling.

## 7. Run Verification
```bash
npm test
npm run typecheck
npm run build
```
