# PaperDeck macOS widget (WidgetKit)

Native desktop / Notification Center widget showing PaperDeck's **System & Network** data:
download speed (hero), upload, CPU, RAM, CPU/SSD temperature and drives.

- `Sources/Shared/` – payload parsing (`Models.swift`) and SwiftUI views (`Views.swift`), shared with the preview tool.
- `Sources/Widget/` – WidgetKit glue: timeline provider and widget configuration.
- `Preview/RenderPreviews.swift` – renders the small / medium / large sizes to PNG without installing anything.
- `build.sh` – compiles with `swiftc`, assembles `PaperDeckWidget.appex` and signs it (sandbox + network client).

## How it gets data

The extension calls the backend the app already runs:
`http://127.0.0.1:8787/api/usage?widgets=macstats,network,storage`. No App Group or shared container is needed.
macOS decides when to refresh the widget. It asks for a refresh every 5 min, or every 1 min while the app is closed.
That means **network speed is a recent snapshot, not live**.

## Build

`npm run build:mac` embeds it automatically through the `afterSign` hook (`scripts/mac-widget-after-sign.js`).
The hook skips the widget when Xcode is missing or when `PAPERDECK_MAC_WIDGET=0`.

Manual steps:

```bash
macos-widget/build.sh                                  # → macos-widget/build/PaperDeckWidget.appex
macos-widget/build.sh --embed release/mac-arm64/PaperDeck.app
```

Signing uses the first `Developer ID Application` or `Apple Development` identity in the keychain. Set `SIGN_IDENTITY` to override it; without an identity it falls back to ad-hoc signing.
The app must live in `/Applications` and be opened once before the widget shows up in the widget gallery.

Preview:

```bash
xcrun swiftc -parse-as-library -target arm64-apple-macos14.0 -framework SwiftUI -framework WidgetKit -framework AppKit \
  macos-widget/Sources/Shared/*.swift macos-widget/Preview/RenderPreviews.swift -o /tmp/render-previews
/tmp/render-previews /tmp/widget-previews            # sample data
curl -s 'http://127.0.0.1:8787/api/usage?widgets=macstats,network,storage' > /tmp/usage.json
/tmp/render-previews /tmp/widget-previews /tmp/usage.json
```

Requires macOS 14+ (`containerBackground`).
