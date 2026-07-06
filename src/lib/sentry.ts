import * as Sentry from '@sentry/react';

const DSN = "";
const ENVIRONMENT = "dashboard-6a46311c306ad0bac0864ae4";
const RELEASE = "0.0.196";
const APPGROUP_ID = "6a46311c306ad0bac0864ae4";

if (DSN) {
  Sentry.init({
    dsn: DSN,
    environment: ENVIRONMENT || undefined,
    release: RELEASE || undefined,
    sendDefaultPii: false,
    tracesSampleRate: 0,
  });
  if (APPGROUP_ID) {
    Sentry.setTag('appgroup_id', APPGROUP_ID);
  }
}

export { Sentry };
