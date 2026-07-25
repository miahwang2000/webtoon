// ⚠️ 이 파일은 절대 공개 GitHub 저장소에 커밋하지 마세요.
// .gitignore 에 이미 config.js 가 포함되어 있습니다.
//
// 실제 배포(학생들이 접속하는 GitHub Pages 등)를 할 때는
// 이 키를 그대로 두면 누구나 브라우저 개발자 도구에서 볼 수 있습니다.
// 배포 전에는 반드시 서버리스 프록시(Cloudflare Workers, Vercel Functions 등)
// 뒤로 키를 옮기는 것을 권장합니다. README.md 참고.

window.APP_CONFIG = {
  // Google AI Studio에서 발급받은 Gemini API 키
  GEMINI_API_KEY: "AQ.Ab8RN6KGo78aqyhT2Hi1JRwiURT7vPZH8hqNznxiYW_e8pbHow",

  // 사용할 이미지 생성 모델 (Gemini 2.5 Flash Image / "나노바나나")
  GEMINI_MODEL: "gemini-2.5-flash-image",

  // (선택) Stickman Class에서 쓰던 것과 같은 Cloudinary unsigned upload 설정.
  // 채워두면 STEP 5 제출 시 선생님이 모든 기기에서 볼 수 있는 클라우드 저장이 되고,
  // 비워두면 학생 브라우저 로컬 저장 + PNG 다운로드만 동작합니다.
  CLOUDINARY_CLOUD_NAME: "",
  CLOUDINARY_UPLOAD_PRESET: ""
};
