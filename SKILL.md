---
name: humancanhelp
description: Use when AI is blocked by captchas, visual verification, or any short interactive task that needs a real human handoff
version: 1.0.0
metadata:
  openclaw:
    emoji: 🧑‍💻
    requires:
      bins:
        - node
---

# HumanCanHelp (HCL)

HumanCanHelp is a local human-in-the-loop handoff tool for moments when AI needs a person to briefly see a live screen, click, type, drag, or complete a blocked step. It supports both browser tab sharing (CDP) and full desktop sharing (VNC).

## When to Use

- Captcha challenges and human verification flows
- Visual checks that need a real person to look at the screen
- Short blocked browser or desktop steps during an automated workflow
- Any interactive handoff where AI cannot safely complete the step alone

## How to Use

Use a local checkout as the primary flow right now. If you publish the package into your own environment later, the CLI behavior stays the same: start HCL, send the printed URL to a helper, and wait for the CLI to exit.

```bash
npm install
npm run build
npm start
```

Optional published-package flow, only after you have actually published or installed it:

```bash
npx humancanhelp start
```

If you installed it globally yourself, `hcl start` is equivalent.

### Step 1: Start the help server

```bash
hcl start
```

HCL auto-detects the best mode:
- If Chrome DevTools is running on port 9222 → CDP mode (shares browser tab)
- Otherwise → VNC mode (shares full desktop, requires VNC server)

For explicit mode selection:
```bash
# CDP mode (browser tab only)
hcl start --cdp localhost:9222

# VNC mode (full desktop)
hcl start --vnc localhost:5900
```

CDP mode output:
```
  HumanCanHelp started

  Local:   http://<your-local-ip>:6080
  Mode:    CDP (Chrome DevTools Protocol)
  Target:  ws://localhost:9222/devtools/page/XXXX
  Timeout: 600s
```

VNC mode output:
```
  HumanCanHelp started

  Local:   http://<your-local-ip>:6080
  Mode:    VNC
  VNC:     localhost:5900
  Timeout: 600s
```

### For remote helpers (public URL)

```bash
hcl start --public --password mysecret
```

If you want `--public`, install the optional tunnel dependency first from your local checkout:

```bash
npm install localtunnel
```

This creates both a local and a public tunnel URL:
```
  Local:   http://<your-local-ip>:6080
  Public:  https://abc123.lhr.life
  Mode:    CDP (Chrome DevTools Protocol)
  Timeout: 600s
  Password: yes
```

If you expose a public URL, use `--password` so the helper must authenticate before they can access the session.

### Step 2: Tell the user to open the URL

Say something like:
"Please open this URL to help me finish the blocked step: http://<your-local-ip>:6080"

### Step 3: Wait

The CLI blocks until:
- The user clicks "Done" on the page → exits with code 0
- The user clicks "Cannot solve" → exits with code 1
- Timeout expires → HCL immediately starts a fresh session with the same config

### Step 4: Continue

After the CLI exits with code 0, the human has finished interacting with the screen. Continue your task.

## CLI Reference

```
hcl start [options]

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
Shares only the browser tab via Chrome DevTools Protocol. Supports mouse clicks, typing, and slider drag interactions. Best for Playwright, Puppeteer, and browser-based recovery workflows.

Requires Chrome launched with `--remote-debugging-port=9222`.

### VNC Mode
Shares the full desktop via VNC. Requires a VNC server running on the machine.

## Session Expiry

The help page automatically expires when:
- Timeout is reached → page shows "This session has expired", disconnects
- Helper clicks Done → session ends, CLI exits with code 0
- Helper clicks "Cannot solve" → session ends, CLI exits with code 1

## Privacy

Password protection is available now. For password-protected sessions, remote helpers must authenticate before HCL exposes live session metadata or event updates. The `--mask` flag exists in the CLI surface, but masking is not enforced yet in the current MVP, so do not rely on it as a privacy control.
