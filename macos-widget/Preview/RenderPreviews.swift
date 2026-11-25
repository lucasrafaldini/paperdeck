import AppKit
import SwiftUI

// Renderiza os três tamanhos do widget em PNG, sem precisar instalá-lo.
//   swiftc ... Sources/Shared/*.swift Preview/RenderPreviews.swift -o render-previews
//   ./render-previews <saída> [usage.json]
// Sem JSON, usa os dados de exemplo.

@main
struct RenderPreviews {
    @MainActor
    static func main() throws {
        let args = CommandLine.arguments
        let outDir = URL(fileURLWithPath: args.count > 1 ? args[1] : ".")
        var snapshot = DeckSnapshot.sample
        if args.count > 2, let data = FileManager.default.contents(atPath: args[2]),
           let parsed = DeckSnapshot.parse(data) {
            snapshot = parsed
        }
        try FileManager.default.createDirectory(at: outDir, withIntermediateDirectories: true)

        // Tamanhos aproximados dos widgets do macOS (pt), com 16 pt de margem interna.
        let sizes: [(String, DeckSize, CGSize)] = [
            ("small", .small, CGSize(width: 170, height: 170)),
            ("medium", .medium, CGSize(width: 364, height: 170)),
            ("large", .large, CGSize(width: 364, height: 382)),
        ]
        for (name, size, frame) in sizes {
            let view = DeckWidgetView(snapshot: snapshot, size: size)
                .padding(16)
                .frame(width: frame.width, height: frame.height)
                .background(Color.white)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .environment(\.colorScheme, .light)
            let renderer = ImageRenderer(content: view)
            renderer.scale = 2
            guard let image = renderer.nsImage,
                  let tiff = image.tiffRepresentation,
                  let png = NSBitmapImageRep(data: tiff)?.representation(using: .png, properties: [:]) else {
                throw NSError(domain: "render", code: 1)
            }
            let url = outDir.appendingPathComponent("widget-\(name).png")
            try png.write(to: url)
            print(url.path)
        }
    }
}
