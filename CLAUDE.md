# Quarrel

## Testing Requirements
- All new features and bug fixes must include tests
- API routes: integration tests in `apps/api/src/__tests__/` using bun:test with in-memory SQLite
- Web components: unit tests in `apps/web/src/__tests__/components/` using vitest + testing-library
- E2E flows: playwright tests in `apps/web/e2e/`
- Run API tests: `cd apps/api && bun test`
- Run web unit tests: `cd apps/web && npx vitest run`
- Run E2E tests: `cd apps/web && npx playwright test`

## Analytics
- All user-facing actions must capture PostHog events via `analytics.capture()`
- Event naming convention: `domain:action` (e.g., `friend:request_sent`, `auth:login`)
- Verify analytics calls in component tests by mocking `../../lib/analytics`
