import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

// 발신자 이메일 (Resend에서 인증된 도메인 필요)
const FROM_EMAIL = 'K-MarketInsight <noreply@k-marketinsight.com>';

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

    // 필수 필드 검증
    if (!to || !subject) {
      return NextResponse.json(
        { error: 'Missing required fields: to, subject' },
        { status: 400 }
      );
    }

    if (!html && !text) {
      return NextResponse.json(
        { error: 'Either html or text content is required' },
        { status: 400 }
      );
    }

    // Resend로 이메일 발송
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || undefined,
      text: text || undefined,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json(
        { error: 'Failed to send email', details: error.message },
        { status: 500 }
      );
    }

    console.log('Email sent successfully:', data);
    return NextResponse.json(
      { success: true, messageId: data?.id },
      { status: 200 }
    );
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
