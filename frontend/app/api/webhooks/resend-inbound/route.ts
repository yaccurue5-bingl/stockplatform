import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

const resend = new Resend(process.env.RESEND_API_KEY);

// 실제 받은편지함 (Gmail) — support@k-marketinsight.com으로 온 메일을 여기로 그대로 전달
const FORWARD_TO = process.env.CONTACT_RECIPIENT_EMAIL ?? '';
const FROM_EMAIL = 'K-MarketInsight <support@k-marketinsight.com>';

// Resend Dashboard → Webhooks → 이 엔드포인트 생성 시 발급되는 Signing Secret (whsec_...)
const WEBHOOK_SECRET = process.env.RESEND_INBOUND_WEBHOOK_SECRET ?? '';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (!WEBHOOK_SECRET) {
    console.error('[resend-inbound] RESEND_INBOUND_WEBHOOK_SECRET not set');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  let event;
  try {
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret: WEBHOOK_SECRET,
    });
  } catch (err) {
    console.error('[resend-inbound] signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (event.type !== 'email.received') {
    return NextResponse.json({ received: true });
  }

  if (!FORWARD_TO) {
    console.error('[resend-inbound] CONTACT_RECIPIENT_EMAIL not set — cannot forward');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  try {
    await resend.emails.receiving.forward({
      emailId: event.data.email_id,
      to: FORWARD_TO,
      from: FROM_EMAIL,
      passthrough: true,
    });
    console.log(
      `[resend-inbound] forwarded email_id=${event.data.email_id} from=${event.data.from} subject=${event.data.subject}`
    );
  } catch (err) {
    console.error('[resend-inbound] forward failed:', err);
    return NextResponse.json({ error: 'Forward failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
