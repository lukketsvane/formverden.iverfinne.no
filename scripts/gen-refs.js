const fs = require('fs');
const tex = fs.readFileSync('traktat.tex', 'utf8');
const lines = tex.split('\n');
const refs = {};
for (const line of lines) {
  const m = line.match(/^\\refentry\{\[(\d+)\]\s*(.+)\}\s*$/);
  if (!m) continue;
  let text = m[2];
  text = text.replace(/\\textit\{([^}]*)\}/g, '<i>$1</i>');
  text = text.replace(/\\&/g, '&');
  text = text.replace(/\\%/g, '%');
  text = text.replace(/\\,/g, ' ');
  text = text.replace(/--/g, '–');
  refs[m[1]] = { text };
}
fs.writeFileSync('data/references.json', JSON.stringify(refs, null, 2));
console.log('Wrote', Object.keys(refs).length, 'refs');
