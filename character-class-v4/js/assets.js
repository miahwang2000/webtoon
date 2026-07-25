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
    { id: "hair_02", label: "모히칸헤어", src: "assets/hair/hair_02.png" },
    { id: "hair_03", label: "양갈래 땋은머리", src: "assets/hair/hair_03.png" },
    { id: "hair_04", label: "삐친머리", src: "assets/hair/hair_04.png" },
    { id: "hair_05", label: "숏컷헤어", src: "assets/hair/hair_05.png" }
  ],
  clothes: [
    { id: "clothes_01", label: "기본 옷", src: "assets/clothes/clothes_01.png" },
    { id: "clothes_02", label: "트렌치 코트", src: "assets/clothes/clothes_02.png" },
    { id: "clothes_03", label: "트레이닝복", src: "assets/clothes/clothes_03.png" },
    { id: "clothes_04", label: "교복", src: "assets/clothes/clothes_04.png" }
  ],
  face: [
    { id: "face_01", label: "기본 표정", src: "assets/face/face_01.png" },
    { id: "face_02", label: "반짝이는 눈", src: "assets/face/face_02.png" },
    { id: "face_03", label: "지친 표정", src: "assets/face/face_03.png" },
    { id: "face_04", label: "당당한 표정", src: "assets/face/face_04.png" }
  ]
};

// 캐릭터 무대(캔버스) 규격 - 모든 파츠 PNG는 이 크기로 제작되어야 합니다.
const CANVAS_WIDTH = 600;
const CANVAS_HEIGHT = 800;

// 12색 팔레트 (스와치에서 추출)
// 색상 톤별로 분류됨
const COLOR_PALETTE = [
  { hex: "#0083c7", name: "파란색", tone: "파란색 톤" },
  { hex: "#28497e", name: "남색", tone: "파란색 톤" },
  { hex: "#303996", name: "보라색", tone: "파란색 톤" },
  { hex: "#d04a89", name: "핑크색", tone: "빨강색 톤" },
  { hex: "#d74128", name: "빨강색", tone: "빨강색 톤" },
  { hex: "#f88029", name: "주황색", tone: "주황색 톤" },
  { hex: "#fcbfa3", name: "살구색", tone: "주황색 톤" },
  { hex: "#ffe222", name: "노랑색", tone: "노랑색 톤" },
  { hex: "#7dc243", name: "연두색", tone: "초록색 톤" },
  { hex: "#044711", name: "초록색", tone: "초록색 톤" },
  { hex: "#493804", name: "갈색", tone: "갈색 톤" },
  { hex: "#000000", name: "검은색", tone: "검은색 톤" }
];
