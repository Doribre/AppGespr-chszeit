import { createServer } from "node:http";
import { createReadStream, statSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const requestedPort = Number.parseInt(process.env.PORT ?? "5173", 10);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".wasm": "application/wasm",
  ".data": "application/octet-stream",
  ".onnx": "application/octet-stream"
};

function resolveRequestPath(url) {
  const rawPath = decodeURIComponent(new URL(url, "http://localhost").pathname);
  const normalized = normalize(rawPath).replace(/^(\.\.[/\\])+/, "");
  const requestPath = rawPath === "/" ? "index.html" : normalized;
  const filePath = resolve(join(root, requestPath));

  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
}

function createAppServer() {
  return createServer((req, res) => {
    const filePath = resolveRequestPath(req.url ?? "/");

    if (!filePath) {
      res.writeHead(403);
      res.end("Forbidden");
      return;
    }

    try {
      const fileStat = statSync(filePath);
      if (!fileStat.isFile()) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }
    } catch {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
      "Cache-Control": "no-store"
    });

    if (req.method === "HEAD") {
      res.end();
      return;
    }

    createReadStream(filePath).pipe(res);
  });
}

function listen(port) {
  const server = createAppServer();

  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, "127.0.0.1", () => {
    const address = server.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`Schwaetzometer running at http://127.0.0.1:${actualPort}`);
  });
}

listen(requestedPort);
