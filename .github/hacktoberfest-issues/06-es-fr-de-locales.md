---
title: "i18n: Add Spanish (`es.json`), French (`fr.json`), and German (`de.json`) Translations"
labels: ["translation", "hacktoberfest", "good first issue", "documentation"]
---

### Summary
Expand PaperDeck's multilingual support by translating the user interface, diagnostic messages, and dashboard strings into Spanish, French, and German.

### Background
PaperDeck automatically discovers languages from files placed in the `locales/` directory. No TypeScript code changes are necessary—simply copy `locales/en.json`, create the target file, and translate the values while preserving the keys and format placeholders (e.g. `{value}`, `{expiresAt}`).

### Target Files
- `locales/es.json` (Spanish)
- `locales/fr.json` (French)
- `locales/de.json` (German)

### Tasks
- [ ] Translate all keys in `meta`, `ui`, `auth`, and `dashboard`.
- [ ] Verify that variable placeholders (`{value}`, `{count}`) remain intact.
- [ ] Run `npm test` to ensure JSON syntax is valid.
