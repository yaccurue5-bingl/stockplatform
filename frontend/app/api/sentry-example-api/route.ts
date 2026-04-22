import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

class SentryExampleAPIError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SentryExampleAPIError';
  }
}

export async function GET() {
  Sentry.logger.info('Sentry example API called');
  throw new SentryExampleAPIError(
    'This error is raised on the backend called by the example page.'
  );
  // eslint-disable-next-line no-unreachable
  return NextResponse.json({ name: 'John Doe' });
}
