#!/usr/bin/env node
// Builds the optional native helpers into build/bin/.
//
// Today that is only `paperdeck-temp` (macOS temperature sensors). The helper
// is optional: when clang is missing or the platform is not macOS this script
// warns and exits 0, and the Mac Stats widget simply hides the temperature.
//
// Usage: node scripts/build-native.js

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'build', 'bin');
const SOURCE = path.join(ROOT, 'native', 'paperdeck-temp.c');
const TARGET = path.join(OUT_DIR, 'paperdeck-temp');

function isUpToDate() {
  try {
    return fs.statSync(TARGET).mtimeMs >= fs.statSync(SOURCE).mtimeMs;
  } catch {
    return false;
  }
}

function build() {
  // Keep the directory around on every platform so packaging globs never miss.
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (process.platform !== 'darwin') {
    console.log('[build-native] skipping paperdeck-temp (macOS only)');
    return 0;
  }
  if (isUpToDate()) {
    console.log('[build-native] paperdeck-temp is up to date');
    return 0;
  }
  try {
    execFileSync('clang', [
      '-O2',
      '-arch', 'arm64',
      '-arch', 'x86_64',
      '-mmacosx-version-min=12.0',
      '-o', TARGET,
      SOURCE,
      '-framework', 'IOKit',
      '-framework', 'CoreFoundation',
    ], { stdio: 'inherit' });
    console.log(`[build-native] built ${path.relative(ROOT, TARGET)}`);
  } catch (error) {
    console.warn(`[build-native] could not build paperdeck-temp (${error.message}); temperature will be hidden`);
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = build();
}

module.exports = { build, TARGET };
