function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
}

async function readSessions() {
  const sessions = await window.electronAPI.storeGet('sessions');
  return Array.isArray(sessions) ? sessions : [];
}

let sessionsMutationQueue = Promise.resolve();

function queueSessionsMutation(mutation) {
  const run = async () => {
    const sessions = await readSessions();
    const result = await mutation(sessions);

    if (!result || result.persist === false) {
      return result?.value ?? null;
    }

    await window.electronAPI.storeSet('sessions', result.sessions);
    return result.value;
  };

  const queued = sessionsMutationQueue.then(run, run);
  sessionsMutationQueue = queued.then(() => undefined, () => undefined);
  return queued;
}

export const SessionStore = {
  async list(limit) {
    // Ensure reads happen after pending writes so callers don't observe stale data.
    await sessionsMutationQueue;
    const sessions = await readSessions();
    // Sort by createdAt descending
    sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (Number.isFinite(limit) && limit > 0) {
      return sessions.slice(0, limit);
    }
    return sessions;
  },

  async create(data) {
    const session = {
      id: generateId(),
      task: typeof data?.task === 'string' ? data.task : '',
      durationMinutes: Number.isFinite(data?.duration_minutes) ? data.duration_minutes : 0,
      mode: typeof data?.mode === 'string' ? data.mode : 'freeflow',
      completed: data?.completed ?? false,
      notes: typeof data?.notes === 'string' ? data.notes : '',
      sessionFeedback: data?.sessionFeedback === 'down' ? 'down' : (data?.sessionFeedback === 'up' ? 'up' : null),
      createdAt: new Date().toISOString(),
    };

    return queueSessionsMutation((sessions) => ({
      sessions: [session, ...sessions],
      value: session,
    }));
  },

  async update(id, data) {
    return queueSessionsMutation((sessions) => {
      const index = sessions.findIndex((s) => s.id === id);
      if (index === -1) {
        return { persist: false, value: null };
      }
      const nextSessions = [...sessions];
      nextSessions[index] = { ...nextSessions[index], ...data };
      return {
        sessions: nextSessions,
        value: nextSessions[index],
      };
    });
  },

  async delete(id) {
    return queueSessionsMutation((sessions) => {
      const filtered = sessions.filter((s) => s.id !== id);
      if (filtered.length === sessions.length) {
        return { persist: false, value: false };
      }
      return {
        sessions: filtered,
        value: true,
      };
    });
  },

  async deleteMany(ids = []) {
    const idSet = new Set(ids.filter(Boolean));
    if (idSet.size === 0) return 0;

    return queueSessionsMutation((sessions) => {
      const filtered = sessions.filter((s) => !idSet.has(s.id));
      const removedCount = sessions.length - filtered.length;

      if (removedCount === 0) {
        return { persist: false, value: 0 };
      }

      return {
        sessions: filtered,
        value: removedCount,
      };
    });
  },
};
