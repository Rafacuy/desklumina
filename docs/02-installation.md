# 02 - Installation

Get DeskLumina up and running on your system. This guide covers all requirements and setup steps.

---

## Table of Contents

- [Requirements](#requirements)
  - [Essential](#essential)
  - [Optional](#optional)
- [Installation Steps](#installation-steps)
- [Configuration](#configuration)
- [Verify Installation](#verify-installation)

---

## Requirements

### Essential

- **[Bun](https://bun.sh/)** v1.3.14 or higher.
- **API Key**: At least one provider key (Groq, OpenAI, Anthropic, Gemini, OpenRouter, or Hugging Face).
- **[Rofi](https://github.com/davatorium/rofi)** (Standard Linux distribution package).
- **Core Utilities**: `bash`, `git`, `find`, `ls`, `mkdir`, `rm`, `mv`, `cp`.

### Optional (For full features)

- **[dunst](https://github.com/dunst-project/dunst)**: Required for the `notify` tool (`dunstify`).
- **[clipcat](https://github.com/p0nce/clipcat)**: Required for the `clipboard` tool (`clipcatctl`).
- **[mpd](https://www.musicpd.org/)** + **[mpc](https://www.musicpd.org/clients/mpc/)**: Required for the `music` tool's MPC backend.
- **[mlocate](https://pagure.io/mlocate)** (or any `locate` implementation): Used by the `file` tool for indexed search. When missing, the tool falls back to `find`, which is slower.
- **[fzf](https://github.com/junegunn/fzf)**: Required for interactive result selection when the `file` tool's `select=true` filter is used. Requires a TTY.

---

## Installation Steps

### 1. Clone the Repository

We recommend installing DeskLumina into your user's config directory:

```bash
mkdir -p ~/.config/desklumina
git clone https://github.com/Rafacuy/desklumina.git ~/.config/desklumina
cd ~/.config/desklumina
```

### 2. Install Dependencies

Use Bun to install the required Node.js and Bun dependencies:

```bash
bun install
```

### 3. Setup Environment Variables

Copy the example environment file and add your API key:

```bash
cp .env.example .env
```

Now, edit the `.env` file with your preferred editor:

```env
# Set at least one provider key
GROQ_API_KEY=gsk_your_actual_key_here
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=sk-ant-...
# GEMINI_API_KEY=...
# OPENROUTER_API_KEY=...
# HF_API_KEY=...

# Primary model (format: provider:model)
DESKLUMINA_MODEL=groq:llama-3.3-70b-versatile
```

At minimum, one provider API key and a primary model (`DESKLUMINA_MODEL`) are required. DeskLumina will exit with a fatal error if neither a model nor any API key is configured. Alternatively, you can skip the env-based model config entirely and use `models.json` instead (see [Configuration](04-configuration.md)).

---

## Configuration

### Settings JSON

DeskLumina stores user settings at `~/.config/desklumina/settings.json`. You can also configure UI themes in `src/ui/themes/`.

### Rofi Theme

DeskLumina includes a custom Rofi theme at `src/ui/themes/lumina.rasi`. To use it, ensure Rofi can locate the file.

---

## Verify Installation

### Test the CLI

Run a simple command to ensure the AI and tools are working correctly:

```bash
bun run start -- --version
bun run start -- --exec "open telegram"
```

You should see output in your terminal.

### Test the UI

Launch the interactive Rofi interface:

```bash
bun run start
```

If Rofi appears and you can type a command, your installation is successful.

---

## Next Steps

- 🚀 **[Quick Start](03-quick-start.md)**: Run your first commands.
- ⚙️ **[Configuration Guide](04-configuration.md)**: Fine-tune your setup.
- 🤖 **[Daemon Mode](11-daemon-mode.md)**: Set up the background service.

---

[← Introduction](01-introduction.md) | [Quick Start →](03-quick-start.md)
