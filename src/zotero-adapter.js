import { target, rowBinding } from './model.js';
export function targetOf(item) {
  return target(item, (id) => Zotero.Items.get(id));
}
export function sourceButton(win, tree, id, candidate = null) {
  const button = candidate || win.document.querySelector(`.rs-capsule[data-rs-row-item="${id}"]`);
  const binding = bindingForButton(button, tree);
  return binding?.sourceID === id && binding.targetID === Number(button.dataset.rsItem)
    ? button
    : null;
}
export function bindingForButton(button, tree) {
  const row = button?.closest('.row'),
    match = row?.id.match(/-row-(\d+)$/);
  return match ? rowBinding(tree, Number(match[1]), (id) => Zotero.Items.get(id)) : null;
}

// Column metadata can finish restoring after the initial row sort. Reconcile only
// our active column, once per window attachment, using Zotero's selection-safe sort.
export async function restoreStatusSort(tree, columnKey, isCurrent = () => true) {
  await tree._ensureSortContextReady();
  if (!isCurrent()) return false;
  if (!tree._getColumns().some((column) => !column.hidden)) return false;
  if (tree.getSortField() !== columnKey) return false;
  await tree.sort();
  return true;
}
