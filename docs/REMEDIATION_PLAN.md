# Remediation Plan — Code vs SRS v3.3 Consistency Fixes

> **Basis:** Consistency audit (code vs SRS v3.3) — 4 Must violations (❌), 8 deviations (⚠️), plus minor findings.
> **Goal:** Restore full SRS compliance for all Must requirements, close functional deviations, and refactor toward a cleaner architecture — **without breaking the 17 verified-compliant items**.
>
> **Golden rule for this plan:** every fix ships with a test that exercises the *requirement end-to-end*, not the implementation. Finding #1 exists precisely because tests injected the data that production code should have produced. That class of bug must become impossible.

---

## Guiding principles

1. **Behavior first, structure second.** Phase 1 (P0) fixes are minimal, surgical changes to make the Must requirements work. The refactor (Phase 3) only starts after Phase 1 is green.
2. **One source of truth per business rule.** Several findings (#1, #4, #7, #10) are variants of the same disease: the same rule implemented twice in two places that drifted apart. Fixes must consolidate, not patch locally.
3. **No test may mock/stub the thing it claims to verify.** Tests for the order flow must obtain the `summary_ref` from the real tool execution path, never seed the summary store manually.
4. **Deviations we choose to keep get documented, not silently ignored** (Phase 4 → SRS amendment log).

---

## Phase 1 — P0: Critical Must violations (blocks the demo)

### Fix 1.1 — Order flow is dead end-to-end (Finding #1, FR-SA-05 / FR-SMS-06 / UC-02)

**Root cause:** `ToolExecutor.build_order_summary` (`backend/app/ai/tools.py:79-121`) constructs an `OrderSummary` with a fresh `summary_ref` and returns it — but never persists it. `chat_confirm.py:29` calls `summary_store.get(ref)` → always `None` → always `410 SUMMARY_EXPIRED`.

**Change:**
- `backend/app/ai/tools.py` — after successfully building the summary, call `summary_store.put(summary)` before returning. Import `app.services.summary_store`.
- Do **not** fix this in `sales_agent.py` instead: the tool layer is the single place where summaries are born, so it must be the single place where they are stored. This covers both channels (Web + WhatsApp) at once.

**Regression test (the important part):**
- New test in `backend/tests/test_orders.py` (or a new `test_flow_e2e.py`):
  1. Seed a product with stock.
  2. `POST /chat/{id}/messages` with a message that triggers `build_order_summary` (mock LLM that emits the tool call, real `ToolExecutor`).
  3. Assert the reply contains `order_summary.summary_ref`.
  4. `POST /chat/{id}/confirm` with **that ref** (no manual `summary_store.put`!).
  5. Assert `200`, order `CONFIRMED`, stock decremented.
- Remove/rewrite the manual `summary_store.put` injections in existing tests so they use the real path (keep at most one narrow unit test for store TTL behavior).

**Acceptance:** UC-02 Flow 1 works through the public API with zero test-only scaffolding. Acceptance Criteria #6 (web channel) satisfied.

### Fix 1.2 — Action Assistant has no entry point (Finding #2, FR-AA-01 / UC-04)

**Root cause:** `ActionAssistant.create_draft` (`backend/app/ai/action_agent.py`) is fully implemented but unreachable: no route calls it, and `frontend/app/pages/admin/actions/` has no instruction UI.

**Change:**
- `backend/app/api/routes/ai_actions.py` — add:
  ```
  POST /ai-actions/draft   (owner-only; router already has dependencies=[Depends(require_owner)])
  Body: { "instruction": str }
  → calls ActionAssistant(db).create_draft(instruction, requested_by=user.id)
  → returns AIActionOut (status DRAFT)
  ```
  Add `DraftRequest` schema in `backend/app/schemas/ai.py`.
- `frontend/app/pages/admin/actions/index.vue` — add an instruction panel: textarea + "Buat Draft dengan AI" button → calls the new endpoint → refreshes the draft list. Reuse existing list/approve/reject components.

**Tests:**
- `test_ai_actions.py`: `POST /ai-actions/draft` with a mocked LLM tool-call → `201`, action `DRAFT`, audit logged; unauthenticated → `401`; non-owner → `403`; garbled instruction → `422` with the friendly error from `create_draft`.

**Acceptance:** UC-04 steps 1–2 executable from the admin UI.

### Fix 1.3 — Analyst endpoint publicly accessible (Finding #3, FR-AUTH-02 / NFR-03 / UC-03)

**Root cause:** `POST /chat/analyst/ask` (`backend/app/api/routes/chat.py:58`) lives in the intentionally-public `/chat` router with no auth dependency.

**Change (choose A, prefer A):**
- **A.** Add `user: User = Depends(require_owner)` to the endpoint and keep the path (frontend already sends the Bearer token — verify in the analytics page composable). Document that FR-SMS-07 "public chat" refers to the *customer* chat endpoints (`/start`, `/{id}/messages`, `/{id}/confirm`), not the analyst query.
- ~~B. Move to `analytics.py` router~~ — rejected: breaks the existing frontend path for no benefit.

**Tests:** `test_chat.py` — no token → `401`; customer-role token (if any) → `403`; owner token → `200`.

**Acceptance:** UC-03 actor is authenticated; FR-AUTH-02 holds for all internal endpoints.

### Fix 1.4 — WhatsApp `CONFIRM:` reply not handled (Finding #4, FR-SA-05 WA channel / UC-02 E5,E7)

**Root cause:** `provider_meta.py:53` correctly parses `button_reply.id = "CONFIRM:<ref>"` into message text, but `WhatsAppAdapter._route_to_agent` (`adapter.py:61`) treats every inbound message as free-form chat — the `CONFIRM:` prefix is never intercepted, so it reaches the LLM as noise and no order is ever created. Compounding: every message creates a *new* conversation, so the confirm handler would have no conversation context even if it existed.

**Change — restructure `WhatsAppAdapter._route_to_agent`:**
1. **Conversation reuse:** find the customer's most recent `OPEN` WHATSAPP conversation; only `ConversationService.create()` if none exists. (Also addresses the WhatsApp half of Finding #10.)
2. **Intercept the confirm event before the agent:**
   ```
   if msg.content.startswith("CONFIRM:"):
       ref = msg.content.split(":", 1)[1]
       → OrderService.create_from_summary(db, conversation_id, channel="WHATSAPP",
             customer_identity from existing customer record,
             items from summary_store.get(ref),
             idempotency_key=stable key derived from ref)   # ref-stable, matching web behavior
       → reply "Pesanan #<id> dikonfirmasi ✅" ; set outcome ORDERED
       → if summary expired → reply asking to rebuild the order (mirror 410 semantics)
   elif msg.content == "CANCEL": → close/cancel politely
   else: → normal agent path
   ```
   The interactive button is the explicit-confirmation event per FR-SA-05 — it must **never** be forwarded to the LLM.
3. Keep `chat_confirm.py` as the canonical web path; the adapter calls `OrderService` directly (same service, same validations, same audit) to avoid an HTTP self-call.

**Tests (webhook-level, using MockWhatsAppProvider):**
- Send product inquiry webhook → reply contains interactive buttons with `CONFIRM:<ref>`; assert `summary_store.get(ref)` is not None (real path!).
- Send `CONFIRM:<ref>` button-reply webhook → order created, `CONFIRMED`, stock decremented, outcome `ORDERED`.
- Send `CONFIRM:<bogus>` → graceful "expired" reply, no 500.
- Double-send the same button reply (webhook retry) → idempotent, one order.

**Acceptance:** UC-02 completes on WhatsApp independently; Acceptance Criteria #6 fully satisfied for both channels.

---

## Phase 2 — P1: Functional deviations (behavior gaps)

### Fix 2.1 — 24h window never opens (Finding #5, FR-SA-07 / §8.4)

- `provider_meta.py`: populate the `_seen_sessions` structure when an inbound **customer** message is parsed (record `sender_id → timestamp`), and have `check_24h_window(customer_ref)` consult it. On send: within window → free-form message; outside → template.
- Test: parse inbound → `check_24h_window` returns True; synthetic old timestamp → False → provider called with `is_template=True`.

### Fix 2.2 — Price mismatch: scheduled promo discounted in summary but not in order (Finding #7, UC-02 step 5)

- `PromotionService.effective_status()`: a promo with `start_date > now` must **not** return `ACTIVE` (return `SCHEDULED`). 
- **Consolidate:** make `OrderService._active_promotion()` use `effective_status()` instead of its own `start_date <= utcnow()` check — one definition of "active promotion", used by summary and order alike. Add a property test: for every promotion state, `build_order_summary` total == `create_from_summary` total.
- Test: promo with future `start_date` → summary shows no discount AND order total matches summary.

### Fix 2.3 — Async EXPIRED job (Finding #6, FR-SMS-05 BR-1)

- Add an APScheduler job (already in requirements) started in `app/main.py` lifespan: every N minutes call `PromotionService.expire_due(db)` which flips `ACTIVE → EXPIRED` where `end_date < now` in a single UPDATE. Keep refresh-on-read as a belt-and-braces.
- Alternatively (cheaper): document refresh-on-read as the accepted mechanism in the deviation log — decide with the team; the SRS text says "background job", so implementing it is the low-risk path to compliance.

### Fix 2.4 — Multi-item context across turns (Finding #10, §2.4)

- The conversation-context half is fixed by 1.4 (conversation reuse). 
- Optionally strengthen the Sales Agent prompt: when calling `build_order_summary`, instruct the LLM to include **all** items mentioned during the session (the conversation history is already in its context). Add one multi-turn test: item A mentioned in turn 1, item B in turn 3 → summary contains both.

---

## Phase 3 — P1/P2: Clean-architecture refactor

The layering (api → services → models; ai and channels as separate edge modules) is already sound. The refactor targets readability, single-responsibility, and the smells found in the audit. **Constraint: no behavior changes without a covering test; run the full suite after each step.**

| # | Item | Change |
|---|------|--------|
| R1 | Self-import hack `from app.channels.whatsapp.adapter import _seen` inside its own method (`adapter.py:_is_new_message`) | Move `_seen` into a small `WebhookDedupe` class (or module-level in `provider` layer) with `seen(id) -> bool`; inject or import cleanly |
| R2 | `import("app.models", ...)` dynamic-import hack in `PATCH /promotions` | Import the model(s) normally at module top; if the reason was a circular import, fix the cycle (likely model ↔ schema coupling) |
| R3 | `chat_confirm.py` inline `from app.models import Customer` inside function body | Hoist to module imports |
| R4 | Dead conversation states `NO_MATCH / ABANDONED / ERROR` never set | Either wire them minimally (ERROR on agent exception; ABANDONED when conversation closed without order) or remove until needed — pick with team; document choice |
| R5 | `IDEMPOTENCY_TTL_MINUTES` configured but no purge | Add purge to the same APScheduler job from Fix 2.3 (single background-maintenance job class) |
| R6 | `LLM_MONTHLY_BUDGET_IDR` in `.env` but ignored by Settings | Add to `Settings` (even if only logged at startup) or delete from `.env.example` — silent no-op config is a trap |
| R7 | Generic analyst disclaimer vs §2.6/FR-BA-05 cross-channel disclaimer | Use the SRS-specified wording whenever `channel_distribution` data is included in an answer |
| R8 | `WhatsAppAdapter` doing routing + confirmation + customer provisioning in one class | Split into `WhatsAppAdapter` (protocol/normalization) + `InboundRouter` (confirm-intercept vs agent routing) so the confirm logic is unit-testable without webhook payloads |
| R9 | `ToolExecutor.call` via `getattr` on self | Make an explicit dispatch dict of tool name → coroutine; unknown tool → error without reflection |
| R10 | Test hygiene (root cause of Finding #1) | Introduce the rule in `tests/conftest.py` docstring + review checklist: no test may call `summary_store.put` / seed entities that production code is responsible for creating |

Not in scope (explicitly): introducing a full hexagonal/ports-and-adapters rewrite, repository pattern over SQLAlchemy, or CQRS. The current service-layer architecture already satisfies the SRS's clean separation (NFR-06 verified); a big-bang rewrite before the capstone demo is risk without payoff.

---

## Phase 4 — P2: Documentation & SRS amendments (thesis defense)

Create **`docs/SRS_AMENDMENTS.md`** — a numbered deviation log referencing SRS v3.3 sections, each entry: what deviates, why (design decision), and status (ratified / pending). Minimum entries:

1. **#8 Insufficient-stock semantics** — code rejects the whole order atomically instead of dropping per-item; stricter than SRS; recommend ratifying the code behavior (safer, matches FR-SMS-06 atomicity) and amending UC-02 5a/E3 wording.
2. **#9 STAFF role** — not in SRS §2.2; either document STAFF as an implementation role with restricted permissions, or restrict STAFF (e.g., no direct `POST /promotions` as ACTIVE). Decision needed from team.
   → **KEPUTUSAN (terekam):** STAFF dihapus total; semua operasi internal langsung Owner. Lihat `SRS_AMENDMENTS.md` B2.
3. **#11 Tool layer as REST + services** — SRS §5.2 lists `create_order`, `approve_draft`, `execute_draft`, `log_audit`, `receive/send_channel_message` as LLM tools; implemented as backend endpoints/services intentionally (safer: confirmation and approval are human-triggered events, not LLM tool calls). Keep the decision, fix the misleading comments in `tools.py` that cite §5.2 as mandating it.
4. **#12 Customer profile timing** — created at `chat/start` instead of "first order"; document as a pragmatic deviation.
5. **#10 `build_order_summary(items)` vs spec's `(conversation_id)`** — after Fix 2.4, note that item aggregation relies on LLM + conversation history rather than a server-side session cart (consistent with C7 no-Cart).
6. Fix 2.3's decision (scheduler vs refresh-on-read), once made.

Also update `docs/API_DESIGN.md` with the new `POST /ai-actions/draft` endpoint and the auth requirement on `/chat/analyst/ask`.

---

## Execution order & effort

| Step | Content | Depends on | Effort |
|------|---------|-----------|--------|
| 1 | Fix 1.1 + regression tests | — | S (the one-liner) + M (tests) |
| 2 | Fix 1.3 (analyst auth) | — | S |
| 3 | Fix 1.2 (draft endpoint + UI) | — | M |
| 4 | Fix 1.4 (WA confirm + conversation reuse) | 1.1 (summary must be stored) | M/L |
| 5 | Fix 2.1, 2.2 (window, price consistency) | — | S each |
| 6 | Fix 2.3 / 2.4 + R5 (scheduler) | — | S/M |
| 7 | Refactor R1–R10 | Steps 1–6 green | M |
| 8 | `SRS_AMENDMENTS.md` + doc updates | team decisions on #8, #9 | S |

Steps 1–3 are independent and can be parallelized. **Step 1 alone revives the core feature**; step 4 completes the second channel.

## Definition of Done (per fix)

- [ ] Behavior matches the SRS requirement it fixes (re-checked against the SRS text, not this report).
- [ ] At least one test exercises the requirement through public entry points (API route or webhook) without seeding production-managed data.
- [ ] Full backend suite green; frontend builds.
- [ ] Deviation log updated if the fix itself introduces a documented design choice.

## Final verification gate (after all phases)

1. Re-run the audit checklist from the consistency report — targets: **0 ❌ on Must items**, all ⚠️ either fixed or logged in `SRS_AMENDMENTS.md`.
2. Manual demo rehearsal of UC-01, UC-02 (web + WhatsApp), UC-03, UC-04 against seeded data.
3. `docker compose up` from clean state → all flows work (NFR-11).
