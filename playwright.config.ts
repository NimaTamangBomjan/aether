import { defineConfig } from "@playwright/test";

// Port 3000 matches the local sign-in service's site address, so emailed links come back here.
const PORT = Number(process.env.E2E_PORT ?? 3000);
export const FAKE_AI_PORT = 4010;
export const FAKE_EMAIL_PORT = 4011;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    timezoneId: "America/New_York",
    locale: "en-US",
  },
  projects: [
    {
      name: "phone",
      use: {
        browserName: "chromium",
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      },
    },
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: `node tests/fake-ai/server.mjs`,
      url: `http://127.0.0.1:${FAKE_AI_PORT}/requests`,
      reuseExistingServer: false,
    },
    {
      command: `node tests/fake-email/server.mjs`,
      url: `http://127.0.0.1:${FAKE_EMAIL_PORT}/emails`,
      reuseExistingServer: false,
    },
    {
      command: `npm run build && npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        // The app talks to the local stand-in, never the real AI service, during browser tests.
        ANTHROPIC_API_KEY: "test-key-not-real",
        ANTHROPIC_BASE_URL: `http://127.0.0.1:${FAKE_AI_PORT}`,
        AI_TIMEOUT_MS: "3000",
        // Webhook signatures are checked with this test-only secret; Stripe itself isn't contacted.
        STRIPE_WEBHOOK_SECRET: "whsec_local_test_secret_not_real",
        // Emails go to a local stand-in that records them.
        RESEND_API_KEY: "re_test_not_real",
        RESEND_BASE_URL: `http://127.0.0.1:${FAKE_EMAIL_PORT}`,
        EMAIL_FROM: "GiftLedger <hello@giftledger.test>",
        CRON_SECRET: "test-cron-secret-0123456789",
        UNSUBSCRIBE_SECRET: "test-unsubscribe-secret-0123456789",
        NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
      },
    },
  ],
});
