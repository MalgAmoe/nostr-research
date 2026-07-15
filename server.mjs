import { createReadStream, existsSync } from "node:fs";
import { appendFile, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const distributionRoot = join(root, "dist");
const staticRoot = existsSync(join(distributionRoot, "index.html")) ? distributionRoot : root;
const logDirectory = join(root, "logs");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

const server = createServer((request, response) => {
  if (request.method === "POST" && request.url === "/api/log") {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 32_768) request.destroy();
    });
    request.on("end", async () => {
      try {
        const event = JSON.parse(body);
        await mkdir(logDirectory, { recursive: true });
        await appendFile(join(logDirectory, "usage.ndjson"), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, "utf8");
        response.writeHead(204).end();
      } catch {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Invalid log event");
      }
    });
    return;
  }
  const requestPath = request.url === "/" ? "/index.html" : request.url.split("?")[0];
  if (requestPath.startsWith("/keys/") || requestPath.startsWith("/logs/")) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("Not found");
    return;
  }
  const path = normalize(join(staticRoot, requestPath));

  if (!path.startsWith(staticRoot) || !existsSync(path)) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, {
    "content-type": mimeTypes[extname(path)] ?? "application/octet-stream",
    "cache-control": "no-store"
  });
  createReadStream(path).pipe(response);
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, "127.0.0.1", () => {
  console.log(`Nostr Research is running at http://localhost:${port}`);
});
