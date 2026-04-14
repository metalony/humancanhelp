# HumanCanHelp (HCL)

AI encounters a captcha → runs one command → gets a URL → tells the human → human opens URL and solves it → AI continues.

That's it. No accounts, no cloud, no API keys. Everything runs on your machine.

## Current Install Path

This project is not published yet. Today, the honest way to run HCL is from a local checkout:

```bash
npm install
npm run build
node dist/index.js start
```

Once the package is actually published, `npm install -g humancanhelp`, `npx humancanhelp start`, and `hcl start` can become the short install path.

## Quick Start

### CDP Mode (recommended for browser automation)

If you use Playwright, Puppeteer, or Chrome with remote debugging:

```bash
# Launch Chrome with remote debugging
chrome --remote-debugging-port=9222

# Start HCL - auto-detects CDP
node dist/index.js start
```

Output:
```
  HumanCanHelp started

  Local:   http://192.168.1.100:6080
  Mode:    CDP (Chrome DevTools Protocol)
  Target:  ws://localhost:9222/devtools/page/XXXX
  Timeout: 600s
```

Open the URL on your phone. You see the browser tab, interact with it (including slider captchas), click "Done".

### VNC Mode (for full desktop sharing)

```bash
node dist/index.js start --vnc localhost:5900
```

Output:
```
  HumanCanHelp started

  Local:   http://192.168.1.100:6080
  Mode:    VNC
  VNC:     localhost:5900
  Timeout: 600s
```

### For Remote Helpers

```bash
node dist/index.js start --public --password mysecret
```

Creates a public tunnel URL anyone on the internet can open:
```
  Local:   http://192.168.1.100:6080
  Public:  https://abc123.lhr.life
  Password: yes
```

## How It Works

### CDP Mode

```
Your Machine                         Your Phone
┌──────────────────────┐            ┌──────────────┐
│  Chrome              │            │              │
│  (--remote-debugging)│            │  Browser     │
│       │              │            │  opens URL   │
│       ▼              │   WS/HTTP  │              │
│  HCL Server          │◄─────────►│  sees tab    │
│  (port 6080)         │            │  clicks Done │
│  - CDP screencast    │            │  drags slider│
│  - input dispatch    │            │              │
└──────────────────────┘            └──────────────┘
```

Shares only the browser tab. Supports mouse clicks, typing, and slider drags.

### VNC Mode

```
Your Machine                    Your Phone
┌──────────────────┐           ┌──────────────┐
│  VNC Server      │           │              │
│  (port 5900)     │           │  Browser     │
│       │          │           │  opens URL   │
│       ▼          │   WS      │              │
│  HCL Server      │◄────────►│  sees screen │
│  (port 6080)     │           │  clicks Done │
│  - serves page   │           │              │
│  - proxies VNC   │           └──────────────┘
└──────────────────┘
```

Shares the full desktop via VNC protocol.

## CLI

```
node dist/index.js start [--port 6080] [--cdp localhost:9222] [--vnc localhost:5900] [--timeout 600] [--public] [--password secret]
node dist/index.js stop
node dist/index.js status
```

| Option | Default | Description |
|--------|---------|-------------|
| `--cdp` | auto | Use CDP mode, e.g. `--cdp localhost:9222` |
| `--vnc` | auto | Use VNC mode, e.g. `--vnc localhost:5900` |
| `--port` | 6080 | HTTP server port |
| `--timeout` | 600 | Auto-stop after N seconds |
| `--public` | off | Create a public tunnel URL for remote access |
| `--password` | none | Password-protect the help URL |
| `--mask` | none | Screen regions to black out: "x,y,w,h;x,y,w,h" |

### Auto-Detection

When neither `--cdp` nor `--vnc` is specified, HCL auto-detects:
1. Checks if Chrome DevTools is available at `localhost:9222` → uses CDP
2. Falls back to VNC at `localhost:5900`

## Session Expiry

- Timeout countdown shows on the help page
- When timer hits 0: session disconnects, page shows "This session has expired"
- Helper can no longer interact
- HCL automatically starts a fresh session on the same port using the same config

## Current MVP Scope

- Implemented now: local CLI, CDP tab sharing, VNC desktop sharing, optional password, optional public tunnel
- Not implemented yet: visual masking enforcement for `--mask`
- Not implemented yet: hosted service, mobile app, or a full MCP server runtime

Use `--mask` as a reserved interface for now, not as an active privacy guarantee.

## Release Readiness Notes

The codebase is being prepared for GitHub and ClawHub, but this workspace is not actually released yet.

- There is no published npm package yet.
- A real GitHub release still requires commit history, a configured remote, and tags.
- ClawHub/OpenClaw metadata exists in `SKILL.md`, but it should only point at a real public source once that source actually exists.

## VNC Setup

**macOS:**
System Settings → General → Sharing → Screen Sharing → enable

**Linux:**
```bash
sudo apt install x11vnc
x11vnc -display :0 -forever
```

**Windows:**
Install [TightVNC](https://www.tightvnc.com/) or UltraVNC

## License

MIT
