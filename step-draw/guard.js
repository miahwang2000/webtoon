/* ============================================================
   classroom-input-guard.js (경량 재구현본)
   - 전체화면(키오스크) 진입
   - 손바닥 오터치 방지 (팜 리젝션)
   - alert()/confirm() 대체용 커스텀 모달
     (전체화면 모드에서는 네이티브 다이얼로그가 화면을 깨거나
      포커스를 잃게 만들 수 있어 자체 모달을 사용합니다)
   ============================================================ */
window.ClassroomGuard = (function () {

  // ---------- 전체화면 키오스크 ----------
  function enterFullscreen(el) {
    el = el || document.documentElement;
    const req = el.requestFullscreen || el.webkitRequestFullscreen ||
                el.mozRequestFullScreen || el.msRequestFullscreen;
    if (req) {
      try { req.call(el); } catch (e) { /* 사용자 제스처 없이 호출된 경우 등 무시 */ }
    }
  }

  function exitFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen ||
                 document.mozCancelFullScreen || document.msExitFullscreen;
    if (exit && document.fullscreenElement) {
      try { exit.call(document); } catch (e) {}
    }
  }

  // ---------- 팜 리젝션 ----------
  // 규칙: 동시에 여러 손가락이 캔버스에 닿으면(손바닥 포함) 첫 번째로 닿은
  // 포인터만 그리기로 인정하고 나머지는 전부 무시합니다.
  // 펜(stylus/pen) 입력은 항상 우선 허용합니다.
  function attachPalmRejection(target, { onStart, onMove, onEnd }) {
    let activePointerId = null;
    let activeIsPen = false;

    function shouldAccept(e) {
      if (e.pointerType === 'pen') return true;
      if (activePointerId === null) return true;
      return false;
    }

    target.addEventListener('pointerdown', (e) => {
      if (!shouldAccept(e)) return;
      // 펜이 새로 닿으면 기존 터치를 취소하고 펜을 우선시
      if (e.pointerType === 'pen' && activePointerId !== null && !activeIsPen) {
        activePointerId = null;
      }
      if (activePointerId !== null) return;
      activePointerId = e.pointerId;
      activeIsPen = e.pointerType === 'pen';
      try { target.setPointerCapture(e.pointerId); } catch (err) {}
      onStart && onStart(e);
    }, { passive: true });

    target.addEventListener('pointermove', (e) => {
      if (e.pointerId !== activePointerId) return;
      onMove && onMove(e);
    }, { passive: true });

    function release(e) {
      if (e.pointerId !== activePointerId) return;
      activePointerId = null;
      activeIsPen = false;
      onEnd && onEnd(e);
    }
    target.addEventListener('pointerup', release, { passive: true });
    target.addEventListener('pointercancel', release, { passive: true });
    target.addEventListener('pointerleave', release, { passive: true });

    // 컨텍스트 메뉴(길게 누르기) 방지
    target.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ---------- 커스텀 모달 ----------
  function showModal(message, buttons) {
    const overlay = document.getElementById('modalOverlay');
    const msgEl = document.getElementById('modalMsg');
    const actionsEl = document.getElementById('modalActions');
    msgEl.textContent = message;
    actionsEl.innerHTML = '';
    (buttons || [{ label: '확인', primary: true }]).forEach((btn) => {
      const b = document.createElement('button');
      b.className = 'btn ' + (btn.primary ? 'coral' : 'ghost');
      b.textContent = btn.label;
      b.onclick = () => {
        overlay.classList.remove('active');
        btn.onClick && btn.onClick();
      };
      actionsEl.appendChild(b);
    });
    overlay.classList.add('active');
  }

  function showLoading(text) {
    const el = document.getElementById('loadingOverlay');
    document.getElementById('loadingText').textContent = text || '처리 중이에요...';
    el.classList.add('active');
  }
  function hideLoading() {
    document.getElementById('loadingOverlay').classList.remove('active');
  }

  return { enterFullscreen, exitFullscreen, attachPalmRejection, showModal, showLoading, hideLoading };
})();
