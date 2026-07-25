import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve } from 'node:path';

const root = resolve('.');
const vendorBundle = resolve('node_modules/@tursodatabase/database-wasm/bundle/main.es.js');
const port = Number(process.env.PORT ?? 4321);

const server = createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  const path = pathname === '/vendor/database-wasm.js'
    ? vendorBundle
    : resolve(root, pathname === '/' ? 'index.html' : pathname.slice(1));

  response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  response.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  if (!path.startsWith(root) || !safeFile(path)) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
  };
  response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream' });
  createReadStream(path).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Turso portability spike: http://127.0.0.1:${port}`);
});

function safeFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}
