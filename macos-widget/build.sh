#!/usr/bin/env bash
# Compila a extensão WidgetKit do PaperDeck e monta PaperDeckWidget.appex.
#
# Uso:
#   macos-widget/build.sh                 # → macos-widget/build/PaperDeckWidget.appex
#   macos-widget/build.sh --embed <App>   # também embute em <App>/Contents/PlugIns e reassina o app
#
# Variáveis:
#   WIDGET_ARCHS     "arm64", "x86_64" ou "arm64 x86_64" (padrão: arquitetura da máquina)
#   SIGN_IDENTITY    identidade do codesign (padrão: primeira "Developer ID Application"
#                    ou "Apple Development" do Keychain; senão "-" = ad-hoc)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/macos-widget"
OUT="${WIDGET_OUT_DIR:-$SRC/build}"
APPEX="$OUT/PaperDeckWidget.appex"
MIN_OS="14.0"
ARCHS="${WIDGET_ARCHS:-$(uname -m)}"
VERSION="$(node -p "require('$ROOT/package.json').version")"

pick_identity() {
  if [[ -n "${SIGN_IDENTITY:-}" ]]; then echo "$SIGN_IDENTITY"; return; fi
  local ids
  ids="$(security find-identity -v -p codesigning 2>/dev/null || true)"
  for kind in "Developer ID Application" "Apple Development"; do
    local hash
    hash="$(echo "$ids" | grep "\"$kind" | head -1 | awk '{print $2}')"
    if [[ -n "$hash" ]]; then echo "$hash"; return; fi
  done
  echo "-"
}

IDENTITY="$(pick_identity)"
SDK="$(xcrun --sdk macosx --show-sdk-path)"

rm -rf "$APPEX"
mkdir -p "$APPEX/Contents/MacOS" "$OUT/obj"

binaries=()
for arch in $ARCHS; do
  bin="$OUT/obj/PaperDeckWidget-$arch"
  xcrun swiftc -O -parse-as-library \
    -target "$arch-apple-macos$MIN_OS" -sdk "$SDK" \
    -framework SwiftUI -framework WidgetKit \
    -module-name PaperDeckWidget \
    "$SRC"/Sources/Shared/*.swift "$SRC"/Sources/Widget/*.swift \
    -o "$bin"
  binaries+=("$bin")
done
lipo -create "${binaries[@]}" -output "$APPEX/Contents/MacOS/PaperDeckWidget"

sed "s/__VERSION__/$VERSION/g" "$SRC/Info.plist" > "$APPEX/Contents/Info.plist"
plutil -lint -s "$APPEX/Contents/Info.plist"

codesign --force --sign "$IDENTITY" --options runtime --timestamp=none \
  --entitlements "$SRC/PaperDeckWidget.entitlements" "$APPEX"
echo "✓ $APPEX ($ARCHS, v$VERSION, signed: $([[ "$IDENTITY" == "-" ]] && echo ad-hoc || echo identity))"

if [[ "${1:-}" == "--embed" ]]; then
  APP="${2:?uso: build.sh --embed <PaperDeck.app>}"
  [[ -d "$APP/Contents" ]] || { echo "app não encontrado: $APP" >&2; exit 1; }
  mkdir -p "$APP/Contents/PlugIns"
  rm -rf "$APP/Contents/PlugIns/PaperDeckWidget.appex"
  cp -R "$APPEX" "$APP/Contents/PlugIns/"

  # Reassina só o bundle externo (sela o PlugIns novo) mantendo os entitlements
  # que o electron-builder aplicou ao executável principal.
  ENT="$OUT/obj/app.entitlements"
  codesign -d --entitlements - --xml "$APP" > "$ENT" 2>/dev/null || true
  ent_args=()
  if [[ -s "$ENT" ]]; then ent_args=(--entitlements "$ENT"); fi
  codesign --force --sign "$IDENTITY" --options runtime --timestamp=none "${ent_args[@]}" "$APP"
  codesign --verify --deep --strict "$APP"
  echo "✓ embutido e reassinado: $APP"
fi
