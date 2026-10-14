import { STATES } from './model.js';
import { PREF } from './constants.js';
import { colorCSS } from './colors.js';
import styles from './styles.css';
function theme(doc) {
  const mode = Zotero.Prefs.get(PREF + 'theme', true) || 'system';
  return colorCSS(
    Zotero.Prefs.get(PREF + 'seed', true) || '#6750a4',
    mode === 'dark' ||
      (mode === 'system' && doc.defaultView.matchMedia('(prefers-color-scheme: dark)').matches),
    STATES,
    Zotero.Prefs.get(PREF + 'harmonize', true) !== false
  );
}
export function applyTheme(doc, style) {
  style.textContent = styles + `\n.rs-capsule-cell,.rs-menu,.rs-error,.rs-settings{${theme(doc)}}`;
}
