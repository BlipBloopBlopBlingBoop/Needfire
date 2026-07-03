/* DOM builder helpers + reusable card components. Returns real DOM nodes. */
const C = (function () {
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        if (k === 'class') n.className = attrs[k];
        else if (k.startsWith('on') && typeof attrs[k] === 'function') n.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
      }
    }
    (children || []).forEach((c) => {
      if (c == null) return;
      n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return n;
  }
  function icon(id, cls) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    if (cls) svg.setAttribute('class', cls);
    svg.setAttribute('viewBox', '0 0 24 24');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#icon-' + id);
    svg.appendChild(use);
    return svg;
  }
  function sectionHead(title) {
    return el('div', { class: 'section-head' }, [el('h2', {}, [title]), el('span', { class: 'rule' })]);
  }

  function categoryCard(cat) {
    return el('a', { class: 'card cat', href: '#/category/' + cat.domain }, [
      cat.critical ? el('span', { class: 'flag' }, ['CRITICAL']) : null,
      el('div', { class: 'cat-ico' }, [icon(cat.icon)]),
      el('h3', {}, [cat.label]),
      el('div', { class: 'count' }, [cat.count + (cat.count === 1 ? ' document' : ' documents')]),
    ]);
  }

  function sourceCard(src) {
    return el('a', { class: 'card src', href: '#/read/' + encodeURIComponent(src.doc_id) }, [
      el('div', { class: 'src-top' }, [
        src.n ? el('span', { class: 'badge n' }, ['[' + src.n + ']']) : null,
        el('span', { class: 'badge' }, [src.domain || 'reference']),
      ]),
      el('h3', {}, [src.title]),
      el('p', { class: 'snippet' }, [(src.snippet || '') + '…']),
      el('div', { class: 'src-foot' }, [
        el('span', {}, [src.license || '']),
        src.tier ? el('span', { class: 'tag' }, [src.tier]) : null,
        el('span', { class: 'open' }, ['Open source →']),
      ]),
    ]);
  }

  function docCard(doc) {
    return el('a', { class: 'card src', href: '#/read/' + encodeURIComponent(doc.doc_id) }, [
      el('div', { class: 'src-top' }, [el('span', { class: 'badge' }, [doc.domain || 'reference'])]),
      el('h3', {}, [doc.title]),
      el('div', { class: 'src-foot' }, [
        el('span', {}, [doc.license || '']),
        doc.tier ? el('span', { class: 'tag' }, [doc.tier]) : null,
        el('span', { class: 'open' }, ['Read →']),
      ]),
    ]);
  }

  function stat(label, value, sub, pct, tone) {
    return el('div', { class: 'card stat' }, [
      el('div', { class: 'stat-label' }, [label]),
      el('div', { class: 'stat-val' }, [value]),
      sub ? el('div', { class: 'stat-sub' }, [sub]) : null,
      pct != null ? el('div', { class: 'meter ' + (tone || '') }, [el('span', { style: 'width:' + pct + '%' })]) : null,
    ]);
  }

  function empty(text, iconId) {
    return el('div', { class: 'empty' }, [icon(iconId || 'empty'), el('div', {}, [text])]);
  }

  return { el, icon, sectionHead, categoryCard, sourceCard, docCard, stat, empty };
})();
