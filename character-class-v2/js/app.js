/**
 * app.js
 * 앱 진입점. 모듈을 초기화하고 저장 버튼을 연결합니다.
 */

document.addEventListener("DOMContentLoaded", () => {
  UI.init();
  Paint.init();

  const exportBtn = document.getElementById("exportBtn");
  exportBtn.addEventListener("click", async () => {
    exportBtn.disabled = true;
    exportBtn.textContent = "저장 중...";
    try {
      await Export.downloadPNG();
    } catch (e) {
      console.error(e);
      alert(e.message || "PNG 저장 중 문제가 발생했습니다. 다시 시도해주세요.");
    } finally {
      exportBtn.disabled = false;
      exportBtn.textContent = "📥 PNG로 저장";
    }
  });
});
