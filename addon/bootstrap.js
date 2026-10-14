var ReadingStatusModule;
async function startup({ rootURI }) {
  await Zotero.initializationPromise;
  Services.scriptloader.loadSubScript(rootURI + 'content/plugin.js', this);
  try { await ReadingStatusModule.start(rootURI); }
  catch (error) { await ReadingStatusModule.stop(); throw error; }
}
async function shutdown() {
  if (ReadingStatusModule) await ReadingStatusModule.stop();
}
function install() {}
function uninstall() {}
async function onMainWindowLoad({ window }) { await ReadingStatusModule?.attach(window); }
function onMainWindowUnload({ window }) { ReadingStatusModule?.detach(window); }
