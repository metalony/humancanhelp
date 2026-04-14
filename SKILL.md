---
name: humancanhelp
description: Use when encountering captchas, human verification, or any visual task requiring human interaction that AI cannot solve autonomously
version: 1.0.0
metadata:
  openclaw:
    emoji: 🧑‍💻
    requires:
      bins:
        - node
---

# HumanCanHelp (HCL)

Generate a shareable URL to let a human see and interact with your screen. Supports both browser tab sharing (CDP) and full desktop sharing (VNC).

## When to Use

- Captcha challenges (text, slider, click, complex)
- Visual verification requiring human eyes
- Any interactive task AI cannot complete alone

## How to Use

This skill metadata is prepared for a future ClawHub/OpenClaw release, but the project is not published yet. Use a local checkout for now:

```bash
npm install
npm run build
node dist/index.js start
```

Once the package is published, `npx humancanhelp start` can become the short install path. Until then, run the built local entrypoint via Bash. It prints a URL. Give that URL to the user. Wait for the CLI to exit.

### Step 1: Start the help server

```bash
node dist/index.js start
```

HCL auto-detects the best mode:
- If Chrome DevTools is running on port 9222 → CDP mode (shares browser tab)
- Otherwise → VNC mode (shares full desktop, requires VNC server)

For explicit mode selection:
```bash
# CDP mode (browser tab only)
node dist/index.js start --cdp localhost:9222

# VNC mode (full desktop)
node dist/index.js start --vnc localhost:5900
```

CDP mode output:
```
  HumanCanHelp started

  Local:   http://192.168.1.100:6080
  Mode:    CDP (Chrome DevTools Protocol)
  Target:  ws://localhost:9222/devtools/page/XXXX
  Timeout: 600s
```

VNC mode output:
```
  HumanCanHelp started

  Local:   http://192.168.1.100:6080
  Mode:    VNC
  VNC:     localhost:5900
  Timeout: 600s
```

### For remote helpers (public URL)

```bash
node dist/index.js start --public
```

This creates both a local and a public tunnel URL:
```
  Local:   http://192.168.1.100:6080
  Public:  https://abc123.lhr.life
  Mode:    CDP (Chrome DevTools Protocol)
  Timeout: 600s
```

Send the public URL to anyone on the internet. Use `--password` to protect it.

### Step 2: Tell the user to open the URL

Say something like:
"Please open this URL on your phone or another browser to help me solve the captcha: http://192.168.1.100:6080"

### Step 3: Wait

The CLI blocks until:
- The user clicks "Done" on the page → exits with code 0
- The user clicks "Cannot solve" → exits with code 1
- Timeout expires → HCL immediately starts a fresh session with the same config

### Step 4: Continue

After the CLI exits with code 0, the human has finished interacting with the screen. Continue your task.

## CLI Reference

```
node dist/index.js start [options]

Options:
  --cdp <host:port>    Use CDP mode (Chrome DevTools Protocol), e.g. --cdp localhost:9222
  --vnc <host:port>    Use VNC mode, VNC server address (default: localhost:5900)
  --port <number>      HTTP server port (default: 6080)
  --timeout <seconds>  Auto-stop after N seconds (default: 600)
  --public             Also create a public tunnel URL for remote helpers
  --password <string>  Protect the help URL with a password
  --mask <regions>     Mask screen regions: "x,y,w,h;x,y,w,h"
```

## Modes

### CDP Mode (recommended)
Shares only the browser tab via Chrome DevTools Protocol. Supports mouse clicks, typing, and slider drag interactions. Best for Playwright/Puppeteer workflows.

Requires Chrome launched with `--remote-debugging-port=9222`.

### VNC Mode
Shares the full desktop via VNC. Requires a VNC server running on the machine.

## Session Expiry

The help page automatically expires when:
- Timeout is reached → page shows "This session has expired", disconnects
- Helper clicks Done → session ends, CLI exits with code 0
- Helper clicks "Cannot solve" → session ends, CLI exits with code 1

## Privacy

Password protection is available now. The `--mask` flag exists in the CLI surface, but masking is not enforced yet in the current MVP, so do not rely on it as a privacy control.
