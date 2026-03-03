const { randomUUID } = require('crypto');
const store = require('./store');

const CHECKIN_STATUSES = ['focused', 'completed', 'detour', 'missed'];

function ensurePlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIsoTimestamp(input) {
  const date = input ? new Date(input) : new Date();
  const ms = date.getTime();
  if (!Number.isFinite(ms)) {
    throw new Error('Invalid check-in timestamp');
  }
  return date.toISOString();
}

function generateId() {
  if (typeof randomUUID === 'function') {
    return randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function validateStatus(status) {
  if (!CHECKIN_STATUSES.includes(status)) {
    throw new Error(`Invalid check-in status: ${status}`);
  }
}

function validateCheckInInput(checkIn) {
  if (!ensurePlainObject(checkIn)) {
    throw new Error('Check-in payload must be an object');
  }

  if (typeof checkIn.sessionId !== 'string') {
    throw new Error('Check-in sessionId must be a string');
  }

  if (typeof checkIn.taskText !== 'string') {
    throw new Error('Check-in taskText must be a string');
  }

  if (!Number.isFinite(checkIn.elapsedMinutes) || checkIn.elapsedMinutes < 0) {
    throw new Error('Check-in elapsedMinutes must be a non-negative number');
  }

  validateStatus(checkIn.status);

  if (Object.prototype.hasOwnProperty.call(checkIn, 'detourNote')) {
    if (checkIn.detourNote !== undefined && typeof checkIn.detourNote !== 'string') {
      throw new Error('Check-in detourNote must be a string when provided');
    }
  }
}

function readAll() {
  const raw = store.get('checkIns', []);
  return Array.isArray(raw) ? raw : [];
}

function sortByTimestampAsc(a, b) {
  const aTime = Date.parse(a?.timestamp || '');
  const bTime = Date.parse(b?.timestamp || '');
  const aSafe = Number.isFinite(aTime) ? aTime : 0;
  const bSafe = Number.isFinite(bTime) ? bTime : 0;
  return aSafe - bSafe;
}

function addCheckIn(checkIn) {
  validateCheckInInput(checkIn);

  const record = {
    id: typeof checkIn.id === 'string' && checkIn.id.trim() ? checkIn.id.trim() : generateId(),
    timestamp: normalizeIsoTimestamp(checkIn.timestamp),
    sessionId: checkIn.sessionId.trim(),
    taskText: checkIn.taskText.trim(),
    elapsedMinutes: checkIn.elapsedMinutes,
    status: checkIn.status,
  };

  if (Object.prototype.hasOwnProperty.call(checkIn, 'detourNote') && checkIn.detourNote !== undefined) {
    record.detourNote = checkIn.detourNote;
  }

  const checkIns = readAll();
  checkIns.push(record);
  store.set('checkIns', checkIns);
  return record;
}

function getCheckInsBySession(sessionId) {
  if (typeof sessionId !== 'string') return [];
  return readAll()
    .filter((item) => item && item.sessionId === sessionId)
    .sort(sortByTimestampAsc);
}

function getCheckInsByStatus(status) {
  validateStatus(status);
  return readAll().filter((item) => item && item.status === status);
}

function getAllCheckIns() {
  return readAll();
}

function clearCheckIns() {
  store.set('checkIns', []);
}

module.exports = {
  CHECKIN_STATUSES,
  addCheckIn,
  getCheckInsBySession,
  getCheckInsByStatus,
  getAllCheckIns,
  clearCheckIns,
};
