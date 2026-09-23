#!/usr/bin/env node
/**
 * Kill whatever is already listening on the given TCP ports, then exit 0.
 *
 * Why this exists: `nest start --watch` and `next dev` are never reaped when a terminal or editor
 * window goes away, so repeated dev sessions stack up silently. We once found four live aaos-api
 * instances at the same time. That is not merely wasteful — the Meta connector's
 * TokenBucketRateLimiter is in-memory and therefore PER PROCESS, so N stacked instances grant
 * themselves N x 200 calls/hour while each one believes it is still inside budget. Meta sees the
 * sum and throttles the ad account. Freeing the port before every dev start makes a second
 * instance impossible instead of merely unlikely.
 *
 * Wired as a `pre` hook (npm runs `predev` / `prestart:dev` automatically), so it costs nothing to
 * remember. Exits 0 even when the port is already free, or when inspection fails — this must never
 * be the reason a dev server refuses to start.
 */
import { execFileSync } from "node:child_process";

const ports = process.argv.slice(2).filter((a) => /^\d+$/.test(a));
if (ports.length === 0) {
  console.error("free-port: no ports given, e.g. `node scripts/free-port.mjs 3000`");
  process.exit(1);
}

/** PIDs currently in LISTEN state on `port`, excluding PID 0 (the idle/system pseudo-process). */
function listenerPids(port) {
  try {
    if (process.platform === "win32") {
      const out = execFileSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" });
      return [
        ...new Set(
          out
            .split(/\r?\n/)
            // Token-based, not a regex: the local-address column is token 1 and the PID is the last
            // token. Avoids backslash-escaping pitfalls and cannot match a port that is a substring.
            .map((l) => l.trim().split(/\s+/))
            .filter(
              (t) => t.includes("LISTENING") && t[1] !== undefined && t[1].endsWith(":" + port),
            )
            .map((t) => t[t.length - 1])
            .filter((pid) => /^\d+$/.test(pid) && pid !== "0"),
        ),
      ];
    }
    const out = execFileSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
      encoding: "utf8",
    });
    return [...new Set(out.split(/\s+/).filter(Boolean))];
  } catch {
    // Nothing listening (lsof exits 1) or the tool is unavailable. Either way: nothing to kill.
    return [];
  }
}

function kill(pid) {
  try {
    // Tree-kill: `nest start --watch` and `next dev` both supervise a child that holds the socket.
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/F", "/T", "/PID", pid], { stdio: "ignore" });
    } else {
      execFileSync("kill", ["-9", pid], { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

for (const port of ports) {
  const pids = listenerPids(port);
  if (pids.length === 0) {
    console.log(`free-port: ${port} already free`);
    continue;
  }
  for (const pid of pids) {
    const ok = kill(pid);
    console.log(
      ok
        ? `free-port: ${port} freed (killed stale PID ${pid})`
        : `free-port: ${port} held by PID ${pid} but it could not be killed — start may fail`,
    );
  }
}
