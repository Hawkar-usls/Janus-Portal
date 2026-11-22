// Small no-dependency localhost server for static ES modules.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep, extname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const contentTypes = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.ico':'image/x-icon'};
const port = Number(process.env.PORT) || 4173;
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (file !== root && !file.startsWith(root + sep)) {response.writeHead(403);response.end();return;}
    const body = await readFile(file);
    response.writeHead(200, {'content-type': (contentTypes[extname(file)] || 'application/octet-stream') + '; charset=utf-8', 'cache-control':'no-store'});
    response.end(body);
  } catch {response.writeHead(404);response.end('Not found');}
}).listen(port, '127.0.0.1', () => console.log('JANUS PORTAL: http://127.0.0.1:' + port));
