// Tabla resumen: casos por grupo y fallas agrupadas por causa, con el
// escenario de menor score que reproduce cada una.
'use strict';
function tabla(resultados) {
  const L = [];
  const total = resultados.length;
  const ok = resultados.filter((r) => r.ok).length;
  L.push(`casos: ${total}   pasados: ${ok}   fallados: ${total - ok}`);
  L.push('');

  const porGrupo = {};
  for (const r of resultados) {
    const g = (porGrupo[r.grupo] ||= { total: 0, ok: 0 });
    g.total++; if (r.ok) g.ok++;
  }
  L.push('grupo                 total   pasados   fallados');
  for (const [g, v] of Object.entries(porGrupo))
    L.push(`${g.padEnd(20)} ${String(v.total).padStart(6)} ${String(v.ok).padStart(9)} ${String(v.total - v.ok).padStart(10)}`);
  L.push('');

  const porTag = {};
  for (const r of resultados)
    for (const f of r.fallas) {
      const t = (porTag[f.tag] ||= { casos: new Set(), puntos: {}, min: null, ej: null });
      t.casos.add(r.id);
      t.puntos[f.punto] = (t.puntos[f.punto] || 0) + 1;
      if (!t.min || r.score < t.min.score) { t.min = r; t.ej = f; }
    }
  L.push('causa                      casos  puntos                     escenario minimo que lo reproduce');
  for (const [tag, v] of Object.entries(porTag).sort((a, b) => b[1].casos.size - a[1].casos.size)) {
    const d = v.min.dims;
    const esc = `${v.min.id} ${d.tipo}/${d.cierre}/${d.orden}/${d.sesion}/${d.servidor}`;
    const pts = Object.entries(v.puntos).map(([k, n]) => `${k}:${n}`).join(' ');
    L.push(`${tag.padEnd(26)} ${String(v.casos.size).padStart(5)}  ${pts.padEnd(25)} ${esc}`);
    L.push(`${''.padEnd(26)}        ${''.padEnd(25)} -> ${(v.ej.detalle || '').slice(0, 110)}`);
  }
  L.push('');
  const conReconexion = resultados.filter((r) => r.info && r.info.reconectoSolo !== undefined);
  if (conReconexion.length) {
    const n = conReconexion.filter((r) => r.info.reconectoSolo).length;
    L.push(`informativo: la pestana abierta se recupero sola tras reiniciar el servidor en ${n}/${conReconexion.length} casos`);
  }
  return L.join('\n');
}

module.exports = { tabla };
