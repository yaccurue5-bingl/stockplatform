CREATE TABLE IF NOT EXISTS public.sector_macro (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_en        TEXT NOT NULL,         -- 우리 12개 sector_en 분류
  year_month       TEXT NOT NULL,         -- "2026-02" 형식
  export_yoy       NUMERIC,              -- 수출 YoY 증감률 (%) - 양수=증가, 음수=감소
  prev_export_yoy  NUMERIC,              -- 전월 YoY 증감률 (모멘텀 계산용)
  export_amount_mn NUMERIC,              -- 수출 금액 (백만 달러)
  export_momentum  TEXT CHECK (export_momentum IN ('ACCELERATING','DECELERATING','STABLE')),
  macro_score      NUMERIC,              -- -1 ~ +1
  macro_label      TEXT CHECK (macro_label IN ('STRONG_TAILWIND','POSITIVE','NEUTRAL','NEGATIVE','HEADWIND')),
  source           TEXT DEFAULT '산업통상자원부',
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (sector_en, year_month)
);

ALTER TABLE public.sector_macro ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view sector_macro" ON public.sector_macro FOR SELECT USING (true);
CREATE INDEX IF NOT EXISTS idx_sector_macro_sector ON public.sector_macro(sector_en);
CREATE INDEX IF NOT EXISTS idx_sector_macro_date ON public.sector_macro(year_month DESC);
