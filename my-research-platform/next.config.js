// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 정적 배포 설정
  trailingSlash: true, // 주소 끝에 /를 붙여 404 방지
};
export default nextConfig;