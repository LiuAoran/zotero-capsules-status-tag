import { createScope } from './scope.js';
import { captureOperation, operationIsCurrent } from './operations.js';
import { STATES, stateIndex, selectionMatches } from './model.js';
import { sourceButton } from './zotero-adapter.js';
export function createInteractionController(
  runtime,
  windows,
  { activateCapsule, choose, closeMenu }
) {
  // Own selection only during this menu/save and its short UI settling period.
  // The host can restore a selection cached before this interaction after saveTx
  // resolves. Observe that event instead of scanning/repainting the whole list.
  function endSelectionGuard(win) {
    const record = windows.get(win),
      guard = record?.selectionGuard;
    if (!guard) return;
    guard.observer.disconnect();
    win.removeEventListener('blur', guard.blur, true);
    if (guard.frame) win.cancelAnimationFrame(guard.frame);
    if (guard.timer) win.clearTimeout(guard.timer);
    record.selectionGuard = null;
  }
  function beginSelectionGuard(win, menu) {
    endSelectionGuard(win);
    const record = windows.get(win),
      tree = win.ZoteroPane?.itemsView;
    const body = menu.anchor.closest('.virtualized-table-body');
    if (!record || !tree || !body) return;
    const guard = {
      ...captureOperation(win, record),
      sourceID: menu.sourceID,
      collection: tree.collectionTreeRow?.id,
    };
    const valid = () =>
      operationIsCurrent(runtime, windows, win, guard) &&
      record.selectionGuard === guard &&
      tree.collectionTreeRow?.id === guard.collection;
    const repair = () => {
      guard.frame = null;
      if (!valid()) {
        endSelectionGuard(win);
        return;
      }
      if (selectionMatches(tree.getSelectedItems(true), guard.sourceID)) return;
      const index = tree.getRowIndexByID(guard.sourceID);
      if (index === undefined) {
        endSelectionGuard(win);
        return;
      }
      // Resolve the index afresh, then select synchronously. Never restore a
      // captured index or wait on the item pane while another selection arrives.
      tree.selection.select(index);
    };
    guard.observer = new win.MutationObserver(() => {
      if (!valid()) {
        endSelectionGuard(win);
        return;
      }
      if (!selectionMatches(tree.getSelectedItems(true), guard.sourceID) && !guard.frame)
        guard.frame = win.requestAnimationFrame(repair);
    });
    guard.blur = (event) => {
      if (event.target === win || event.target === win.document) endSelectionGuard(win);
    };
    win.addEventListener('blur', guard.blur, true);
    record.selectionGuard = guard;
    guard.observer.observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class'],
    });
  }
  function install(win) {
    const doc = win.document;
    // A native mousedown can focus the virtualized tree and replace a cell before
    // its click arrives. Cancel only our controls' default focus/drag behavior,
    // before the tree's capture handlers; menu/keyboard code owns their focus.
    const inputChanged = (event) => {
      const r = windows.get(win);
      if (event.type === 'mousedown' && r) r.releaseShield = false;
      const inMenu = event.target.closest?.('.rs-menu');
      const navigation =
        event.type === 'keydown' &&
        !inMenu &&
        ['ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown', 'Tab'].includes(event.key);
      if (
        !event.target.closest?.('.rs-capsule-cell .rs-capsule, .rs-menu') ||
        navigation ||
        (event.type === 'wheel' && !inMenu)
      ) {
        const r = windows.get(win);
        if (r) {
          r.inputEpoch = (r.inputEpoch || 0) + 1;
          endSelectionGuard(win);
        }
      }
    };
    const controlMouseDown = (event) => {
      const control = event.target.closest?.('.rs-capsule-cell .rs-capsule, .rs-menu button');
      if (event.button !== 0 || !control) return;
      const r = windows.get(win);
      if (!r) return;
      if (r.gestureTimer) win.clearTimeout(r.gestureTimer);
      const menu = control.closest('.rs-menu') ? r.menu : null;
      if (!menu) endSelectionGuard(win);
      r.pointerPress = {
        control,
        menu,
        down: true,
        kind: menu ? 'option' : 'capsule',
        sourceID: menu?.sourceID ?? Number(control.dataset.rsRowItem),
        targetID: menu?.targetID ?? Number(control.dataset.rsItem),
        stateTag: control.dataset.rsStateTag,
      };
      event.preventDefault();
      event.stopPropagation();
    };
    const controlMouseUp = (event) => {
      const r = windows.get(win),
        press = r?.pointerPress;
      if (event.button !== 0 || !r) return;
      // macOS force-click can emit an extra mouseup after a popup has closed.
      // A new mousedown ends this shield, so ordinary row clicks still work.
      if (!press) {
        if (r.releaseShield) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      r.releaseShield = true;
      press.down = false;
      // React can replace a capsule between down and up. Resolve the release
      // against immutable item identity, never the old DOM node or row index.
      const hit = win.document.elementFromPoint(event.clientX, event.clientY);
      const released = hit?.closest?.('.rs-capsule-cell .rs-capsule, .rs-menu button');
      let action = null;
      if (!press.deferredClose && released) {
        if (
          press.kind === 'capsule' &&
          Number(released.dataset.rsRowItem) === press.sourceID &&
          Number(released.dataset.rsItem) === press.targetID &&
          sourceButton(win, win.ZoteroPane?.itemsView, press.sourceID, released)
        ) {
          action = () => activateCapsule(released);
        } else if (
          press.kind === 'option' &&
          r.menu === press.menu &&
          press.menu.node.contains(released) &&
          released.dataset.rsStateTag === press.stateTag &&
          !released.disabled
        ) {
          const index = stateIndex(press.stateTag);
          if (index >= 0 && !STATES[index].retired)
            action = () => choose(win.document, press.targetID, index, press.menu);
        }
      }
      press.lost = !action;
      // Own the complete gesture so a missing/retargeted click cannot drop the
      // action, and a later native click cannot activate it a second time.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (action) void action();
      r.gestureTimer = win.setTimeout(() => {
        if (r.pointerPress !== press) return;
        r.pointerPress = null;
        r.gestureTimer = null;
        if (press.deferredClose && r.menu === press.menu)
          closeMenu(win, press.deferredClose.restore, press.deferredClose.reason);
      }, 0);
    };
    const controlClick = (event) => {
      if (windows.get(win)?.releaseShield && event.detail > 0) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const listeners = [
      ['pointerdown', inputChanged],
      ['mousedown', inputChanged],
      ['keydown', inputChanged],
      ['wheel', inputChanged],
      ['mousedown', controlMouseDown],
      ['mouseup', controlMouseUp],
      ['click', controlClick],
      ['dblclick', controlClick],
    ];
    const scope = createScope();
    for (const [type, handler] of listeners) scope.listen(doc, type, handler);
    return scope.dispose;
  }
  return { beginSelectionGuard, endSelectionGuard, install };
}
