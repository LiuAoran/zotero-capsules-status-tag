// Every async list operation carries the user-input generation that created it.
// This is intentionally separate from a row index, which sorting can change.
export function matchesInput(record, token) {
  return token.epoch === (record.inputEpoch || 0) && token.serial === record.activationSerial;
}
export function captureOperation(win, record) {
  return {
    record,
    tree: win.ZoteroPane?.itemsView,
    epoch: record.inputEpoch || 0,
    serial: record.activationSerial,
  };
}
export function operationIsCurrent(runtime, windows, win, token) {
  return (
    runtime.alive &&
    windows.get(win) === token.record &&
    matchesInput(token.record, token) &&
    win.ZoteroPane?.itemsView === token.tree
  );
}
