#!/usr/bin/env node
// Walk proposisjonar.tex, extract per-proposition superscript sets and texts,
// then patch traktat.json to match. Only touches the <sup class="footnote-ref">
// spans and the preceding prose where it clearly differs. Leaves nested HTML
// (img tags, etc) untouched by preserving anything inside <...> in the JSON.

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\//, '')), '..');
const texPath = path.join(root, 'data', 'proposisjonar.tex');
const traktatTexPath = path.join(root, 'data', 'traktat.tex');
const jsonPath = path.join(root, 'data', 'traktat.json');
const refsPath = path.join(root, 'data', 'references.json');
const notesPath = path.join(root, 'data', 'notes.json');

const tex = fs.readFileSync(texPath, 'utf8');
const traktatTex = fs.readFileSync(traktatTexPath, 'utf8');
const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const refs = JSON.parse(fs.readFileSync(refsPath, 'utf8'));
const notes = JSON.parse(fs.readFileSync(notesPath, 'utf8'));

// --- tex → html helpers ----------------------------------------------------

function texToHtml(s) {
  // Strip comments
  s = s.replace(/(^|[^\\])%.*$/gm, '$1');
  // Italic / bold (non-nested)
  s = s.replace(/\\textit\{([^{}]*)\}/g, '<i>$1</i>');
  s = s.replace(/\\textbf\{([^{}]*)\}/g, '<b>$1</b>');
  s = s.replace(/\\texttt\{([^{}]*)\}/g, '<code>$1</code>');
  // Common LaTeX glyphs
  s = s.replace(/---/g, '—').replace(/--/g, '–');
  s = s.replace(/``/g, '"').replace(/''/g, '"');
  s = s.replace(/\\&/g, '&amp;');
  s = s.replace(/\\,/g, ' ');
  s = s.replace(/\\-/g, '');           // strip soft-hyphen hints (form\-verda → formverda)
  // Drop remaining simple control-sequence wrappers like \msym{x} → x
  s = s.replace(/\\msym\{([^{}]*)\}/g, '$1');
  // Collapse stray backslashes before spaces/newlines
  s = s.replace(/\\([ \n])/g, '$1');
  return s.trim();
}

// --- tex parsing -----------------------------------------------------------

// Find \prop{id}{status}{body} and \mainprop{id}{status}{body}. Body can contain
// nested braces (for \textbf{...} etc) — count braces.
function extractProps(src) {
  const out = new Map();
  const re = /\\(main)?prop\{([^}]+)\}\{([^}]*)\}\{/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const id = m[2].trim();
    const status = m[3].trim();
    // Walk forward counting braces to find the matching close.
    let depth = 1;
    let i = re.lastIndex;
    while (i < src.length && depth > 0) {
      const ch = src[i];
      if (ch === '\\') { i += 2; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
      if (depth === 0) break;
      i++;
    }
    const body = src.slice(re.lastIndex, i);
    out.set(id, { status, body });
    re.lastIndex = i + 1;
  }
  return out;
}

const texProps = extractProps(tex);

// Pull out only the superscript references from a tex body.
function extractSups(body) {
  const re = /\\textsuperscript\{([^}]*)\}/g;
  const out = [];
  let m;
  while ((m = re.exec(body)) !== null) {
    const nums = m[1]
      .replace(/\\,/g, ' ')            // collapse thin-spaces to plain spaces first
      .split(/[,\s]+/)
      .map(s => s.trim())
      .filter(s => /^\d+$/.test(s));   // numeric refs only
    out.push(nums);
  }
  return out;
}

// --- json walking ----------------------------------------------------------

function walk(nodes, fn) {
  for (const n of nodes) {
    fn(n);
    if (n.children && n.children.length) walk(n.children, fn);
  }
}

// Pull existing sup lists from a JSON text (HTML string).
function extractJsonSups(html) {
  const re = /<sup class="footnote-ref">([^<]*)<\/sup>/g;
  const out = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    out.push(m[1].split(/[,\s]+/).map(s => s.trim()).filter(Boolean));
  }
  return out;
}

// --- diff + patch ----------------------------------------------------------

const additions = [];
const newProps = [];

walk(json, (node) => {
  const tp = texProps.get(node.id);
  if (!tp) return;
  const texSups = extractSups(tp.body);
  const jsonSups = extractJsonSups(node.text);

  // Build a flat added set. We only ADD refs that the tex has and json doesn't;
  // we never remove existing ones (preserves any json-only annotations).
  const texFlat = new Set(texSups.flat());
  const jsonFlat = new Set(jsonSups.flat());
  const toAdd = [...texFlat].filter(n => !jsonFlat.has(n));
  if (toAdd.length === 0) return;

  // If the json already has a <sup>, append to the last one.
  if (jsonSups.length > 0) {
    const lastSupRe = /<sup class="footnote-ref">([^<]*)<\/sup>/g;
    let last = null, m;
    while ((m = lastSupRe.exec(node.text)) !== null) last = m;
    const merged = Array.from(new Set([...last[1].split(/[,\s]+/).filter(Boolean), ...toAdd]))
      .sort((a, b) => Number(a) - Number(b));
    const replacement = `<sup class="footnote-ref">${merged.join(', ')}</sup>`;
    const start = last.index;
    const end = start + last[0].length;
    node.text = node.text.slice(0, start) + replacement + node.text.slice(end);
  } else {
    // No existing sup — append one at the end of the text (before any trailing HTML like <img>).
    const sorted = Array.from(new Set(toAdd)).sort((a, b) => Number(a) - Number(b));
    const tail = /<img[^>]*>\s*$/i.exec(node.text);
    if (tail) {
      const idx = tail.index;
      node.text = node.text.slice(0, idx).replace(/\s*$/, '') +
        `<sup class="footnote-ref">${sorted.join(', ')}</sup> ` +
        node.text.slice(idx);
    } else {
      node.text = node.text.replace(/\s*$/, '') + `<sup class="footnote-ref">${sorted.join(', ')}</sup>`;
    }
  }
  additions.push({ id: node.id, added: toAdd });
});

// Report tex props absent from json, and insert them next to their nearest sibling.
const jsonIds = new Set();
walk(json, n => jsonIds.add(n.id));
for (const id of texProps.keys()) {
  if (!jsonIds.has(id)) newProps.push(id);
}

// Insert missing props. Nearest parent by longest matching prefix.
function parentIdOf(id) {
  const parts = id.split('.');
  if (parts.length <= 1) return null;
  return parts.slice(0, -1).join('.');
}
function findParent(nodes, parentId) {
  for (const n of nodes) {
    if (n.id === parentId) return n;
    if (n.children) {
      const hit = findParent(n.children, parentId);
      if (hit) return hit;
    }
  }
  return null;
}
function buildText(id) {
  const tp = texProps.get(id);
  if (!tp) return '';
  const sups = extractSups(tp.body);
  // Strip all \textsuperscript{...} from body, convert to html.
  const bare = tp.body.replace(/\\textsuperscript\{[^{}]*\}/g, '').replace(/\s+/g, ' ');
  let html = texToHtml(bare);
  // Append a trailing <sup> with all refs (flattened, unique, sorted).
  const flat = Array.from(new Set(sups.flat())).sort((a, b) => Number(a) - Number(b));
  if (flat.length) html += `<sup class="footnote-ref">${flat.join(', ')}</sup>`;
  return html;
}
const inserted = [];
// Iterate in numerically-sorted order so parents are inserted before children.
const sortMissing = [...newProps].sort((a, b) => {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1);
    if (d) return d;
  }
  return 0;
});
for (const id of sortMissing) {
  const tp = texProps.get(id);
  if (!tp) continue;
  const pid = parentIdOf(id);
  const parent = pid ? findParent(json, pid) : null;
  const container = parent ? (parent.children ??= []) : json;
  // Refresh jsonIds so parents inserted this pass count.
  if (parent) jsonIds.add(parent.id);
  const entry = { id, status: tp.status, text: buildText(id), children: [] };
  // Keep numeric order inside the container.
  const order = [...container.map(n => n.id), id].sort((a, b) => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const d = (pa[i] ?? -1) - (pb[i] ?? -1);
      if (d) return d;
    }
    return 0;
  });
  const at = order.indexOf(id);
  container.splice(at, 0, entry);
  inserted.push(id);
  jsonIds.add(id);
}

// --- references ------------------------------------------------------------

const refRe = /\\refentry\{\[(\d+)\]\s*([\s\S]*?)\}\s*(?=\\refentry|\\end\{widebody\})/g;
const refAdds = [];
let rm;
while ((rm = refRe.exec(traktatTex)) !== null) {
  const n = rm[1];
  if (refs[n]) continue;
  refs[n] = { text: texToHtml(rm[2]) };
  refAdds.push(n);
}

fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n');
fs.writeFileSync(refsPath, JSON.stringify(refs, null, 2) + '\n');

console.log(`Patched ${additions.length} propositions:`);
for (const a of additions) console.log(`  ${a.id}  + [${a.added.join(', ')}]`);
if (inserted.length) {
  console.log(`\nInserted ${inserted.length} new propositions:`);
  for (const id of inserted) console.log(`  ${id}`);
}
if (refAdds.length) {
  console.log(`\nAdded ${refAdds.length} references:  ${refAdds.join(', ')}`);
}
