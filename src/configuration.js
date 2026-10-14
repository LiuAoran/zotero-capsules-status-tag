import { configure } from './model.js';
import { PREF } from './constants.js';
export function readConfiguration() {
  let raw = {};
  try {
    raw = JSON.parse(Zotero.Prefs.get(PREF + 'states', true) || '{}');
  } catch (error) {
    Zotero.logError(error);
  }
  return configure(raw);
}
export function persistConfiguration(config) {
  Zotero.Prefs.set(PREF + 'states', JSON.stringify(config), true);
}
