---
name: test-and-verify
description: Comprehensive test execution, typecheck, and build verification workflow for PaperDeck.
---

# Test and Verify Skill

Use this skill to execute and diagnose automated tests, static typing, and production build pipelines.

## 1. Run Unit Tests
```bash
npm test
```
- Tests live in `test/` and run using Node's built-in `node:test` runner.
- Expected output: `pass 40`, `fail 0`.
- If a test fails, inspect the mock environment or missing collector exports.

## 2. Run TypeScript Static Analysis
```bash
npm run typecheck
```
- Executes both:
  1. `npm run typecheck:node` (main process & preload via `tsconfig.node.json`)
  2. `npm run typecheck:web` (React renderer via `tsconfig.web.json`)
- All types must resolve cleanly with 0 errors.

## 3. Production Build Validation
```bash
npm run build
```
- Executes `electron-vite build`.
- Generates bundles in `dist/main/`, `dist/preload/`, and `dist/renderer/`.
