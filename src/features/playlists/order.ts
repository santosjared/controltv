export function movePlaylistItem<T extends { id: string }>(items: T[], sourceId: string, targetId: string): T[] {
  const source = items.findIndex((item) => item.id === sourceId);
  const target = items.findIndex((item) => item.id === targetId);
  if (source < 0 || target < 0 || source === target) return items;
  const next = [...items];
  const [item] = next.splice(source, 1);
  next.splice(target, 0, item);
  return next;
}

export function playlistOrderChanged(saved: { id: string }[], current: { id: string }[]): boolean {
  return saved.length !== current.length || saved.some((item, index) => item.id !== current[index]?.id);
}
