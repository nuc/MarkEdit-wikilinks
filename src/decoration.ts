import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import { Range } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';

const linkDeco = Decoration.mark({ class: 'cm-md-wikilink' });
const embedDeco = Decoration.mark({ class: 'cm-md-wikilink-embed' });
const markDeco = Decoration.mark({ class: 'cm-md-wikilink-mark' });
const aliasDeco = Decoration.mark({ class: 'cm-md-wikilink-alias' });

export const wikilinkExtension = ViewPlugin.fromClass(class {}, {
  provide: () => EditorView.decorations.of(view => {
    const ranges: Range<Decoration>[] = [];
    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from, to,
        enter: node => {
          switch (node.name) {
            case 'WikiLink':
              ranges.push(linkDeco.range(node.from, node.to)); break;
            case 'WikiLinkEmbed':
              ranges.push(embedDeco.range(node.from, node.to)); break;
            case 'WikiLinkMark':
              ranges.push(markDeco.range(node.from, node.to)); break;
            case 'WikiLinkAlias':
              ranges.push(aliasDeco.range(node.from, node.to)); break;
          }
        },
      });
    }
    return Decoration.set(ranges.sort((a, b) => a.from - b.from));
  }),
});

export const wikilinkTheme = EditorView.baseTheme({
  '.cm-md-wikilink': {
    color: 'var(--md-link-color, #2563eb)',
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
  },
  '.cm-md-wikilink-embed': {
    color: 'var(--md-link-color, #2563eb)',
    backgroundColor: 'rgba(37, 99, 235, 0.06)',
    borderRadius: '3px',
    padding: '0 2px',
  },
  '.cm-md-wikilink-mark': {
    color: 'var(--md-mark-color, #94a3b8)',
    opacity: 0.6,
  },
  '.cm-md-wikilink-alias': {
    fontStyle: 'italic',
  },
});
