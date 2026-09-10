import http from 'node:http';
import { readFile } from 'node:fs/promises';

const files = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/questions.js': ['questions.js', 'text/javascript'] };
for (let i = 1; i <= 10; i++) {
  const name = `Q${String(i).padStart(2, '0')}.webp`;
  files[`/${name}`] = [name, 'image/webp'];
}
const server = http.createServer(async (req, res) => {
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    const body = await readFile(new URL(file[0], import.meta.url));
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Unable to load page'); }
});
server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log(`Mindscope: http://localhost:${process.env.PORT || 3000}`));
