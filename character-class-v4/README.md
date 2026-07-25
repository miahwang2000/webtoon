# Character Sheet Maker (MVP)

웹툰 제작 전, 학생이 캐릭터를 기획하기 위한 교육용 캐릭터 시트 제작 웹앱입니다.
회원가입/로그인/서버/DB/API 없이 순수 HTML·CSS·JS로만 동작하며, GitHub Pages에 그대로 올려 사용할 수 있습니다.

## 실행 방법

1. 이 폴더 전체를 GitHub Pages 저장소에 업로드
2. 또는 로컬에서 확인할 때는 폴더 안에서 아래 명령 실행 후 브라우저로 접속

```bash
python3 -m http.server 8000
# http://localhost:8000 접속
```

⚠️ **주의**: `index.html`을 더블클릭해서 `file://`로 직접 열면 미리보기는 되지만,
**PNG 저장 버튼이 동작하지 않습니다.** 브라우저가 보안상 로컬 파일 캔버스의
이미지 재생성을 차단하기 때문입니다. 반드시 위의 로컬 서버 명령을 사용하거나,
GitHub Pages처럼 http(s) 주소로 접속해서 사용해주세요. (GitHub Pages에
올려서 사용할 때는 이 문제가 발생하지 않습니다.)

## 파츠 규격 (중요)

- 캔버스 크기: **600 × 800px**
- 배경: **투명 PNG**
- 모든 파츠는 동일한 600×800 캔버스 기준 좌표에 그려야 함 (몸체 기준 정렬)

## 레이어 순서 (아래 → 위)

1. `body` (공통 몸체)
2. `clothes` (의상)
3. `face` (표정)
4. `hair` (헤어스타일 — 앞머리가 이마를 덮는 스타일이라 최상단)

## 새 파츠 추가하는 방법

1. 규격에 맞는 PNG를 해당 폴더에 추가
   - `assets/hair/`, `assets/clothes/`, `assets/face/`, `assets/body/`
2. `js/assets.js` 파일의 `ASSET_MANIFEST` 배열에 한 줄 추가

```js
hair: [
  { id: "hair_01", label: "단발머리", src: "assets/hair/hair_01.png" },
  { id: "hair_02", label: "숏컷", src: "assets/hair/hair_02.png" },
  { id: "hair_03", label: "새 헤어 이름", src: "assets/hair/hair_03.png" } // 추가
]
```

이게 전부입니다. 코드 수정 없이 바로 선택지에 나타납니다.

## 폴더 구조

```text
character-sheet-maker/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── app.js        # 진입점
│   ├── ui.js         # 화면 렌더링 / 이벤트
│   ├── character.js  # 캐릭터 상태 관리
│   ├── export.js     # PNG 캐릭터 시트 생성
│   └── assets.js     # 파츠 목록 정의
└── assets/
    ├── body/
    ├── hair/
    ├── clothes/
    └── face/
```

## 기능 요약

- 처음 로드 시에는 공통 몸체만 보임 (헤어/의상/표정 미선택 상태)
- 헤어 / 의상 / 표정 선택 → 즉시 미리보기 반영 (드래그 없음)
- 이름 / 성격 입력
- 강점 2개, 약점 2개 입력 + 빈 게이지 5칸(학생이 직접 채색)
- "PNG로 저장" 클릭 시, 캐릭터 이미지 + 정보가 합쳐진 캐릭터 시트 1장을 PNG로 다운로드
- 서버 저장 없음 (모든 처리는 브라우저 내부에서 Canvas API로 수행)

## 제외된 기능 (의도적으로 미구현)

회원가입/로그인, 서버 저장, AI 기능, 채색 기능, 애니메이션, 확대/축소,
드래그 앤 드롭, Undo/Redo, 복잡한 설정 메뉴
