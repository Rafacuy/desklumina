# 02 - Installation

This guide covers the complete installation process for DeskLumina, from prerequisites to configuration.

> **Note:** Throughout this documentation, `~/.config/bspwm/agent/` is used as the base path where DeskLumina is installed.

---

## Prerequisites

### Required

| Requirement | Version | Purpose |
|-------------|---------|---------|
| [Bun](https://bun.sh) | v1.3.9+ | JavaScript runtime |
| BSPWM | Latest | Window manager |
| Groq API Key | — | AI functionality |

### Optional Dependencies

| Package | Purpose |
|---------|---------|
| Rofi | Interactive UI mode |
| Dunst | Desktop notifications |
| Clipcat | Clipboard management |
| MPD + MPC | Media control |

### Recommended Setup

DeskLumina is designed for the [gh0stzk dotfiles](https://github.com/gh0stzk/dotfiles) configuration. For the best experience, install the dotfiles first.

---

## Step 1: Install Bun

If you don't have Bun installed:

```bash
# Using curl (recommended)
curl -fsSL https://bun.sh/install | bash

# Or using npm
npm install -g bun
```

Verify installation:

```bash
bun --version
```

---

## Step 2: Clone the Repository

```bash
# Clone from GitHub to your BSPWM agent config directory
git clone https://github.com/Rafacuy/desklumina.git ~/.config/bspwm/agent
cd ~/.config/bspwm/agent
```

---

## Step 3: Install Dependencies

```bash
bun install
```

This installs all required dependencies including:
- `edge-tts-universal` — Text-to-speech support
- TypeScript types

---

## Step 4: Configure Environment

### Get a Groq API Key

1. Visit [console.groq.com](https://console.groq.com)
2. Sign in or create an account
3. Navigate to API Keys
4. Create a new API key

### Create Environment File

```bash
# Copy the example file
cp .env.example .env

# Edit the file
nano .env
```

### Environment Variables

```bash
# Required: Your Groq API key
GROQ_API_KEY=your_groq_api_key_here

# Required: Primary AI model to use
MODEL_NAME=openai/gpt-oss-120b

# Optional: Fallback models (comma-separated)
FALLBACK_MODELS=llama-3.3-70b-versatile,llama-3.1-8b-instant,openai/gpt-oss-20b
```

### Available Models

| Model | Description |
|-------|-------------|
| `openai/gpt-oss-120b` | Default, high-quality responses |
| `llama-3.3-70b-versatile` | Fast fallback option |
| `llama-3.1-8b-instant` | Ultra-fast lightweight model |
| `openai/gpt-oss-20b` | Alternative fallback |

---

## Step 5: Verify Installation

Run the type checker to ensure everything is set up correctly:

```bash
bun run lint
```

Test the basic functionality:

```bash
# Terminal chat mode
bun run dev

# Or test a direct command
bun run src/main.ts --exec "what time is it"
```

---

## Directory Structure

After installation, your directory should look like this:

```
~/.config/bspwm/agent/
├── .env                    # Your API configuration
├── .env.example            # Environment template
├── .gitignore
├── bun.lock
├── LICENSE
├── package.json
├── README.md
├── settings.json           # Feature flags
├── tsconfig.json
├── docs/                   # Documentation
├── scripts/                # Utility scripts
├── src/                    # Source code
│   ├── main.ts            # Entry point
│   ├── ai/                # AI integration
│   ├── config/            # Configuration
│   ├── constants/         # Constants
│   ├── core/              # Core logic
│   ├── daemon/            # Daemon mode
│   ├── logger/            # Logging
│   ├── security/          # Security features
│   ├── tools/             # Tool handlers
│   ├── ui/                # User interface
│   └── utils/             # Utilities
├── systemd/               # Systemd service files
├── chats/                # Chat history storage
├── logs/                 # Log files
└── tests/                # Test files
```

---

## Optional: Systemd Service

To run DeskLumina as a background service that starts automatically:

### Find Your Bun Path

```bash
which bun
```

Common paths:
- `/usr/bin/bun` — System package installation
- `~/.bun/bin/bun` — Bun installer script
- `/usr/local/bin/bun` — Global installation

### Update Service File

Edit `systemd/desklumina-daemon@.service` and set your bun path:

```ini
ExecStart=/path/to/your/bun run src/main.ts --daemon
```

### Install Service

```bash
# Copy service file
cp systemd/desklumina-daemon@.service ~/.config/systemd/user/

# Reload systemd
systemctl --user daemon-reload

# Enable and start
systemctl --user enable --now desklumina-daemon@$(id -u).service
```

For detailed daemon setup, see the [Daemon Mode Guide](11-daemon-mode.md).

---

## Troubleshooting

### Bun Not Found

```bash
# Add bun to PATH (add to ~/.bashrc or ~/.zshrc)
export PATH="$HOME/.bun/bin:$PATH"
```

### API Key Issues

```bash
# Verify your API key is set
cat .env | grep GROQ_API_KEY

# Test API connectivity
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.groq.com/openai/v1/models
```

### Permission Errors

```bash
# Ensure scripts are executable
chmod +x src/main.ts
```

---

## Next Steps

- **[Quick Start](03-quick-start.md)** — Learn basic usage
- **[Configuration](04-configuration.md)** — Customize settings
- **[Usage Guide](06-usage-guide.md)** — Explore all modes

---

← Previous: [Introduction](01-introduction.md) | Next: [Quick Start](03-quick-start.md) →