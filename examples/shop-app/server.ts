import { createServer } from 'node:http';
import { cartPage, forgot, login, search, signup, transfer, type Version } from './pages.js';

/** Serves ShopBank on localhost. APP_VERSION=v1 (default), v2 or v3 picks the release. */
const version = (['v2', 'v3'].includes(process.env.APP_VERSION ?? '') ? process.env.APP_VERSION : 'v1') as Version;
const port = Number(process.env.PORT ?? 4510);
const routes: Record<string, (v: Version) => string> = {
  '/': login, '/login': login, '/forgot': forgot, '/signup': signup, '/search': search, '/cart': cartPage, '/transfer': transfer,
};

createServer((req, res) => {
  const page = routes[new URL(req.url ?? '/', 'http://localhost').pathname];
  if (!page) {
    res.writeHead(404).end('Not found');
    return;
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(page(version));
}).listen(port, '127.0.0.1', () => console.log(`ShopBank ${version} on http://127.0.0.1:${port}`));
