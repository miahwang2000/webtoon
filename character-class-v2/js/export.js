/**
 * export.js
 * 캐릭터 + 정보를 하나의 "캐릭터 시트" PNG로 그려서 다운로드합니다.
 * (외부 라이브러리 없이 순수 Canvas 2D API만 사용)
 */

const Export = {
  SHEET_W: 900,
  SHEET_H: 1360,

  COLORS: {
    paper: "#f6f4ef",
    ink: "#232323",
    panel: "#ffffff",
    accent: "#ff5a5f",
    accentSoft: "#ffd23f",
    line: "#d8d4c8",
    muted: "#8a877d"
  },

  drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  // 텍스트 줄바꿈 (긴 성격/이름 입력 대응)
  wrapText(ctx, text, maxWidth) {
    if (!text) return [""];
    const chars = text.split("");
    const lines = [];
    let line = "";
    for (const ch of chars) {
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line !== "") {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  },

  // 빈 능력치 게이지 5칸 그리기 (색칠은 하지 않음 - 학생이 직접 채색)
  drawGauges(ctx, x, y, count = 5) {
    const box = 26;
    const gap = 10;
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = this.COLORS.ink;
    for (let i = 0; i < count; i++) {
      const bx = x + i * (box + gap);
      this.drawRoundedRect(ctx, bx, y, box, box, 5);
      ctx.stroke();
    }
    return count * (box + gap) - gap; // 전체 폭
  },

  // 좌측에 3연공 바인더 구멍 느낌의 장식 (앱 디자인과 통일감)
  drawBinderHoles(ctx, frameX, frameY, frameH) {
    const holeR = 9;
    const holeX = frameX + 26;
    const positions = [0.18, 0.5, 0.82];
    positions.forEach((p) => {
      const holeY = frameY + frameH * p;
      ctx.save();
      ctx.fillStyle = this.COLORS.paper;
      ctx.beginPath();
      ctx.arc(holeX, holeY, holeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.COLORS.line;
      ctx.stroke();
      ctx.restore();
    });
  },

  async waitForFonts() {
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.load('700 40px "Gaegu"');
        await document.fonts.load('400 26px "Gaegu"');
        await document.fonts.load('400 24px "Noto Sans KR"');
        await document.fonts.ready;
      } catch (e) {
        // 폰트 로드 실패해도 기본 폰트로 계속 진행
      }
    }
  },

  async buildSheetCanvas() {
    await this.waitForFonts();

    const canvas = document.createElement("canvas");
    canvas.width = this.SHEET_W;
    canvas.height = this.SHEET_H;
    const ctx = canvas.getContext("2d");
    const C = this.COLORS;

    // 배경 (종이 느낌)
    ctx.fillStyle = C.paper;
    ctx.fillRect(0, 0, this.SHEET_W, this.SHEET_H);

    // 외곽 카드 테두리
    const margin = 30;
    this.drawRoundedRect(
      ctx,
      margin,
      margin,
      this.SHEET_W - margin * 2,
      this.SHEET_H - margin * 2,
      24
    );
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    ctx.stroke();

    // 상단 헤더 바
    const headerH = 90;
    ctx.fillStyle = C.ink;
    this.drawRoundedRect(ctx, margin, margin, this.SHEET_W - margin * 2, headerH, 24);
    ctx.fill();
    // 헤더 하단 각짐 보정 (라운드가 아래쪽까지 적용되지 않도록 사각형 덧그리기)
    ctx.fillRect(margin, margin + headerH - 24, this.SHEET_W - margin * 2, 24);

    ctx.fillStyle = C.accentSoft;
    ctx.font = '700 22px "Noto Sans KR", sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText("CHARACTER FILE", margin + 32, margin + 30);

    ctx.fillStyle = "#ffffff";
    ctx.font = '700 40px "Gaegu", "Noto Sans KR", sans-serif';
    const nameText = Character.info.name || "이름을 입력해주세요";
    ctx.fillText(nameText, margin + 32, margin + 62);

    // 캐릭터 초상 프레임 (인쇄 시 캐릭터가 크게 보이도록 원본 해상도에 가깝게 확대)
    const pad = 20;
    const binderSpace = 30;
    const printScale = 0.95; // 600x800 원본 대비 배율 (1.0 이하로 유지해 확대로 인한 흐림 방지)
    const drawW = CANVAS_WIDTH * printScale;
    const drawH = CANVAS_HEIGHT * printScale;
    const frameW = drawW + pad * 2 + binderSpace;
    const frameH = drawH + pad * 2;
    const frameX = (this.SHEET_W - frameW) / 2;
    const frameY = margin + headerH + 30;

    ctx.fillStyle = C.panel;
    this.drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 18);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = C.ink;
    this.drawRoundedRect(ctx, frameX, frameY, frameW, frameH, 18);
    ctx.stroke();

    this.drawBinderHoles(ctx, frameX, frameY, frameH);

    // 캐릭터 레이어 그리기 (body -> clothes -> face -> hair)
    const layers = await Character.loadCurrentLayers();
    const drawX = frameX + pad + binderSpace;
    const drawY = frameY + pad;

    // 선화가 축소/확대될 때 뭉개지지 않도록 고품질 리샘플링 사용
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    for (const img of layers) {
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
    }

    // 색칠 레이어 합성 (동일한 위치/크기로)
    if (Character.paintData.canvas) {
      ctx.drawImage(Character.paintData.canvas, drawX, drawY, drawW, drawH);
    }

    // 정보 패널 시작 y
    let cursorY = frameY + frameH + 45;
    const panelX = margin + 40;
    const panelW = this.SHEET_W - margin * 2 - 80;

    ctx.textBaseline = "alphabetic";

    // 성격 한 줄
    ctx.fillStyle = C.muted;
    ctx.font = '400 20px "Noto Sans KR", sans-serif';
    ctx.fillText("성격", panelX, cursorY);
    ctx.fillStyle = C.ink;
    ctx.font = '400 26px "Noto Sans KR", sans-serif';
    const personalityLines = this.wrapText(
      ctx,
      Character.info.personality || "-",
      panelW
    );
    let py = cursorY + 34;
    personalityLines.slice(0, 2).forEach((line) => {
      ctx.fillText(line, panelX, py);
      py += 34;
    });
    cursorY = py + 20;

    // 구분선
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(panelX, cursorY);
    ctx.lineTo(panelX + panelW, cursorY);
    ctx.stroke();
    cursorY += 40;

    // 능력치 섹션 타이틀
    ctx.fillStyle = C.ink;
    ctx.font = '700 30px "Gaegu", "Noto Sans KR", sans-serif';
    ctx.fillText("능력치", panelX, cursorY);
    cursorY += 45;

    const abilities = [
      { label: "강점", value: Character.info.strength },
      { label: "약점", value: Character.info.weakness }
    ];

    for (const ability of abilities) {
      ctx.fillStyle = C.accent;
      ctx.font = '700 22px "Noto Sans KR", sans-serif';
      ctx.fillText(ability.label, panelX, cursorY);

      ctx.fillStyle = C.ink;
      ctx.font = '400 24px "Noto Sans KR", sans-serif';
      const valueText = ability.value || "-";
      const valueLines = this.wrapText(ctx, valueText, 230);
      ctx.fillText(valueLines[0] || "-", panelX + 110, cursorY);

      // 오른쪽 정렬 게이지 5칸
      const gaugeTotalWidth = 5 * (26 + 10) - 10;
      const gaugeX = panelX + panelW - gaugeTotalWidth;
      this.drawGauges(ctx, gaugeX, cursorY - 22);

      cursorY += 60;
    }

    return canvas;
  },

  sanitizeFilename(name) {
    const cleaned = (name || "character").trim().replace(/[\\/:*?"<>|]/g, "");
    return cleaned || "character";
  },

  async downloadPNG() {
    // file://로 index.html을 직접 열면 브라우저 보안 정책(캔버스 오염 방지)으로
    // 이미지를 다시 읽어내는 저장 기능이 차단됩니다. 미리 안내합니다.
    if (location.protocol === "file:") {
      throw new Error(
        "PNG 저장은 파일을 더블클릭해서 열었을 때(file://)는 브라우저 보안 정책으로 동작하지 않습니다. " +
          "터미널에서 'python3 -m http.server' 실행 후 http://localhost:8000 으로 접속하거나, " +
          "GitHub Pages에 올려서 사용해주세요."
      );
    }

    const canvas = await this.buildSheetCanvas();
    const filename = `character-sheet-${this.sanitizeFilename(Character.info.name)}.png`;

    const blob = await new Promise((resolve, reject) => {
      canvas.toBlob((b) => {
        if (b) {
          resolve(b);
        } else {
          reject(new Error("PNG 파일 생성에 실패했습니다. 이미지가 모두 정상적으로 로드되었는지 확인해주세요."));
        }
      }, "image/png");
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
