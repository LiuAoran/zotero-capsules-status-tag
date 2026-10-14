import { stateOf, sortRank, isStatusTag } from './model.js';
import { ID, PREF } from './constants.js';
import { readConfiguration } from './configuration.js';
import { targetOf } from './zotero-adapter.js';
import { applyTheme } from './theme.js';
import { createItemListController } from './item-list.js';
import { createSettingsController } from './settings.js';
const runtime = { alive: false, rootURI: null, columnKey: null };
const list = createItemListController(runtime);
const settings = createSettingsController(runtime, list.capsule);
const { windows, attach, detach, closeMenu, refreshVisible } = list;
let paneID,
  observer,
  prefObservers = [];
export { attach, detach };
export const initSettings = settings.init;
export async function start(uri) {
  runtime.rootURI = uri;
  runtime.alive = true;
  readConfiguration();
  Zotero.ReadingStatusCapsules = { initSettings: settings.init };
  runtime.columnKey = await Zotero.ItemTreeManager.registerColumn({
    dataKey: 'readingStatus',
    label: '状态',
    pluginID: ID,
    enabledTreeIDs: ['main'],
    width: '112',
    flex: 0,
    minWidth: 48,
    staticWidth: true,
    zoteroPersist: ['width', 'hidden', 'sortDirection', 'ordinal'],
    dataProvider(item) {
      const p = targetOf(item);
      return p
        ? `${String(sortRank(stateOf(p))).padStart(6, '0')}|${String(p.id).padStart(12, '0')}|${item.id}`
        : '';
    },
    renderCell: list.renderCell,
  });
  if (!runtime.columnKey) throw new Error('Reading Status column registration failed');
  paneID = await Zotero.PreferencePanes.register({
    pluginID: ID,
    id: 'reading-status-capsules-settings',
    label: 'Capsules 状态',
    src: runtime.rootURI + 'content/preferences.xhtml',
    scripts: [runtime.rootURI + 'content/preferences.js'],
  });
  observer = Zotero.Notifier.registerObserver(
    {
      notify(event, type, ids, extraData) {
        if (type === 'group') {
          for (const [w] of windows) closeMenu(w, false, 'permissions changed');
          refreshVisible();
          return;
        }
        let affected = [];
        if (type === 'item-tag') {
          affected = ids
            .filter((key) => !extraData?.[key]?.tag || isStatusTag(extraData[key].tag))
            .map((key) => Number(String(key).split('-')[0]));
        } else if (
          type === 'item' &&
          ['modify', 'refresh', 'delete', 'trash', 'redraw'].includes(event)
        )
          affected = ids.map(Number);
        if (!affected.length) return;
        for (const [w, r] of windows) {
          if (r.menu && affected.some((id) => id === r.menu.targetID || id === r.menu.sourceID))
            closeMenu(w, false, 'affected item changed');
        }
        refreshVisible(null, null, affected);
      },
    },
    ['item', 'item-tag', 'group'],
    'reading-status-capsules'
  );
  for (const name of ['theme', 'seed', 'states', 'harmonize'])
    prefObservers.push(
      Zotero.Prefs.registerObserver(
        PREF + name,
        () => {
          if (name === 'states') readConfiguration();
          for (const [w, r] of windows) applyTheme(w.document, r.style);
          settings.repaint();
          if (name === 'states') {
            for (const [w] of windows) {
              closeMenu(w, false, 'state configuration changed');
              const tree = w.ZoteroPane?.itemsView;
              if (tree && tree._sortedColumn?.dataKey === runtime.columnKey)
                windows.get(w).sortRequested = true;
            }
            refreshVisible();
          }
        },
        true
      )
    );
  for (const w of Zotero.getMainWindows()) await attach(w);
}
export async function stop() {
  runtime.alive = false;
  for (const w of [...windows.keys()]) detach(w);
  settings.destroy();
  if (observer) Zotero.Notifier.unregisterObserver(observer);
  for (const id of prefObservers) Zotero.Prefs.unregisterObserver(id);
  prefObservers = [];
  if (runtime.columnKey) await Zotero.ItemTreeManager.unregisterColumn(runtime.columnKey);
  if (paneID) Zotero.PreferencePanes.unregister(paneID);
  delete Zotero.ReadingStatusCapsules;
}
