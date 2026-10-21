import { createServer } from "node:http";

// Local ngrok ingress: expose only KIE callbacks, never dashboard or administration APIs.
const callbackPath = "/api/v1/creative-packages/webhooks/kie";
createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (req.method !== "POST" || url.pathname !== callbackPath) {
    res.writeHead(404).end();
    return;
  }
  try {
    const chunks = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 1024 * 1024) {
        res.writeHead(413).end();
        return;
      }
      chunks.push(chunk);
    }
    const body = Buffer.concat(chunks);
    const response = await fetch(`http://127.0.0.1:3000${callbackPath}${url.search}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    });
    res
      .writeHead(response.status, { "Content-Type": "application/json" })
      .end(await response.text());
    let taskId;
    try {
      taskId = JSON.parse(body.toString()).data?.taskId;
    } catch {}
    console.log(
      JSON.stringify({ time: new Date().toISOString(), status: response.status, taskId }),
    );
  } catch {
    if (!res.headersSent) res.writeHead(502);
    res.end();
    console.error("Callback forwarding unavailable");
  }
}).listen(3099, "127.0.0.1", () => console.log("KIE callback gateway listening on 127.0.0.1:3099"));
