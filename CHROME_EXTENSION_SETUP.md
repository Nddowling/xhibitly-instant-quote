# Claude in Chrome — Extension Setup Guide

**Claude in Chrome** is Anthropic's official browser extension that connects to Claude Code CLI, enabling browser automation directly from your terminal or VS Code.

## What You Can Do

- **Live debugging** — read console errors and DOM state, then fix the code that caused them
- **Design verification** — build a UI, then open it in the browser to verify the result
- **Web app testing** — test form validation, check for visual regressions, verify user flows
- **Authenticated browsing** — interact with Google Docs, Gmail, Notion, etc. using your existing sessions
- **Data extraction** — pull structured data from web pages

## Requirements

| Requirement          | Details                                                              |
|----------------------|----------------------------------------------------------------------|
| Claude Code CLI      | `>= 2.0.73` — install with `npm install -g @anthropic-ai/claude-code` |
| Browser              | Google Chrome or Microsoft Edge (Chromium)                           |
| Extension version    | `>= 1.0.36`                                                         |
| Anthropic plan       | Pro, Max, Team, or Enterprise (not available on free tier)           |

> **Note:** Brave, Arc, and other Chromium browsers are not supported. WSL is also not supported.

## Quick Setup (Automated)

Run the setup script from the project root:

```bash
chmod +x scripts/setup-chrome-extension.sh
./scripts/setup-chrome-extension.sh
```

This will verify your Claude Code version, create the Native Messaging Host configuration, and print remaining manual steps.

## Manual Setup

### 1. Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

Verify the version:

```bash
claude --version
# Should be >= 2.0.73
```

### 2. Install the Chrome Extension

1. Visit the [Chrome Web Store listing](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn)
2. Click **Add to Chrome**
3. Pin the extension (puzzle piece icon → thumbtack next to "Claude")
4. Sign in with your Anthropic account

### 3. Configure Native Messaging Host

The Native Messaging Host config allows the Chrome extension to communicate with the Claude Code CLI.

**macOS (Chrome):**
```bash
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts
```

**Linux (Chrome):**
```bash
mkdir -p ~/.config/google-chrome/NativeMessagingHosts
```

Create `com.anthropic.claude_code_browser_extension.json` in the directory above:

```json
{
  "name": "com.anthropic.claude_code_browser_extension",
  "description": "Claude Code Browser Extension Native Messaging Host",
  "path": "/path/to/claude",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://fcoeoabgfenejglbffodgkkbkcdhcgfn/"
  ]
}
```

Replace `/path/to/claude` with the output of `which claude`.

### 4. Launch Claude Code with Chrome

From your terminal:

```bash
claude --chrome
```

Or from an existing Claude Code session:

```
/chrome
```

To enable Chrome integration by default, run `/chrome` and select **Enabled by default**.

## Usage in This Project

With the Chrome extension connected, you can ask Claude Code to:

- Open the Vite dev server (`npm run dev`) and verify UI changes in the browser
- Test the booth designer workflow end-to-end
- Check responsive layouts across breakpoints
- Inspect console errors after making changes
- Verify quote calculations render correctly

## Useful Commands

| Command               | Description                                     |
|-----------------------|-------------------------------------------------|
| `claude --chrome`     | Start Claude Code with Chrome integration       |
| `/chrome`             | Check connection, manage permissions, reconnect |
| `/mcp`                | List available browser tools via MCP             |

## Troubleshooting

**Extension not connecting?**
- Ensure the Chrome extension is version `>= 1.0.36`
- Re-run the setup script to regenerate the Native Messaging Host config
- Check that the `path` in the NMH JSON points to a valid `claude` binary
- Restart Chrome after configuration changes

**"Not available" error?**
- Chrome integration requires a paid Anthropic plan (Pro, Max, Team, or Enterprise)
- Third-party API providers (Bedrock, Vertex) are not supported

**Performance issues?**
- Pro plan users are limited to the Haiku 4.5 model
- Max/Team/Enterprise users can select faster models including Opus 4.6
