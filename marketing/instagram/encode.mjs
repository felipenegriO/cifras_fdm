/**
 * Codifica os quadros gravados em um mp4 pronto para o Instagram.
 *
 * Entrada:  out/frames/frame-%06d.png (1800 quadros 1080x1920, gerados por record.mjs)
 * Saida:    out/reel.mp4 — H.264, yuv420p, 1080x1920, 30 fps, SEM faixa de audio.
 *
 * O video sai mudo de proposito: a trilha e escolhida dentro do app do Instagram,
 * entre os audios em alta, o que favorece o alcance e resolve licenciamento.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.join(DIR, 'out', 'frames');
const FRAMES = path.join(FRAMES_DIR, 'frame-%06d.png');
const OUTPUT = path.join(DIR, 'out', 'reel.mp4');
const TOTAL_FRAMES = 1800;
const FPS_SAIDA = 30;

// Velocidade de reproducao. 1 = ritmo original; 0.9 deixa 10% mais lento.
// Em vez de reamostrar o video, alimentamos o ffmpeg com uma taxa de entrada
// menor (30 x velocidade) e mantemos a saida em 30 fps — as cenas sao telas
// paradas com legendas em fade, entao a duplicacao de quadros e imperceptivel.
const VELOCIDADE = Number(process.env.REEL_SPEED || process.argv[2] || 1);
if (!(VELOCIDADE > 0.2 && VELOCIDADE <= 2)) {
  console.error(`Velocidade invalida: ${VELOCIDADE}. Use algo entre 0.2 e 2.`);
  process.exit(1);
}
const FPS_ENTRADA = FPS_SAIDA * VELOCIDADE;
const DURACAO_ESPERADA = TOTAL_FRAMES / FPS_ENTRADA;

const WINGET_FFMPEG = path.join(
  process.env.LOCALAPPDATA || '',
  'Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0-full_build/bin',
);
const bin = name => {
  const local = path.join(WINGET_FFMPEG, `${name}.exe`);
  return fs.existsSync(local) ? local : name;
};

// Falhar aqui e muito melhor que entregar um video truncado sem ninguem notar.
const encontrados = fs.existsSync(FRAMES_DIR)
  ? fs.readdirSync(FRAMES_DIR).filter(f => /^frame-\d{6}\.png$/.test(f)).length
  : 0;
if (encontrados !== TOTAL_FRAMES) {
  console.error(`Esperava ${TOTAL_FRAMES} quadros em ${FRAMES_DIR}, encontrei ${encontrados}.`);
  console.error('Rode `npm run demo:record` antes de codificar.');
  process.exit(1);
}

const encode = spawnSync(bin('ffmpeg'), [
  '-y',
  '-framerate', String(FPS_ENTRADA),
  '-i', FRAMES,
  '-an',                   // sem audio: a trilha entra no app do Instagram
  '-c:v', 'libx264',
  '-preset', 'slow',
  '-crf', '18',            // praticamente sem perda visivel
  '-pix_fmt', 'yuv420p',   // exigido pelos players moveis
  '-movflags', '+faststart',
  '-r', String(FPS_SAIDA),
  OUTPUT,
], { stdio: 'inherit' });

if (encode.status !== 0) {
  console.error('ffmpeg falhou.');
  process.exit(1);
}

// Confere o que saiu, em vez de confiar que saiu certo.
const probe = spawnSync(bin('ffprobe'), [
  '-v', 'error',
  '-show_entries', 'stream=codec_type,codec_name,width,height,r_frame_rate,pix_fmt',
  '-show_entries', 'format=duration',
  '-of', 'json', OUTPUT,
], { encoding: 'utf8' });

const info = JSON.parse(probe.stdout || '{}');
const video = (info.streams || []).find(s => s.codec_type === 'video') || {};
const temAudio = (info.streams || []).some(s => s.codec_type === 'audio');
const duracao = Number(info.format?.duration || 0);

const checagens = [
  ['codec h264', video.codec_name === 'h264', video.codec_name],
  ['largura 1080', video.width === 1080, video.width],
  ['altura 1920', video.height === 1920, video.height],
  [`${FPS_SAIDA} fps`, video.r_frame_rate === `${FPS_SAIDA}/1`, video.r_frame_rate],
  ['pix_fmt yuv420p', video.pix_fmt === 'yuv420p', video.pix_fmt],
  ['sem faixa de audio', !temAudio, temAudio ? 'tem audio' : 'nenhuma'],
  [`duracao ~${DURACAO_ESPERADA.toFixed(1)}s`, Math.abs(duracao - DURACAO_ESPERADA) < 0.25, duracao.toFixed(2) + 's'],
];

let falhou = false;
for (const [nome, ok, valor] of checagens) {
  console.log(`${ok ? 'ok  ' : 'FALHA'} ${nome} (${valor})`);
  if (!ok) falhou = true;
}
if (falhou) {
  console.error('\nO arquivo nao atende as exigencias do Instagram.');
  process.exit(1);
}

const mb = (fs.statSync(OUTPUT).size / 1024 / 1024).toFixed(1);
console.log(`\nReel pronto: ${OUTPUT} (${mb} MB)`);
