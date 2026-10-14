// Own event subscriptions and disposal callbacks as one idempotent lifetime.
export function createScope() {
  const cleanups = [];
  let disposed = false;
  function defer(cleanup) {
    if (disposed) cleanup();
    else cleanups.push(cleanup);
  }
  function listen(target, type, handler, capture = true) {
    target.addEventListener(type, handler, capture);
    defer(() => target.removeEventListener(type, handler, capture));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const cleanup of cleanups.splice(0)) cleanup();
  }
  return { defer, listen, dispose };
}
