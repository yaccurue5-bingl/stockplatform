/**
 * Super Admin Configuration
 * 슈퍼계정은 모든 기능에 접근 가능
 */

export const SUPER_ADMIN_EMAILS = [
  'yaccurue3@naver.com',
  'yaccurue5@gmail.com',
];

export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}
