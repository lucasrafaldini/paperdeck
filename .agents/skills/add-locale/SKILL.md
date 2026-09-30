---
name: add-locale
description: Step-by-step workflow to add and synchronize a new internationalization locale in PaperDeck.
---

# Add Locale Skill

Use this skill whenever an agent is tasked with adding or updating a language translation dictionary in PaperDeck.

## 1. Identify Language Code
- Determine the ISO 639-1 / BCP-47 tag (e.g., `es` for Spanish, `fr` for French, `de` for German, `ja` for Japanese).
- Name the target file `locales/<lang-code>.json`.

## 2. Copy Base Structure from `locales/en.json`
- `locales/en.json` is the canonical reference.
- Maintain the three primary namespaces:
  1. `meta`: `{ "name": "Español", "locale": "es-ES", "currency": "EUR" }`
  2. `ui`: all Electron desktop UI labels, buttons, forms, tooltips, dialogs.
  3. `auth`: CLI preflight and diagnostic messages.
  4. `dashboard`: strings rendered on the Kindle e-ink display.

## 3. Verify Key Completeness
- Do not remove keys. Any missing key in the new file will automatically fall back to `en.json`, but for complete support all keys should be provided.
- Preserve format parameters like `{value}`, `{expiresAt}`, `{count}`, `{mode}`.

## 4. Automatic Discovery
- The app discovers translation files automatically from `locales/`. No TypeScript changes are necessary in `src/`.

## 5. Validate
- Ensure JSON is valid UTF-8 without BOM:
  ```bash
  node -e "JSON.parse(require('fs').readFileSync('locales/<lang-code>.json', 'utf8'))"
  ```
- Run tests:
  ```bash
  npm test
  ```
