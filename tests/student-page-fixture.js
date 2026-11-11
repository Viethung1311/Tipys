export function studentPage(students, params = new URLSearchParams()) {
  const all = students.map((s) => ({
    ...s,
    classes:
      s.classes ||
      (s.class_members || [])
        .filter((m) => m.is_active && !m.classes.archived_at)
        .map((m) => m.classes),
    joined: (s.class_members || []).some(
      (m) => m.class_id === params.get('rosterClass') && m.is_active,
    ),
  }));
  const filtered = all
    .filter(
      (s) =>
        `${s.full_name} ${s.username}`
          .toLowerCase()
          .includes((params.get('search') || '').toLowerCase()) &&
        (!params.get('classFilter') ||
          params.get('classFilter') === 'all' ||
          (params.get('classFilter') === 'none'
            ? s.classes.length === 0
            : s.classes.some((c) => c.class_id === params.get('classFilter')))) &&
        (!params.get('membership') ||
          params.get('membership') === 'all' ||
          (params.get('membership') === 'members' ? s.joined : !s.joined)),
    )
    .sort(
      (a, b) =>
        (params.get('sort') === 'asc' ? 1 : -1) * (a.total_active_seconds - b.total_active_seconds),
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 7)),
    page = Math.min(Number(params.get('page') || 1), pages);
  return {
    students: filtered.slice((page - 1) * 7, page * 7),
    total: filtered.length,
    pages,
    page,
    memberTotal: all.filter((s) => s.joined).length,
    summary: {
      students: all.length,
      seconds: all.reduce((n, s) => n + s.total_active_seconds, 0),
      plays: all.reduce((n, s) => n + s.total_plays, 0),
    },
  };
}
