import { EditorView } from '@codemirror/view';
import { syntaxTree } from '@codemirror/language';
import { MarkEdit } from 'markedit-api';

const MD_EXTS = ['.md', '.markdown', '.mdown', '.txt'];

// Folders we never descend into during vault search. Hidden dot-dirs are also skipped.
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', 'target']);

// Cap on how many entries we visit per click, to keep huge vaults responsive.
const SEARCH_BUDGET = 5000;

// Sentinels that mark a directory as a vault root. findVaultRoot() walks up
// from the current file and returns the first ancestor containing any of these.
// Order matters only for the diagnostic message; resolution uses any-match.
const VAULT_MARKERS: readonly string[] = ['.obsidian', '.git', '.markedit-vault'];

export const followWikilinks = EditorView.domEventHandlers({
  mousedown: (event, view) => {
    if (!event.metaKey) return false;

    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos == null) return false;

    const node = syntaxTree(view.state).resolveInner(pos, 1);
    let cur: typeof node | null = node;
    while (cur && cur.name !== 'WikiLink' && cur.name !== 'WikiLinkEmbed') {
      cur = cur.parent;
    }
    if (!cur) return false;

    const targetNode = cur.getChild('WikiLinkTarget');
    if (!targetNode) return false;

    const rawTarget = view.state.sliceDoc(targetNode.from, targetNode.to).trim();
    if (!rawTarget) return false;

    event.preventDefault();
    void openTarget(rawTarget);
    return true;
  },
});

export async function openTarget(rawTarget: string) {
  const target = rawTarget.split(/[#^]/)[0].trim();
  if (!target) return;

  const current = await MarkEdit.getFileInfo();
  if (!current?.filePath) {
    await MarkEdit.showAlert({
      title: 'Cannot follow wikilink',
      message: 'Save this file first so the link can be resolved relative to its folder.',
    });
    return;
  }

  const baseDir = current.parentPath || dirname(current.filePath);
  const sameFolderCandidates = expandCandidates(baseDir, target);

  // 1. Same folder — cheapest, also matches Obsidian's tie-breaker.
  for (const candidate of sameFolderCandidates) {
    if (await MarkEdit.getFileInfo(candidate)) {
      await MarkEdit.openFile(candidate);
      return;
    }
  }

  // 2. Vault-relative path if the target has a slash (e.g. [[docs/foo]]).
  const vaultRoot = await findVaultRoot(baseDir);
  if (vaultRoot && target.includes('/')) {
    for (const candidate of expandCandidates(vaultRoot, target)) {
      if (await MarkEdit.getFileInfo(candidate)) {
        await MarkEdit.openFile(candidate);
        return;
      }
    }
  }

  // 3. Recursive vault search.
  let vaultHit: string | null = null;
  if (vaultRoot) {
    vaultHit = await searchVault(vaultRoot, basenameVariants(target));
    if (vaultHit) {
      await MarkEdit.openFile(vaultHit);
      return;
    }
  }

  // Nothing matched — diagnostic + offer to create in same folder.
  await showMissDialog(target, current.filePath, baseDir, vaultRoot, sameFolderCandidates);
}

function expandCandidates(baseDir: string, target: string): string[] {
  const hasExt = /\.[a-zA-Z0-9]+$/.test(target);
  const bases = target.startsWith('/') ? [target] : [joinPath(baseDir, target)];
  if (hasExt) return bases;
  return bases.flatMap(b => MD_EXTS.map(ext => b + ext));
}

function basenameVariants(target: string): string[] {
  // Strip any folder prefix the user wrote — vault search matches on basename.
  const leaf = target.includes('/') ? target.slice(target.lastIndexOf('/') + 1) : target;
  const hasExt = /\.[a-zA-Z0-9]+$/.test(leaf);
  return hasExt ? [leaf] : MD_EXTS.map(ext => leaf + ext);
}

// Walk up from `start` looking for a directory containing any VAULT_MARKERS entry.
// Stops at the user's home dir or filesystem root.
async function findVaultRoot(start: string): Promise<string | null> {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    const entries = await MarkEdit.listFiles(dir);
    if (entries && VAULT_MARKERS.some(m => entries.includes(m))) return dir;
    const parent = dirname(dir);
    if (!parent || parent === dir) return null;
    dir = parent;
  }
  return null;
}

async function searchVault(root: string, leafTargets: string[]): Promise<string | null> {
  const wanted = new Set(leafTargets);
  const stack: string[] = [root];
  let budget = SEARCH_BUDGET;

  while (stack.length > 0 && budget > 0) {
    const dir = stack.pop()!;
    const entries = await MarkEdit.listFiles(dir);
    if (!entries) continue;

    // Check files in this dir first, then queue subdirs.
    const subdirs: string[] = [];
    for (const entry of entries) {
      budget--;
      if (budget <= 0) break;
      if (entry.startsWith('.') || SKIP_DIRS.has(entry)) continue;

      const full = joinPath(dir, entry);
      if (wanted.has(entry)) return full;

      // Only stat entries that aren't obviously files, to save round-trips.
      if (looksLikeFile(entry)) continue;
      const info = await MarkEdit.getFileInfo(full);
      if (info?.isDirectory) subdirs.push(full);
    }

    // Push in reverse so DFS visits them in listing order.
    for (let i = subdirs.length - 1; i >= 0; i--) stack.push(subdirs[i]);
  }

  return null;
}

function looksLikeFile(name: string): boolean {
  // Cheap heuristic to skip getFileInfo on obvious files.
  return /\.[a-zA-Z0-9]{1,8}$/.test(name);
}

async function showMissDialog(
  target: string,
  currentFilePath: string,
  baseDir: string,
  vaultRoot: string | null,
  candidates: string[],
) {
  const listing = await MarkEdit.listFiles(baseDir);
  const listSample = listing
    ? (listing.length === 0 ? '(empty)' : listing.slice(0, 12).join(', ') + (listing.length > 12 ? `, … (+${listing.length - 12})` : ''))
    : 'listFiles() returned undefined → sandbox denies folder access.';

  const choice = await MarkEdit.showAlert({
    title: `Couldn't resolve “${target}”`,
    message:
      `Current file: ${currentFilePath}\n` +
      `Vault root:   ${vaultRoot ?? `(none — no [${VAULT_MARKERS.join(', ')}] found walking up)`}\n` +
      `Same-folder tried:\n  ${candidates.join('\n  ')}\n\n` +
      `listFiles(parent): ${listSample}\n\n` +
      `Create ${candidates[0]}?`,
    buttons: ['Create', 'Cancel'],
  });
  if (choice === 0) {
    const ok = await MarkEdit.createFile({ path: candidates[0], string: `# ${target}\n` });
    if (ok) await MarkEdit.openFile(candidates[0]);
  }
}

function dirname(p: string): string {
  const i = p.lastIndexOf('/');
  return i < 0 ? '' : p.slice(0, i);
}

function joinPath(dir: string, rel: string): string {
  if (!dir) return rel;
  return dir.endsWith('/') ? dir + rel : dir + '/' + rel;
}
