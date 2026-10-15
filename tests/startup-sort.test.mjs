import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreStatusSort } from '../src/zotero-adapter.js';

function view(field = 'status') {
  const calls = [];
  return {
    calls,
    async _ensureSortContextReady() {
      calls.push('ready');
    },
    _getColumns() {
      calls.push('columns');
      return [{ dataKey: field }];
    },
    getSortField() {
      return field;
    },
    async sort() {
      calls.push('sort');
    },
  };
}
test('restored status metadata triggers one host sort', async () => {
  const tree = view();
  assert.equal(await restoreStatusSort(tree, 'status'), true);
  assert.deepEqual(tree.calls, ['ready', 'columns', 'sort']);
});
test('another active column retains its sorting', async () => {
  const tree = view('title');
  assert.equal(await restoreStatusSort(tree, 'status'), false);
  assert.deepEqual(tree.calls, ['ready', 'columns']);
});
test('waits for restored metadata before checking the active column', async () => {
  const tree = view('title');
  tree._ensureSortContextReady = async () => {
    await Promise.resolve();
    tree.getSortField = () => 'status';
  };
  assert.equal(await restoreStatusSort(tree, 'status'), true);
});
test('detached windows cannot sort after asynchronous restoration', async () => {
  const tree = view();
  assert.equal(await restoreStatusSort(tree, 'status', () => false), false);
  assert.deepEqual(tree.calls, ['ready']);
});

test('an uninitialized view has no active sort to restore', async () => {
  const tree = view();
  tree._getColumns = () => [];
  assert.equal(await restoreStatusSort(tree, 'status'), false);
});
