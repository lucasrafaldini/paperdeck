import SwiftUI
#if canImport(WidgetKit)
import WidgetKit
#endif

// Visual "e-ink" do PaperDeck: preto no branco, tipografia pesada, barras
// com contorno. Usa só .primary/.secondary para que os modos de renderização
// do macOS (colorido, tingido, monocromático da mesa) funcionem sozinhos.

enum DeckSize {
    case small, medium, large
}

struct DeckWidgetView: View {
    let snapshot: DeckSnapshot
    let size: DeckSize

    var body: some View {
        Group {
            if !snapshot.online {
                OfflineView()
            } else {
                switch size {
                case .small: SmallLayout(snapshot: snapshot)
                case .medium: MediumLayout(snapshot: snapshot)
                case .large: LargeLayout(snapshot: snapshot)
                }
            }
        }
        .foregroundStyle(.primary)
    }
}

// MARK: - Layouts

private struct SmallLayout: View {
    let snapshot: DeckSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Header(date: snapshot.date)
            if let net = snapshot.network {
                DownloadHero(network: net, valueSize: 40)
            }
            Spacer(minLength: 0)
            if let sys = snapshot.system {
                HStack(spacing: 6) {
                    Text("\(L10n.t("cpu")) \(Format.pct(sys.cpuPct))")
                    if let t = sys.cpuTempC { Text("· \(Format.temp(t))") }
                }
                .font(.system(size: 12, weight: .bold))
                Meter(value: sys.cpuPct, height: 6)
            }
        }
    }
}

private struct MediumLayout: View {
    let snapshot: DeckSnapshot

    var body: some View {
        HStack(alignment: .top, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Header(date: snapshot.date)
                if let net = snapshot.network {
                    DownloadHero(network: net, valueSize: 38)
                    UploadLine(network: net)
                    Sparkline(values: net.history)
                        .frame(maxHeight: .infinity)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Rectangle().frame(width: 2).opacity(0.85)

            SystemColumn(system: snapshot.system)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
    }
}

private struct LargeLayout: View {
    let snapshot: DeckSnapshot

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            MediumLayout(snapshot: snapshot)
                .frame(height: 150)
            Rectangle().frame(height: 2).opacity(0.85)
            DriveList(drives: Array(snapshot.drives.prefix(4)))
            Spacer(minLength: 0)
        }
    }
}

// MARK: - Peças

private struct Header: View {
    let date: Date

    var body: some View {
        HStack(spacing: 4) {
            Text("PaperDeck")
                .font(.system(size: 11, weight: .heavy))
                .widgetAccentableIfAvailable()
            Spacer(minLength: 4)
            Text(date, style: .time)
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
        }
    }
}

private struct DownloadHero: View {
    let network: NetworkInfo
    let valueSize: CGFloat

    var body: some View {
        let rate = Format.rate(network.downloadBps)
        VStack(alignment: .leading, spacing: 0) {
            Text("▼ \(L10n.t("download").uppercased())")
                .font(.system(size: 10, weight: .heavy))
                .kerning(0.6)
            HStack(alignment: .firstTextBaseline, spacing: 3) {
                Text(rate.value)
                    .font(.system(size: valueSize, weight: .black))
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                    .widgetAccentableIfAvailable()
                Text(rate.unit)
                    .font(.system(size: valueSize * 0.38, weight: .bold))
            }
        }
    }
}

private struct UploadLine: View {
    let network: NetworkInfo

    var body: some View {
        let up = Format.rate(network.uploadBps)
        let peak = Format.rate(network.peakDownloadBps)
        HStack {
            Text("▲ \(up.value) \(up.unit)")
            Spacer(minLength: 4)
            Text("\(L10n.t("peak")) \(peak.value)")
                .foregroundStyle(.secondary)
        }
        .font(.system(size: 11, weight: .bold))
        .lineLimit(1)
    }
}

private struct SystemColumn: View {
    let system: SystemInfo?

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            if let sys = system {
                LabeledMeter(label: L10n.t("cpu"), value: Format.pct(sys.cpuPct), pct: sys.cpuPct)
                LabeledMeter(label: L10n.t("ram"), value: Format.pct(sys.memPct), pct: sys.memPct)
                if let t = sys.cpuTempC {
                    LabeledMeter(label: "\(L10n.t("temp")) \(L10n.t("cpu"))", value: Format.temp(t), pct: t)
                }
                HStack(spacing: 6) {
                    if let ssd = sys.ssdTempC { Text("SSD \(Format.temp(ssd))") }
                    if let up = sys.uptime { Text("· \(up)") }
                }
                .font(.system(size: 10, weight: .semibold))
                .foregroundStyle(.secondary)
                .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
    }
}

private struct LabeledMeter: View {
    let label: String
    let value: String
    let pct: Double

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            HStack {
                Text(label)
                Spacer(minLength: 4)
                Text(value)
            }
            .font(.system(size: 12, weight: .bold))
            Meter(value: pct, height: 8)
        }
    }
}

private struct DriveList: View {
    let drives: [DriveInfo]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            ForEach(drives) { drive in
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(L10n.t(drive.kind).uppercased())
                            .font(.system(size: 9, weight: .heavy))
                            .padding(.horizontal, 4)
                            .padding(.vertical, 1)
                            .overlay(Rectangle().stroke(lineWidth: 1.5))
                        Text(drive.name)
                            .font(.system(size: 12, weight: .bold))
                            .lineLimit(1)
                            .truncationMode(.middle)
                        Spacer(minLength: 4)
                        Text(Format.pct(drive.pct))
                            .font(.system(size: 12, weight: .bold))
                    }
                    Meter(value: drive.pct, height: 6)
                    Text("\(Format.gb(drive.usedGb)) / \(Format.gb(drive.totalGb)) · \(Format.gb(drive.freeGb)) \(L10n.t("free"))")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            }
        }
    }
}

/// Barra de progresso com contorno, legível em monocromático.
struct Meter: View {
    let value: Double
    let height: CGFloat

    var body: some View {
        GeometryReader { geo in
            let fraction = min(1, max(0, value / 100))
            ZStack(alignment: .leading) {
                Rectangle().stroke(lineWidth: 1.5)
                Rectangle()
                    .frame(width: max(0, geo.size.width * fraction))
                    .widgetAccentableIfAvailable()
            }
        }
        .frame(height: height)
    }
}

/// Histórico de download (últimos ~10 min) em barras.
struct Sparkline: View {
    let values: [Double]
    var slots: Int = 20

    var body: some View {
        GeometryReader { geo in
            let list = Array(values.suffix(slots))
            let maxValue = max(list.max() ?? 0, 1)
            let slotWidth = geo.size.width / CGFloat(slots)
            ZStack(alignment: .bottomLeading) {
                Rectangle().frame(height: 1.5).frame(maxHeight: .infinity, alignment: .bottom)
                HStack(alignment: .bottom, spacing: 0) {
                    Spacer(minLength: 0)
                    ForEach(Array(list.enumerated()), id: \.offset) { _, v in
                        Rectangle()
                            .frame(width: max(1, slotWidth - 2), height: max(1, geo.size.height * CGFloat(v / maxValue)))
                            .frame(width: slotWidth)
                    }
                }
            }
        }
        .frame(minHeight: 14)
    }
}

private struct OfflineView: View {
    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("PaperDeck")
                .font(.system(size: 13, weight: .heavy))
            Spacer(minLength: 0)
            Text(L10n.t("offline"))
                .font(.system(size: 14, weight: .bold))
            Text(L10n.t("offlineHint"))
                .font(.system(size: 11))
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }
}

extension View {
    /// `widgetAccentable()` só existe com WidgetKit; fora dele (prévia) é no-op.
    @ViewBuilder
    func widgetAccentableIfAvailable() -> some View {
        #if canImport(WidgetKit)
        self.widgetAccentable()
        #else
        self
        #endif
    }
}
