import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { openSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Start only after stopping the verified local API process. Secrets stay in process memory.
const tunnels = await fetch("http://127.0.0.1:4040/api/tunnels").then((r) => r.json());
const tunnel = tunnels.tunnels.find((t) => t.proto === "https" && t.config.addr.endsWith(":3099"));
if (!tunnel) throw new Error("KIE callback gateway tunnel not found");
const secret = randomBytes(32).toString("hex");
const child = spawn(process.execPath, ["dist/main.js"], {
  cwd: resolve("apps/aaos-api"),
  detached: true,
  windowsHide: true,
  env: { ...process.env, AAOS_API_BASE_URL: tunnel.public_url, KIE_WEBHOOK_SECRET: secret },
  stdio: [
    "ignore",
    openSync(join(tmpdir(), "eyvra-handoff-api.out.log"), "a"),
    openSync(join(tmpdir(), "eyvra-handoff-api.err.log"), "a"),
  ],
});
child.unref();
console.log(JSON.stringify({ apiPid: child.pid, callbackBase: tunnel.public_url }));
const path = "/api/v1/creative-packages/webhooks/kie";
let ready = false;
for (let i = 0; i < 180; i++) {
  try {
    const r = await fetch(`http://127.0.0.1:3000${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (r.status === 401) {
      ready = true;
      break;
    }
  } catch {}
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
if (!ready) throw new Error("API did not become ready");
const response = await fetch(`${tunnel.public_url}${path}?secret=${secret}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ data: { taskId: "callback-connectivity-probe" } }),
  signal: AbortSignal.timeout(20000),
});
console.log(
  JSON.stringify({ publicCallbackStatus: response.status, result: await response.json() }),
);
const blocked = await fetch(`${tunnel.public_url}/api/v1/campaigns`, {
  headers: { "ngrok-skip-browser-warning": "1" },
});
console.log(JSON.stringify({ nonCallbackRouteStatus: blocked.status }));
