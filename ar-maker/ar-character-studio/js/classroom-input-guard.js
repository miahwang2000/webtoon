/**
 * classroom-input-guard.js
 * ------------------------------------------------------------------
 * 여러 그림/드로잉 수업용 웹앱에서 공통으로 쓰기 위한 유틸리티 스크립트.
 * 의존성 없음(순수 JS). <script src="classroom-input-guard.js"></script>
 * 한 줄만 추가하면 모든 앱에서 바로 window.ClassroomGuard로 사용 가능합니다.
 *
 * 제공 기능 2가지
 *   1) ClassroomGuard.fullscreen  — 전체화면(키오스크) 모드 + 나가기 제스처/ESC
 *   2) ClassroomGuard.singlePointer — 손바닥 오탐(팜 터치) 방지를 위한
 *      "단일 활성 포인터" 트래커 (진짜 팜 리젝션 API 대신 쓰는 대체 방식)
 *
 * ============================================================
 * 1) 전체화면(키오스크) 모드
 * ============================================================
 * 사용법:
 *   ClassroomGuard.fullscreen.enable();
 *   // 기본값: 문서에 첫 터치/클릭이 들어오는 순간 전체화면을 요청합니다.
 *   // (브라우저 정책상 Fullscreen API는 반드시 사용자의 실제 조작
 *   //  제스처 안에서만 호출할 수 있어서, 페이지 로드 즉시 자동으로
 *   //  전체화면을 걸 수는 없습니다 — 이건 웹표준 보안 정책이라 우회 불가)
 *
 * 더 안정적으로 쓰려면, 수업 시작 버튼 클릭 이벤트 안에서 직접 호출하세요:
 *   document.getElementById('btn-start').addEventListener('click', () => {
 *     ClassroomGuard.fullscreen.request();
 *     // ...이후 앱 시작 로직...
 *   });
 *
 * 나가는 방법 2가지 (둘 다 항상 활성화되어 있음):
 *   - 키보드 ESC: 브라우저 표준 동작이라 우리가 막을 수도, 안 막을 수도 없음
 *     (전체화면 API 자체가 "ESC로 항상 나갈 수 있어야 한다"는 표준 보안 요구사항)
 *   - 화면 왼쪽 위 구석을 정해진 횟수만큼 빠르게 톡톡 누르기 (기본: 1.5초 안에 3번)
 *     → 태블릿처럼 키보드가 없는 기기에서 선생님/학생이 빠져나올 수 있는 제스처
 *
 * 옵션(모두 선택):
 *   ClassroomGuard.fullscreen.enable({
 *     exitCorner: 'top-left',   // 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
 *     exitHotspotSize: 64,      // 제스처를 인식할 구석 영역 크기(px)
 *     exitTapCount: 3,          // 나가기에 필요한 탭 횟수
 *     exitTapWindowMs: 1500,    // 이 시간(ms) 안에 다 눌러야 인정
 *     onEnter: () => {},        // 전체화면 진입 시 콜백
 *     onExit: () => {}          // 전체화면 해제 시 콜백 (ESC 포함 모든 경우)
 *   });
 *
 * ============================================================
 * 2) 단일 활성 포인터 트래커 (팜 리젝션 대체)
 * ============================================================
 * 웹 표준에는 "이건 손바닥이다"를 알려주는 공식 API가 없습니다(펜 제조사
 * 전용 SDK에만 있음). 그래서 대신 이런 규칙을 씁니다:
 *   "여러 손가락/손바닥이 동시에 닿아도, 그 중 실제로 움직이기 시작한
 *    첫 번째 포인터만 진짜 그리기로 인정하고, 그 포인터가 손을 뗄 때까지
 *    다른 모든 포인터(나중에 닿는 것 포함)는 완전히 무시한다."
 *
 * 사용법 (기존에 canvas.addEventListener('pointerdown', ...) 등으로 직접
 * 그리던 코드를 아래처럼 바꾸면 됩니다):
 *
 *   const tracker = ClassroomGuard.singlePointer.attach(canvas, {
 *     onStart(pos, evt) { ... },   // 그리기 시작 (탭 한 번도 여기로 들어옴)
 *     onMove(pos, evt)  { ... },   // 그리는 중
 *     onEnd(pos, evt)   { ... }    // 손을 뗌
 *   });
 *   // pos = { x, y } (캔버스 내부 좌표계, getBoundingClientRect 보정 완료)
 *
 *   // 필요하면 강제로 리셋 (예: 모드를 바꿀 때 진행 중이던 스트로크를 취소)
 *   tracker.reset();
 *   // 더 이상 필요 없을 때
 *   tracker.destroy();
 *
 * 동작 규칙 정리:
 *   - 아무 포인터도 없을 때 하나가 닿으면: 후보로만 등록 (아직 onStart 안 부름)
 *   - 그 후보가 기준 이상 움직이면: 그 순간 활성 포인터로 확정, onStart(처음
 *     닿은 위치) → onMove(현재 위치) 순서로 호출. 동시에 있던 다른 후보는
 *     전부 버려지고, 이후 새로 닿는 포인터도 전부 무시됨.
 *   - 그 후보가 움직이지 않고 손을 뗐는데, 그 사이 다른 포인터가 전혀
 *     닿지 않았다면: 단순 탭(클릭)으로 보고 onStart → onEnd를 바로 호출.
 *     (색칠 앱의 "터치 한 번 = 채우기" 같은 기능이 정상 동작하게 하기 위함)
 *   - 그 후보가 움직이지 않고 손을 뗐는데, 그 사이 다른 포인터도 같이
 *     닿아있었다면: 손바닥일 가능성이 높다고 보고 완전히 무시(콜백 없음).
 *   - (보너스) 기기가 PointerEvent.width/height(터치 면적)를 지원하면,
 *     닿은 면적이 비정상적으로 큰 경우(기본 30px 초과) 단순 탭이어도
 *     바로 인정하지 않고 움직임으로만 확정되게 해서 손바닥 탭을 한 번 더 거릅니다.
 *
 * 옵션(모두 선택):
 *   ClassroomGuard.singlePointer.attach(canvas, handlers, {
 *     moveThreshold: 4,          // 이 픽셀 이상 움직여야 "진짜 그리기"로 확정
 *     largeContactSize: 30,      // 이 값(px) 넘는 접촉은 탭만으로 확정 안 함
 *     capturePointer: true       // 캔버스 밖으로 나가도 계속 그리기 유지
 *   });
 * ------------------------------------------------------------------
 */
(function (global) {
  'use strict';

  /* =========================================================
     1) 전체화면(키오스크) 모드
     ========================================================= */
  function requestFullscreenCompat(el) {
    const fn = el.requestFullscreen || el.webkitRequestFullscreen ||
      el.mozRequestFullScreen || el.msRequestFullscreen;
    if (fn) return fn.call(el);
    return Promise.reject(new Error('Fullscreen API를 지원하지 않는 브라우저입니다.'));
  }

  function exitFullscreenCompat() {
    const fn = document.exitFullscreen || document.webkitExitFullscreen ||
      document.mozCancelFullScreen || document.msExitFullscreen;
    if (fn) return fn.call(document);
    return Promise.resolve();
  }

  function currentFullscreenElement() {
    return document.fullscreenElement || document.webkitFullscreenElement ||
      document.mozFullScreenElement || document.msFullscreenElement || null;
  }

  const FULLSCREEN_CHANGE_EVENTS = [
    'fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'
  ];

  const fullscreenModule = (function () {
    let started = false;
    let opts = {};
    let tapTimestamps = [];

    function inHotspot(x, y) {
      const size = opts.exitHotspotSize;
      const w = global.innerWidth, h = global.innerHeight;
      switch (opts.exitCorner) {
        case 'top-right': return x >= w - size && y <= size;
        case 'bottom-left': return x <= size && y >= h - size;
        case 'bottom-right': return x >= w - size && y >= h - size;
        case 'top-left':
        default: return x <= size && y <= size;
      }
    }

    function handleHotspotTap(x, y) {
      if (!inHotspot(x, y)) return;
      const now = Date.now();
      tapTimestamps.push(now);
      tapTimestamps = tapTimestamps.filter(t => now - t <= opts.exitTapWindowMs);
      if (tapTimestamps.length >= opts.exitTapCount) {
        tapTimestamps = [];
        if (currentFullscreenElement()) exitFullscreenCompat();
      }
    }

    function onPointerDownForExit(e) {
      const point = (e.touches && e.touches[0]) ? e.touches[0] : e;
      handleHotspotTap(point.clientX, point.clientY);
    }

    function onFirstGestureRequestFullscreen() {
      if (!currentFullscreenElement()) {
        requestFullscreenCompat(document.documentElement).catch(() => {
          /* 사용자가 거부했거나 미지원 브라우저 - 조용히 무시, 앱은 계속 정상 동작 */
        });
      }
    }

    function enable(userOpts) {
      if (started) return; // 중복 초기화 방지
      started = true;
      opts = Object.assign({
        exitCorner: 'top-left',
        exitHotspotSize: 64,
        exitTapCount: 3,
        exitTapWindowMs: 1500,
        autoRequestOnFirstGesture: true,
        onEnter: null,
        onExit: null
      }, userOpts || {});

      if (opts.autoRequestOnFirstGesture) {
        ['pointerdown', 'touchstart', 'click'].forEach(evt => {
          document.addEventListener(evt, onFirstGestureRequestFullscreen, { once: true, capture: true });
        });
      }

      document.addEventListener('pointerdown', onPointerDownForExit, true);

      FULLSCREEN_CHANGE_EVENTS.forEach(evt => {
        document.addEventListener(evt, () => {
          if (currentFullscreenElement()) {
            if (typeof opts.onEnter === 'function') opts.onEnter();
          } else {
            if (typeof opts.onExit === 'function') opts.onExit();
          }
        });
      });
    }

    function request() {
      return requestFullscreenCompat(document.documentElement);
    }

    function exit() {
      return exitFullscreenCompat();
    }

    function isFullscreen() {
      return !!currentFullscreenElement();
    }

    return { enable, request, exit, isFullscreen };
  })();

  /* =========================================================
     2) 단일 활성 포인터 트래커 (팜 리젝션 대체)
     ========================================================= */
  function getRelativePos(canvasLike, evt) {
    const rect = canvasLike.getBoundingClientRect();
    // canvas는 내부 해상도(width/height 속성)와 화면에 보이는 크기가 다를 수 있어 보정한다
    const scaleX = (canvasLike.width || rect.width) / rect.width;
    const scaleY = (canvasLike.height || rect.height) / rect.height;
    return {
      x: (evt.clientX - rect.left) * scaleX,
      y: (evt.clientY - rect.top) * scaleY
    };
  }

  const singlePointerModule = (function () {
    function attach(element, handlers, userOpts) {
      const opts = Object.assign({
        moveThreshold: 4,
        largeContactSize: 30,
        capturePointer: true
      }, userOpts || {});

      handlers = handlers || {};
      const onStart = typeof handlers.onStart === 'function' ? handlers.onStart : () => {};
      const onMove = typeof handlers.onMove === 'function' ? handlers.onMove : () => {};
      const onEnd = typeof handlers.onEnd === 'function' ? handlers.onEnd : () => {};

      let activeId = null;
      /** @type {Map<number, {x0:number,y0:number,downEvt:PointerEvent}>} */
      const candidates = new Map();

      function isLargeContact(e) {
        const w = e.width || 0, h = e.height || 0;
        return w > opts.largeContactSize || h > opts.largeContactSize;
      }

      function reset() {
        activeId = null;
        candidates.clear();
      }

      function onPointerDown(e) {
        if (activeId !== null) {
          // 이미 확정된 포인터가 그리는 중 - 새로 닿은 포인터(손바닥 등)는 완전히 무시
          return;
        }
        candidates.set(e.pointerId, { x0: e.clientX, y0: e.clientY, downEvt: e });
      }

      function onPointerMove(e) {
        if (activeId !== null) {
          if (e.pointerId === activeId) {
            onMove(getRelativePos(element, e), e);
          }
          return; // 활성 포인터가 아니면 무시
        }
        const c = candidates.get(e.pointerId);
        if (!c) return;

        const dist = Math.hypot(e.clientX - c.x0, e.clientY - c.y0);
        if (dist >= opts.moveThreshold) {
          // 이 포인터를 활성으로 확정, 나머지 후보는 전부 버린다
          activeId = e.pointerId;
          candidates.clear();
          if (opts.capturePointer && element.setPointerCapture) {
            try { element.setPointerCapture(e.pointerId); } catch (err) { /* 무시 */ }
          }
          onStart(getRelativePos(element, c.downEvt), c.downEvt);
          onMove(getRelativePos(element, e), e);
        }
      }

      function onPointerUp(e) {
        if (e.pointerId === activeId) {
          onEnd(getRelativePos(element, e), e);
          reset();
          return;
        }
        if (candidates.has(e.pointerId)) {
          const wasSoleCandidate = candidates.size === 1;
          const c = candidates.get(e.pointerId);
          candidates.delete(e.pointerId);
          if (wasSoleCandidate && activeId === null && !isLargeContact(c.downEvt)) {
            // 움직이지 않고 손을 뗀 유일한 접촉 = 단순 탭(클릭)으로 인정
            const pos = getRelativePos(element, c.downEvt);
            onStart(pos, c.downEvt);
            onEnd(pos, e);
          }
          // 그 외(다른 포인터와 동시에 있었거나, 접촉면이 넓은 경우)는 조용히 무시 = 손바닥으로 간주
        }
      }

      element.addEventListener('pointerdown', onPointerDown);
      element.addEventListener('pointermove', onPointerMove);
      element.addEventListener('pointerup', onPointerUp);
      element.addEventListener('pointercancel', onPointerUp);

      function destroy() {
        element.removeEventListener('pointerdown', onPointerDown);
        element.removeEventListener('pointermove', onPointerMove);
        element.removeEventListener('pointerup', onPointerUp);
        element.removeEventListener('pointercancel', onPointerUp);
        reset();
      }

      return { reset, destroy };
    }

    return { attach };
  })();

  global.ClassroomGuard = {
    fullscreen: fullscreenModule,
    singlePointer: singlePointerModule
  };
})(window);
