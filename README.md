# MarkEdit-wikilinks

Obsidian-style `[[wikilinks]]` for [MarkEdit](https://github.com/MarkEdit-app/MarkEdit) that leverages [markedit-api](https://github.com/MarkEdit-app/MarkEdit-api).

A small CodeMirror extension that adds wikilink syntax highlighting and click-to-follow navigation, with Obsidian-style vault-wide resolution. Renders in both the editor and the [MarkEdit-preview](https://github.com/MarkEdit-app/MarkEdit-preview) pane.

## Installation

Copy [dist/markedit-wikilinks.js](dist/markedit-wikilinks.js?raw=true) to `~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/`. Details [here](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization#entries).

> Once installed, restart MarkEdit to apply the changes.
>
> If wikilink resolution fails because the file is in a sibling folder, you may also need to [grant folder access](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization#grant-folder-access) by opening your vault root via **File → Open…** once.

## How to Use

Type any Obsidian-style wikilink in your Markdown:

| Syntax | Meaning |
|---|---|
| `[[Note Name]]` | Link to `Note Name.md` |
| `[[Note Name\|Display Text]]` | Link with custom display text |
| `[[docs/foo]]` | Vault-relative path |
| `![[Embed]]` | Embed syntax (highlighted, not yet rendered as image) |

To follow a link:

- **In the editor**: <kbd>⌘</kbd>-click on the wikilink.
- **In the [MarkEdit-preview](https://github.com/MarkEdit-app/MarkEdit-preview) pane**: plain click.

Resolution mirrors Obsidian, in this order:

1. **Same folder** as the current file.
2. **Vault-relative path** if the target contains `/` (e.g. `[[docs/foo]]`).
3. **Recursive search** from the vault root (the directory containing `.obsidian/`), skipping hidden dot-dirs and `node_modules` / `dist` / `build` / `target`, budget-capped at 5,000 entries per click.

If nothing resolves, a diagnostic dialog shows what was tried and offers to create `<target>.md` in the current folder.

## Not yet supported

- `#header` and `^block-id` fragments — stripped, not navigated.
- Inline embed rendering — `![[image.png]]` is highlighted but not displayed as an image.
- Vault index caching — the recursive search rebuilds per click. Fast enough for hundreds of files; large vaults may want a session-scoped index.
- Autocomplete for link targets.
- User-configurable settings.

## Building

Run `yarn install && yarn build` to build and deploy the script. The build also copies the bundle to MarkEdit's scripts folder, so a `yarn reload` will pick up your changes immediately.

## Architecture

```
main.ts              wires four pieces into MarkEdit
src/parser.ts        Lezer inline parser → emits WikiLink / WikiLinkEmbed / Mark / Target / Alias nodes
src/decoration.ts    CodeMirror ViewPlugin → styles those nodes in the editor
src/follow.ts        domEventHandlers → ⌘-click in the editor → resolve and open
src/preview.ts       MutationObserver on .markdown-body → transform text into <a> + plain-click handler
```

A real Lezer parser is used rather than a regex decoration so wikilink nodes:

- don't fire inside fenced code blocks (Lezer context handles that for free),
- play nicely with code folding and syntax-aware selection,
- let the click handler use `syntaxTree.resolveInner(pos)` instead of re-matching against document text.

The preview integration post-processes the rendered HTML inside `.markdown-body` because MarkEdit-preview's [markdown-it](https://github.com/markdown-it/markdown-it) pipeline doesn't know `[[…]]` and has no extension API for adding parsers. The observer skips text inside `<code>`, `<pre>`, `<script>`, `<style>`, and existing `<a>` elements, and disconnects during its own mutations to avoid feedback loops. It's a no-op when MarkEdit-preview isn't installed.

## Contribution

Issues and PRs welcome. Build verification runs via GitHub Actions on every push and PR. If you change source, please run `yarn build` and commit the updated `dist/markedit-wikilinks.js` along with your changes so end users get the fix without needing a toolchain.

## License

MIT — see [LICENSE](./LICENSE).
