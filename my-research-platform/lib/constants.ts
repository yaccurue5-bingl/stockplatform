/**
 * 애플리케이션 상수
 */

// 슈퍼 관리자 이메일 목록
export const SUPER_ADMIN_EMAILS = [
  'yaccurue3@naver.com',
  'yaccurue5@gmail.com',
];

/**
 * 슈퍼 관리자 여부 확인
 */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
