#!/usr/bin/env node
// Regenera la tabla resumen a partir de un resultados.json ya escrito.
//   node resumir.js resultados.json > resumen.txt
//   node resumir.js resultados.json --criterio2 > baseline-criterio2.txt
//
// --criterio2 reevalua una corrida vieja con el criterio actual, sin volver a
// correrla: el visor poda a proposito los nodos completados, y un agente muerto
// a media tool es indistinguible de uno vivo en una tool larga.
'use strict';
const fs = require('fs');
const { tabla } = require('./lib/tabla');

const f = process.argv[2] || 'resultados.json';
const c2 = process.argv.includes('--criterio2');
const d = JSON.parse(fs.readFileSync(f, 'utf8'));

if (c2) {
  for (const r of d.resultados) {
    r.fallas = r.fallas.filter((x) => {
      if (x.tag === 'terminado-desaparecido') return false;
      // el cierre viejo 'muerto-sin-stop' dejaba el transcript a media tool
      if (x.tag === 'fantasma-vivo' && r.dims.cierre === 'muerto-sin-stop') return false;
      return true;
    });
    r.ok = r.fallas.length === 0;
  }
}

console.log(`dist ${d.meta.dist['dist/app.js']}  ${d.meta.fecha}  ${d.meta.duracionS}s${c2 ? '  [criterio 2]' : ''}`);
console.log(tabla(d.resultados));
