import { MarkEdit } from 'markedit-api';
import { wikilinkConfig } from './src/parser';
import { wikilinkExtension, wikilinkTheme } from './src/decoration';
import { followWikilinks } from './src/follow';
import { installPreviewWikilinks } from './src/preview';

MarkEdit.addMarkdownConfig(wikilinkConfig);
MarkEdit.addExtension([wikilinkTheme, wikilinkExtension, followWikilinks]);

// Wire up the MarkEdit-preview integration. No-op if the preview plugin isn't installed.
installPreviewWikilinks();
