import "@testing-library/jest-dom/vitest";

// Stub environment variables for tests
process.env.OPENAI_API_KEY = "test-openai-key";
process.env.REPLICATE_API_TOKEN = "test-replicate-token";
process.env.R2_ACCOUNT_ID = "test-account";
process.env.R2_ACCESS_KEY_ID = "test-access-key";
process.env.R2_SECRET_ACCESS_KEY = "test-secret-key";
process.env.R2_BUCKET_NAME = "test-bucket";
process.env.R2_PUBLIC_URL = "https://test-r2.example.com";
process.env.DATABASE_URL = "file:./test.db";
process.env.STRIPE_SECRET_KEY = "sk_test_fake";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_fake";
process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_fake";
process.env.INNGEST_EVENT_KEY = "test-event-key";
process.env.INNGEST_SIGNING_KEY = "test-signing-key";
