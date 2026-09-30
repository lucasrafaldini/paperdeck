<p align="center">
  <a href="README.md"><b>English</b></a> •
  <a href="README.pt.md"><b>Português</b></a> •
  <a href="README.es.md"><b>Español</b></a>
</p>

# PaperDeck 📟

<p align="center">
  <a href="https://hacktoberfest.com/"><img src="https://img.shields.io/badge/Hacktoberfest-2026-ff7a00?style=for-the-badge&logo=hacktoberfest&logoColor=white" alt="Hacktoberfest 2026" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licencia-MIT-blue.svg?style=for-the-badge" alt="Licencia MIT" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D24-brightgreen?style=for-the-badge&logo=node.js" alt="Node.js 24+" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-42+-47848F?style=for-the-badge&logo=electron" alt="Electron 42" /></a>
  <img src="https://img.shields.io/badge/Plataformas-macOS%20|%20Windows%20|%20Linux-lightgrey?style=for-the-badge" alt="Plataformas" />
</p>

> **Convierte tu Kindle con jailbreak en una estación de trabajo inteligente y panel de control e-ink.** Creado por **Lucas Rafaldini**.

PaperDeck ejecuta un servidor en segundo plano en tu ordenador (macOS, Windows o Linux) que recopila métricas locales de tus agentes de IA (Claude Code, Antigravity, OpenCode, Codex), el estado del sistema, reproducción de música y sitios web personalizados. Renderiza un lienzo monocromático de 800x600 de alto contraste y lo sirve vía HTTP a tu Kindle, que lo dibuja usando FBInk.

---

## 📸 Demostración / Capturas de Pantalla

| Panel de Control de Escritorio | Configuración de Kindle |
| :---: | :---: |
| ![Panel de Control](screenshot/painel.jpg) | ![Configuración de Kindle](screenshot/kindle-config.jpg) |

| Diagnósticos e Instalador | Inicios de Sesión y Autenticación |
| :---: | :---: |
| ![Diagnósticos e Instalación](screenshot/kindle-install.jpg) | ![Inicios de Sesión](screenshot/logins.jpg) |

| Picture-in-Picture (PiP) en Escritorio | En Vivo en Kindle Físico |
| :---: | :---: |
| ![Picture-in-Picture](screenshot/pip.jpg) | ![Ejemplo en Kindle](screenshot/exemplo.jpg) |

---

## ✨ Características Principales

- 📐 **Editor Visual de Distribución (Arrastrar y Soltar)**: Diseña, redimensiona y organiza tarjetas en tiempo real sobre la cuadrícula.
- 🤖 **Telemetría de IA y Agentes de Código**:
  - **Claude Code**: Límite móvil de 5 horas, cuota de 7 días, temporizador de reinicio y gráfico de tendencia semanal.
  - **Antigravity AI**: Barra de cuota de 5 horas, cuota semanal, contador de pasos de sesión y modelo activo.
  - **OpenCode**: Estado de ejecución, modelo activo, sesiones y consumo de tokens.
  - **OpenAI Codex**: Límites de tokens e historial de rollouts (compatible con escaneo en WSL).
- 👾 **Mascota Virtual Memtchi (Tamagotchi)**:
  - Compañero de escritorio en pixel-art viviendo en tu pantalla e-ink.
  - Control de hambre, felicidad y energía.
  - Acciones: Alimentar, Jugar, Limpiar, Dormir y reacciones humorísticas para desarrolladores.
- 🖥️ **Métricas del Sistema y Hardware**:
  - Uso de CPU en tiempo real, memoria RAM (GB / %), capacidad de disco, tiempo de actividad y modelo del equipo.
- 🎵 **Multimedia y Servicios Conectados**:
  - **Apple Music**: Pista actual, artista, álbum y barra de progreso en tiempo real.
  - **OmniRouter**: Analítica de tokens y latencia de pasarela de IA.
  - **Chaos Machine**: Estado y monitorización de servidor Linux remoto.
  - **Lector de Sitios Web / RSS**: Titulares y novedades de tus blogs favoritos.
- 🔋 **Optimización de Batería y Suspensión Profunda RTC**:
  - Horario de suspensión nocturna programada (01:00 a 10:00) y apagado del Wi-Fi entre actualizaciones (dura de **2 a 3 semanas** por carga).
  - Autodescubrimiento dinámico de IP vía mDNS (`paperdeck.local`) y escaneo de subred.
- 📱 **Gestor Multi-Kindle**: Controla y monitoriza múltiples dispositivos Kindle en tu hogar u oficina.

---

## ⚙️ Cómo Funciona

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│        Ordenador (Host)         │           │       Dispositivo Kindle        │
│                                 │           │                                 │
│  [Recolectores Locales]         │           │  [daemon dash-loop.sh]          │
│   ├─ Claude Code / OpenCode     │           │   1. Reconecta Wi-Fi            │
│   ├─ Antigravity / Codex        │   Wi-Fi   │   2. Descarga /dash.png (curl)  │
│   ├─ Mascota Virtual Memtchi    ├──────────►│   3. Dibuja en pantalla (FBInk) │
│   └─ Hardware y Sistema         │ HTTP:8787 │   4. Apaga el radio Wi-Fi       │
│                │                │           │   5. Entra en suspensión RTC    │
│                ▼                │           │                                 │
│       [Renderer Electron]       │           │                                 │
│     (Lienzo E-ink 800x600)      │           │                                 │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 🎃 Hacktoberfest y Cómo Contribuir

¡PaperDeck participa activamente en **Hacktoberfest**! Damos la bienvenida a contribuidores de todos los niveles para crear nuevos widgets, añadir traducciones, mejorar animaciones de la mascota y dar soporte a nuevos dispositivos Kindle.

### 💡 Tareas Disponibles (Good First Issues)
Revisa la carpeta [`.github/hacktoberfest-issues/`](.github/hacktoberfest-issues/) con propuestas listas para implementar:
1. **Widget del Clima (Open-Meteo)**: Pronóstico del tiempo, temperaturas e iconos en pixel-art.
2. **Widget Spotify (Now Playing)**: Canción actual, artista y barra de reproducción.
3. **Sensores Home Assistant**: Temperaturas, luces y enchufes inteligentes.
4. **Monitor de GitHub**: Revisiones de PR pendientes y notificaciones no leídas.
5. **Temporizador Pomodoro**: Bloques de concentración con avisos en el Kindle.
6. **Nuevos Idiomas**: Traducciones al Francés, Alemán, Italiano o Japonés.
7. **Soporte para Paperwhite 5**: Perfil de resolución retina de 1648x1236.
8. **Evolución del Tamagotchi**: Etapas de crecimiento y nuevas animaciones.

### 🚀 Flujo de Trabajo
1. Haz un Fork del repositorio: [https://github.com/lucasrafaldini/paperdeck](https://github.com/lucasrafaldini/paperdeck)
2. Crea tu rama: `git checkout -b feature/mi-nuevo-widget`
3. Realiza los cambios y verifica:
   ```bash
   npm test              # Ejecuta pruebas unitarias
   npm run typecheck     # Valida TypeScript
   npm run build         # Construye el paquete de producción
   ```
4. Abre un Pull Request siguiendo nuestra [Guía de Contribución](CONTRIBUTING.md) y el [Código de Conducta](CODE_OF_CONDUCT.md).

---

## 🚀 Inicio Rápido

### 1. Requisitos
- **Ordenador**: macOS, Windows 10/11 o Linux con **Node.js >= 24.0.0**.
- **Kindle**: Cualquier modelo con jailbreak (Paperwhite 2/3/4/5, Touch, Oasis, Voyage) con SSH y FBInk instalados.

### 2. Ejecutar desde el Código
```bash
# Clonar el repositorio
git clone https://github.com/lucasrafaldini/paperdeck.git
cd kindle-dashboard

# Instalar dependencias
npm install

# Iniciar la aplicación en modo desarrollo
npm run dev
```

### 3. Conectar tu Kindle
1. En la aplicación PaperDeck, ve a **Kindle > Configuración**.
2. Introduce la IP local de tu Kindle y las credenciales SSH (usuario por defecto: `root`).
3. Haz clic en **Guardar** y entra en la pestaña **Diagnósticos e Instalación**.
4. Haz clic en **Verificar Kindle** para comprobar SSH, FBInk y los scripts del sistema.
5. Pulsa en **Instalar scripts** y luego en **Iniciar script**.

Para una guía detallada paso a paso sobre el jailbreak y preparación del dispositivo, consulta [KINDLE-INSTALLATION.md](KINDLE-INSTALLATION.md).

---

## 🛠️ Comandos Esenciales

| Comando | Función |
| --- | --- |
| `npm run dev` | Inicia la aplicación Electron en modo desarrollo con HMR |
| `npm test` | Ejecuta la batería completa de pruebas unitarias (`node:test`) |
| `npm run typecheck` | Comprobación de tipos en TypeScript sin errores |
| `npm run build` | Compila el proyecto y genera los paquetes de distribución |
| `npm run build:mac` | Empaqueta la aplicación nativa para macOS (`.app` / `.dmg`) |
| `npm run build:win` | Genera el instalador independiente para Windows (`PaperDeck-<version>-setup.exe`) |

---

## 📚 Documentación y Enlaces

- 🤖 **Configuración de Proveedores de IA**: [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md) — Cómo conectar Claude Code, Antigravity, OpenCode, Codex y OmniRouter.
- 📟 **Preparación y Jailbreak de Kindle**: [KINDLE-INSTALLATION.md](KINDLE-INSTALLATION.md) — Guía de hardware, versiones de firmware, FBInk y diagramas.
- 🎃 **Guía de Contribución Hacktoberfest**: [CONTRIBUTING.md](CONTRIBUTING.md) — Normas de contribución y checklist de PR.
- 🤝 **Código de Conducta**: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Contributor Covenant v2.1.
- 🧠 **Instrucciones para Agentes**: [CLAUDE.md](CLAUDE.md) y [AGENTS.md](AGENTS.md) — Especificaciones para agentes de IA (Claude, Codex, OpenCode, Antigravity).
- 🌐 **Referencia de Idiomas**: [locales/README.md](locales/README.md) — Cómo añadir nuevas traducciones.
- 📜 **Historial de Versiones**: [CHANGELOG.md](CHANGELOG.md) — Notas de lanzamiento.

---

## 🔒 Privacidad y Seguridad

- **100% Local**: Ninguna métrica, token o telemetría se envía a servidores externos.
- **Credenciales Cifradas**: La contraseña SSH del Kindle se almacena cifrada mediante la API `safeStorage` de Electron.
- **Cero Secretos**: Nunca se suben al repositorio números de serie, nombres de equipo personales ni IPs privadas reales.

---

## 📄 Licencia

Este proyecto es de código abierto bajo la [Licencia MIT](LICENSE) © 2026 **Lucas Rafaldini**.
Concepto original inspirado en [alexishida/kindle-dashboard](https://github.com/alexishida/kindle-dashboard).
