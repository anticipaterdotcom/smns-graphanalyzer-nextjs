import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: 'https://db5b3df1e97047541141ba3a3bbc8678@o4508015640772608.ingest.de.sentry.io/4511271321272400',
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  integrations: [Sentry.replayIntegration()],
  debug: false,
});
