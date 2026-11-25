import Foundation

// MARK: - JSON solto
//
// O payload de /api/usage muda conforme o coletor e alguns números chegam como
// string ("12.6"). Um enum JSON simples evita quebrar o widget quando um campo
// muda ou some.

enum JSON: Decodable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSON])
    case object([String: JSON])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() { self = .null }
        else if let b = try? c.decode(Bool.self) { self = .bool(b) }
        else if let n = try? c.decode(Double.self) { self = .number(n) }
        else if let s = try? c.decode(String.self) { self = .string(s) }
        else if let a = try? c.decode([JSON].self) { self = .array(a) }
        else if let o = try? c.decode([String: JSON].self) { self = .object(o) }
        else { self = .null }
    }

    subscript(key: String) -> JSON {
        if case .object(let o) = self { return o[key] ?? .null }
        return .null
    }

    var double: Double? {
        switch self {
        case .number(let n): return n
        case .string(let s): return Double(s)
        default: return nil
        }
    }

    var string: String? {
        switch self {
        case .string(let s): return s
        case .number(let n): return n == n.rounded() ? String(Int(n)) : String(n)
        default: return nil
        }
    }

    var array: [JSON] {
        if case .array(let a) = self { return a }
        return []
    }
}

// MARK: - Snapshot exibido pelo widget

struct SystemInfo: Equatable {
    var cpuPct: Double
    var memPct: Double
    var memUsedGb: Double?
    var memTotalGb: Double?
    var cpuTempC: Double?
    var ssdTempC: Double?
    var thermalState: String?
    var uptime: String?
}

struct NetworkInfo: Equatable {
    var downloadBps: Double
    var uploadBps: Double
    var peakDownloadBps: Double
    var history: [Double]
    var kind: String?
    var portName: String?
}

struct DriveInfo: Equatable, Identifiable {
    var id: String
    var name: String
    var kind: String
    var pct: Double
    var usedGb: Double
    var totalGb: Double
    var freeGb: Double
}

struct DeckSnapshot: Equatable {
    var date: Date
    var online: Bool
    var system: SystemInfo?
    var network: NetworkInfo?
    var drives: [DriveInfo]

    static func offline(at date: Date = Date()) -> DeckSnapshot {
        DeckSnapshot(date: date, online: false, system: nil, network: nil, drives: [])
    }

    /// Converte o JSON de /api/usage nos dados do widget.
    static func parse(_ data: Data, at date: Date = Date()) -> DeckSnapshot? {
        guard let root = try? JSONDecoder().decode(JSON.self, from: data) else { return nil }
        var snapshot = DeckSnapshot(date: date, online: true, system: nil, network: nil, drives: [])
        for tool in root["tools"].array {
            if case .string("error") = tool["confidence"] { continue }
            switch tool["tool"].string {
            case "macstats":
                snapshot.system = SystemInfo(
                    cpuPct: tool["cpuPct"].double ?? 0,
                    memPct: tool["memPct"].double ?? 0,
                    memUsedGb: tool["memUsedGb"].double,
                    memTotalGb: tool["memTotalGb"].double,
                    cpuTempC: tool["cpuTempC"].double,
                    ssdTempC: tool["ssdTempC"].double,
                    thermalState: tool["thermalState"].string,
                    uptime: tool["uptime"].string
                )
            case "network":
                snapshot.network = NetworkInfo(
                    downloadBps: tool["downloadBps"].double ?? 0,
                    uploadBps: tool["uploadBps"].double ?? 0,
                    peakDownloadBps: tool["peakDownloadBps"].double ?? 0,
                    history: tool["downloadHistoryBps"].array.compactMap(\.double),
                    kind: tool["kind"].string,
                    portName: tool["portName"].string
                )
            case "storage":
                snapshot.drives = tool["drives"].array.map { d in
                    DriveInfo(
                        id: d["id"].string ?? d["name"].string ?? UUID().uuidString,
                        name: d["name"].string ?? "?",
                        kind: d["kind"].string ?? "unknown",
                        pct: d["pct"].double ?? 0,
                        usedGb: d["usedGb"].double ?? 0,
                        totalGb: d["totalGb"].double ?? 0,
                        freeGb: d["freeGb"].double ?? 0
                    )
                }
            default:
                break
            }
        }
        return snapshot
    }

    /// Dados de exemplo para a galeria de widgets e o placeholder.
    static let sample = DeckSnapshot(
        date: Date(),
        online: true,
        system: SystemInfo(cpuPct: 26, memPct: 78, memUsedGb: 12.5, memTotalGb: 16, cpuTempC: 62, ssdTempC: 48, thermalState: "nominal", uptime: "1d 14h"),
        network: NetworkInfo(
            downloadBps: 11_775_000, uploadBps: 287_500, peakDownloadBps: 12_250_000,
            history: [0.4, 0.6, 1.2, 0.8, 3.1, 9.8, 11.2, 10.9, 6.5, 11.8, 12.2, 11.9].map { $0 * 1_000_000 },
            kind: "ethernet", portName: "Ethernet"
        ),
        drives: [
            DriveInfo(id: "1", name: "Macintosh HD", kind: "nvme", pct: 91, usedGb: 208, totalGb: 228, freeGb: 20),
            DriveInfo(id: "2", name: "Backup", kind: "hdd", pct: 75, usedGb: 348, totalGb: 466, freeGb: 118),
            DriveInfo(id: "3", name: "Fotos", kind: "ssd", pct: 43, usedGb: 205, totalGb: 477, freeGb: 272),
            DriveInfo(id: "4", name: "PEN", kind: "flash", pct: 12, usedGb: 4, totalGb: 32, freeGb: 28),
        ]
    )
}

// MARK: - Formatação

enum Format {
    /// Velocidade em bits/s, como os provedores anunciam.
    static func rate(_ bytesPerSec: Double) -> (value: String, unit: String) {
        let bits = max(0, bytesPerSec) * 8
        func fmt(_ v: Double, _ digits: Int) -> String { v.formatted(.number.precision(.fractionLength(digits))) }
        if bits >= 1e9 { return (fmt(bits / 1e9, 2), "Gbps") }
        if bits >= 1e6 { return (fmt(bits / 1e6, bits >= 1e8 ? 0 : 1), "Mbps") }
        if bits >= 1e3 { return (fmt(bits / 1e3, 0), "Kbps") }
        return (fmt(bits, 0), "bps")
    }

    static func gb(_ gb: Double) -> String {
        gb >= 1000
            ? (gb / 1024).formatted(.number.precision(.fractionLength(1))) + " TB"
            : gb.formatted(.number.precision(.fractionLength(0))) + " GB"
    }

    static func pct(_ value: Double) -> String { "\(Int(value.rounded()))%" }
    static func temp(_ value: Double) -> String { "\(Int(value.rounded()))°C" }
}

// MARK: - Textos (en / pt / es)

enum L10n {
    private static let lang: String = {
        let code = Locale.current.language.languageCode?.identifier ?? "en"
        return ["pt", "es"].contains(code) ? code : "en"
    }()

    private static let table: [String: [String: String]] = [
        "download": ["en": "Download", "pt": "Download", "es": "Descarga"],
        "upload": ["en": "Upload", "pt": "Upload", "es": "Subida"],
        "peak": ["en": "peak", "pt": "pico", "es": "pico"],
        "cpu": ["en": "CPU", "pt": "CPU", "es": "CPU"],
        "ram": ["en": "RAM", "pt": "RAM", "es": "RAM"],
        "temp": ["en": "Temp", "pt": "Temp.", "es": "Temp."],
        "free": ["en": "free", "pt": "livre", "es": "libre"],
        "offline": ["en": "PaperDeck is not running", "pt": "PaperDeck não está aberto", "es": "PaperDeck no está abierto"],
        "offlineHint": ["en": "Open the app to see live data.", "pt": "Abra o app para ver os dados.", "es": "Abre la app para ver los datos."],
        "nvme": ["en": "NVMe", "pt": "NVMe", "es": "NVMe"],
        "ssd": ["en": "SSD", "pt": "SSD", "es": "SSD"],
        "hdd": ["en": "HDD", "pt": "HD", "es": "HDD"],
        "flash": ["en": "USB", "pt": "Pen", "es": "Pen"],
        "sd": ["en": "SD", "pt": "SD", "es": "SD"],
        "network": ["en": "NET", "pt": "Rede", "es": "Red"],
        "unknown": ["en": "Drive", "pt": "Disco", "es": "Disco"],
        "widgetName": ["en": "System & Network", "pt": "Sistema e Rede", "es": "Sistema y Red"],
        "widgetDesc": [
            "en": "Download speed, CPU, RAM, temperature and drives from PaperDeck.",
            "pt": "Velocidade de download, CPU, RAM, temperatura e discos do PaperDeck.",
            "es": "Velocidad de descarga, CPU, RAM, temperatura y discos de PaperDeck.",
        ],
    ]

    static func t(_ key: String) -> String { table[key]?[lang] ?? table[key]?["en"] ?? key }
}
