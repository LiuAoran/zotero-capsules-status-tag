import test from 'node:test';
import assert from 'node:assert/strict';
import { createScope } from '../src/scope.js';
import { captureOperation, operationIsCurrent } from '../src/operations.js';

test('disposing a scope removes all callbacks and is safe to repeat', () => {
  const target = new EventTarget(),
    scope = createScope();
  let events = 0,
    disposed = 0;
  scope.listen(target, 'change', () => events++, false);
  scope.defer(() => disposed++);
  target.dispatchEvent(new Event('change'));
  scope.dispose();
  scope.dispose();
  target.dispatchEvent(new Event('change'));
  assert.equal(events, 1);
  assert.equal(disposed, 1);
  scope.defer(() => disposed++);
  assert.equal(disposed, 2);
});
test('async operation cannot regain ownership after user input, new menu, view change or disable', () => {
  const tree = {},
    win = { ZoteroPane: { itemsView: tree } },
    record = { inputEpoch: 3, activationSerial: 4 },
    runtime = { alive: true },
    windows = new Map([[win, record]]);
  const token = captureOperation(win, record);
  assert.equal(operationIsCurrent(runtime, windows, win, token), true);
  record.inputEpoch++;
  assert.equal(operationIsCurrent(runtime, windows, win, token), false);
  record.inputEpoch--;
  record.activationSerial++;
  assert.equal(operationIsCurrent(runtime, windows, win, token), false);
  record.activationSerial--;
  win.ZoteroPane.itemsView = {};
  assert.equal(operationIsCurrent(runtime, windows, win, token), false);
  win.ZoteroPane.itemsView = tree;
  runtime.alive = false;
  assert.equal(operationIsCurrent(runtime, windows, win, token), false);
  runtime.alive = true;
  windows.delete(win);
  assert.equal(operationIsCurrent(runtime, windows, win, token), false);
});
