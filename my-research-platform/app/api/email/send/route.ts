export const dynamic = 'force-dynamic'; // 빌드 시 오류 방지

import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// 발신자 이메일 (Resend에서 인증된 도메인)
const FROM_EMAIL = 'K-MarketInsight <support@k-marketinsight.com>';

interface SendEmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
}

export async function POST(request: Request) {
  try {
    const body: SendEmailRequest = await request.json();
    const { to, subject, html, text } = body;

    if (!to || !subject) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [String(to)],
      subject: subject,
      html: html || '',
      text: text || undefined,
    });

    if (error) return NextResponse.json({ error }, { status: 500 });
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
