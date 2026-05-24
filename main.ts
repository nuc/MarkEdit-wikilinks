import { MarkEdit } from 'markedit-api';
import { wikilinkConfig } from './src/parser';
import { wikilinkExtension, wikilinkTheme } from './src/decoration';
import { followWikilinks } from './src/follow';

MarkEdit.addMarkdownConfig(wikilinkConfig);
MarkEdit.addExtension([wikilinkTheme, wikilinkExtension, followWikilinks]);
