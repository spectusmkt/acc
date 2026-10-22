// Uso: node render.mjs criativo-01.html [segundos] [fps]
// Abre o HTML no Chromium, congela as animações e tira um print por quadro; o ffmpeg junta tudo em MP4.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const arquivo = path.resolve(process.argv[2]);
const duracao = Number(process.argv[3] || 14);
const fps = Number(process.argv[4] || 30);
const nome = path.basename(arquivo, '.html');
const pasta = path.join(path.dirname(arquivo), '.quadros-' + nome);
rmSync(pasta, { recursive: true, force: true });
mkdirSync(pasta);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + arquivo, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);

const total = Math.round(duracao * fps);
for (let i = 0; i < total; i++) {
  const ms = (i / fps) * 1000;
  await page.evaluate((ms) => document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; }), ms);
  await page.screenshot({ path: path.join(pasta, String(i).padStart(5, '0') + '.png') });
}
await browser.close();

execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', String(fps), '-i', path.join(pasta, '%05d.png'),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart',
  path.join(path.dirname(arquivo), nome + '.mp4')], { stdio: 'inherit' });
rmSync(pasta, { recursive: true, force: true });
console.log('pronto:', nome + '.mp4');
