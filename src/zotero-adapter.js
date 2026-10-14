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
