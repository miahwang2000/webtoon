// STEP 2(채색)는 원본 그림을 바꾸지 않고, 순수 JS만으로 채우기/펜/실행취소/초기화를
// 제공합니다. 어떤 외부 AI API도 호출하지 않습니다.

window.APP_CONFIG = {
  // STEP 1에서 반투명하게 보여줄 가이드 이미지 목록.
  // 여러 개를 넣어두면 학생이 그릴 캐릭터를 직접 골라서 시작할 수 있어요.
  // url은 이 폴더(character-maker) 기준 상대 경로입니다.
  GUIDE_IMAGES: [
    { id: "fox", label: "여우", url: "guides/fox.jpg" },
    { id: "elephant", label: "코끼리", url: "guides/elephant.jpg" },
    { id: "penguin", label: "펭귄", url: "guides/penguin.jpg" },
    { id: "cat", label: "고양이", url: "guides/cat.jpg" },
    { id: "bear", label: "곰", url: "guides/bear.jpg" },
    { id: "squirrel", label: "다람쥐", url: "guides/squirrel.jpg" }
  ],
  GUIDE_OPACITY: 0.18, // 0(안 보임)~1(진하게) 사이. 아이들이 보기 편한 정도로 조절하세요.

  // (선택) Stickman Class에서 쓰던 것과 같은 Cloudinary unsigned upload 설정.
  // 채워두면 STEP 4 제출 시 루트의 "ch-maker" 폴더 아래
  // "이름_반_캐릭터이름_시간.png" 형식으로 저장됩니다.
  // 비워두면 제출 버튼을 눌러도 "아직 연결되지 않았어요" 안내만 뜹니다.
  // ⚠️ unsigned upload preset 설정에서 "Use filename or externally defined
  //    Public ID"와 폴더 지정 허용이 켜져 있어야 folder/public_id가 실제로 적용됩니다.
  CLOUDINARY_CLOUD_NAME: "qmbonapf",
  CLOUDINARY_UPLOAD_PRESET: "stickman"
};
