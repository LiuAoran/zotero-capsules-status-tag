import { createScope } from './scope.js';
import { STATES, orderedIndices, retireState, defaultConfiguration } from './model.js';
import { PREF } from './constants.js';
import { html, icon } from './dom.js';
import { applyTheme } from './theme.js';
import { readConfiguration, persistConfiguration } from './configuration.js';
export function createSettingsController(runtime, capsule) {
  const settings = new Map();
  function initSettings(doc) {
    const box = doc.querySelector('.rs-settings');
    if (!box) return;
    const scope = createScope();
    box.querySelector('.rs-brand-icon').src = runtime.rootURI + 'assets/icon.svg';
    const mode = box.querySelector('.rs-theme-options'),
      modeButtons = [...mode.querySelectorAll('[data-rs-mode]')],
      seed = box.querySelector('.rs-seed'),
      harmonize = box.querySelector('.rs-harmonize');
    const paintMode = () => {
      const selected = Zotero.Prefs.get(PREF + 'theme', true) || 'system';
      for (const button of modeButtons) {
        const checked = button.dataset.rsMode === selected;
        button.setAttribute('aria-checked', String(checked));
        button.tabIndex = checked ? 0 : -1;
      }
    };
    harmonize.checked = Zotero.Prefs.get(PREF + 'harmonize', true) !== false;
    paintMode();
    seed.value = Zotero.Prefs.get(PREF + 'seed', true) || '#6750a4';
    const style = html(doc, 'style');
    doc.documentElement.append(style);
    applyTheme(doc, style);
    const preview = box.querySelector('.rs-preview');
    const drawEditor = () => {
      box.querySelector('.rs-config-error').textContent = '';
      preview.replaceChildren();
      const editor = box.querySelector('.rs-status-editor');
      editor.replaceChildren();
      const defaults = ['#c6a700', '#b3261e', '#348343', '#3b69bb', '#808080'];
      for (const [position, i] of orderedIndices().entries()) {
        const state = STATES[i],
          row = html(doc, 'div');
        row.className = 'rs-status-row';
        row.dataset.rsTag = state.tag;
        const name = html(doc, 'input');
        name.type = 'text';
        name.maxLength = 40;
        name.value = state.label;
        name.setAttribute('aria-label', '状态名称 ' + state.label);
        const color = html(doc, 'input');
        color.type = 'color';
        color.value = state.color || defaults[i] || '#6750a4';
        color.setAttribute('aria-label', '状态颜色 ' + state.label);
        const edit = () => {
          if (!name.value.trim()) {
            box.querySelector('.rs-config-error').textContent = '状态名称不能为空';
            name.value = state.label;
            return;
          }
          const config = readConfiguration();
          config.overrides[state.tag] = {
            label: name.value.trim(),
            ...(state.color ? { color: state.color } : {}),
          };
          persistConfiguration(config);
        };
        name.addEventListener('change', edit);
        color.addEventListener('change', () => {
          const config = readConfiguration();
          config.overrides[state.tag] = {
            label: name.value.trim() || state.label,
            color: color.value,
          };
          persistConfiguration(config);
        });
        row.append(name, color);
        for (const [text, delta] of [
          ['上移', -1],
          ['下移', 1],
        ]) {
          const b = html(doc, 'button');
          b.type = 'button';
          b.className = 'rs-icon-button';
          b.disabled = position + delta < 0 || position + delta >= orderedIndices().length;
          b.setAttribute('aria-label', state.label + text);
          b.title = text;
          b.append(icon(doc, delta < 0 ? 'M7 14l5-5 5 5z' : 'M7 10l5 5 5-5z'));
          b.addEventListener('click', () => {
            const config = readConfiguration(),
              order = config.order;
            [order[position], order[position + delta]] = [order[position + delta], order[position]];
            persistConfiguration(config);
          });
          row.append(b);
        }
        if (i >= 5) {
          const remove = html(doc, 'button');
          remove.type = 'button';
          remove.className = 'rs-icon-button';
          remove.title = '删除自定义状态（保留文献已有标签）';
          remove.setAttribute('aria-label', '删除状态 ' + state.label);
          remove.append(icon(doc, 'M5 11h14v2H5z'));
          remove.addEventListener('click', () =>
            persistConfiguration(retireState(readConfiguration(), state.tag))
          );
          row.append(remove);
        } else {
          const spacer = html(doc, 'span');
          spacer.className = 'rs-delete-spacer';
          spacer.setAttribute('aria-hidden', 'true');
          row.append(spacer);
        }
        editor.append(row);
        const cell = html(doc, 'span');
        cell.className = 'rs-capsule-cell';
        const b = capsule(doc, 0, i, true);
        b.disabled = true;
        b.tabIndex = -1;
        b.title = state.label;
        b.removeAttribute('aria-haspopup');
        b.removeAttribute('aria-expanded');
        cell.append(b);
        preview.append(cell);
      }
    };
    const add = (event) => {
      event.preventDefault();
      const name = box.querySelector('.rs-new-label'),
        color = box.querySelector('.rs-new-color');
      if (!name.value.trim()) {
        box.querySelector('.rs-config-error').textContent = '请输入新状态名称';
        return;
      }
      const config = readConfiguration();
      const tag = '/reading-status/custom-' + doc.defaultView.crypto.randomUUID();
      config.custom.push({ tag, label: name.value.trim().slice(0, 40), color: color.value });
      config.order.push(tag);
      persistConfiguration(config);
      name.value = '';
    };
    scope.listen(box.querySelector('.rs-add-status'), 'submit', add, false);
    drawEditor();
    const changeMode = (event) => {
      const button = event.target.closest('[data-rs-mode]');
      if (button && mode.contains(button))
        Zotero.Prefs.set(PREF + 'theme', button.dataset.rsMode, true);
    };
    const modeKey = (event) => {
      const current = modeButtons.indexOf(event.target);
      if (current < 0) return;
      let next;
      if (['ArrowRight', 'ArrowDown'].includes(event.key)) next = (current + 1) % 3;
      else if (['ArrowLeft', 'ArrowUp'].includes(event.key)) next = (current + 2) % 3;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = 2;
      else return;
      event.preventDefault();
      modeButtons[next].focus();
      modeButtons[next].click();
    };
    const changeSeed = () => Zotero.Prefs.set(PREF + 'seed', seed.value, true);
    const changeHarmonize = () => Zotero.Prefs.set(PREF + 'harmonize', harmonize.checked, true);
    scope.listen(mode, 'click', changeMode, false);
    scope.listen(mode, 'keydown', modeKey, false);
    scope.listen(seed, 'input', changeSeed, false);
    scope.listen(harmonize, 'change', changeHarmonize, false);
    const media = doc.defaultView.matchMedia('(prefers-color-scheme: dark)');
    const repaint = () => {
      paintMode();
      seed.value = Zotero.Prefs.get(PREF + 'seed', true) || '#6750a4';
      harmonize.checked = Zotero.Prefs.get(PREF + 'harmonize', true) !== false;
      applyTheme(doc, style);
      drawEditor();
    };
    scope.listen(media, 'change', repaint, false);
    const resetButton = box.querySelector('.rs-reset');
    const reset = () => {
      const prompt = Services.prompt;
      const flags =
        prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_IS_STRING +
        prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_IS_STRING +
        prompt.BUTTON_POS_1_DEFAULT;
      const result = prompt.confirmEx(
        null,
        '恢复默认设置',
        '恢复默认外观与内置状态，移除自定义状态。\n文献已有标签保留。是否继续？',
        flags,
        '恢复默认',
        '取消',
        null,
        null,
        {}
      );
      if (result !== 0) return;
      const config = defaultConfiguration(readConfiguration());
      Zotero.Prefs.set(PREF + 'theme', 'system', true);
      Zotero.Prefs.set(PREF + 'seed', '#6750a4', true);
      Zotero.Prefs.set(PREF + 'harmonize', true, true);
      persistConfiguration(config);
      box.querySelector('.rs-new-label').value = '';
      box.querySelector('.rs-new-color').value = '#6750a4';
      repaint();
    };
    scope.listen(resetButton, 'click', reset, false);
    const cleanup = () => scope.dispose();
    scope.listen(doc.defaultView, 'unload', cleanup, false);
    scope.defer(() => {
      style.remove();
      settings.delete(doc);
    });
    settings.set(doc, { repaint, cleanup });
  }
  return {
    init: initSettings,
    repaint() {
      for (const record of settings.values()) record.repaint();
    },
    destroy() {
      for (const record of [...settings.values()]) record.cleanup();
    },
  };
}
