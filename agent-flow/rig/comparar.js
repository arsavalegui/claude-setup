#!/usr/bin/env node
// Compara dos corridas: que se arreglo, que se rompio, que sigue igual.
//   node comparar.js resultados-viejo.json resultados.json
'use strict';
const fs = require('fs');

const [a, b] = process.argv.slice(2);
if (!a || !b) { console.error('uso: node comparar.js <antes.json> <despues.json>'); process.exit(1); }
const A = JSON.parse(fs.readFileSync(a, 'utf8'));
const B = JSON.parse(fs.readFileSync(b, 'utf8'));
const idx = (d) => Object.fromEntries(d.resultados.map((r) => [r.id, r]));
const ia = idx(A), ib = idx(B);
const tags = (r) => [...new Set(r.fallas.map((f) => f.tag))].sort().join(',') || 'ok';

console.log(`antes:   ${a}  dist ${A.meta.dist['dist/app.js'].slice(0, 8)}  ${A.meta.pasados}/${A.meta.total} pasados`);
console.log(`despues: ${b}  dist ${B.meta.dist['dist/app.js'].slice(0, 8)}  ${B.meta.pasados}/${B.meta.total} pasados\n`);

const arreglados = [], rotos = [], cambiados = [];
for (const id of Object.keys(ib)) {
  const ra = ia[id], rb = ib[id];
  if (!ra) continue;
  if (!ra.ok && rb.ok) arreglados.push(id);
  else if (ra.ok && !rb.ok) rotos.push(`${id} -> ${tags(rb)}`);
  else if (!ra.ok && !rb.ok && tags(ra) !== tags(rb)) cambiados.push(`${id}: ${tags(ra)} -> ${tags(rb)}`);
}
console.log(`arreglados: ${arreglados.length}`);
console.log(`rotos:      ${rotos.length}`);
rotos.slice(0, 20).forEach((x) => console.log('   ' + x));
console.log(`cambiaron de causa: ${cambiados.length}`);
cambiados.slice(0, 20).forEach((x) => console.log('   ' + x));

const cuenta = (d) => {
  const m = {};
  for (const r of d.resultados) for (const t of new Set(r.fallas.map((f) => f.tag))) m[t] = (m[t] || 0) + 1;
  return m;
};
const ca = cuenta(A), cb = cuenta(B);
console.log('\ncausa                          antes  despues');
for (const t of new Set([...Object.keys(ca), ...Object.keys(cb)]))
  console.log(`${t.padEnd(30)} ${String(ca[t] || 0).padStart(5)} ${String(cb[t] || 0).padStart(8)}`);
