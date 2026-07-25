// storage.js — simple localStorage helpers.
// Keeps a student's in-progress work safe if they accidentally leave the
// page. Everything is cleared again the moment "수업 시작하기" is pressed
// for a new student, so the next student always starts from a blank page.

const AR_KEYS = {
  session: 'ar_session',   // {name, className, guideId}
  drawing: 'ar_drawing'    // dataURL of the in-progress canvas
};

const ARStorage = {
  saveSession(session) {
    try { localStorage.setItem(AR_KEYS.session, JSON.stringify(session)); }
    catch (e) { console.warn('저장 실패', e); }
  },
  loadSession() {
    try {
      const raw = localStorage.getItem(AR_KEYS.session);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  },
  saveDrawing(dataURL) {
    try { localStorage.setItem(AR_KEYS.drawing, dataURL); }
    catch (e) { /* quota or private-mode issues: fail silently, not critical */ }
  },
  loadDrawing() {
    try { return localStorage.getItem(AR_KEYS.drawing); }
    catch (e) { return null; }
  },
  clearAll() {
    try {
      localStorage.removeItem(AR_KEYS.session);
      localStorage.removeItem(AR_KEYS.drawing);
    } catch (e) { /* ignore */ }
  }
};
