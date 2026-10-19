import http from 'node:http';
import { questions } from './questions.js';
import { readFile } from 'node:fs/promises';
import { renderLanding } from './seo.js';

const files = { '/naver366e597dfb634369d3031aa2cccfd6b3.html':['naver366e597dfb634369d3031aa2cccfd6b3.html','text/html'], '/google8e1ad6d7f4037882.html':['google8e1ad6d7f4037882.html','text/html'], '/seo.js':['seo.js','text/javascript'], '/robots.txt':['robots.txt','text/plain'], '/sitemap.xml':['sitemap.xml','application/xml'], '/api-response.js': ['api-response.js', 'text/javascript'], '/favicon.svg': ['favicon.svg', 'image/svg+xml'], '/report-content.js': ['report-content.js', 'text/javascript'], '/report-export.js': ['report-export.js', 'text/javascript'], '/scoring.js': ['scoring.js', 'text/javascript'], '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/style.css': ['style.css', 'text/css'], '/app.js': ['app.js', 'text/javascript'], '/questions.js': ['questions.js', 'text/javascript'] };
files['/design-ui.css'] = ['design-ui.css', 'text/css'];
for (const name of ['share-copy.js','share-menu.js','i18n.js','translations.js','report-locales.js','question-locales.js']) files[`/${name}`]=[name,'text/javascript'];
for (const { image: name } of questions) {
  files[`/${name}`] = [name, 'image/webp'];
}
const server = http.createServer(async (req, res) => {
  if (new URL(req.url, 'http://localhost').pathname.startsWith('/api/')) {
    res.writeHead(503, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
    res.end(JSON.stringify({error:'로컬 미리보기에서는 결제와 리포트를 이용할 수 없습니다. mindscope.online에서 진행해 주세요.',code:'STATIC_PREVIEW_API_UNAVAILABLE'}));
    return;
  }
  const file = files[new URL(req.url, 'http://localhost').pathname];
  if (!file || !['GET', 'HEAD'].includes(req.method)) { res.writeHead(404); res.end('Not found'); return; }
  try {
    let body = await readFile(new URL(file[0], import.meta.url));
    if(file[0]==='index.html')body=renderLanding(body.toString(),new URL(req.url,'http://localhost').searchParams.get('lang'));
    res.writeHead(200, { 'Content-Type': `${file[1]}; charset=utf-8`, 'X-Content-Type-Options': 'nosniff' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch { res.writeHead(500); res.end('Unable to load page'); }
});
server.listen(process.env.PORT || 3000, '0.0.0.0', () => console.log(`Mindscope: http://localhost:${process.env.PORT || 3000}`));
