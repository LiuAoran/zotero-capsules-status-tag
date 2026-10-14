document.addEventListener('showing', function readingStatusShowing(event) {
  if (!event.target.classList?.contains('rs-settings')) return;
  document.removeEventListener('showing', readingStatusShowing, true);
  Zotero.ReadingStatusCapsules?.initSettings(document);
}, true);
