/* Minimal safe markdown renderer. Builds real DOM nodes (createElement +
   textContent) so corpus/model text can never inject HTML. External URLs are
   rendered as plain text — Needfire is an offline appliance. */
const MD = (function () {
  const INLINE = /(`+)([\s\S]*?)\1|\*\*([^*]+)\*\*|__([^_]+)__|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|\[([^\]]+)\]\(([^)\s]+)\)/;

  function appendInline(parent, text) {
    let rest = String(text);
    while (rest) {
      const m = rest.match(INLINE);
      if (!m) { parent.appendChild(document.createTextNode(rest)); return; }
      if (m.index > 0) parent.appendChild(document.createTextNode(rest.slice(0, m.index)));
      if (m[2] != null) {
        const c = document.createElement('code'); c.textContent = m[2]; parent.appendChild(c);
      } else if (m[3] != null || m[4] != null) {
        const b = document.createElement('strong'); appendInline(b, m[3] != null ? m[3] : m[4]); parent.appendChild(b);
      } else if (m[5] != null || m[6] != null) {
        const it = document.createElement('em'); appendInline(it, m[5] != null ? m[5] : m[6]); parent.appendChild(it);
      } else if (m[7] != null) {
        const href = m[8];
        if (/^(#|\/(?!\/)|\.\.?\/)/.test(href)) { // internal links only
          const a = document.createElement('a'); a.setAttribute('href', href); appendInline(a, m[7]); parent.appendChild(a);
        } else { // external: show as text, never a live link
          appendInline(parent, m[7]);
          parent.appendChild(document.createTextNode(' (' + href + ')'));
        }
      }
      rest = rest.slice(m.index + m[0].length);
    }
  }

  const BLOCK_START = /^(#{1,6}\s|```|\s*>|\s*[-*+]\s+|\s*\d+[.)]\s+|(?:-{3,}|\*{3,})\s*$)/;

  /* render(text, {skipTitle: 'Doc Title'}) -> DocumentFragment.
     skipTitle drops a leading H1 that duplicates the given title. */
  function render(text, opts) {
    opts = opts || {};
    const frag = document.createDocumentFragment();
    const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    let i = 0;
    let firstBlock = true;

    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim()) { i++; continue; }

      if (/^```/.test(line)) {
        const buf = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
        i++; // closing fence
        const pre = document.createElement('pre');
        const code = document.createElement('code');
        code.textContent = buf.join('\n');
        pre.appendChild(code); frag.appendChild(pre);
        firstBlock = false; continue;
      }

      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        i++;
        if (h[1].length === 1 && firstBlock && opts.skipTitle &&
            h[2].trim().toLowerCase() === String(opts.skipTitle).trim().toLowerCase()) {
          firstBlock = false; continue; // duplicate of the page title
        }
        firstBlock = false;
        const hd = document.createElement('h' + h[1].length);
        appendInline(hd, h[2]); frag.appendChild(hd); continue;
      }

      if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
        frag.appendChild(document.createElement('hr')); i++; firstBlock = false; continue;
      }

      if (/^\s*>/.test(line)) {
        const buf = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
        const bq = document.createElement('blockquote');
        bq.appendChild(render(buf.join('\n')));
        frag.appendChild(bq); firstBlock = false; continue;
      }

      const ulRe = /^\s*[-*+]\s+/, olRe = /^\s*\d+[.)]\s+/;
      if (ulRe.test(line) || olRe.test(line)) {
        const re = olRe.test(line) ? olRe : ulRe;
        const list = document.createElement(re === olRe ? 'ol' : 'ul');
        while (i < lines.length && (re.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && lines[i].trim()))) {
          if (re.test(lines[i])) {
            let item = lines[i].replace(re, ''); i++;
            while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !ulRe.test(lines[i]) && !olRe.test(lines[i])) {
              item += ' ' + lines[i].trim(); i++;
            }
            const li = document.createElement('li');
            appendInline(li, item); list.appendChild(li);
          } else { i++; }
        }
        frag.appendChild(list); firstBlock = false; continue;
      }

      // paragraph: absorb soft-wrapped lines until a blank or a block marker
      const buf = [line.trim()]; i++;
      while (i < lines.length && lines[i].trim() && !BLOCK_START.test(lines[i])) {
        buf.push(lines[i].trim()); i++;
      }
      const p = document.createElement('p');
      appendInline(p, buf.join(' '));
      frag.appendChild(p); firstBlock = false;
    }
    return frag;
  }

  return { render };
})();
