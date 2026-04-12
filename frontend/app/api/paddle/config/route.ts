import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    developerPriceId: process.env.PADDLE_PRICE_ID_DEVELOPER ?? '',
    proPriceId: process.env.PADDLE_PRICE_ID_PRO ?? '',
  });
}
