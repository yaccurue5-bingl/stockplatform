-- user_events는 hooks/useTrack.ts(클라이언트 anon/authenticated 키)에서 직접 insert된다.
-- 기존 정책은 authenticated 역할만 커버했고 anon 역할용 정책이 없어서,
-- 비로그인 방문자의 트래킹 이벤트(page_view, disclosure_click 등)가 전부
-- "new row violates row-level security policy for table user_events"로 조용히 실패하고 있었다
-- (useTrack의 catch{}가 실패를 삼켜서 사용자 경험엔 영향 없었지만 익명 트래픽 분석 데이터가 유실됨).
--
-- anon은 auth.uid()가 항상 null이므로 user_id를 반드시 null로만 허용 —
-- 익명 요청이 다른 유저의 user_id를 사칭해서 넣는 것을 방지한다.
CREATE POLICY "anon can insert anonymous events" ON public.user_events
  FOR INSERT TO anon
  WITH CHECK (user_id IS NULL);
