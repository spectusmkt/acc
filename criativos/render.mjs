// Uso: node render.mjs pasta/arquivo.html [segundos] [fps]
// Abre o HTML no Chromium, congela as animações e tira um print por quadro; o ffmpeg junta tudo em MP4 (H.264 + AAC estéreo).
// Se existir uma pasta "midia" ao lado do HTML:
//   - vídeos .mp4/.mov viram .webm (o Chromium do Playwright não lê H.264);
//   - locucao.* e trilha.* entram no áudio, com a trilha abaixando sozinha quando a voz fala.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

const arquivo = path.resolve(process.argv[2]);
const pastaHtml = path.dirname(arquivo);
const nome = path.basename(arquivo, '.html');
const fps = Number(process.argv[4] || 30);
const ffmpeg = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' });

const pastaMidia = path.join(pastaHtml, 'midia');
const midia = existsSync(pastaMidia) ? readdirSync(pastaMidia) : [];
for (const f of midia.filter(f => /\.(mp4|mov)$/i.test(f))) {
  const webm = path.join(pastaMidia, f.replace(/\.(mp4|mov)$/i, '.webm'));
  if (existsSync(webm)) continue;
  console.log('convertendo', f);
  ffmpeg(['-i', path.join(pastaMidia, f), '-an', '-vf', "scale='min(1920,iw)':-2", '-c:v', 'libvpx', '-b:v', '8M', '-g', '10', webm]);
}

const quadros = path.join(pastaHtml, '.quadros-' + nome);
rmSync(quadros, { recursive: true, force: true });
mkdirSync(quadros);

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.goto('file://' + arquivo, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => window.__pronto);
const duracao = Number(process.argv[3]) || await page.evaluate(() => Number(document.documentElement.dataset.duracao)) || 14;

const total = Math.round(duracao * fps);
for (let i = 0; i < total; i++) {
  const ms = (i / fps) * 1000;
  await page.evaluate(async (ms) => {
    if (window.__irPara) return window.__irPara(ms);
    document.getAnimations().forEach(a => { a.pause(); a.currentTime = ms; });
  }, ms);
  await page.screenshot({ path: path.join(quadros, String(i).padStart(5, '0') + '.png') });
  if (i % (fps * 5) === 0) console.log(`quadro ${i}/${total}`);
}
await browser.close();

const achar = (base) => midia.find(f => f.startsWith(base + '.') && /\.(mp3|wav|m4a|aac|ogg)$/i.test(f));
const voz = achar('locucao'), trilha = achar('trilha');
const entradas = ['-framerate', String(fps), '-i', path.join(quadros, '%05d.png')];
let audio;
if (voz) entradas.push('-i', path.join(pastaMidia, voz));
if (trilha) entradas.push('-i', path.join(pastaMidia, trilha));
const fimTrilha = `afade=t=in:d=0.6,afade=t=out:st=${duracao - 1.5}:d=1.5`;
if (voz && trilha) {
  audio = ['-filter_complex',
    `[1:a]adelay=200:all=1,asplit[v1][v2];[2:a]volume=0.35,${fimTrilha}[m0];` +
    `[m0][v1]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400[m];` +
    `[v2][m]amix=inputs=2:duration=longest:normalize=0[a]`, '-map', '0:v', '-map', '[a]'];
} else if (voz) {
  audio = ['-filter_complex', '[1:a]adelay=200:all=1[a]', '-map', '0:v', '-map', '[a]'];
} else if (trilha) {
  audio = ['-filter_complex', `[1:a]volume=0.5,${fimTrilha}[a]`, '-map', '0:v', '-map', '[a]'];
} else {
  entradas.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo');
  audio = ['-map', '0:v', '-map', '1:a'];
}

ffmpeg([...entradas, ...audio, '-t', String(duracao),
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-r', String(fps),
  '-c:a', 'aac', '-b:a', '192k', '-ac', '2', '-ar', '48000', '-movflags', '+faststart',
  path.join(pastaHtml, nome + '.mp4')]);
rmSync(quadros, { recursive: true, force: true });
console.log('pronto:', path.join(pastaHtml, nome + '.mp4'), voz ? '' : '(sem locução)', trilha ? '' : '(sem trilha)');
