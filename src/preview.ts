import { openTarget } from './follow';

// Selector for MarkEdit-preview's pane. The pane class is defined in
// markedit-preview/src/shared/const.ts as `markdown-body`.
const PREVIEW_PANE = '.markdown-body';

// Pattern mirrors src/parser.ts but applied to text nodes in rendered HTML.
// Capture groups: 1 = target (before optional |), 2 = optional alias.
const WIKILINK_RE = /\[\[([^[\]|]+?)(?:\|([^[\]]+?))?\]\]/g;

const ANCHOR_CLASS = 'me-wikilink';
const SKIP_PARENTS = new Set(['CODE', 'PRE', 'SCRIPT', 'STYLE', 'A']);

export function installPreviewWikilinks() {
  // MarkEdit-preview creates the pane synchronously during its setUp().
  // We may load after that, but if the user doesn't have the preview plugin
  // installed, the pane never appears — observe `document.body` for it.
  const pane = document.querySelector(PREVIEW_PANE);
  if (pane) {
    attach(pane);
    return;
  }

  // Wait for the pane to appear, then attach once.
  const bodyObserver = new MutationObserver(() => {
    const found = document.querySelector(PREVIEW_PANE);
    if (found) {
      bodyObserver.disconnect();
      attach(found);
    }
  });
  bodyObserver.observe(document.body, { childList: true, subtree: false });
}

function attach(pane: Element) {
  installClickHandler(pane);

  const observer = new MutationObserver(() => {
    // Disconnect during our own mutations so we don't re-trigger.
    observer.disconnect();
    try {
      transformPane(pane);
    } finally {
      observer.observe(pane, { childList: true, subtree: true, characterData: true });
    }
  });

  // Initial pass + subscribe to subsequent renders.
  transformPane(pane);
  observer.observe(pane, { childList: true, subtree: true, characterData: true });
}

function transformPane(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) => {
      const value = node.nodeValue;
      if (!value || !value.includes('[[')) return NodeFilter.FILTER_REJECT;

      // Skip text inside code blocks, existing anchors, etc.
      let p: Element | null = node.parentElement;
      while (p) {
        if (SKIP_PARENTS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        p = p.parentElement;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  for (const text of textNodes) {
    const fragment = buildReplacement(text.nodeValue ?? '');
    if (fragment) text.replaceWith(fragment);
  }
}

function buildReplacement(source: string): DocumentFragment | null {
  WIKILINK_RE.lastIndex = 0;
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let matched = false;

  for (const match of source.matchAll(WIKILINK_RE)) {
    matched = true;
    const start = match.index ?? 0;
    if (start > lastIndex) {
      fragment.appendChild(document.createTextNode(source.slice(lastIndex, start)));
    }

    const rawTarget = match[1].trim();
    const display = (match[2] ?? match[1]).trim();
    const anchor = document.createElement('a');
    anchor.className = ANCHOR_CLASS;
    anchor.dataset.wikilinkTarget = rawTarget;
    anchor.href = '#';
    anchor.textContent = display;
    fragment.appendChild(anchor);

    lastIndex = start + match[0].length;
  }

  if (!matched) return null;
  if (lastIndex < source.length) {
    fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
  }
  return fragment;
}

function installClickHandler(pane: Element) {
  pane.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const anchor = target?.closest<HTMLAnchorElement>(`a.${ANCHOR_CLASS}`);
    if (!anchor) return;
    const wikilinkTarget = anchor.dataset.wikilinkTarget;
    if (!wikilinkTarget) return;

    event.preventDefault();
    event.stopPropagation();
    void openTarget(wikilinkTarget);
  });
}
