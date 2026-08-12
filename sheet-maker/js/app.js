/**
 * app.js - v3 캐릭터 시트 메이커 (3단계 구성)
 */

const CHARACTERISTICS = {
  bow: [
    "불 나오는 화살을 쏘는 활을 가지고 있고, 숲에서 잘 안 보이게 초록 옷을 입고 있다",
    "빠르게 많은 화살을 쏘는 활을 다루고, 파란 옷을 입고 있다",
    "독이 들어간 화살을 쏘는 활을 가지고 있고, 주황 옷을 입고 있다",
    "먼 거리에서 정확하게 맞추는 것으로 유명한 활 쏘는 사람이고, 검은 옷을 입고 있다"
  ],
  sword: [
    "큰 검을 휘두르는 전사이고, 빨간 갑옷을 입고 있다",
    "빠르고 날카로운 검술을 쓰며, 흰 옷을 입고 있다",
    "마법이 들어간 검을 쓰는 검사이고, 보라 옷을 입고 있다",
    "방어를 잘하는 검 사용자이고, 금색 갑옷을 입고 있다"
  ],
  stick: [
    "센 불 마법을 쓰는 마술사이고, 빨간 옷을 입고 있다",
    "얼음 마법을 쓰는 마술사이고, 파란 옷을 입고 있다",
    "다른 사람을 낫게 하는 마법을 쓰는 마술사이고, 하얀 옷을 입고 있다",
    "번개 마법으로 나쁜 사람들을 이기는 마술사이고, 노란 옷을 입고 있다"
  ]
};

let currentStep = 1;
let selectedType = null;
let images = {};

document.addEventListener("DOMContentLoaded", () => {
  setupStep1();
  setupStep2Button();
  setupCharacteristicInput();
  setupDownloadButton();
  preloadImages();
});

// ============= STEP NAVIGATION =============
function goToStep(step) {
  const allSteps = document.querySelectorAll(".step");
  allSteps.forEach(s => s.style.display = "none");
  
  document.getElementById(`step${step}`).style.display = "block";
  
  // Progress bar update
  document.querySelectorAll(".progress-step").forEach((s, idx) => {
    s.classList.toggle("active", idx < step);
  });
  
  currentStep = step;
  
  if (step === 2) {
    updateStep2Preview();
  } else if (step === 3) {
    generatePreview();
  }
}

// ============= STEP 1: CHARACTER SELECTION =============
function setupStep1() {
  document.querySelectorAll(".type-card").forEach(card => {
    card.addEventListener("click", () => {
      selectCharacterType(card.dataset.type);
    });
  });
}

function selectCharacterType(type) {
  selectedType = type;
  
  // UI 업데이트
  document.querySelectorAll(".type-card").forEach(card => {
    card.classList.toggle("selected", card.dataset.type === type);
  });
  
  // 2단계로 진행
  goToStep(2);
}

// ============= STEP 2: INFORMATION INPUT =============
function setupStep2Button() {
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      goToStep(3);
    });
  }
}
function updateStep2Preview() {
  if (!selectedType) return;
  
  const previewImage = document.getElementById("previewImage");
  previewImage.src = `assets/${selectedType}.png`;
  
  // 특징 드롭다운 업데이트
  updateCharacteristicOptions(selectedType);
}

function updateCharacteristicOptions(type) {
  const selectEl = document.getElementById("characteristic");
  const customInput = document.getElementById("characteristicCustom");
  
  selectEl.innerHTML = '<option value="">선택하기...</option>';
  selectEl.innerHTML += '<option value="__custom__">직접입력</option>';
  
  CHARACTERISTICS[type].forEach((char) => {
    const opt = document.createElement("option");
    opt.value = char;
    opt.textContent = char;
    selectEl.appendChild(opt);
  });
  
  selectEl.value = "";
  customInput.value = "";
  customInput.style.display = "none";
}

function setupCharacteristicInput() {
  const selectEl = document.getElementById("characteristic");
  const customInput = document.getElementById("characteristicCustom");
  
  selectEl.addEventListener("change", () => {
    if (selectEl.value === "__custom__") {
      customInput.style.display = "block";
      customInput.focus();
    } else {
      customInput.style.display = "none";
      customInput.value = "";
    }
    checkFormValidity();
  });
  
  // 모든 입력값 변경 감지
  ["authorName", "jobTitle", "characteristicCustom"].forEach(id => {
    document.getElementById(id).addEventListener("input", checkFormValidity);
  });
}

function checkFormValidity() {
  const authorName = document.getElementById("authorName").value.trim();
  const jobTitle = document.getElementById("jobTitle").value.trim();
  const characteristic = document.getElementById("characteristic").value;
  const customChar = document.getElementById("characteristicCustom").value.trim();
  
  const isValid = authorName && 
                  jobTitle && 
                  (characteristic && characteristic !== "__custom__" || customChar);
  
  document.getElementById("nextBtn").disabled = !isValid;
}

// ============= STEP 3: PREVIEW & DOWNLOAD =============
function generatePreview() {
  const canvas = document.getElementById("previewCanvas");
  const ctx = canvas.getContext("2d");
  
  drawSheet(ctx, canvas.width, canvas.height);
}

function drawSheet(ctx, canvasWidth, canvasHeight) {
  const authorName = document.getElementById("authorName").value.trim();
  const jobTitle = document.getElementById("jobTitle").value.trim();
  const selectEl = document.getElementById("characteristic");
  const customChar = document.getElementById("characteristicCustom").value.trim();
  const characteristic = selectEl.value === "__custom__" ? customChar : selectEl.value;
  
  // 배경
  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // 테두리
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 3;
  roundRect(ctx, 15, 15, canvasWidth - 30, canvasHeight - 30, 20);
  ctx.stroke();
  
  // 캐릭터 이미지 (상단, 정사각형)
  const imgSize = 740;  // 가로 세로 동일
  const imgX = (canvasWidth - imgSize) / 2;
  const imgY = 30;
  
  const img = images[selectedType];
  if (img && img.complete && img.naturalWidth) {
    ctx.drawImage(img, imgX, imgY, imgSize, imgSize);
  }
  
  // 정보 박스들 (하단) - 캐릭터와 20px 마진
  const boxStartY = imgY + imgSize + 20;
  const boxWidth = 740;   // 캐릭터와 동일 너비
  const boxX = imgX;      // 캐릭터와 동일 X좌표
  const spacing = 12;
  const padding = 12;
  
  // 작가명 박스 - 한 줄만
  const authorBoxHeight = 65;
  drawInfoBox(ctx, "작가명", authorName, boxX, boxStartY, boxWidth, authorBoxHeight, padding, 16, 14);
  
  // 직업 박스 - 한 줄만
  const jobBoxHeight = 65;
  drawInfoBox(ctx, "직업", jobTitle, boxX, boxStartY + authorBoxHeight + spacing, boxWidth, jobBoxHeight, padding, 16, 14);
  
  // 특징 박스
  drawInfoBox(ctx, "특징", characteristic, boxX, boxStartY + (authorBoxHeight + spacing) * 2, boxWidth, 160, padding, 16, 14);
}

function drawInfoBox(ctx, label, value, x, y, width, height, padding, labelFontSize = 16, valueFontSize = 14) {
  const labelWidth = 90;
  
  // 라벨 배경 (파란색)
  ctx.fillStyle = "#4472C4";
  roundRect(ctx, x, y, labelWidth, height, [12, 0, 0, 12]);
  ctx.fill();
  
  // 입력 영역 배경 (흰색)
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x + labelWidth, y, width - labelWidth, height, [0, 12, 12, 0]);
  ctx.fill();
  
  // 테두리
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, width, height, 12);
  ctx.stroke();
  
  // 라벨 텍스트 (작은 폰트)
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${labelFontSize}px 'Noto Sans KR'`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + labelWidth / 2, y + height / 2);
  
  // 입력값 텍스트 (큰 폰트)
  ctx.fillStyle = "#333";
  ctx.font = `${valueFontSize}px 'Noto Sans KR'`;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  
  const textX = x + labelWidth + padding;
  const textY = y + padding;
  const maxTextWidth = width - labelWidth - padding * 2;
  const lineHeight = valueFontSize + 6;
  
  // 긴 텍스트는 줄바꿈
  const lines = wrapText(ctx, value, maxTextWidth);
  lines.forEach((line, idx) => {
    ctx.fillText(line, textX, textY + (idx * lineHeight));
  });
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let currentLine = "";
  
  words.forEach(word => {
    const testLine = currentLine + word + " ";
    const metrics = ctx.measureText(testLine);
    
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine.trim());
      currentLine = word + " ";
    } else {
      currentLine = testLine;
    }
  });
  
  if (currentLine) lines.push(currentLine.trim());
  return lines.length > 0 ? lines : [text];
}

// 둥근 사각형 그리기
function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === "number") {
    r = [r, r, r, r];
  }
  ctx.beginPath();
  ctx.moveTo(x + r[0], y);
  ctx.lineTo(x + w - r[1], y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r[1]);
  ctx.lineTo(x + w, y + h - r[2]);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r[2], y + h);
  ctx.lineTo(x + r[3], y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r[3]);
  ctx.lineTo(x, y + r[0]);
  ctx.quadraticCurveTo(x, y, x + r[0], y);
  ctx.closePath();
}

// ============= DOWNLOAD =============
function setupDownloadButton() {
  const btn = document.getElementById("downloadBtn");
  btn.addEventListener("click", downloadSheet);
}

async function downloadSheet() {
  try {
    const canvas = document.getElementById("downloadCanvas");
    const ctx = canvas.getContext("2d");
    
    // 이미지 로드 완료 확인
    const img = images[selectedType];
    if (!img || !img.src) {
      alert("이미지를 불러올 수 없습니다. 다시 시도해주세요.");
      return;
    }
    
    // 이미지 로드 대기
    if (!img.complete || !img.naturalWidth) {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error("이미지 로드 실패"));
      });
    }
    
    // 다운로드용 캔버스에 그리기
    drawSheet(ctx, canvas.width, canvas.height);
    
    // PNG 다운로드
    canvas.toBlob((blob) => {
      if (!blob) {
        alert("이미지 생성에 실패했습니다. 다시 시도해주세요.");
        return;
      }
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `character_sheet_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, "image/png");
  } catch (error) {
    console.error("다운로드 오류:", error);
    alert("PNG 저장 중 오류가 발생했습니다: " + error.message);
  }
}

// ============= UTILITIES =============
function preloadImages() {
  ["bow", "sword", "stick"].forEach(type => {
    const img = new Image();
    img.src = `assets/${type}.png`;
    images[type] = img;
  });
}
