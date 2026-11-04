// Guards the colour system. Needs Node 22.18+ to import theme.ts directly.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, PLAYER_TONES } from '../src/constants/theme.ts';

const TEXT_MIN = 4.5;
const GRAPHIC_MIN = 3;
const SEPARATION_MIN = 8;

const failures = [];
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = rgb(hex).map(linear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const expectContrast = (fg, bg, min, label) => {
  const ratio = contrast(fg, bg);
  if (ratio < min) failures.push(`${label}: ${ratio.toFixed(2)}:1, needs ${min}:1 (${fg} on ${bg})`);
};

// Machado, Oliveira and Fernandes (2009), severity 1.0.
const VISION = {
  normal: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
};
const oklab = ([r, g, b]) => {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const seenAs = (hex, matrix) => {
  const v = rgb(hex).map(linear);
  return oklab(matrix.map((row) => Math.min(1, Math.max(0, row[0] * v[0] + row[1] * v[1] + row[2] * v[2]))));
};
const separation = (a, b, matrix) => 100 * Math.hypot(...seenAs(a, matrix).map((x, i) => x - seenAs(b, matrix)[i]));

const surfaces = ['deep', 'surface', 'panel', 'raised', 'hover'];
for (const surface of surfaces) {
  for (const fg of ['text', 'textMuted', 'lime', 'sky', 'gold', 'win', 'dangerText']) {
    expectContrast(COLORS[fg], COLORS[surface], TEXT_MIN, `${fg} on ${surface}`);
  }
  expectContrast(COLORS.danger, COLORS[surface], GRAPHIC_MIN, `danger graphic on ${surface}`);
}
expectContrast(COLORS.textFaint, COLORS.deep, TEXT_MIN, 'textFaint on deep');
expectContrast(COLORS.textFaint, COLORS.surface, TEXT_MIN, 'textFaint on surface');

for (const fill of ['lime', 'gold', 'sky', 'danger', 'win']) {
  expectContrast(COLORS.onColor, COLORS[fill], TEXT_MIN, `onColor on ${fill}`);
}

const tones = Object.values(PLAYER_TONES);
for (const { fill, wash, washHover } of tones) {
  expectContrast(fill, COLORS.raised, GRAPHIC_MIN, 'player fill on raised');
  expectContrast(COLORS.onColor, fill, TEXT_MIN, 'onColor on player fill');
  for (const bg of [wash, washHover]) {
    expectContrast(COLORS.text, bg, TEXT_MIN, 'text on card wash');
    expectContrast(COLORS.textMuted, bg, TEXT_MIN, 'textMuted on card wash');
  }
}

for (const [name, matrix] of Object.entries(VISION)) {
  tones.forEach((a, i) => {
    tones.slice(i + 1).forEach((b) => {
      const gap = separation(a.fill, b.fill, matrix);
      if (gap < SEPARATION_MIN) failures.push(`${name}: ${a.fill} and ${b.fill} only ${gap.toFixed(1)} apart, needs ${SEPARATION_MIN}`);
    });
  });
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgb|hsl)a?\(/;
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
for (const file of walk(root)) {
  if (file.endsWith(join('constants', 'theme.ts'))) continue;
  readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
    if (LITERAL.test(line)) failures.push(`colour literal outside theme.ts: ${file}:${i + 1}`);
  });
}

if (failures.length) {
  console.error(failures.join('\n'));
  console.error(`\n${failures.length} colour check(s) failed`);
  process.exit(1);
}
console.log('Colour checks passed');
