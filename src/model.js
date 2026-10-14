export const DEFAULT_STATES = Object.freeze([
  { label: 'New', tag: '/reading-status/new' },
  { label: 'To Read', tag: '/reading-status/to-read' },
  { label: 'Reading', tag: '/reading-status/reading' },
  { label: 'Finished', tag: '/reading-status/read' },
  { label: 'UnRead', tag: '/reading-status/unread' },
]);
export let STATES = DEFAULT_STATES;
let order = DEFAULT_STATES.map((s) => s.tag);
let ordered = [0, 1, 2, 3, 4],
  ranks = [0, 1, 2, 3, 4];
let statusTags = new Set(STATES.map((s) => s.tag));
let priorities = new Map(
  [2, 1, 3, 4, 0].map((index, rank) => [STATES[index].tag, { index, rank }])
);
export function isStatusTag(tag) {
  return statusTags.has(tag);
}
export function configure(raw = {}) {
  if (!raw || typeof raw !== 'object') raw = {};
  const custom = [],
    retired = [],
    seen = new Set(DEFAULT_STATES.map((s) => s.tag));
  for (const s of Array.isArray(raw.custom) ? raw.custom : []) {
    if (
      !s ||
      !/^\/reading-status\/custom-[a-z0-9-]{1,80}$/.test(s.tag) ||
      seen.has(s.tag) ||
      typeof s.label !== 'string' ||
      !s.label.trim()
    )
      continue;
    custom.push({
      tag: s.tag,
      label: s.label.trim().slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#6750a4',
    });
    seen.add(s.tag);
  }
  for (const s of Array.isArray(raw.retired) ? raw.retired : []) {
    if (
      !s ||
      !/^\/reading-status\/custom-[a-z0-9-]{1,80}$/.test(s.tag) ||
      seen.has(s.tag) ||
      typeof s.label !== 'string' ||
      !s.label.trim()
    )
      continue;
    retired.push({
      tag: s.tag,
      label: s.label.trim().slice(0, 40),
      color: /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : '#6750a4',
      retired: true,
    });
    seen.add(s.tag);
  }
  STATES = [...DEFAULT_STATES, ...custom, ...retired].map((s) => {
    const v = raw.overrides?.[s.tag];
    return {
      ...s,
      ...(typeof v?.label === 'string' && v.label.trim()
        ? { label: v.label.trim().slice(0, 40) }
        : {}),
      ...(/^#[0-9a-f]{6}$/i.test(v?.color) ? { color: v.color } : {}),
    };
  });
  const active = new Set([...DEFAULT_STATES, ...custom].map((s) => s.tag));
  order = [
    ...new Set([
      ...(Array.isArray(raw.order) ? raw.order.filter((t) => active.has(t)) : []),
      ...active,
    ]),
  ];
  const indices = new Map(STATES.map((s, i) => [s.tag, i]));
  ordered = order.map((tag) => indices.get(tag));
  ranks = [];
  ordered.forEach((index, rank) => {
    ranks[index] = rank;
  });
  retired.forEach((s, i) => {
    ranks[indices.get(s.tag)] = ordered.length + i;
  });
  statusTags = new Set(indices.keys());
  priorities = new Map(
    [2, 1, 3, 4, ...STATES.map((s, i) => i).filter((i) => i >= 5), 0].map((index, rank) => [
      STATES[index].tag,
      { index, rank },
    ])
  );
  return {
    custom,
    retired,
    overrides: Object.fromEntries(
      STATES.filter((s) => raw.overrides?.[s.tag]).map((s) => [
        s.tag,
        { label: s.label, ...(s.color ? { color: s.color } : {}) },
      ])
    ),
    order: [...order],
  };
}
export function retireState(config, tag) {
  const state = config.custom.find((s) => s.tag === tag);
  if (!state) throw new Error('只能删除自定义状态');
  return {
    ...config,
    custom: config.custom.filter((s) => s.tag !== tag),
    retired: [...(config.retired || []), { ...state, ...config.overrides?.[tag], retired: true }],
    order: config.order.filter((t) => t !== tag),
  };
}
export function defaultConfiguration(config) {
  const archived = [...(config.retired || []), ...(config.custom || [])].map((s) => ({
    ...s,
    ...config.overrides?.[s.tag],
    retired: true,
  }));
  return {
    custom: [],
    retired: [...new Map(archived.map((s) => [s.tag, s])).values()],
    overrides: {},
    order: DEFAULT_STATES.map((s) => s.tag),
  };
}
export function stateIndex(tag) {
  return STATES.findIndex((s) => s.tag === tag);
}
export function orderedIndices() {
  return [...ordered];
}
export function sortRank(index) {
  return ranks[index] ?? -1;
}
export const PRIORITY = [2, 1, 3, 4, 0];
export function target(item, getItem) {
  if (item?.isRegularItem()) return item;
  if (item?.isPDFAttachment() && item.parentItemID) {
    const parent = getItem(item.parentItemID);
    if (parent?.isRegularItem()) return parent;
  }
  return null;
}
export function stateOf(item) {
  let best;
  for (const { tag } of item.getTags()) {
    const candidate = priorities.get(tag);
    if (candidate && (!best || candidate.rank < best.rank)) best = candidate;
  }
  return best?.index ?? 0;
}
export function replacement(tags, index) {
  if (!STATES[index] || STATES[index].retired) throw new Error('Invalid reading status');
  return [...tags.filter((t) => !statusTags.has(t.tag)), { tag: STATES[index].tag, type: 0 }];
}
export async function saveStatus(item, index) {
  if (!item?.isEditable() || item.deleted) throw new Error('此文献或文库为只读');
  if (!STATES[index] || STATES[index].retired) throw new Error('Invalid reading status');
  const original = item.getTags().map((t) => ({ ...t }));
  const existing = original.filter((t) => statusTags.has(t.tag));
  if (existing.length === 1 && existing[0].tag === STATES[index].tag && existing[0].type === 0)
    return false;
  item.setTags(replacement(original, index));
  try {
    await item.saveTx({ undoAction: 'undo-action-edit-metadata', undoActionArgs: { count: 1 } });
  } catch (error) {
    // Zotero rolls back disk state; restore the unsaved in-memory tag state too.
    item.setTags(original);
    throw error;
  }
}
export function initialColumnPrefs(prefs, columns, key) {
  if (prefs[key]) return null;
  const ordered = columns
    .filter((c) => c.dataKey !== key)
    .map((c, i) => ({
      key: c.dataKey,
      ordinal: prefs[c.dataKey]?.ordinal ?? i,
    }))
    .sort((a, b) => a.ordinal - b.ordinal);
  const titleIndex = ordered.findIndex((c) => c.key === 'title');
  ordered.splice(titleIndex < 0 ? 0 : titleIndex + 1, 0, { key });
  const result = JSON.parse(JSON.stringify(prefs));
  ordered.forEach((c, i) => {
    result[c.key] = { ...result[c.key], ordinal: i };
  });
  result[key] = { ...result[key], hidden: false, width: 112 };
  return result;
}

export function rowBinding(tree, index, getItem) {
  const source = tree?.getRow?.(index)?.ref;
  const parent = target(source, getItem);
  return source && parent ? { sourceID: source.id, targetID: parent.id, item: parent } : null;
}
export function selectionMatches(ids, sourceID) {
  return ids.length === 1 && ids[0] === sourceID;
}
