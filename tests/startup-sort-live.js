export async function run() {
  const base = '/tmp/reading-status-live',
    file = base + '/startup-sort-fixture.json',
    report = { checks: [] };
  const check = (name, pass) => report.checks.push({ name, pass: !!pass });
  try {
    const { AddonManager } = ChromeUtils.importESModule(
      'resource://gre/modules/AddonManager.sys.mjs'
    );
    report.zoteroVersion = Zotero.version;
    report.pluginVersion = (
      await AddonManager.getAddonByID('reading-status-capsules@independent.local')
    ).version;
    const win = Zotero.getMainWindow(),
      tree = win.ZoteroPane.itemsView;
    await tree.waitForLoad();
    const col = () => tree._getColumns().findIndex((c) => c.label === '状态');
    let fixture;
    if (!(await win.IOUtils.exists(file))) {
      Zotero.Prefs.set('extensions.readingStatusCapsules.states', '{}', true);
      const c = new Zotero.Collection();
      c.name = 'Cold startup status sorting';
      await c.saveTx();
      const items = [];
      for (const [title, tag, rank] of [
        ['Z New', 'new', 0],
        ['Y To Read', 'to-read', 1],
        ['X Reading', 'reading', 2],
        ['C Finished', 'read', 3],
        ['B UnRead', 'unread', 4],
        ['A New second', 'new', 0],
      ]) {
        const item = new Zotero.Item('journalArticle');
        item.setField('title', title);
        item.addTag('/reading-status/' + tag, 0);
        item.addToCollection(c.id);
        await item.saveTx();
        items.push({ id: item.id, title, rank });
      }
      await win.ZoteroPane.collectionsView.selectByID('C' + c.id);
      await tree.waitForLoad();
      await tree._handleColumnSort(col(), 1);
      fixture = { collectionID: c.id, items, phase: 'ascending' };
      await tree.selectItems([items[2].id], true, true);
      check(
        'setup status order',
        tree._rows.map((r) => r.ref.id).join(',') ===
          [...items]
            .sort((a, b) => a.rank - b.rank || a.id - b.id)
            .map((x) => x.id)
            .join(',')
      );
    } else {
      fixture = JSON.parse(await Zotero.File.getContentsAsync(file));
      if (fixture.phase.startsWith('metadata-')) {
        const direction = fixture.phase === 'metadata-descending' ? -1 : 1;
        await tree._handleColumnSort(col(), direction);
        await Zotero.Promise.delay(100);
        await tree.selectItems([fixture.items[2].id], true, true);
        const saved = JSON.parse(JSON.stringify(tree._getColumnPrefs()));
        await tree._handleColumnSort(
          tree._getColumns().findIndex((c) => c.dataKey === 'title'),
          1
        );
        await Zotero.Promise.delay(100);
        tree._storeColumnPrefs(saved);
        await tree._resetColumns();
        tree._getColumns();
        report.beforeAttach = {
          ids: tree._rows.map((r) => r.ref.id),
          field: tree.getSortField(),
          direction: tree.getSortDirection(),
        };
        ReadingStatusModule.detach(win);
        await ReadingStatusModule.attach(win);
      }
      if (fixture.phase === 'late-registration') {
        await tree._handleColumnSort(col(), 1);
        const own = await AddonManager.getAddonByID('reading-status-capsules@independent.local');
        await own.disable();
        await Zotero.Promise.delay(300);
        report.beforeEnable = tree._rows.map((r) => r.ref.id);
        await own.enable();
        await Zotero.Promise.delay(300);
        await tree.waitForLoad();
      }
      const direction = ['descending', 'metadata-descending'].includes(fixture.phase) ? -1 : 1;
      const expected =
        fixture.phase === 'title'
          ? [...fixture.items].sort((a, b) => a.title.localeCompare(b.title))
          : [...fixture.items].sort((a, b) => direction * (a.rank - b.rank || a.id - b.id));
      report.phase = fixture.phase;
      report.actual = tree._rows.map((r) => r.ref.id);
      report.expected = expected.map((x) => x.id);
      report.sortField = tree.getSortField();
      report.sortDirection = tree.getSortDirection();
      report.collectionID = tree.collectionTreeRow?.id;
      check(
        'same fixture scope restored',
        report.actual.length === fixture.items.length &&
          report.actual.every((id) => fixture.items.some((item) => item.id === id))
      );
      check(
        'cold actual order ' + fixture.phase,
        report.actual.join(',') === report.expected.join(',')
      );
      check(
        'cold indicator ' + fixture.phase,
        fixture.phase === 'title'
          ? tree.getSortField() === 'title'
          : tree.getSortField() === tree._getColumns()[col()].dataKey &&
              tree.getSortDirection() === direction
      );
      if (fixture.phase === 'ascending') {
        await tree._handleColumnSort(col(), -1);
        fixture.phase = 'descending';
      } else if (fixture.phase === 'descending') {
        await tree._handleColumnSort(
          tree._getColumns().findIndex((c) => c.dataKey === 'title'),
          1
        );
        fixture.phase = 'title';
      } else if (fixture.phase === 'title') fixture.phase = 'late-registration';
      else fixture.phase = 'done';
    }
    if (!(await win.IOUtils.exists(base + '/crash-hold'))) await tree._writeColumnPrefsToFile(true);
    await Zotero.File.putContentsAsync(file, JSON.stringify(fixture));
  } catch (e) {
    report.error = String(e);
    report.stack = e.stack;
  }
  await Zotero.File.putContentsAsync(
    base + '/startup-sort-' + report.pluginVersion + '-' + (report.phase || 'setup') + '.json',
    JSON.stringify(report, null, 2)
  );
  if (!(await IOUtils.exists(base + '/crash-hold')))
    Services.startup.quit(Ci.nsIAppStartup.eForceQuit);
  else await Zotero.File.putContentsAsync(base + '/crash-ready', 'ready');
}
