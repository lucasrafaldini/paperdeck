<p align="center">
  <a href="README.md"><b>English</b></a> •
  <a href="README.pt.md"><b>Português</b></a> •
  <a href="README.es.md"><b>Español</b></a>
</p>

# PaperDeck 📟

<p align="center">
  <a href="https://hacktoberfest.com/"><img src="https://img.shields.io/badge/Hacktoberfest-2026-ff7a00?style=for-the-badge&logo=hacktoberfest&logoColor=white" alt="Hacktoberfest 2026" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/Licen%C3%A7a-MIT-blue.svg?style=for-the-badge" alt="Licença MIT" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-%3E%3D24-brightgreen?style=for-the-badge&logo=node.js" alt="Node.js 24+" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0+-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.electronjs.org/"><img src="https://img.shields.io/badge/Electron-42+-47848F?style=for-the-badge&logo=electron" alt="Electron 42" /></a>
  <img src="https://img.shields.io/badge/Plataformas-macOS%20|%20Windows%20|%20Linux-lightgrey?style=for-the-badge" alt="Plataformas" />
</p>

> **Transforme seu Kindle com jailbreak em uma estação de trabalho inteligente e dashboard de mesa com tela e-ink.** Criado por **Lucas Rafaldini**.

O PaperDeck executa um servidor em segundo plano no seu computador (macOS, Windows ou Linux) que coleta métricas dos seus agentes de IA (Claude Code, Antigravity, OpenCode, Codex), saúde da máquina, música em reprodução e sites personalizados. Ele renderiza uma tela monocromática de alto contraste de 800x600 e a serve via HTTP para o seu Kindle, que a desenha usando o FBInk.

---

## 📸 Demonstração / Screenshots

| Painel de Controle Desktop | Configuração do Kindle |
| :---: | :---: |
| ![Painel de Controle](screenshot/painel.jpg) | ![Configuração do Kindle](screenshot/kindle-config.jpg) |

| Diagnóstico e Instalador de Scripts | Autenticações e Logins |
| :---: | :---: |
| ![Diagnósticos e Instalação](screenshot/kindle-install.jpg) | ![Logins](screenshot/logins.jpg) |

| Picture-in-Picture (PiP) no Computador | Ao Vivo no Kindle Físico |
| :---: | :---: |
| ![Picture-in-Picture](screenshot/pip.jpg) | ![Exemplo no Kindle](screenshot/exemplo.jpg) |

---

## ✨ Principais Funcionalidades

- 📐 **Editor Visual de Layout (Arrastar e Soltar)**: Monte, redimensione e organize cards em tempo real na grade.
- 🤖 **Telemetria de IA e Agentes de Desenvolvimento**:
  - **Claude Code**: Limite móvel de 5 horas, cota de 7 dias, contadores de reset e gráfico histórico semanal.
  - **Antigravity AI**: Barra de cota de 5 horas, cota semanal, contador de passos da sessão e modelo ativo.
  - **OpenCode**: Status de execução, modelo ativo, contagem de sessões e consumo de tokens.
  - **OpenAI Codex**: Limite de tokens e histórico de rollouts (suporta varredura no WSL).
- 👾 **Mascote Virtual Memtchi (Tamagotchi)**:
  - Companheiro em pixel-art vivendo na sua tela e-ink.
  - Gerenciamento de fome, felicidade e energia.
  - Ações interativas: Alimentar, Brincar, Limpar, Dormir e reações bem-humoradas de desenvolvedor.
- 🖥️ **Métricas de Hardware e Sistema**:
  - Uso de CPU em tempo real, memória RAM (GB / %), capacidade de disco, uptime e modelo do Mac/PC.
- 🎵 **Mídia e Serviços Conectados**:
  - **Apple Music**: Faixa atual, artista, álbum e barra de progresso em tempo real.
  - **OmniRouter**: Consumo de tokens e latência de gateway de IA.
  - **Chaos Machine**: Monitoramento e saúde de servidor Linux remoto.
  - **Monitor de Sites / RSS**: Manchetes e novidades dos seus blogs e feeds favoritos.
- 🔋 **Otimização de Bateria e Sono Profundo RTC**:
  - Horário de descanso noturno automático (01:00 às 10:00) e desligamento de Wi-Fi entre atualizações (dura de **2 a 3 semanas** por carga).
  - Auto-descoberta dinâmica de IP via mDNS (`paperdeck.local`) e varredura de sub-rede.
- 📱 **Gerenciador Multi-Kindle**: Cadastre e monitore múltiplos dispositivos Kindle pela casa ou escritório.

---

## ⚙️ Como Funciona

```
┌─────────────────────────────────┐           ┌─────────────────────────────────┐
│       Computador (Host)         │           │        Dispositivo Kindle       │
│                                 │           │                                 │
│  [Coletores Locais]             │           │  [daemon dash-loop.sh]          │
│   ├─ Claude Code / OpenCode     │           │   1. Reconecta o Wi-Fi          │
│   ├─ Antigravity / Codex        │   Wi-Fi   │   2. Baixa /dash.png (curl)     │
│   ├─ Mascote Virtual Memtchi    ├──────────►│   3. Desenha na tela com FBInk  │
│   └─ Hardware e Sistema         │ HTTP:8787 │   4. Desliga o rádio Wi-Fi      │
│                │                │           │   5. Entra em sono profundo RTC │
│                ▼                │           │                                 │
│       [Renderer Electron]       │           │                                 │
│     (Canvas E-ink 800x600)      │           │                                 │
└─────────────────────────────────┘           └─────────────────────────────────┘
```

---

## 🎃 Hacktoberfest e Como Contribuir

O PaperDeck participa com orgulho do **Hacktoberfest**! Convidamos pessoas de todos os níveis de experiência a colaborar criando novos widgets, adicionando traduções, melhorando animações do mascote ou testando novos modelos de Kindle.

### 💡 Good First Issues Disponíveis
Consulte a pasta [`.github/hacktoberfest-issues/`](.github/hacktoberfest-issues/) com tarefas prontas:
1. **Widget de Clima (Open-Meteo)**: Previsão do tempo, temperaturas e ícones em pixel art.
2. **Widget Spotify (Now Playing)**: Faixa, artista e barra de progresso ao vivo.
3. **Sensores Home Assistant**: Temperatura, luzes ativas e consumo de energia.
4. **Rastreador GitHub**: Revisões de PR pendentes e alertas de notificações.
5. **Timer Pomodoro**: Foco no trabalho com alertas de intervalo no Kindle.
6. **Novos Idiomas**: Tradução para Espanhol, Francês, Alemão e Italiano.
7. **Suporte ao Paperwhite 5**: Perfil de resolução retina de 1648x1236.
8. **Evolução do Tamagotchi**: Fases de idade e novas reações animadas.

### 🚀 Fluxo de Contribuição
1. Faça um Fork do repositório: [https://github.com/lucasrafaldini/paperdeck](https://github.com/lucasrafaldini/paperdeck)
2. Crie uma branch para sua funcionalidade: `git checkout -b feature/meu-novo-widget`
3. Faça suas alterações e verifique:
   ```bash
   npm test              # Roda testes unitários
   npm run typecheck     # Valida TypeScript
   npm run build         # Cria build de produção
   ```
4. Abra um Pull Request seguindo nosso [Guia de Contribuição](CONTRIBUTING.md) e o [Código de Conduta](CODE_OF_CONDUCT.md).

---

## 🚀 Início Rápido

### 1. Requisitos
- **Computador**: macOS, Windows 10/11 ou Linux com **Node.js >= 24.0.0**.
- **Kindle**: Qualquer Kindle com jailbreak (Paperwhite 2/3/4/5, Touch, Oasis, Voyage) com SSH e FBInk instalados.

### 2. Executando a Partir do Código
```bash
# Clonar o repositório
git clone https://github.com/lucasrafaldini/paperdeck.git
cd kindle-dashboard

# Instalar dependências
npm install

# Iniciar aplicativo desktop em desenvolvimento
npm run dev
```

### 3. Conectando seu Kindle
1. No aplicativo PaperDeck, vá em **Kindle > Configurações**.
2. Preencha o IP local do seu Kindle e as credenciais SSH (usuário padrão: `root`).
3. Clique em **Salvar** e vá para a aba **Diagnóstico e Instalação**.
4. Clique em **Verificar Kindle** para testar SSH, FBInk e scripts.
5. Clique em **Instalar scripts** e em seguida **Iniciar script**.

Para um guia passo a passo completo de jailbreak e instalação no aparelho, consulte o [KINDLE-INSTALLATION.md](KINDLE-INSTALLATION.md).

---

## 🛠️ Comandos Essenciais

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Abre o app Electron em modo de desenvolvimento com Vite HMR |
| `npm test` | Executa a suíte de testes unitários (`node:test`) |
| `npm run typecheck` | Executa análise estática de TypeScript com 0 erros |
| `npm run build` | Compila o projeto e gera os pacotes do Electron |
| `npm run build:mac` | Gera o executável nativo para macOS (`.app` / `.dmg`) |
| `npm run build:win` | Gera o instalador standalone para Windows (`PaperDeck-<version>-setup.exe`) |

---

## 📚 Documentação e Manuais

- 🤖 **Configuração de Provedores de IA**: [docs/AI_PROVIDERS.md](docs/AI_PROVIDERS.md) — Como conectar Claude Code, Antigravity, OpenCode, Codex e OmniRouter.
- 📟 **Preparação e Jailbreak do Kindle**: [KINDLE-INSTALLATION.md](KINDLE-INSTALLATION.md) — Compatibilidade, firmware, FBInk, SSH e diagramas.
- 🎃 **Guia de Contribuição Hacktoberfest**: [CONTRIBUTING.md](CONTRIBUTING.md) — Regras de contribuição e checklist de PR.
- 🤝 **Código de Conduta**: [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Contributor Covenant v2.1.
- 🧠 **Diretrizes para Agentes**: [CLAUDE.md](CLAUDE.md) e [AGENTS.md](AGENTS.md) — Especificações para agentes autônomos (Claude, Codex, OpenCode, Antigravity).
- 🌐 **Internacionalização**: [locales/README.md](locales/README.md) — Como adicionar novos idiomas.
- 📜 **Histórico de Mudanças**: [CHANGELOG.md](CHANGELOG.md) — Notas de lançamento.

---

## 🔒 Privacidade e Segurança

- **100% Local**: Nenhuma métrica, token ou telemetria pessoal é enviada para servidores externos.
- **Senhas Criptografadas**: A senha SSH do Kindle é gravada de forma criptografada usando a API `safeStorage` do Electron.
- **Zero Segredos**: Seriais, hostnames pessoais e IPs reais nunca são commitados no repositório.

---

## 📄 Licença

Este projeto é de código aberto sob a [Licença MIT](LICENSE) © 2026 **Lucas Rafaldini**.
Conceito original inspirado em [alexishida/kindle-dashboard](https://github.com/alexishida/kindle-dashboard).
