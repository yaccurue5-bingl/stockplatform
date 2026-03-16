import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  // 1. Next.js의 기본 권장 설정 및 Core Web Vitals 설정 적용
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  
  // 2. 추가 규칙 설정 (필요시)
  {
    rules: {
      // 빌드 시 경고로만 취급하고 싶은 규칙이 있다면 여기에 추가
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
  
  // 3. 무시할 파일 설정
  {
    ignores: [".next/*", "out/*", "node_modules/*"],
  },
];

export default eslintConfig;