/**
 * character.js
 * 캐릭터의 현재 상태(선택된 파츠, 입력 정보)를 관리합니다.
 */

const Character = {
  // 선택된 파츠 id
  // body는 공통 몸체라 항상 첫 번째 항목 고정
  // hair/clothes/face는 처음엔 미선택(null) 상태 -> 로드 시 몸체만 보임
  selection: {
    body: ASSET_MANIFEST.body[0].id,
    hair: null,
    clothes: null,
    face: null
  },

  // 캐릭터 정보 입력값
  info: {
    name: "",
    personality: "",
    strength1: "",
    strength2: "",
    weakness1: "",
    weakness2: ""
  },

  // 이미지 캐시 (같은 이미지를 반복 로드하지 않도록)
  _imageCache: {},

  setPart(category, id) {
    this.selection[category] = id;
  },

  setInfo(field, value) {
    this.info[field] = value;
  },

  getPartData(category, id) {
    return ASSET_MANIFEST[category].find((p) => p.id === id);
  },

  // 현재 선택된 파츠들을 레이어 순서(아래→위)대로 반환
  // body -> clothes -> face -> hair
  getLayerOrder() {
    return ["body", "clothes", "face", "hair"];
  },

  loadImage(src) {
    if (this._imageCache[src]) {
      return Promise.resolve(this._imageCache[src]);
    }
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this._imageCache[src] = img;
        resolve(img);
      };
      img.onerror = () => reject(new Error(`이미지를 불러올 수 없습니다: ${src}`));
      img.src = src;
    });
  },

  // 현재 선택된 모든 레이어 이미지를 순서대로 로드해서 배열로 반환
  async loadCurrentLayers() {
    const order = this.getLayerOrder();
    const images = [];
    for (const category of order) {
      const partData = this.getPartData(category, this.selection[category]);
      if (partData) {
        const img = await this.loadImage(partData.src);
        images.push(img);
      }
    }
    return images;
  }
};
