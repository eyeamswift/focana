function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

export const SessionStore = {
  async list(limit) {
    const sessions = await window.electronAPI.storeGet('sessions') || [];
    // Sort by createdAt descending
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (Number.isFinite(limit) && limit > 0) {
      return sessions.slice(0, limit);
    }
    return sessions;
  },

  async create(data) {
    const sessions = await window.electronAPI.storeGet('sessions') || [];
    const session = {
      id: generateId(),
      task: data.task || '',
      durationMinutes: data.duration_minutes || 0,
      mode: data.mode || 'freeflow',
      completed: data.completed || false,
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
    };
    sessions.unshift(session);
    await window.electronAPI.storeSet('sessions', sessions);
    return session;
  },

  async update(id, data) {
    const sessions = await window.electronAPI.storeGet('sessions') || [];
    const index = sessions.findIndex((s) => s.id === id);
    if (index !== -1) {
      sessions[index] = { ...sessions[index], ...data };
      await window.electronAPI.storeSet('sessions', sessions);
      return sessions[index];
    }
    return null;
  },

  async delete(id) {
    const sessions = await window.electronAPI.storeGet('sessions') || [];
    const filtered = sessions.filter((s) => s.id !== id);
    if (filtered.length === sessions.length) return false;
    await window.electronAPI.storeSet('sessions', filtered);
    return true;
  },

  async deleteMany(ids = []) {
    const idSet = new Set(ids.filter(Boolean));
    if (idSet.size === 0) return 0;

    const sessions = await window.electronAPI.storeGet('sessions') || [];
    const filtered = sessions.filter((s) => !idSet.has(s.id));
    const removedCount = sessions.length - filtered.length;

    if (removedCount > 0) {
      await window.electronAPI.storeSet('sessions', filtered);
    }

    return removedCount;
  },
};
