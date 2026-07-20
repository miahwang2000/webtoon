/**
 * assets.js
 * 파츠 목록을 정의합니다.
 * 새 파츠 이미지를 추가할 때는 assets/폴더에 파일을 넣고
 * 아래 배열에 한 줄만 추가하면 됩니다.
 */

const ASSET_MANIFEST = {
  body: [
    { id: "body_01", label: "기본 몸체", src: "assets/body/body_01.png" }
  ],
  hair: [
    { id: "hair_01", label: "단발머리", src: "assets/hair/hair_01.png" },
    { id: "hair_02", label: "숏컷", src: "assets/hair/hair_02.png" }
  ],
  clothes: [
    { id: "clothes_01", label: "기본 옷", src: "assets/clothes/clothes_01.png" }
  ],
  face: [
    { id: "face_01", label: "기본 표정", src: "assets/face/face_01.png" }
  ]
};

// 캐릭터 무대(캔버스) 규격 - 모든 파츠 PNG는 이 크기로 제작되어야 합니다.
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;
