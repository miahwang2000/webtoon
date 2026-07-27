// cloudinary.js — direct browser-to-Cloudinary upload using an unsigned
// upload preset, so this still works from a static GitHub Pages site with
// no backend of its own.

const CLOUDINARY_CONFIG = {
  cloudName: 'qmbonapf',
  uploadPreset: 'stickman'
};

const ArCloudinary = (() => {
  function endpoint() {
    return `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  }

  // sanitize a student name for use in a Cloudinary public_id (no spaces/slashes)
  function safeName(str) {
    return String(str).trim().replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 30) || 'student';
  }

  /**
   * Upload a photo blob under AR/{classCode}/ with the student's name and
   * class baked into the filename too, per the teacher's requirement.
   */
  async function uploadPhoto(blob, session) {
    const timestamp = Date.now();
    const publicId = `${safeName(session.name)}_${session.classCode}_${timestamp}`;
    const folder = `AR/${session.classCode}`;

    const form = new FormData();
    form.append('file', blob, `${publicId}.png`);
    form.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
    form.append('folder', folder);
    form.append('public_id', publicId);

    // Without a timeout, a blocked/very slow network makes this hang
    // forever with no feedback — which looks exactly like "nothing happens"
    // when a student taps submit. Fail loudly instead after 20s.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    let res;
    try {
      res = await fetch(endpoint(), { method: 'POST', body: form, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('업로드 시간이 너무 오래 걸려요 (네트워크를 확인해주세요)');
      }
      throw new Error('네트워크 연결에 문제가 있어요');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // 400/401 on an unsigned upload usually means the preset isn't set to
      // "Unsigned", or doesn't allow the folder/public_id override — a
      // Cloudinary console setting, not something fixable from the app.
      if (res.status === 400 || res.status === 401) {
        throw new Error(`Cloudinary 설정을 확인해주세요 (preset: ${CLOUDINARY_CONFIG.uploadPreset}) — ${text}`);
      }
      throw new Error(`업로드 실패 (${res.status}): ${text}`);
    }
    return res.json();
  }

  return { uploadPhoto };
})();
