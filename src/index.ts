#!/usr/bin/env node

import { createServer, HclServer } from "./server.js";
import { networkInterfaces } from "node:os";
import { discoverCdpTarget } from "./cdp.js";

type ParsedArgs = Record<string, string | number | boolean>;

type ModeSelection =
  | { mode: "vnc"; vncHost: string; vncPort: number }
  | { mode: "cdp"; cdpHost: string; cdpPort: number };

function getLocalIP(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name];
    if (!iface) continue;
    for (const addr of iface) {
      if (addr.family === "IPv4" && !addr.internal) {
        return addr.address;
      }
    }
  }
  return "127.0.0.1";
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[key] = isNaN(Number(next)) ? next : Number(next);
        i++;
      } else {
        parsed[key] = true;
      }
    } else {
      parsed._command = arg;
    }
  }
  return parsed;
}

function printUsage() {
  console.log(`HumanCanHelp (hcl) - Start a short-lived human help session for blocked AI workflows

Usage:
  hcl start [--port 6080] [--cdp localhost:9222] [--vnc localhost:5900] [--timeout 600] [--public] [--password secret]
  hcl stop
  hcl status

Commands:
  start    Start the help server and print helper URL(s)
  stop     Stop the running help server
  status   Check if a help server is running

Options:
  --port <number>      HTTP server port (default: 6080)
  --cdp <host:port>    Use CDP mode (Chrome DevTools Protocol), e.g. --cdp localhost:9222
  --vnc <host:port>    VNC server address (default: localhost:5900)
  --timeout <seconds>  Auto-stop after this many seconds (default: 600)
  --public             Create a public tunnel URL (for remote helpers)
  --password <string>  Optional password to protect the help URL
  --mask <regions>     Optional: "x,y,w,h;x,y,w,h" regions to mask (black)
`);
}

function parseHostPort(value: string, defaultPort: number): { host: string; port: number } {
  const [host, portValue] = value.split(":");
  return {
    host: host || "localhost",
    port: parseInt(portValue || String(defaultPort), 10),
  };
}

async function detectMode(parsed: ParsedArgs): Promise<ModeSelection> {
  if (parsed.cdp) {
    const { host, port } = parseHostPort(String(parsed.cdp), 9222);
    return { mode: "cdp", cdpHost: host, cdpPort: port };
  }

  if (parsed.vnc) {
    const { host, port } = parseHostPort(String(parsed.vnc), 5900);
    return { mode: "vnc", vncHost: host, vncPort: port };
  }

  try {
    const response = await fetch("http://localhost:9222/json/version");
    if (response.ok) {
      return { mode: "cdp", cdpHost: "localhost", cdpPort: 9222 };
    }
  } catch {
  }

  return { mode: "vnc", vncHost: "localhost", vncPort: 5900 };
}

async function createPublicTunnel(port: number): Promise<string> {
  try {
    const localtunnel = await import("localtunnel");
    const tunnel = await localtunnel.default({ port });
    return tunnel.url;
  } catch {
    console.error("  Failed to create public tunnel. Install the optional dependency first: npm install localtunnel");
    return "";
  }
}

async function wait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    printUsage();
    process.exit(0);
  }

  const parsed = parseArgs(args);
  const command = parsed._command;

  if (command === "stop") {
    try {
      const resp = await fetch(`http://127.0.0.1:${parsed.port || 6080}/api/stop`, { method: "POST" });
      if (resp.ok) {
        await wait(200);
        console.log("Server stopped.");
      } else {
        console.log("No running server found.");
      }
    } catch {
      console.log("No running server found.");
    }
    process.exit(0);
  }

  if (command === "status") {
    try {
      const port = parsed.port || 6080;
      const resp = await fetch(`http://127.0.0.1:${port}/api/status`);
      if (resp.ok) {
        const data = await resp.json() as { status: string; publicUrl?: string; mode?: "vnc" | "cdp" };
        console.log(`Server running on port ${port}`);
        console.log(`Status: ${data.status}`);
        console.log(`Mode: ${data.mode || "vnc"}`);
        console.log(`Local: http://${getLocalIP()}:${port}`);
        if (data.publicUrl) console.log(`Public: ${data.publicUrl}`);
      } else {
        console.log("No server running.");
      }
    } catch {
      console.log("No server running.");
    }
    process.exit(0);
  }

  if (command === "start") {
    const port = Number(parsed.port) || 6080;
    const timeout = Number(parsed.timeout) || 600;
    const isPublic = !!parsed.public;
    const password = parsed.password ? String(parsed.password) : undefined;
    const mask = parsed.mask ? String(parsed.mask) : undefined;
    const modeSelection = await detectMode(parsed);
    let maskRegions: Array<{ x: number; y: number; w: number; h: number }> | undefined;
    if (mask) {
      maskRegions = mask.split(";").map((r) => {
        const [x, y, w, h] = r.split(",").map(Number);
        return { x, y, w, h };
      });
    }

    const localIP = getLocalIP();
    const localUrl = `http://${localIP}:${port}`;

    let currentServer: HclServer | null = null;
    let stopping = false;
    let publicUrl = "";

    process.on("SIGINT", () => {
      stopping = true;
      if (!currentServer) {
        console.log(`\n  Stopped.`);
        process.exit(0);
        return;
      }
      void currentServer?.stop().finally(() => {
        console.log(`\n  Stopped.`);
        process.exit(0);
      });
    });

    async function startSession(restarting = false): Promise<void> {
      let cdpTarget: string | null = null;
      if (modeSelection.mode === "cdp") {
        try {
          cdpTarget = await discoverCdpTarget({ host: modeSelection.cdpHost, port: modeSelection.cdpPort });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Failed to start: ${message}`);
          process.exit(1);
          return;
        }
      }

      let server: HclServer;
      try {
        server = await createServer({
          port,
          timeout,
          password,
          maskRegions,
          ...(modeSelection.mode === "cdp"
            ? {
                mode: "cdp",
                cdpHost: modeSelection.cdpHost,
                cdpPort: modeSelection.cdpPort,
              }
            : {
                mode: "vnc",
                vncHost: modeSelection.vncHost,
                vncPort: modeSelection.vncPort,
              }),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`Failed to start: ${message}`);
        process.exit(1);
        return;
      }

      currentServer = server;

      console.log(restarting ? `\n  HumanCanHelp restarted\n` : `\n  HumanCanHelp started\n`);
      console.log(`  Local:   ${localUrl}`);

      if (isPublic) {
        if (!publicUrl) {
          process.stdout.write(`  Public:  creating tunnel...`);
          publicUrl = await createPublicTunnel(port);
          if (publicUrl) {
            process.stdout.write(`\r  Public:  ${publicUrl}      \n`);
          } else {
            process.stdout.write(`\r  Public:  unavailable         \n`);
          }
        } else {
          console.log(`  Public:  ${publicUrl}`);
        }

        if (publicUrl) {
          server.setPublicUrl(publicUrl);
        }
      }

      if (modeSelection.mode === "cdp") {
        console.log(`  Mode:    CDP (Chrome DevTools Protocol)`);
        console.log(`  Target:  ${cdpTarget || server.getTarget() || `ws://${modeSelection.cdpHost}:${modeSelection.cdpPort}`}`);
      } else {
        console.log(`  Mode:    VNC`);
        console.log(`  VNC:     ${modeSelection.vncHost}:${modeSelection.vncPort}`);
      }
      console.log(`  Timeout: ${timeout}s`);
      if (password) console.log(`  Password: yes`);
      if (maskRegions) console.log(`  Masking:  ${maskRegions.length} region(s)`);
      console.log("");

      server.onDone(() => {
        currentServer = null;
        console.log(`\n  Helper marked as DONE.`);
        process.exit(0);
      });

      server.onFail((reason) => {
        currentServer = null;
        console.log(`\n  Helper marked as FAILED: ${reason}`);
        process.exit(1);
      });

      server.onTimeout((closed) => {
        currentServer = null;
        console.log(`\n  Timed out after ${timeout}s.`);
        if (stopping) {
          return;
        }
        void closed.then(() => startSession(true)).catch((err) => {
          const message = err instanceof Error ? err.message : String(err);
          console.error(`Failed to restart: ${message}`);
          process.exit(1);
        });
      });
    }

    await startSession();

    return;
  }

  printUsage();
  process.exit(1);
}

void main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`Failed to start: ${message}`);
  process.exit(1);
});
