import { createScope } from './scope.js';
import { captureOperation, operationIsCurrent, matchesInput } from './operations.js';
import {
  STATES,
  stateOf,
  saveStatus,
  initialColumnPrefs,
  rowBinding,
  selectionMatches,
  orderedIndices,
  stateIndex,
} from './model.js';
import { html, icon } from './dom.js';
import { targetOf, sourceButton, bindingForButton } from './zotero-adapter.js';
import { applyTheme } from './theme.js';
import { createInteractionController } from './interactions.js';
export function createItemListController(runtime) {
  const windows = new Map(),
    pending = new Map();
  const interaction = createInteractionController(runtime, windows, {
    activateCapsule,
    choose,
    closeMenu,
  });
  const { beginSelectionGuard, endSelectionGuard } = interaction;
  function displayState(item) {
    const tag = pending.get(item.id);
    return tag ? Math.max(0, stateIndex(tag)) : stateOf(item);
  }

  function errorNotice(doc, message) {
    const record = windows.get(doc.defaultView);
    if (!record) return;
    record.error?.remove();
    if (record.errorTimer) doc.defaultView.clearTimeout(record.errorTimer);
    const node = html(doc, 'div');
    node.className = 'rs-error';
    node.setAttribute('role', 'alert');
    node.textContent = message;
    doc.documentElement.append(node);
    record.error = node;
    record.errorTimer = doc.defaultView.setTimeout(() => {
      node.remove();
      record.error = null;
    }, 3500);
  }
  function closeMenu(win, restore = false, reason = 'explicit') {
    const record = windows.get(win);
    if (!record?.menu) return;
    Zotero.debug('Reading Status menu close: ' + reason);
    if (runtime.alive && record.pointerPress?.down && record.pointerPress.menu === record.menu) {
      record.pointerPress.deferredClose = { restore, reason };
      return;
    }
    if (reason !== 'save started') endSelectionGuard(win);
    const { node, anchor, scope, sourceID } = record.menu;
    scope.dispose();
    node.remove();
    anchor.setAttribute('aria-expanded', 'false');
    record.menu = null;
    if (restore) {
      const tree = win.ZoteroPane?.itemsView;
      const replacement = sourceButton(win, tree, sourceID);
      if (selectionMatches(tree?.getSelectedItems(true) || [], sourceID))
        replacement?.focus({ preventScroll: true });
    }
  }
  async function choose(doc, id, index, expectedMenu) {
    const menu = windows.get(doc.defaultView)?.menu;
    const tree = doc.defaultView.ZoteroPane?.itemsView;
    // Ignore callbacks from a detached menu without disturbing a newer menu.
    if (!menu || menu !== expectedMenu) return;
    if (
      menu.targetID !== id ||
      !matchesInput(windows.get(doc.defaultView), menu) ||
      targetOf(Zotero.Items.get(menu.sourceID))?.id !== id
    ) {
      closeMenu(doc.defaultView);
      errorNotice(doc, '当前选择已变化，请重新打开状态菜单');
      return;
    }
    const item = targetOf(Zotero.Items.get(id));
    if (!item || pending.has(item.id)) return;
    // A delayed host restore cannot redirect this menu's immutable target.
    const sourceIndex = tree.getRowIndexByID(menu.sourceID);
    if (sourceIndex === undefined) {
      closeMenu(doc.defaultView);
      return;
    }
    if (!selectionMatches(tree.getSelectedItems(true), menu.sourceID))
      tree.selection.select(sourceIndex);
    const record = windows.get(doc.defaultView);
    const operation = captureOperation(doc.defaultView, record);
    const operationGuard = record.selectionGuard;
    const viewport = menu.anchor.closest('.virtualized-table-body');
    const anchorRect = menu.anchor.getBoundingClientRect(),
      bounds = viewport?.getBoundingClientRect();
    const screenTop = bounds
      ? Math.max(bounds.top + 3, Math.min(anchorRect.top, bounds.bottom - anchorRect.height))
      : anchorRect.top;
    const sortedByStatus = tree._sortedColumn?.dataKey === runtime.columnKey;
    pending.set(item.id, STATES[stateOf(item)].tag);
    // Dismiss immediately while keeping the last committed label and color.
    // The pointer gesture guard still protects any delayed mouse release.
    closeMenu(doc.defaultView, false, 'save started');
    refreshVisible(null, null, [item.id]);
    try {
      await saveStatus(item, index);
    } catch (e) {
      Zotero.logError(e);
      errorNotice(doc, '保存失败，状态未改变');
    } finally {
      pending.delete(item.id);
      const guard = operationGuard;
      if (guard && record.selectionGuard === guard) {
        // Event-driven protection remains briefly after notifier completion.
        guard.timer = doc.defaultView.setTimeout(() => {
          if (record.selectionGuard === guard) endSelectionGuard(doc.defaultView);
        }, 600);
      }
      // The host reorders modified rows. Restore by item ID after its notifier
      // finishes, never by the old row position, and never over new user input.
      const stillCurrent = () => operationIsCurrent(runtime, windows, doc.defaultView, operation);
      if (stillCurrent() && tree.getRowIndexByID(menu.sourceID) !== undefined) {
        try {
          if (!selectionMatches(tree.getSelectedItems(true), menu.sourceID))
            await tree.selectItems([menu.sourceID], true, true);
          // Selection rendering is asynchronous. Respect any newer user input
          // before scrolling or focusing the source after a status sort.
          if (stillCurrent() && selectionMatches(tree.getSelectedItems(true), menu.sourceID)) {
            const rowIndex = tree.getRowIndexByID(menu.sourceID);
            if (rowIndex !== undefined) tree.ensureRowsAreVisible([rowIndex]);
            if (sortedByStatus && viewport?.isConnected) {
              for (let pass = 0; pass < 2; pass++) {
                await new Promise((resolve) => doc.defaultView.requestAnimationFrame(resolve));
                const button = sourceButton(doc.defaultView, tree, menu.sourceID);
                if (
                  !stillCurrent() ||
                  !selectionMatches(tree.getSelectedItems(true), menu.sourceID) ||
                  !button
                )
                  break;
                const delta = button.getBoundingClientRect().top - screenTop;
                if (Math.abs(delta) > 1) viewport.scrollTop += delta;
              }
            }
          }
        } catch (error) {
          Zotero.logError(error);
        }
      }
      const unchanged = stillCurrent();
      if (record.menu === menu) closeMenu(doc.defaultView, false);
      const active = doc.activeElement;
      const restore =
        menu &&
        (!active ||
          active === doc.body ||
          active === doc.documentElement ||
          menu.node.contains(active) ||
          active === menu.anchor);
      refreshVisible(restore && unchanged ? doc.defaultView : null, menu.sourceID, [item.id]);
    }
  }
  async function activateCapsule(button) {
    const doc = button.ownerDocument,
      win = doc.defaultView,
      record = windows.get(win);
    const tree = win.ZoteroPane?.itemsView;
    const binding = bindingForButton(button, tree);
    if (!record || !button.isConnected || !binding) return;
    if (
      binding.sourceID !== Number(button.dataset.rsRowItem) ||
      binding.targetID !== Number(button.dataset.rsItem)
    ) {
      closeMenu(win);
      refreshVisible();
      errorNotice(doc, '列表已变化，请重新点击状态');
      return;
    }
    const serial = (record.activationSerial || 0) + 1;
    record.activationSerial = serial;
    closeMenu(win);
    try {
      // Selecting by ID (not a captured row index) survives sorting and repaint.
      if (!selectionMatches(tree.getSelectedItems(true), binding.sourceID)) {
        await tree.selectItems([binding.sourceID], true, true);
        // Finish the host's selection scroll before positioning the popup.
        await Zotero.Promise.delay(60);
      }
      if (!runtime.alive || !windows.has(win) || record.activationSerial !== serial) return;
      if (!selectionMatches(tree.getSelectedItems(true), binding.sourceID)) return;
      const anchor = [...doc.querySelectorAll('.rs-capsule')].find(
        (b) =>
          Number(b.dataset.rsRowItem) === binding.sourceID &&
          Number(b.dataset.rsItem) === binding.targetID
      );
      if (anchor) openMenu(anchor, binding.targetID);
    } catch (error) {
      Zotero.logError(error);
      errorNotice(doc, '无法选择文献，请重试');
    }
  }
  function openMenu(anchor, id) {
    const doc = anchor.ownerDocument,
      win = doc.defaultView,
      record = windows.get(win);
    const item = targetOf(Zotero.Items.get(id));
    if (!record || !anchor.isConnected || !item) {
      Zotero.debug('Reading Status menu rejected: missing window, row or item');
      return;
    }
    if (!item.isEditable() || item.deleted) {
      errorNotice(doc, '此文献或文库为只读');
      return;
    }
    if (pending.has(item.id)) {
      Zotero.debug('Reading Status menu rejected: save pending');
      return;
    }
    closeMenu(win);
    Zotero.debug('Reading Status menu open row: ' + anchor.dataset.rsRowItem);
    const node = html(doc, 'div');
    node.className = 'rs-menu';
    node.setAttribute('role', 'menu');
    node.setAttribute('aria-label', '状态');
    const menu = {
      node,
      anchor,
      scope: createScope(),
      sourceID: Number(anchor.dataset.rsRowItem),
      targetID: id,
      epoch: record.inputEpoch || 0,
      serial: record.activationSerial,
    };
    const selected = stateOf(item);
    const indices = orderedIndices();
    const buttons = indices.map((i) => {
      const s = STATES[i];
      const b = html(doc, 'button');
      b.type = 'button';
      b.dataset.rsStateTag = s.tag;
      b.setAttribute('role', 'menuitemradio');
      b.setAttribute('aria-checked', String(i === selected));
      b.tabIndex = -1;
      const check = html(doc, 'span');
      check.className = 'rs-check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = i === selected ? '✓' : '';
      b.append(check, doc.createTextNode(s.label));
      b.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.detail === 0) void choose(doc, id, i, menu);
      });
      node.append(b);
      return b;
    });
    for (const type of ['mousedown', 'pointerdown', 'dblclick', 'dragstart'])
      node.addEventListener(type, (e) => {
        e.stopPropagation();
        if (type === 'dragstart') e.preventDefault();
      });
    node.addEventListener('keydown', (e) => {
      e.stopPropagation();
      const current = buttons.indexOf(doc.activeElement);
      let next;
      if (e.key === 'ArrowDown') next = (current + 1) % buttons.length;
      if (e.key === 'ArrowUp') next = (current + buttons.length - 1) % buttons.length;
      if (e.key === 'Home') next = 0;
      if (e.key === 'End') next = buttons.length - 1;
      if (next !== undefined) {
        e.preventDefault();
        buttons[next].focus({ preventScroll: true });
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeMenu(win, true);
      }
      if (e.key === 'Tab') closeMenu(win, true);
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (current >= 0 && !buttons[current].disabled)
          void choose(doc, id, indices[current], menu);
      }
    });
    doc.documentElement.append(node);
    function positionMenu() {
      if (record.pointerPress?.down && record.pointerPress.menu?.node === node) return;
      const width = win.innerWidth,
        height = win.innerHeight;
      node.style.maxHeight = Math.max(40, height - 16) + 'px';
      node.style.overflowY = 'auto';
      const rect = anchor.getBoundingClientRect(),
        bounds = node.getBoundingClientRect();
      node.style.left = Math.max(8, Math.min(rect.left, width - bounds.width - 8)) + 'px';
      node.style.top = Math.max(8, Math.min(rect.bottom + 4, height - bounds.height - 8)) + 'px';
    }
    positionMenu();
    anchor.setAttribute('aria-expanded', 'true');
    const listen = menu.scope.listen;
    listen(doc, 'pointerdown', (e) => {
      if (!node.contains(e.target) && !anchor.contains(e.target))
        closeMenu(win, false, 'outside pointer');
    });
    listen(win, 'resize', () => {
      if (anchor.isConnected) positionMenu();
    });
    listen(doc, 'wheel', (e) => {
      const list = anchor.closest('.virtualized-table-body');
      if (!node.contains(e.target) && list?.contains(e.target))
        closeMenu(win, false, 'user list wheel');
    });
    listen(doc, 'scroll', (e) => {
      if (node.contains(e.target)) return;
      // Selection/sort/attachment rendering can schedule a later list scroll.
      // A scroll event alone is not evidence of a new user gesture.
      if (anchor.isConnected) positionMenu();
    });
    listen(win, 'blur', (e) => {
      if (e.target === win || e.target === doc) {
        record.pointerPress = null;
        record.inputEpoch = (record.inputEpoch || 0) + 1;
        closeMenu(win, false, 'window blur');
      }
    });
    // Virtualized rows can disappear without a scroll event (filter/sort/library switch).
    const rowItemID = anchor.dataset.rsRowItem;
    const mutation = new win.MutationObserver(() => {
      const tree = win.ZoteroPane?.itemsView;
      if (anchor.isConnected && sourceButton(win, tree, Number(rowItemID), anchor)) return;
      const replacement = sourceButton(win, tree, Number(rowItemID));
      if (!replacement || replacement.getAttribute('aria-disabled') === 'true') {
        closeMenu(win, false, 'row removed or disabled');
        return;
      }
      // Focus/selection repaint replaces DOM nodes without changing the row.
      // Rebind that same source row (PDF children have their own row IDs).
      anchor.setAttribute('aria-expanded', 'false');
      anchor = replacement;
      anchor.setAttribute('aria-expanded', 'true');
      if (record.menu) record.menu.anchor = anchor;
      positionMenu();
    });
    mutation.observe(
      anchor.closest('.virtualized-table-body') ||
        anchor.closest('.row')?.parentNode ||
        anchor.parentNode.parentNode,
      { childList: true, subtree: true }
    );
    menu.scope.defer(() => mutation.disconnect());
    record.menu = menu;
    beginSelectionGuard(win, menu);
    buttons[Math.max(0, indices.indexOf(selected))].focus({ preventScroll: true });
  }
  function capsule(doc, id, index, editable = true, rowItemID = id) {
    const b = html(doc, 'button');
    b.type = 'button';
    b.className = 'rs-capsule';
    b.draggable = false;
    b.dataset.rsItem = String(id);
    b.dataset.rsRowItem = String(rowItemID);
    b.style.setProperty('--rs-bg', `var(--rs-bg-${index})`);
    b.style.setProperty('--rs-fg', `var(--rs-fg-${index})`);
    b.setAttribute('aria-label', '状态: ' + STATES[index].label);
    b.setAttribute('aria-haspopup', 'menu');
    b.setAttribute('aria-expanded', 'false');
    b.setAttribute('aria-disabled', String(!editable));
    b.title = editable
      ? STATES[index].label + '：修改状态'
      : STATES[index].label + '：此文献或文库为只读';
    const label = html(doc, 'span');
    label.className = 'rs-label';
    label.textContent = STATES[index].label;
    const arrow = icon(doc, 'M7 10l5 5 5-5z', 'rs-arrow');
    b.append(label, arrow);
    for (const type of [
      'pointerdown',
      'mousedown',
      'mouseup',
      'dblclick',
      'contextmenu',
      'dragstart',
    ])
      b.addEventListener(type, (e) => {
        e.stopPropagation();
        if (['dblclick', 'contextmenu', 'dragstart'].includes(type)) e.preventDefault();
      });
    b.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.detail === 0) void activateCapsule(b);
    });
    b.addEventListener('keydown', (e) => {
      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        void activateCapsule(b);
      } else if (e.key === 'Escape') {
        e.stopPropagation();
        closeMenu(doc.defaultView, true);
      }
      // Arrow keys outside the menu retain the tree's own navigation.
    });
    b.addEventListener('keyup', (e) => {
      if (['Enter', ' '].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    return b;
  }
  function renderCell(index, data, column, first, doc) {
    const cell = html(doc, 'span');
    cell.className = `cell ${column.className} rs-capsule-cell clickable`;
    // Column data can be cached while virtualized rows move. The current tree
    // row is the authority for both its label and its action target.
    const binding = rowBinding(doc.defaultView.ZoteroPane?.itemsView, index, (id) =>
      Zotero.Items.get(id)
    );
    if (binding) {
      const item = binding.item;
      const b = capsule(
        doc,
        item.id,
        displayState(item),
        item.isEditable() && !item.deleted,
        binding.sourceID
      );
      b.setAttribute('aria-busy', String(pending.has(item.id)));
      cell.append(b);
    }

    return cell;
  }
  function refreshVisible(focusWindow = null, focusID = null, itemIDs = null) {
    if (!runtime.alive) return;
    for (const [win, record] of windows) {
      if (win === focusWindow)
        record.focusRequest = {
          id: focusID,
          epoch: record.inputEpoch || 0,
          serial: record.activationSerial,
        };
      if (itemIDs === null) record.refreshAll = true;
      else {
        record.dirtyItems ||= new Set();
        for (const id of itemIDs) record.dirtyItems.add(Number(id));
      }
      if (record.refreshTimer) continue;
      record.refreshTimer = win.setTimeout(async () => {
        record.refreshTimer = null;
        if (!runtime.alive || !windows.has(win)) return;
        const tree = win.ZoteroPane?.itemsView;
        if (!tree) return;
        const all = record.refreshAll,
          ids = record.dirtyItems || new Set();
        record.refreshAll = false;
        record.dirtyItems = new Set();
        // Config changes may need a deliberate re-sort. Item saves use the host's
        // notifier sort; never clear the entire display cache or sort again here.
        if (record.sortRequested) {
          record.sortRequested = false;
          try {
            tree.invalidateRowCache(true);
            await tree.sort();
          } catch (error) {
            Zotero.logError(error);
          }
        }
        if (!runtime.alive || !windows.has(win)) return;
        const invalid = new Set(ids);
        for (const button of win.document.querySelectorAll(
          '.rs-capsule-cell .rs-capsule[data-rs-row-item]'
        )) {
          const id = Number(button.dataset.rsItem),
            sourceID = Number(button.dataset.rsRowItem);
          if (!all && !ids.has(id) && !ids.has(sourceID)) continue;
          const item = targetOf(Zotero.Items.get(sourceID));
          // Never reuse a stale node for a different parent or row.
          if (!item || item.id !== id || sourceButton(win, tree, sourceID, button) !== button)
            continue;
          invalid.add(id);
          invalid.add(sourceID);
          const editable = item.isEditable() && !item.deleted,
            index = displayState(item);
          const label = STATES[index].label;
          const labelNode = button.querySelector('.rs-label');
          if (labelNode.textContent !== label) labelNode.textContent = label;
          for (const [property, value] of [
            ['--rs-bg', `var(--rs-bg-${index})`],
            ['--rs-fg', `var(--rs-fg-${index})`],
          ])
            if (button.style.getPropertyValue(property) !== value)
              button.style.setProperty(property, value);
          for (const [name, value] of [
            ['aria-label', '状态: ' + label],
            ['aria-disabled', String(!editable)],
            ['aria-busy', String(pending.has(id))],
            ['title', label + (editable ? '：修改状态' : '：此文献或文库为只读')],
          ])
            if (button.getAttribute(name) !== value) button.setAttribute(name, value);
        }
        tree.invalidateRowCache([...invalid]);
        if (record.focusRequest) {
          const request = record.focusRequest,
            button = sourceButton(win, tree, request.id);
          if (
            matchesInput(record, request) &&
            selectionMatches(tree.getSelectedItems(true), request.id)
          )
            button?.focus({ preventScroll: true });
          record.focusRequest = null;
        }
      }, 16);
    }
  }
  async function attach(win) {
    if (!runtime.alive || windows.has(win)) return;
    const doc = win.document,
      style = html(doc, 'style');
    style.className = 'rs-owned-style';
    applyTheme(doc, style);
    doc.documentElement.append(style);
    const media = win.matchMedia('(prefers-color-scheme: dark)');
    const changed = () => applyTheme(doc, style);
    media.addEventListener('change', changed);
    const record = { style, media, changed };
    windows.set(win, record);
    record.removeGestures = interaction.install(win);
    let tree = win.ZoteroPane?.itemsView;
    // A cold-start window can exist before its asynchronous item view is ready.
    for (let i = 0; !tree && i < 100 && runtime.alive && windows.has(win); i++) {
      await Zotero.Promise.delay(100);
      tree = win.ZoteroPane?.itemsView;
    }
    if (tree) {
      await tree.waitForLoad();
      if (!runtime.alive || !windows.has(win)) return;
      // Zotero 10.0.6 has no public initial-column-position API. This small adapter
      // uses verified host column preferences once; it never patches host methods.
      const prefs = initialColumnPrefs(
        tree._getColumnPrefs(),
        tree.getColumns(),
        runtime.columnKey
      );
      if (prefs) {
        tree._storeColumnPrefs(prefs);
        Zotero.ItemTreeManager.refreshColumns();
      }
      tree.tree?.invalidate();
    }
  }
  function detach(win) {
    const r = windows.get(win);
    if (!r) return;
    r.pointerPress = null;
    endSelectionGuard(win);
    if (r.gestureTimer) win.clearTimeout(r.gestureTimer);
    closeMenu(win);
    r.removeGestures();
    if (r.refreshTimer) win.clearTimeout(r.refreshTimer);
    r.style.remove();
    r.media.removeEventListener('change', r.changed);
    r.error?.remove();
    if (r.errorTimer) win.clearTimeout(r.errorTimer);
    windows.delete(win);
  }
  return { attach, detach, renderCell, capsule, refreshVisible, closeMenu, windows };
}
