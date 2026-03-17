# 13 - Troubleshooting

This guide covers common issues and their solutions when using DeskLumina.

---

## Installation Issues

### Bun Not Found

**Problem:** `bun: command not found`

**Solution:**
```bash
# Add bun to PATH
export PATH="$HOME/.bun/bin:$PATH"

# Add to shell config for persistence
echo 'export PATH="$HOME/.bun/bin:$PATH"' >> ~/.bashrc
# or ~/.zshrc for zsh users
```

### Dependencies Fail to Install

**Problem:** `bun install` fails with errors

**Solution:**
```bash
# Clear bun cache
bun pm cache rm

# Remove node_modules and reinstall
rm -rf node_modules bun.lock
bun install
```

### TypeScript Errors

**Problem:** Type checking fails with errors

**Solution:**
```bash
# Run type check to see specific errors
bun run lint

# Common fix: update TypeScript
bun update typescript
```

---

## API Issues

### Invalid API Key

**Problem:** `Error: Invalid API key`

**Solution:**
```bash
# Check if key is set
cat .env | grep GROQ_API_KEY

# Verify key format (should start with gsk_)
# Get new key from https://console.groq.com

# Test API directly
curl -H "Authorization: Bearer YOUR_API_KEY" https://api.groq.com/openai/v1/models
```

### Rate Limiting

**Problem:** `Error: Rate limit exceeded`

**Solution:**
- Wait a few seconds between requests
- Check your Groq API usage dashboard
- Consider using a different model with higher limits

### Model Not Available

**Problem:** `Error: Model not found`

**Solution:**
```bash
# Check available models
curl -H "Authorization: Bearer $GROQ_API_KEY" https://api.groq.com/openai/v1/models

# Update MODEL_NAME in .env to a valid model
# Valid options: llama-3.3-70b-versatile, llama-3.1-8b-instant
```

### All Models Failed

**Problem:** `AllModelsFailedError: All models failed`

**Solution:**
1. Check your internet connection
2. Verify API key is valid
3. Check Groq API status page
4. Try again in a few minutes

---

## Daemon Issues

### Daemon Won't Start

**Problem:** Daemon fails to start

**Solution:**
```bash
# Check for existing process
ps aux | grep "main.ts"

# Kill existing process
pkill -f "main.ts.*daemon"

# Remove stale socket
rm -f ~/.config/bspwm/agent/daemon.sock

# Restart daemon
bun run daemon
```

### Connection Refused

**Problem:** `Error: Connection refused` when sending commands

**Solution:**
```bash
# Verify daemon is running
bun run daemon:status

# Check socket exists
ls -la ~/.config/bspwm/agent/daemon.sock

# If missing, start daemon
bun run daemon
```

### Socket Permission Denied

**Problem:** `Error: Permission denied` accessing socket

**Solution:**
```bash
# Check socket permissions
ls -la ~/.config/bspwm/agent/daemon.sock

# Remove and restart
rm ~/.config/bspwm/agent/daemon.sock
bun run daemon
```

### Slow Daemon Responses

**Problem:** Daemon responses are slow

**Solution:**
```bash
# Check system resources
htop

# Check if multiple daemon instances running
ps aux | grep daemon

# Kill duplicates
pkill -f "main.ts.*daemon"

# Restart single instance
bun run daemon
```

---

## Rofi Issues

### Rofi Not Opening

**Problem:** Rofi dialog doesn't appear

**Solution:**
```bash
# Verify rofi is installed
which rofi

# Test rofi directly
rofi -show run

# Check rofi config
ls -la ~/.config/rofi/config.rasi
```

### Rofi Theme Issues

**Problem:** Rofi looks wrong or unreadable

**Solution:**
- Check theme file exists in `src/ui/themes/`
- Verify rofi config points to valid theme
- Test with default theme: `rofi -show run -theme default`

---

## Window Management Issues

### BSPWM Commands Not Working

**Problem:** Window commands don't execute

**Solution:**
```bash
# Verify BSPWM is running
bspc wm -g

# Check BSPWM socket
ls -la /tmp/bspwm*

# Test bspc directly
bspc query -D
```

### Window Not Moving

**Problem:** `wait_and_move` times out

**Solution:**
- The window class might not match exactly
- Check window class with: `bspc query -N -n focused | xargs bspc query -T -n | grep class`
- Use exact class name in command

### Wrong Workspace

**Problem:** Windows go to wrong workspace

**Solution:**
- Check workspace numbering (starts at 1 or 0)
- List workspaces: `bspc query -D`
- Verify workspace exists before moving

---

## File Operation Issues

### Permission Denied

**Problem:** File operations fail with permission error

**Solution:**
- Check file permissions: `ls -la /path/to/file`
- Ensure path is in user-accessible directory
- Protected paths require explicit confirmation

### Path Not Found

**Problem:** `Error: Path not found`

**Solution:**
```bash
# Check path exists
ls -la ~/path/to/check

# Verify tilde expansion
# Use ~/ (tilde-slash) for home directory
```

### Cannot Delete File

**Problem:** Delete operation blocked

**Solution:**
- Check if path is protected (system directory)
- Confirm the deletion when prompted
- Check file permissions

---

## Media Control Issues

### MPD Not Responding

**Problem:** Media commands fail

**Solution:**
```bash
# Check MPD is running
systemctl --user status mpd

# Start MPD
systemctl --user start mpd

# Test mpc directly
mpc status
```

### Volume Not Changing

**Problem:** Volume commands don't work

**Solution:**
```bash
# Check MPD volume control
mpc volume

# Test volume change
mpc volume +10
```

---

## Clipboard Issues

### Clipcat Not Working

**Problem:** Clipboard commands fail

**Solution:**
```bash
# Check clipcat is running
systemctl --user status clipcat

# Start clipcat
systemctl --user start clipcat

# Test clipcat directly
clipcatctl list
```

---

## Notification Issues

### Dunst Not Showing Notifications

**Problem:** Notifications don't appear

**Solution:**
```bash
# Check dunst is running
pgrep dunst

# Start dunst
dunst &

# Test notification
notify-send "Test" "Notification test"
```

---

## Logging and Debugging

### View Logs

```bash
# Main log
tail -f ~/.config/bspwm/agent/logs/general.log

# Error log
tail -f ~/.config/bspwm/agent/logs/error.log
```

### Enable Debug Mode

```bash
# Run with debug output
DEBUG=1 bun run dev
```

### Check System Resources

```bash
# CPU and memory
htop

# Disk space
df -h

# Process list
ps aux | grep lumina
```

---

## Getting Help

### Check Documentation

1. [FAQ](14-faq.md) — Common questions
2. [Usage Guide](06-usage-guide.md) — How to use features
3. [Configuration](04-configuration.md) — Settings

### Report Issues

When reporting issues, include:

1. **System info:** `uname -a`
2. **Bun version:** `bun --version`
3. **Error message:** Full error text
4. **Steps to reproduce:** What you did
5. **Logs:** Relevant log entries

### GitHub Issues

Report bugs at: https://github.com/Rafacuy/desklumina/issues

---

## Related Documentation

- **[FAQ](14-faq.md)** — Frequently asked questions
- **[Daemon Mode](11-daemon-mode.md)** — Daemon troubleshooting
- **[Security](09-security.md)** — Security-related issues

---

← Previous: [Testing Guide](12-testing.md) | Next: [FAQ](14-faq.md) →