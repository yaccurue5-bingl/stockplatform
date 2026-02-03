export const dynamic = 'force-dynamic'; // 빌드 시 오류 방지

import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 발신자 이메일 (Resend에서 인증된 도메인)
const FROM_EMAIL = 'K-MarketInsight <support@k-marketinsight.com>';

interface SendEmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  // 로깅용 옵션
  mailType?: string;
  corpName?: string;
  stockCode?: string;
  sector?: string;
  metadata?: Record<string, unknown>;
}

// 메일 로그 저장 함수
async function logEmail(params: {
  resendId?: string;
  recipient: string;
  subject: string;
  mailType: string;
  corpName?: string;
  stockCode?: string;
  sector?: string;
  status: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}) {
  try {
    await supabase.from('mail_logs').insert({
      resend_id: params.resendId,
      recipient: params.recipient,
      subject: params.subject,
      mail_type: params.mailType,
      corp_name: params.corpName,
      stock_code: params.stockCode,
      sector: params.sector,
      status: params.status,
      error_message: params.errorMessage,
      metadata: params.metadata || {},
    });
  } catch (err) {
    console.error('Failed to log email:', err);
  }
}

export async function POST(request: Request) {
  try {
    const body: SendEmailRequest = await request.json();
    const { to, subject, html, text, mailType, corpName, stockCode, sector, metadata } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const recipients = Array.isArray(to) ? to : [String(to)];

    // Resend로 이메일 발송
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: recipients,
      subject: subject,
      html: html || '',
      text: text || undefined,
    });

    if (error) {
      console.error('Resend error:', error);

      // 실패 로그 저장
      for (const recipient of recipients) {
        await logEmail({
          recipient,
          subject,
          mailType: mailType || 'general',
          corpName,
          stockCode,
          sector,
          status: 'failed',
          errorMessage: error.message,
          metadata,
        });
      }

      return NextResponse.json({ error }, { status: 500 });
    }

    // 성공 로그 저장
    for (const recipient of recipients) {
      await logEmail({
        resendId: data?.id,
        recipient,
        subject,
        mailType: mailType || 'general',
        corpName,
        stockCode,
        sector,
        status: 'sent',
        metadata,
      });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
