# WHMCS MCP Ops-Forensics Extension — Scoping Document

> This is an **index/scoping document**, not an executable implementation plan. It maps the full scope into phases; each phase will get its own detailed TDD-style plan once selected for execution.

## Target User

Ops manager at a hosting company (Libyan Spider). Uses the MCP through an LLM (Cursor/Claude) to diagnose and resolve cross-module issues: provisioning failures, invoicing discrepancies, complex hosting products, registrar/domain sync, and dunning.

## Current State (reconnaissance)

- `src/index.ts` — 1,939 lines, all MCP tool/prompt/resource registration in one file
- `src/whmcs-client.ts` — 1,492 lines, 70 methods, one giant class
- `src/test.ts` — 65-line smoke test; **no real test framework configured** (no jest/vitest/mocha)
- `package.json` `scripts.test` just runs the smoke test against live WHMCS

**Implications:**
1. Both existing files are past the "one clear responsibility" threshold. New work should land in new modules, and a phased refactor is needed.
2. No unit test harness exists. We must either add one (vitest recommended — fastest, TS-native) or accept integration-only testing against a mock WHMCS. **Decision needed from user.**
3. The live-API smoke test is currently blocked by the VPN/IP-allowlist issue — so integration testing against real WHMCS is unreliable for CI. Plan assumes a **mock WHMCS HTTP server** for tests.

## Architectural Refactor (Phase 0 — prerequisite for everything else)

Before bolting more tools onto 1,900-line files, split by responsibility:

```
src/
  whmcs/
    client.ts            # base HTTP caller only (~100 lines)
    types.ts             # shared response shape types
    domains/
      clients.ts         # GetClients, GetClientsDetails, ...
      invoices.ts
      tickets.ts
      products.ts
      servers.ts         # GetServers, ModuleCustom, Module*
      domains.ts         # registrar API actions
      system.ts          # GetStats, GetActivityLog, ...
  mcp/
    server.ts            # McpServer setup, transport wiring
    tools/
      clients.ts         # tool registrations per domain
      invoices.ts
      tickets.ts
      provisioning.ts    # NEW
      invoice-forensics.ts # NEW
      timeline.ts        # NEW
      products.ts
      domains.ts
      integrity.ts       # NEW
      actions.ts         # NEW (safe mutations)
    prompts/
      onboarding.ts      # existing
      investigate-service.ts # NEW
      investigate-invoice.ts # NEW
      client-triage.ts   # NEW
      audit-product.ts   # NEW
    resources/
      stats.ts           # existing resources split
      ...
  test/
    mock-whmcs.ts        # HTTP mock server for tests
    fixtures/            # JSON response fixtures per action
```

This is **not a big-bang rewrite** — we migrate one domain at a time as we touch it for new features.

## Phase Breakdown

Each phase is independently shippable and reviewable. Dependencies shown explicitly. Rough effort is in ideal engineer-hours assuming familiar stack (not calendar time).

### Phase 0 — Foundations *(prerequisite, ~6h)*
- Add vitest + mock WHMCS HTTP server + fixture loader
- Extract `WhmcsClient` base from the monolith (just the `call()` method + auth)
- Split `index.ts` into `mcp/server.ts` + tool-group files (carve out one domain as the migration template, e.g. `clients`)
- CI: add `npm test` that runs vitest against mocks (keep `npm run test:live` for the smoke test)
- **Deliverable:** identical behavior, new structure, green vitest suite covering migrated domain.
- **Ship criteria:** existing features still work; new test command passes; PR reviewable.

### Phase 1 — Provisioning forensics *(~10h, depends on Phase 0)*
**Why first:** biggest ops pain point; ~60% of hosting-ops tickets involve "why didn't this provision?" or "why did module command X fail?"

Tools:
- `whmcs_get_service_details` — full state of one service (via `GetClientsProducts` with filters + `GetOrders` join; surfaces config options, addons, assigned server, last sync)
- `whmcs_get_module_log` — read WHMCS module log for a service (uses `GetActivityLog` filtered by service + direct `ModuleCustom` where supported)
- `whmcs_get_module_queue` — pending/failed module ops across system (WHMCS API: `ModuleQueue` action if version ≥ 8.x — otherwise document fallback via `GetActivityLog`)
- `whmcs_resync_service` — safe wrapper: re-run last failed module command (guarded by explicit confirmation param)
- `whmcs_get_server_usage` — per-server active/limit, capacity headroom (from `GetServers` response + aggregation)

Tests: mock fixtures for each WHMCS response; one integration test per tool against mock server.

**Version-gate risk:** `ModuleQueue` was added in WHMCS 8.x. Plan must include a `GetWhmcsDetails` probe + graceful fallback.

### Phase 2 — Invoice & payment forensics *(~10h, depends on Phase 0)*
Tools:
- `whmcs_get_invoice_audit` — invoice with enriched line items: each line's origin (service renewal / addon / proration / manual), linked service IDs
- `whmcs_get_payment_attempts` — gateway attempts per invoice (successes + failures with gateway response codes); uses `GetTransactions` + activity log correlation
- `whmcs_get_orphan_transactions` — transactions with no invoice linkage (via `GetTransactions invoiceid=0` + cross-check)
- `whmcs_get_credit_history` — credit applied / refunded per client (via `GetCredits` action)
- `whmcs_get_dunning_log` — overdue reminders sent + next scheduled (via `GetEmails` filtered by template type + invoice state)

**Data-quality risk:** Some enrichment (e.g., line item origin) isn't directly exposed by the WHMCS API — we'll need to parse line descriptions or correlate with `GetClientsProducts.nextduedate`. Plan explicit fallback to "best-effort classification" with a `confidence` field.

### Phase 3 — Client 360 timeline *(~6h, depends on Phases 1+2 for richer output, but can ship with partial data)*
Tools:
- `whmcs_get_client_timeline` — chronological merge of orders / invoices / services / tickets / domain events for one client. Pure aggregation over existing calls.
- `whmcs_get_client_autoauth_url` — via `CreateSsoToken` action → one-click login URL

**Design choice to validate:** timeline window (default 90 days? all time?), pagination, whether to include internal activity log entries.

### Phase 4 — Product & configurable options audit *(~7h, depends on Phase 0)*
Tools:
- `whmcs_get_product_full` — product + configurable options + linked addons + server group + multi-currency pricing + available upgrade paths. Chains `GetProducts` + `GetConfigurableOptions` (if available — falls back to scraping product metadata) + `GetProducts addons=true`.
- `whmcs_get_product_addons` / `whmcs_get_client_addons`
- `whmcs_simulate_order` — dry-run order pricing (via WHMCS `OrderFraudCheck`-adjacent or in-memory calc — needs design spike)

**Spike required:** `simulate_order` — WHMCS has no native "price this combination" API. Either implement pricing logic client-side by pulling all relevant rates, or document as out-of-scope. **Design decision before implementation.**

### Phase 5 — Domain ops *(~5h, depends on Phase 0)*
Tools:
- `whmcs_domain_sync` — force registrar sync (via `DomainUpdateNameservers`/`DomainGetNameservers` cycle; actual sync uses `Domain*` WHMCS automation hooks — some versions expose `DomainSync`, others don't; include probe + fallback)
- `whmcs_get_pending_transfers` — via `GetClientsDomains` filtered by `status=Pending Transfer`
- `whmcs_get_upcoming_renewals` — via `GetClientsDomains` filtered by expiry window

### Phase 6 — Integrity / health checks *(~8h, depends on Phases 1+2+5)*
Tools:
- `whmcs_find_orphans` — services active in WHMCS with no corresponding cPanel account (requires server-side module API call per service — slow; must support paging + optional sampling)
- `whmcs_find_inconsistencies` — rule-based checks: invoices without services, products with no assigned server, clients with no services, recurring mismatch between service nextduedate and invoice cycle
- `whmcs_get_health_summary` — composite dashboard: module queue depth, failed transactions 24h, overdue aging buckets, provisioning success rate (last 7 days)

**Performance risk:** full-system scans are expensive. Plan includes: pagination, sampling mode, per-client scope option.

### Phase 7 — Composite investigative prompts *(~5h, depends on Phases 1–3)*
These are MCP **prompts** (not tools) — they guide the LLM through investigation chains using tools built in earlier phases. No new API work; just prompt engineering + argument schemas.
- `investigate_service` prompt — why is service X broken?
- `investigate_invoice` prompt — why is invoice Y unpaid?
- `client_incident_triage` prompt — full client diagnostic
- `audit_product` prompt — product + options + servers + recent provisioning success

### Phase 8 — Safe action tools *(~8h, depends on Phases 1+2)*
Mutating tools. Each requires an explicit `confirm: true` param in the schema, and logs the action.
- `whmcs_reprovision_service` — re-run create
- `whmcs_regenerate_invoice` — void + recreate (dangerous; needs UX review)
- `whmcs_apply_credit` — with reason field
- `whmcs_waive_late_fee`
- `whmcs_resend_welcome_email`

**Governance decision needed:** should mutating tools require a separate env flag (e.g., `WHMCS_ALLOW_MUTATIONS=true`) to enable? Recommended yes, to prevent accidents when a junior ops person is using the MCP.

## Total Scope

| Phase | Effort | Ships standalone? | Depends on |
|-------|--------|-------------------|-----------|
| 0. Foundations | ~6h | Refactor only, no UX change | — |
| 1. Provisioning forensics | ~10h | ✅ | 0 |
| 2. Invoice forensics | ~10h | ✅ | 0 |
| 3. Client timeline | ~6h | ✅ (richer after 1+2) | 0 |
| 4. Product audit | ~7h | ✅ (partial without `simulate_order` spike) | 0 |
| 5. Domain ops | ~5h | ✅ | 0 |
| 6. Integrity checks | ~8h | ✅ | 0, 1, 2, 5 |
| 7. Composite prompts | ~5h | ✅ | 1, 2, 3 |
| 8. Safe action tools | ~8h | ✅ | 0, 1, 2 |

**Total:** ~65 engineer-hours. MVP (0 → 1 → 2 → 3 → 7) = ~37h and covers the bulk of ops-manager value.

## Open Decisions Before Detailed Plans

1. **Test framework:** vitest (recommended) vs. extend current smoke-test approach?
2. **Mutation governance:** require separate env flag for Phase 8 tools?
3. **WHMCS version target:** which version does Libyan Spider run? Some API actions are version-gated (`ModuleQueue`, `GetCredits`, `CreateSsoToken`). Need to confirm before committing to specific actions.
4. **`simulate_order` scope:** implement client-side pricing logic, or cut from Phase 4?
5. **Mock fixtures:** do you have anonymized real WHMCS API responses we can use as fixtures, or should I generate synthetic ones from the API docs?
6. **Execution model:** ship the whole thing in sequence, or prioritize MVP (Phase 0, 1, 2, 3, 7) and re-scope later?

## Recommended Next Step

Answer the 6 decisions above, then I'll produce detailed TDD plans for Phase 0 + Phase 1 (the smallest shippable set that adds user-visible ops value). Each subsequent phase gets its own plan document.

Do **not** write all 9 detailed plans up front — Phase 0's outcome will shape the structure of every downstream plan, and WHMCS version findings may force scope changes in 1, 4, 5.
