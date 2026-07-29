import { createReadStream } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createServer } from 'node:http';

const root = new URL('.', import.meta.url).pathname;
const port = Number.parseInt(process.env.PORT ?? '4178', 10);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

createServer((request, response) => {
  const requested = request.url === '/' ? '/index.html' : request.url;
  const path = normalize(join(root, requested.split('?')[0]));
  if (!path.startsWith(root)) {
    response.writeHead(403).end('forbidden');
    return;
  }
  response.setHeader('content-type', types[extname(path)] ?? 'text/plain');
  createReadStream(path)
    .on('error', () => response.writeHead(404).end('not found'))
    .pipe(response);
}).listen(port, '127.0.0.1', () => {
  console.log(`spacecraft cockpit at http://127.0.0.1:${port}`);
});
