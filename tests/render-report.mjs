// Visual regression fixture using the same canvas renderer shipped to the browser.
// Usage: node tests/render-report.mjs /path/to/node_modules/@napi-rs/canvas /tmp/calcly-report-review
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { renderReportPages, assemblePDF } from '../dist/report.js';

const require = createRequire(import.meta.url);
const { createCanvas } = require(process.argv[2]);
const output = process.argv[3];
await mkdir(output, { recursive: true });
const sample = { version: 2, year: 2026, averageIncome: 3000, income: 4200, base: null, tax: 20,
  expenses: [{ name: 'Gestoría', amount: 75 }, { name: 'Software y herramientas', amount: 49.90 }, { name: 'Coworking', amount: 180 }] };
for (const [name, state] of [
  ['sample', sample],
  ['long', { ...sample, expenses: Array.from({ length: 40 }, (_, i) => ({ name: `${i + 1}. Suscripción mensual a herramientas de diseño, gestión de proyectos y contabilidad`, amount: 5.55 })) }],
  ['zero', { ...sample, income: 0, expenses: [] }],
  ['large', { ...sample, averageIncome: 10000000, income: 10000000, base: 5101.2 }],
]) {
  const images = [];
  for (const canvas of renderReportPages(state, { createCanvas: () => createCanvas(1, 1), now: new Date('2026-09-16T12:00:00Z') })) {
    images.push(new Uint8Array(canvas.toBuffer('image/jpeg', 96)));
  }
  assert.ok(images.length >= 1);
  if (name === 'long') assert.ok(images.length >= 3, 'Long expense lists must paginate');
  const pdf = await assemblePDF(images).arrayBuffer();
  const text = Buffer.from(pdf).toString('latin1');
  const xref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(xref, xref + 4), 'xref');
  await writeFile(join(output, name + '.pdf'), new Uint8Array(pdf));
  console.log(`${name}: ${images.length} pages, ${pdf.byteLength} bytes`);
}
