import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 최신 공시 데이터 가져오기 (최대 10개)
    const { data: disclosures, error } = await supabase
      .from('disclosure_insights')
      .select('*')
      .order('analyzed_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching disclosures:', error);
      return NextResponse.json([]);
    }

    return NextResponse.json(disclosures || []);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json([]);
  }
}
