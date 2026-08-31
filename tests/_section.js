'use strict';
const fs = require('fs');

const BUNDLES = ['js/70-verdant-world.js', 'js/71-aqua-world.js'];

/* Return the verbatim source of one original layer out of a flattened
   bundle, so each smoke test still exercises exactly its own layer.
   Unbundled paths fall through to a plain file read. */
module.exports = function (name) {
  for (const bundle of BUNDLES) {
    const all = fs.readFileSync(bundle, 'utf8');
    const b = '/* ===== BEGIN ' + name + ' ===== */';
    const e = '/* ===== END ' + name + ' ===== */';
    const i = all.indexOf(b);
    if (i >= 0) return all.slice(i + b.length, all.indexOf(e));
  }
  return fs.readFileSync(name, 'utf8');
};

/* The wiring manifest: every layer actually loaded, in true load order,
   rendered as name?b=NNN lines so legacy wiring checks keep working. */
module.exports.manifest = function () {
  const out = [];
  const re = /\/\* ===== BEGIN (js\/[^ ]+) ===== \*\//g;
  for (const bundle of BUNDLES) {
    const all = fs.readFileSync(bundle, 'utf8');
    let m;
    while ((m = re.exec(all))) out.push(m[1] + '?b=161');
  }
  const loader = fs.readFileSync('js/19-verdant-assets.js', 'utf8');
  const re2 = /src=\\?"(js\/[^?"\\]+)\?/g;
  let m2;
  while ((m2 = re2.exec(loader))) {
    const f = m2[1];
    if (!f.includes('70-verdant-world') && !f.includes('71-aqua-world')) out.push(f + '?b=161');
  }
  return out.join('\n');
};
