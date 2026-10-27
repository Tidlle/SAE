const STORAGE_KEY = 'sae-recent-courses';
const MAX_RECENT = 8;

export interface RecentCourse {
  name: string;
  ies: string;
}

const isRecent = (value: unknown): value is RecentCourse =>
  typeof value === 'object' && value !== null && typeof (value as RecentCourse).name === 'string' && typeof (value as RecentCourse).ies === 'string';

export const loadRecents = (): RecentCourse[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isRecent).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
};

// Põe o curso no topo da lista (sem repetir) e devolve a lista atualizada.
export const saveRecent = (course: RecentCourse): RecentCourse[] => {
  const next = [course, ...loadRecents().filter((item) => !(item.name === course.name && item.ies === course.ies))].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // armazenamento indisponível: a lista vale só para esta visita
  }
  return next;
};

export const clearRecents = (): RecentCourse[] => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorar
  }
  return [];
};
