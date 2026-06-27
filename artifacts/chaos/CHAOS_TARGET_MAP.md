# CHAOS_TARGET_MAP

1. Billing state machine (`routes/billing.ts`):

- Attack surface: webhook signature validation, subscription lifecycle transitions, checkout/portal toggles, timeout and upstream error handling.
- Why high-risk: mixed authenticated/unauthenticated boundaries plus async external dependency behavior.

2. Auth and API-key gate (`middlewares/auth.ts`, `routes/auth.ts`, `routes/api-keys.ts`):

- Attack surface: session vs bearer token path selection, malformed scopes, revoked/expired key behavior.
- Why high-risk: authorization decisions rely on request-scoped state mutations and method-sensitive scope checks.

3. Cluster/keyword/brief mutation graph (`routes/clusters.ts`, `routes/keywords.ts`, `routes/briefs.ts`):

- Attack surface: malformed IDs, cross-entity linkage, repeated out-of-order transitions.
- Why high-risk: multi-step workflow with state transitions and side effects (AI-task enqueue, updates, approvals).

4. Integration credential and provider boundary (`routes/integrations.ts`, `lib/integration-credentials.ts`, `lib/keyword-adapters.ts`):

- Attack surface: malformed credential payloads, decrypt edge cases, fallback parsing for third-party responses.
- Why high-risk: encryption envelope state plus external fetch adapters with varied payload formats.

5. Webhook emission and delivery persistence (`lib/webhook-emitter.ts`, `routes/webhooks.ts`):

- Attack surface: delivery retries/timeouts, connection failures, payload signing.
- Why high-risk: asynchronous fan-out under failures can produce data races and delivery-state drift.
