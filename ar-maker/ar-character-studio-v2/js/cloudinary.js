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

    const res = await fetch(endpoint(), { method: 'POST', body: form });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Cloudinary upload failed (${res.status}): ${text}`);
    }
    return res.json();
  }

  return { uploadPhoto };
})();
