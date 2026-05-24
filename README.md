# MarkEdit-wikilinks

Obsidian-style `[[wikilinks]]` for [MarkEdit](https://github.com/MarkEdit-app/MarkEdit).

A small CodeMirror extension that adds wikilink syntax highlighting and Cmd-click navigation, with Obsidian-style vault-wide resolution.

## Features

- **Highlights** `[[Note Name]]`, `[[Note|Alias]]`, and `![[Embed]]` as real syntax nodes — implemented via a Lezer inline parser so it composes correctly with the rest of MarkEdit's Markdown grammar and stays inert inside fenced code blocks.
- **Cmd-click in the editor** opens the linked file. Resolution mirrors Obsidian:
  1. same folder as the current file,
  2. vault-relative path if the target contains `/` (e.g. `[[docs/foo]]`),
  3. recursive search from the vault root (the directory containing `.obsidian/`), skipping hidden and noisy folders, budget-capped at 5,000 entries per click.
- **Plain click in the [MarkEdit-preview](https://github.com/MarkEdit-app/MarkEdit-preview) pane** also follows wikilinks. The preview integration post-processes the rendered HTML (the preview plugin's `markdown-it` pipeline doesn't know `[[…]]`), turning text nodes into anchors with the same resolver, and is a no-op if MarkEdit-preview isn't installed.
- **Create-on-miss**: if nothing resolves, prompts to create `<target>.md` in the current folder.
- **Styled** via CSS classes that pick up your MarkEdit theme.

## Not yet supported

- `#header` and `^block-id` fragments — stripped, not navigated.
- Inline embed rendering — `![[image.png]]` is highlighted but not displayed as an image.
- Vault index caching — the recursive search rebuilds per click. Fast enough for hundreds of files; large vaults may want a session-scoped index.
- Autocomplete for link targets.

## Install

```sh
yarn install
yarn build     # vite build also deploys the bundle to MarkEdit's scripts/ folder
yarn reload    # restart MarkEdit so the script loads
```

The compiled bundle lands at:
`~/Library/Containers/app.cyan.markedit/Data/Documents/scripts/markedit-wikilinks.js`

To uninstall: `yarn uninstall`.

### Sandbox / folder access

MarkEdit is sandboxed and only sees folders you've explicitly granted access to.
If `[[…]]` resolution fails with `listFiles() returned undefined` in the diagnostic
alert, open your vault folder once via **File → Open…** to grant access. See
[the MarkEdit wiki on folder access](https://github.com/MarkEdit-app/MarkEdit/wiki/Customization#grant-folder-access) for details.

## Architecture

```
main.ts              wires three pieces into MarkEdit
src/parser.ts        Lezer inline parser → emits WikiLink / WikiLinkEmbed / Mark / Target / Alias nodes
src/decoration.ts    CodeMirror ViewPlugin → styles those nodes
src/follow.ts        domEventHandlers → Cmd-click resolves and opens
```

A real Lezer parser is used rather than a regex decoration so wikilink nodes:

- don't fire inside fenced code blocks (Lezer context handles that for free),
- play nicely with code folding and syntax-aware selection,
- let the click handler use `syntaxTree.resolveInner(pos)` instead of re-matching against document text.

## Contributing

Issues and PRs welcome. Build verification runs via GitHub Actions on every push and PR.

## License

MIT — see [LICENSE](./LICENSE).
