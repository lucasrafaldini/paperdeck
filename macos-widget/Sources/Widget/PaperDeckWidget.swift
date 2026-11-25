import SwiftUI
import WidgetKit

// Extensão WidgetKit do PaperDeck. Busca os dados no backend local que o app
// Electron já roda (http://127.0.0.1:8787) — sem App Group nem pasta
// compartilhada; a extensão só precisa do entitlement de cliente de rede.

private let backendURL = URL(string: "http://127.0.0.1:8787/api/usage?widgets=macstats,network,storage")!
private let refreshInterval: TimeInterval = 5 * 60

struct DeckEntry: TimelineEntry {
    let date: Date
    let snapshot: DeckSnapshot
}

struct DeckProvider: TimelineProvider {
    func placeholder(in context: Context) -> DeckEntry {
        DeckEntry(date: Date(), snapshot: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (DeckEntry) -> Void) {
        if context.isPreview {
            completion(DeckEntry(date: Date(), snapshot: .sample))
            return
        }
        Task {
            let snapshot = await fetchSnapshot()
            completion(DeckEntry(date: snapshot.date, snapshot: snapshot))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<DeckEntry>) -> Void) {
        Task {
            let snapshot = await fetchSnapshot()
            let entry = DeckEntry(date: snapshot.date, snapshot: snapshot)
            // Sem o app aberto não há o que mostrar: tenta de novo mais cedo.
            let next = Date().addingTimeInterval(snapshot.online ? refreshInterval : 60)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    private func fetchSnapshot() async -> DeckSnapshot {
        var request = URLRequest(url: backendURL)
        request.timeoutInterval = 6
        request.cachePolicy = .reloadIgnoringLocalCacheData
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200,
                  let snapshot = DeckSnapshot.parse(data) else { return .offline() }
            return snapshot
        } catch {
            return .offline()
        }
    }
}

struct DeckWidgetEntryView: View {
    @Environment(\.widgetFamily) private var family
    let entry: DeckEntry

    var body: some View {
        DeckWidgetView(snapshot: entry.snapshot, size: size)
            .containerBackground(for: .widget) { Color.white.opacity(0.0) }
    }

    private var size: DeckSize {
        switch family {
        case .systemSmall: return .small
        case .systemLarge, .systemExtraLarge: return .large
        default: return .medium
        }
    }
}

struct PaperDeckSystemWidget: Widget {
    let kind = "PaperDeckSystemNetwork"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: DeckProvider()) { entry in
            DeckWidgetEntryView(entry: entry)
        }
        .configurationDisplayName(L10n.t("widgetName"))
        .description(L10n.t("widgetDesc"))
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}

@main
struct PaperDeckWidgets: WidgetBundle {
    var body: some Widget {
        PaperDeckSystemWidget()
    }
}
