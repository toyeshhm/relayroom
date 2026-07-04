import { createServer } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = resolve("site");
const port = Number(process.env.PORT || 4173);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

createServer((req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${port}`);
  const path = join(root, url.pathname === "/" ? "index.html" : url.pathname);
  if (!path.startsWith(root) || !existsSync(path)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": types[extname(path)] || "text/plain; charset=utf-8" });
  createReadStream(path).pipe(res);
}).listen(port, () => {
  console.log(`Relayroom site running at http://localhost:${port}`);
});
