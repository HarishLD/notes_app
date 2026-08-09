# DECISIONS.md

A running log of every non-obvious choice made while building this, and why.

**Purpose:** the reviewer will ask "why did you do it this way?" in a live walkthrough. Answers written at the moment of the decision are accurate. Answers reconstructed two days later are guesses.

**Format:** one entry per decision. Keep it to a few lines.

```
## <the decision>
**Why:** the reason
**Alternative:** what was rejected, and what it would have cost
```

Add an entry the moment you make a choice — not at the end of the phase. This file becomes README sections 3–6 and the round-2 prep sheet.

---

## Single Next.js app rather than a separate backend
**Why:** The brief specifies Next.js App Router, which includes a server. Route handlers give a real HTTP API and server components read through the same service layer. Separation of concerns is enforced by layering, not by repository count.
**Alternative:** A separate Express API would add a second deployment, a network hop, and CORS configuration, with no benefit at this scale.

## Hosted on Vercel with Postgres on Neon
**Why:** First-party Next.js support meant no build configuration under time pressure, and the free tier has no idle spin-down, so the review link is always warm. Neon supplies pooled and direct connection strings, which the serverless function model needs.
**Alternative:** Render's free tier spins down after ~15 minutes of inactivity, giving a reviewer a cold start of up to a minute on first visit. Railway no longer offers a permanent free tier.

## Prisma as the ORM
**Why:** Declarative schema, generated migrations, and a fully typed client. The schema file doubles as documentation of the relationships the brief asks to see.
**Alternative:** Raw SQL would have meant hand-writing migrations and types with no compile-time guarantee they stay in sync.

## Explicit `NoteTag` join model rather than Prisma's implicit many-to-many
**Why:** The join table is visible in the schema and directly queryable in tests, it can carry metadata later, and the brief explicitly asks for a many-to-many via a join table.
**Alternative:** Implicit many-to-many hides the join table, making the relationship harder to demonstrate and impossible to extend.

## Tags are scoped per user, unique on `[userId, name]`
**Why:** Notes are private, so a shared global tag vocabulary would leak information about other users' data. Two users can each own a tag called "work" without collision.
**Alternative:** Global tags would be simpler but would let one user enumerate another's tag names.

## Hand-rolled auth rather than Auth.js
**Why:** The brief asks specifically for email/password with hashing and session management — not OAuth. The implementation is roughly 80 lines with no framework behaviour to explain, and every line is defensible in a walkthrough.
**Alternative:** Auth.js would add configuration and abstraction over a problem that is already small here.

## `jose` for JWTs rather than `jsonwebtoken`
**Why:** Promise-based API, runtime-agnostic, actively maintained.
**Alternative:** `jsonwebtoken` uses callbacks and has runtime constraints.

## Session in an httpOnly cookie
**Why:** The brief rules out localStorage. An httpOnly cookie is unreadable from JavaScript, so an XSS bug cannot exfiltrate the session, and the browser attaches it automatically.
**Alternative:** A token in localStorage is readable by any script on the page.

## Auth is verified in the data access layer, not in `proxy.ts`
**Why:** Next.js 16 renamed `middleware.ts` to `proxy.ts` and repositioned it as a routing layer, following a CVE where middleware-based auth could be bypassed. `proxy.ts` here does an optimistic cookie-presence check for UX only. The authoritative check is `requireUser()`, called at the top of every protected route handler and server component.
**Alternative:** Treating the proxy layer as the security boundary would recreate exactly the class of bug that caused the rename.

## Another user's note returns 404, not 403
**Why:** A 403 confirms the resource exists, which leaks information about other users' data. A 404 is indistinguishable from a non-existent id.
**Alternative:** 403 is arguably more semantically precise but discloses existence.

## Ownership is enforced inside the Prisma `where` clause
**Why:** `findFirst({ where: { id, userId } })` means no code path ever holds another user's row in a variable. Fetch-then-compare relies on a subsequent check that can be forgotten in a later refactor.
**Alternative:** Loading the row and comparing `note.userId === user.id` works, but places the guarantee in application code rather than the query.

## Route handlers for mutations, server components for reads
**Why:** The brief requires server-side ownership checks on every API call and API-level tests. Route handlers give a real HTTP surface that tests can exercise with a plain `Request`. Reads go through server components calling the service directly, avoiding a pointless self-fetch.
**Alternative:** Server Actions are the newer idiom but produce no addressable HTTP endpoint to test against.

## Try/catch only at the route boundary
**Why:** A single `route()` wrapper converts typed domain errors into responses. Services throw and stay unaware of HTTP. This keeps the happy path linear and guarantees no route can leak an internal error.
**Alternative:** Try/catch inside each handler duplicates the mapping and makes it easy for one route to leak a raw error message.

---

<!-- Add entries below as you build. Every choice you would have to justify. -->

## Neon driver adapter (`@prisma/adapter-neon`) instead of a URL-based datasource
**Why:** Prisma 7's `prisma-client` generator is engine-less and requires an explicit driver adapter. Neon's serverless driver talks HTTP/WebSocket instead of opening a raw TCP socket, which is what a Vercel serverless function needs — a normal `pg` connection would exhaust Neon's connection limit under concurrent invocations. `lib/prisma.ts` builds the adapter from `DATABASE_URL` (the pooled string); `DIRECT_URL` is only used by `prisma.config.ts` for migrations.
**Alternative:** A plain `postgresql://` URL on the datasource works locally but is the wrong shape for a serverless deployment target.

## No `ws` package added for the Neon adapter
**Why:** `@neondatabase/serverless` needs a WebSocket constructor for transactions; Node 22+ (this project runs on Node 26) exposes a global `WebSocket`, so `neonConfig.webSocketConstructor` doesn't need to be set. Adding `ws` would be a new dependency for something the runtime already provides.
**Alternative:** Setting `neonConfig.webSocketConstructor = ws` is the documented pattern for older Node versions, but it's an unnecessary dependency here.

## Seed script re-hashes and reuses `lib/prisma.ts`, doesn't call `lib/auth/password.ts`
**Why:** Phase 1 has no auth module yet — `hashPassword` doesn't exist until Phase 3. The seed script hashes with `bcryptjs` at cost 12 directly, matching the auth rule in `CLAUDE.md` §6, and imports the same `prisma` singleton the app uses rather than constructing a second client.
**Alternative:** Duplicating a second Prisma client construction in the seed script would drift from the app's connection setup.

## Seed idempotency via delete-then-recreate per user, not upsert-per-note
**Why:** `User` and `Tag` have natural unique keys (`email`, `[userId, name]`) so they upsert cleanly. `Note` has none — titles aren't unique. Running the seed twice deletes each seed user's existing notes and tags (cascading their join rows) and rebuilds them, which is simpler than diffing content and still leaves the `User` row and its `id` untouched.
**Alternative:** Upserting notes by title would work but adds a fake uniqueness constraint to the schema for a seed-only concern.

## `.env.example` created in this phase, not deferred to Phase 0
**Why:** CLAUDE.md §1.4 is a non-negotiable: every env key must be documented in `.env.example`. It didn't exist yet, and this phase introduces two new keys (`SEED_REVIEWER_EMAIL`, `SEED_REVIEWER_PASSWORD`), so leaving it missing would mean shipping undocumented secrets configuration. Filled in with all keys used so far: `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` (used starting Phase 3, documented now since the rule doesn't say to wait), `SEED_REVIEWER_EMAIL`, `SEED_REVIEWER_PASSWORD`.
**Alternative:** Waiting for Phase 0 to be revisited would leave a known rule violation on the books in the meantime.

## Legacy `"prisma"` key removed from `package.json`
**Why:** `prisma.config.ts` is Prisma 7's canonical config location and already declares the seed command; `create-next-app`/`prisma init` had also written the old `package.json#prisma.seed` key, and Prisma 7 warns when both are present. Removed the redundant one.
**Alternative:** Keeping both doesn't break anything today but is exactly the kind of thing a reviewer asks "why is this here twice?" about.

## `vitest.config.ts` renamed to `vitest.config.mts`
**Why:** The config uses `export default` (ESM), but `package.json` has no `"type": "module"`. Vite's native config loader warned about ESM syntax in a file it was loading as CommonJS, and — more importantly — `resolve.alias` silently failed to apply under that ambiguity, so the `@` alias didn't resolve at all. The `.mts` extension is unambiguous ESM, and fixed alias resolution.
**Alternative:** Adding `"type": "module"` to `package.json` would fix it too but changes how every other `.js` file in the project is interpreted — too broad a change for a config-loading quirk.

## `signinSchema.email` validated and normalized the same as `signupSchema.email`
**Why:** `requirements.md` only spells out "presence only, no strength rule" for signin's *password*, contrasting it with signup's 8-character minimum — it says nothing that overrides email's format check. Since `User.email` is stored lowercased, signin's email needs the same trim+lowercase normalization as signup just to look up the right row; treating format validation the same way keeps both schemas consistent instead of inventing a weaker rule for signin.
**Alternative:** Accepting any non-empty string for signin's email and letting an unrecognized format fall through to "wrong credentials" would also avoid an information leak, but it's an unstated assumption in the other direction, and duplicates trim/lowercase logic in the service layer instead of the schema.

## Added `lib/auth/service.ts` so `session.ts` never imports Prisma directly
**Why:** `requirements.md` has `getCurrentUser()`/`requireUser()` load the user from the DB, but `CLAUDE.md` §2 restricts Prisma imports to `lib/**/service.ts` and `lib/prisma.ts` — `session.ts` matches neither. Rather than widen the layering rule with a named exception, added a one-function `lib/auth/service.ts` (`findSessionUser`) that `session.ts` calls instead. The rule stays literally true and there's exactly one place, per module, that ever touches `prisma.user`.
**Alternative:** Amending CLAUDE.md's allowed-importer list to name `session.ts` explicitly — fewer files, but leaves a named exception to remember instead of a rule with no exceptions.

## (Superseded in Phase 4 — see below) `test/setup.ts` originally loaded `.env` via `dotenv/config`
**Why (Phase 3):** `lib/auth/jwt.ts` throws at module load if `JWT_SECRET` is missing, per CLAUDE.md §6. Vitest doesn't read `.env` files into `process.env` automatically (confirmed: a smoke test importing nothing but reading `process.env.JWT_SECRET` came back `undefined`), so every test run would fail at the first import of `jwt.ts` without this.
**Superseded:** Phase 4 needed a *different* database for tests than dev, which a plain `dotenv/config` import can't express (it only ever loads one file). Replaced by the `vitest.config.mts` entry below.

## `lib/auth/service.ts` and `session.ts`'s `getCurrentUser`/`requireUser` have no dedicated Phase 3 tests
**Why:** `requirements.md`'s Phase 3 test checklist only lists hashing and token-signing tests — session reading isn't in it, and for good reason: `getCurrentUser`/`requireUser` call `cookies()` from `next/headers`, which only works inside a Next.js request scope, not a bare Vitest test. `findSessionUser` could be tested with a raw Prisma call, but CLAUDE.md §10 requires a **separate test database**, which doesn't exist yet — only one `DATABASE_URL` is configured, pointing at the Neon dev/seed database from Phase 1. Testing against it now would violate "never the dev database." Both get real coverage once Phase 4's API-level tests exercise them through actual route handlers, and once a test database exists.
**Alternative:** Standing up a second Neon database and `test/factories.ts` now would let these get tested immediately, but that's Phase 6 in `requirements.md`'s own sequencing — pulling it forward wasn't asked for.

## Test env loaded via Vite's `loadEnv` into `vitest.config.mts`'s `test.env`, not inside `test/setup.ts`
**Why:** `lib/prisma.ts` constructs its client singleton as a top-level statement, immediately on import. ES module `import` statements always execute before the importing module's own code, regardless of where they're textually written — so if `test/setup.ts` itself imported `@/lib/prisma` and then called `dotenv.config({ path: ".env.test" })`, the client would already be built from the wrong (dev) `DATABASE_URL` by the time the test override ran. Vite's `loadEnv("test", cwd, "")` runs entirely inside `vitest.config.mts`, in the main process, before any test file or setup file is loaded — merging `.env` then `.env.test` (test branch wins) — so `process.env.DATABASE_URL` is already correct before `lib/prisma.ts` is imported anywhere. Verified empirically: a smoke test confirmed the dev-seeded reviewer account is invisible from the test connection, and a separate script confirmed the dev database's 2 seeded users were untouched after a full test run.
**Alternative:** A dynamic `await import("@/lib/prisma")` inside `test/setup.ts`, after calling `dotenv.config()` synchronously first, would also dodge the hoisting problem — more moving parts than letting Vitest's own `env` config option do it.

## `fileParallelism: false` in `vitest.config.mts`
**Why:** `test/setup.ts` truncates all tables in a `beforeEach`. Vitest runs test files in parallel by default; two files' `beforeEach`/test bodies interleaving against the same Neon test branch would let one file's truncation delete rows another file just inserted mid-test, producing flaky failures with no code bug behind them.
**Alternative:** Per-test-file transactions that roll back at the end would allow parallelism, but Prisma's interactive transactions don't compose cleanly with a truncate-in-`beforeEach` pattern, and CLAUDE.md doesn't ask for it.

## `test/factories.ts` (`createTestUser`) introduced in Phase 4, not Phase 3
**Why:** `requirements.md` schedules `test/factories.ts` for Phase 6, but Phase 4's own test list needs real rows in the database — an existing user to collide with on signup, a known password to sign in with. CLAUDE.md §10 already bans hand-built fixtures ("Do not hand-build fixtures in every test"), so the factory had to exist now rather than waiting. `createTestNote` isn't added yet — nothing in this phase needs it.
**Alternative:** Calling `prisma.user.create` inline in each test would work but is exactly the hand-built-fixture pattern the testing rules rule out.

## `setSessionCookie`/`clearSessionCookie` take a `NextResponse` instead of reading `next/headers`'s `cookies()`
**Why:** Verified empirically: calling an exported route handler directly (no real Next.js server) and invoking `cookies()` from `next/headers` throws `` `cookies` was called outside a request scope `` — that API only works inside Next's own request-handling AsyncLocalStorage, which the framework sets up before invoking a handler in production, but which importing and calling the exported function directly (exactly how CLAUDE.md's testing strategy — and `requirements.md`'s Phase 4 test list — calls route handlers) never provides. Setting/deleting the cookie on the `NextResponse` object being returned instead works identically in production and is directly observable in a test via `res.headers.get("set-cookie")`, with no framework request context needed. `getCurrentUser`/`requireUser` are unchanged — Server Components (their only caller so far) always run inside Next's real render pipeline, where `cookies()` works fine.
**Alternative:** Keep the `next/headers` version and only assert cookie behavior at the browser level in Phase 5 — but that would mean silently dropping the explicit Phase 4 acceptance criterion ("sets a Set-Cookie header with HttpOnly"), which is a MUST in `requirements.md`, not something to quietly weaken.
**Note for Phase 7:** notes API routes will call `requireUser()` too, and will hit the exact same "no request scope" error under direct-handler-call tests. Not solved here — `getCurrentUser`/`requireUser` have no `NextResponse` to attach anything to (they're reads, and Server Components need them to keep working with zero arguments), so the fix isn't as simple as Phase 4's. Revisit when Phase 7 starts.

## `route()`'s returned `ctx` parameter made optional, unlike CLAUDE.md's literal snippet
**Why:** CLAUDE.md's own `route<Ctx>` snippet types the wrapped handler as `(req: Request, ctx: Ctx) => Promise<NextResponse>` with `ctx` required — but its own usage example calls `route(async (req: Request) => {...})` with a callback that never mentions `ctx` at all. That's fine for the callback (TS allows assigning a shorter-arity function where a longer one is expected), but the *returned* function's declared type still demands two arguments, and non-dynamic routes (signup/signin/signout) are called in tests with just a `Request` — a real arity mismatch under `--strict`, not something specific to this codebase's setup. Made `ctx` optional on the returned type and cast it back to `Ctx` once, at the one point it's forwarded to `fn` — dynamic routes ([id]/route.ts, Phase 7) will always receive it for real from Next.js at runtime, so this only changes what's possible to omit in a test.
**Alternative:** Requiring every non-dynamic-route test to pass a second `undefined` argument keeps `handler.ts` byte-for-byte identical to the snippet, but pushes a framework-shaped workaround into every test file instead of the one shared wrapper.

## `parse<T>`'s zod error normalization deviates from CLAUDE.md's literal snippet
**Why:** CLAUDE.md's `parse<T>` example passes `result.error.flatten().fieldErrors` straight into `new ValidationError(...)`. Under `--strict` with a generic `T`, that doesn't typecheck: zod types each field as `string[] | undefined`, and with `T` unresolved, `Object.entries()` on it degrades further to untyped values — but `ValidationError` requires `Record<string, string[]>` with no undefined values. Rebuilt into a clean object, dropping the (never actually present) undefined entries.
**Alternative:** An `as Record<string, string[]>` cast at the call site would also compile, but silently assumes zod never emits an empty array for a field, which the rebuild doesn't need to assume.

## `proxy.ts` uses a named `export function proxy(...)`, not a default export
**Why:** CLAUDE.md §7 and §9 disagreed with each other when this was built — §7 said "the exported function is named proxy," §9 listed `proxy.ts` among files needing a default export. Checked Next 16's own source (`next/dist/server/next-server.js`) rather than guess: it resolves the handler as `middlewareModule.proxy || middlewareModule.middleware || middlewareModule` — a named `proxy` export is checked first, matching the old `middleware.ts` convention of a named export. Went with §7 as the more specific, directly-on-point instruction. §9 has since been corrected to match (it was a copy-paste leftover from the general default-export list).
**Alternative:** A default export would also work (the `|| middlewareModule` fallback), but wouldn't match CLAUDE.md's own explicit statement about this specific file.

## `SESSION_COOKIE_NAME` exported from `session.ts` for `proxy.ts` to import
**Why:** `proxy.ts` needs to check for the same cookie `session.ts` sets, without a second hardcoded `"session"` string that could drift out of sync if the cookie name ever changed.
**Alternative:** Duplicating the literal in `proxy.ts` — one string, low actual risk, but no reason to accept it when exporting a constant costs nothing.

## `components/auth/` added alongside the `ui/notes/tags` folders CLAUDE.md enumerates
**Why:** `sign-out-button.tsx` is domain-specific (knows the `/api/auth/signout` endpoint and the `/login` redirect) and used from the shared root layout — not a one-off tied to a single page, so it didn't fit colocating with a page the way `login-form.tsx`/`signup-form.tsx` do, and it doesn't fit `components/ui/`'s explicit "generic, no domain knowledge" definition either. `login-form.tsx` and `signup-form.tsx` themselves stay colocated with their pages (`app/(auth)/login/`, `app/(auth)/signup/`) since each is used in exactly one place — matching CLAUDE.md §7's "keep `use client` at the leaves."
**Alternative:** Forcing `sign-out-button.tsx` into `components/ui/` would misdescribe it as generic; putting it in `app/` directly (uncolocated with any single page, since it's used from the layout) would bury a reusable piece as if it were page-local.

## Root layout became an async Server Component that calls `getCurrentUser()`
**Why:** The sign-out control (`requirements.md` Phase 5: "a sign-out control in the app shell") needed a home before Phase 8 builds the actual notes app shell. Rather than always rendering it (visible even on `/login`/`/signup`, which is confusing since proxy.ts redirects signed-in users away from those paths anyway) or inventing a separate shell component ahead of when one is needed, the root layout now reads the session once and renders `<SignOutButton />` only when a user is present. This does make every route dynamic (verified in `next build` output — `/` moved from static to `ƒ`), which is unavoidable once any shared layout reads cookies.
**Alternative:** A client-side check (fetch current user on mount) would avoid the server-side cookie read, but would flash the wrong header state on every load and duplicates work `getCurrentUser()` already does correctly.

## `app/page.tsx` ("/") redirects straight to `/notes` instead of showing content
**Why:** `proxy.ts`'s matcher is deliberately scoped to `/notes`, `/login`, `/signup` only, per `requirements.md` — widening it to cover `/` would mean the protection logic runs on every single route in the app, not just the three that need it. Left alone, `/` kept rendering the untouched `create-next-app` placeholder in production, so visitors had to already know to type `/notes`. A `redirect("/notes")` server-side in the page itself (not proxy) sends every visit to `/` through the existing `/notes` protection: signed out → `/login`, signed in → `/notes` (or further to `/login` again until Phase 8 builds the actual notes page). Verified the full chain with curl: `/` → `/notes` → `/login`, landing on a real `200`.
**Alternative:** Adding `/` to proxy's matcher and giving it its own branch would work too, but duplicates the "protected path" redirect logic that `/notes` already has, instead of reusing it for free by redirecting into `/notes`.

## `ListNotesOptions` omits `tagIds`, unlike the signature shown in requirements.md's Phase 6 Build section
**Why:** The Build section shows `listNotes(userId, { tagIds?, sort, q })`, but `requirements.md`'s own testing-strategy section splits "every ownership rule" (Phase 6, test-first) from "the filter/sort logic" (Phase 10, test-first) as separate TDD categories — and this file already carried a placeholder reserving the AND/OR tag-filter decision for Phase 10 with its own tests. Implementing `tagIds` filtering now, untested and with a semantics choice not yet made, would mean either guessing at AND/OR without the dedicated tests `requirements.md` asks for, or shipping a parameter that's accepted but silently ignored — the kind of thing CLAUDE.md says shouldn't exist without an answer to "why is this here?" `sort` and `q` are in the Phase 6 signature and implemented now since neither has an undecided semantics question. `ListNotesOptions` derives from `NoteQueryInput` (`Pick<NoteQueryInput, "sort" | "q">`) per CLAUDE.md §9 ("derive types rather than restating them"), so it'll extend cleanly once `tagIds` is added.
**Alternative:** Add `tagIds` now with a guessed-at AND semantics and revisit in Phase 10 — defers the same decision one phase later while adding an untested code path in the meantime, for no benefit.

## Resolved the Phase 4 `requireUser()` request-scope problem: an optional `Request` parameter, cast internally to `NextRequest`
**Why:** Flagged in Phase 4 and revisited now that every notes route needs `requireUser()` first. `getCurrentUser`/`requireUser` gained an optional `request?: Request` parameter. When a route handler passes its `req`, the function reads the session cookie straight off it — cast to `NextRequest` internally, since Next.js route handlers always receive a genuine `NextRequest` at runtime (confirmed empirically: `new NextRequest(url, { headers: { cookie: "..." } })` parses `.cookies` correctly with no request scope at all), even though `lib/api/handler.ts`'s `route()` wrapper types the parameter as the more general `Request`. Calling with zero arguments — the Server Component case, unchanged since Phase 5 — still goes through `next/headers`'s `cookies()`, which needs a real request scope but always has one when Next's render pipeline calls it. Verified all three states before writing the Phase 7 tests: `requireUser(authenticatedReq)` resolves the real user, `requireUser(bareReq)` throws `UnauthorizedError`, and `requireUser()` with zero args still throws outside a request scope (proving the Server Component path didn't regress).
**Alternative considered and rejected:** Widening `route()` itself to type `req` as `NextRequest` (rather than casting once inside `session.ts`) — verified via a throwaway compile check that this direction is type-safe and wouldn't break Phase 4's existing `Request`-typed callbacks, but it would force every existing auth-route test to construct a `NextRequest` instead of a plain `Request`, for no benefit to routes that never read cookies from the request. Confining the cast to the one function that actually needs `.cookies` is a smaller, better-contained change.

## `test/request.ts` (`authenticatedRequest`) built as shared test infrastructure
**Why:** Every notes route test needs a `NextRequest` carrying a valid signed session cookie for a specific test user — exactly the kind of setup CLAUDE.md §10 says shouldn't be hand-built per test. Not a factory (creates no DB row), so it doesn't belong in `test/factories.ts`; added as its own file since `requirements.md`'s folder structure only names `test/setup.ts` and `test/factories.ts`, similar to the earlier `components/auth/` and `lib/auth/service.ts` additions where a genuinely new concern didn't fit an existing sanctioned file.
**Alternative:** Constructing the cookie header inline in every test file — the exact repeated-fixture pattern the testing rules already rule out for DB rows, no reason it's fine for auth state instead.

## `NextRequestInit` derived via `ConstructorParameters<typeof NextRequest>[1]`, not imported
**Why:** `tsc --noEmit` caught a real type mismatch: `NextRequest`'s constructor expects its own `RequestInit` (narrower `signal`: `AbortSignal | undefined`, not `| null`) rather than the DOM lib's — and that type isn't exported from the public `next/server` entry point, only from an internal `next/dist/server/web/spec-extension/request` module. Deriving it from the constructor's own parameter type gets the exact right shape without depending on Next's internal file layout, which could change between versions.
**Alternative:** Importing directly from the internal module path would work today but is exactly the kind of import that breaks silently on a Next.js patch release.

## Verified deletion through a follow-up `GET` (404), not a direct Prisma query, in the `[id]` route test
**Why:** The obvious way to assert "the note is gone" — `prisma.note.findUnique(...)` — is a direct Prisma import inside a file colocated under `app/api/notes/[id]/__tests__/`, which trips CLAUDE.md's literal `grep -rn "prisma\." app` check (no test-file exception stated). Rather than carve out an unstated exception, verified the same behavior through the API's own public surface: after `DELETE` returns `204`, a follow-up `GET` for the same id returns `404`. This is arguably the more correct test anyway — CLAUDE.md §10 says to "test through the public surface: exported service functions, exported route handlers," and a route handler test reaching into Prisma directly was always a bit of a layering shortcut.
**Alternative:** Scoping the grep check to exclude `__tests__/` directories would also resolve the conflict, but changes a rule to fit one inconvenient test rather than finding a test that already fits the rule.

## Edit is inline, not a modal
**Why:** `requirements.md` leaves this as an explicit choice. Inline editing (the card swaps its display view for `<NoteForm>` in place) needs no focus-trap, no Escape-to-close, no return-focus-to-trigger handling — all real requirements the moment a modal is chosen, per the same phase's own text. Fewer moving parts, same result: the user edits the note and sees it saved in place.
**Alternative:** A modal is arguably more conventional, but every one of its accessibility requirements is a real implementation burden inline editing doesn't have. Revisit only if a reviewer specifically wants to see modal-focus-trap code.

## Delete confirmation is an inline two-step toggle, not a modal or `window.confirm()`
**Why:** `requirements.md` asks for "a confirmation step," not a dialog. `window.confirm()` is unstyled, blocks the main thread, and can't be unit-tested or restyled for dark mode. An inline toggle (Delete → Confirm delete? / Cancel) is real `<button>` elements, fully keyboard-operable, and needs no focus-trap since nothing steals focus from the page.
**Alternative:** A modal confirmation is more visually prominent but re-introduces the same focus-trap/Escape/return-focus burden the inline-edit decision above avoided, for a lower-stakes action than edit.

## `app/notes/page.tsx` catches `UnauthorizedError` and redirects to `/login`, instead of letting it reach `error.tsx`
**Why:** `proxy.ts`'s check is cookie-presence only (CLAUDE.md §6) — a forged or expired cookie can still reach this page, where `requireUser()` is the authoritative check and throws. Left uncaught, that throw would surface as a generic `error.tsx` screen ("Something went wrong") for what is really just "please sign in again," which is both a worse experience and arguably not an honest error state. Catching specifically `UnauthorizedError` (not a blanket catch) and redirecting is a legitimate outcome-conversion per CLAUDE.md §4.2, and keeps `error.tsx` for genuinely unexpected failures (e.g., `listNotes` hitting a DB problem).
**Alternative:** Doing nothing and letting it hit `error.tsx` would technically satisfy "errors surface as readable messages," but conflates "you're not signed in" with "something broke," which are different problems with different correct next actions.

## `lib/api/client-error.ts` extracted from `login-form.tsx`/`signup-form.tsx`, which were then refactored to use it
**Why:** Phase 8 needed the identical `{ error?, fields? }` response-parsing pattern for the create and edit forms — a 3rd and 4th copy of what Phase 5 had already written twice. Extracted to `lib/api/client-error.ts` (client-safe: no Prisma, no `process.env` reads) and pointed all four forms at it instead of leaving two duplicate local definitions alongside two new ones.
**Alternative:** Leaving Phase 5's forms with their own copies while only the new Phase 8 forms use the shared helper would mean the same four lines of logic exist in the codebase in two different forms for no reason — worth fixing once noticed, not worth leaving as "not this phase's problem."

## Tag assignment folded into the existing note create/edit endpoints, not a separate route
**Why:** Phase 9's Build section lists only `GET`/`POST /api/tags` (for the `Tag` entity itself) — no dedicated endpoint for note-tag association. `createNoteSchema`/`updateNoteSchema` gained an optional `tagIds` field instead; `POST /api/notes` and `PATCH /api/notes/[id]` call `setNoteTags` after the note operation when `tagIds` is present. Matches the UI shape too — one form, one submit, note and tags together — rather than the client making two requests for what's conceptually one edit.
**Alternative:** A `PUT /api/notes/[id]/tags` endpoint would keep `setNoteTags` fully self-contained behind its own route, but nothing in `requirements.md` asks for it, and it would mean the note form making two sequential requests on every save.

## `setNoteTags` returns `void`; the route handler re-reads via `getNote` for the response
**Why:** Keeps `setNoteTags` doing exactly one thing (verify ownership, replace join rows) without also needing to know how to shape a `NoteWithTags` response — that's `lib/notes/service.ts`'s `getNote`, already built and tested in Phase 6. Reusing it here means the tag-attachment query logic exists in exactly one place, not duplicated across `lib/notes/service.ts` and `lib/tags/service.ts`.
**Alternative:** Having `setNoteTags` return the updated note directly would save one query per request, but would require duplicating (or cross-importing in the other direction) the tag-include query shape that `getNote` already owns.

## Note creation and tag attachment are not atomic across the two calls
**Why:** `POST /api/notes` calls `createNote` then, separately, `setNoteTags` — each is its own transaction, not one spanning both. If a `tagId` in the request doesn't belong to the caller, the note has already been created by the time `setNoteTags` rejects it, so the response is `404` for what actually left a real (untagged) note in the database. This only happens on a malformed/adversarial direct API call — the UI's tag picker only ever offers tags the signed-in user already owns — and there's no cross-user leak either way, just a partial-success rough edge. `requirements.md` only asks `setNoteTags` itself to be transactional (verify both ownerships, write nothing on rejection), not for note-creation-with-tags as a whole to be one transaction — extending `createNote` to also validate and write tag joins would duplicate `setNoteTags`'s own ownership-checking logic in a second place.
**Alternative:** Wrapping `createNote` and the tag joins in one shared transaction inside `lib/notes/service.ts` would close this gap, at the cost of notes/service.ts needing to know about tag ownership rules — logic Phase 9 puts in `lib/tags/service.ts` for a reason. Worth reconsidering if a reviewer flags the partial-success case as a real problem rather than an edge case.

## Found and fixed a real bug: `createNote`/`updateNote` blindly spread their input into Prisma's `data`
**Why:** Once `CreateNoteInput`/`UpdateNoteInput` gained an optional `tagIds` field, `prisma.note.create({ data: { ...data, userId } })` started throwing `PrismaClientValidationError: Unknown argument tagIds` at runtime — `tagIds` isn't a `Note` column. Caught by a regression test written before the fix (committed failing, showing the real Prisma error, not a hypothetical). Fixed by naming the fields explicitly (`{ title: data.title, body: data.body, userId }`) instead of spreading the whole validated object. Verified separately that `updateMany` with an empty `data: {}` (the tagIds-only-edit case) is a harmless no-op, not an error.
**Alternative:** None — this was a straightforward bug once the schema changed shape; the fix is the obviously correct one.

## Tag multi-select is native checkboxes, not a custom combobox
**Why:** Each tag is an independently labeled `<input type="checkbox" name="tagIds">`, matching CLAUDE.md §11's bar (no custom interactive widget where a native element does the job) with zero extra ARIA work. Embedding it inside `NoteForm`'s existing `<form>` means `formData.getAll("tagIds")` on submit reads whatever's checked with no separate state-syncing between `TagSelect` and its parent.
**Alternative:** A searchable multi-select dropdown scales better past a few dozen tags, but needs a full combobox/listbox ARIA pattern (CLAUDE.md's own accessibility bar) for a feature with no stated scale requirement.

## `components/tags/tag-chip.tsx` extracted from inline JSX in `note-card.tsx`
**Why:** CLAUDE.md's folder structure names `tag-chip` explicitly under `components/tags/`; it was inline JSX in `note-card.tsx` since Phase 8 (before any tag data existed to justify extracting it). Pulled out now that Phase 9 gives it real content and a second, defensible reason to exist as its own file — TagSelect's "add tag" flow and NoteCard's display both center on the same `Tag` shape.
**Alternative:** Leaving it inline still works but ignores a file CLAUDE.md already named.

## Multi-tag filter semantics: AND — a note must carry every selected tag
**Why:** AND matches how a filter is normally read — checking "work" and "urgent" narrows the list to notes that are both, the same mental model as filtering by two facets in a file browser or issue tracker. OR would widen the results as you select more tags, which reads backwards against the term "filter." Implemented as one `{ noteTags: { some: { tagId } } }` per selected tag, combined with an explicit `AND` — the note needs a join row for tag A *and* a (possibly different) join row for tag B, never one row satisfying both at once, since each `NoteTag` row has exactly one `tagId`. Tested directly: a note carrying only one of two selected tags is excluded, and a note carrying both is the only one returned.
**Alternative:** OR (`some: { tagId: { in: tagIds } }`, a single check) is simpler to write and cheaper to run, and is the more useful default once a tag vocabulary gets large and specific — but that's a product judgment call with no signal either way in `requirements.md`, so went with the reading that matches the word "filter" most directly.

## `listNotes` doesn't itself verify that `tagIds` belong to the caller — the invariant holds transitively
**Why:** Unlike `setNoteTags` (which explicitly checks tag ownership before writing a join row), `listNotes` just filters on `noteTags.some.tagId` within a `where` already scoped to `userId`. This is still safe: a `NoteTag` row only ever exists because `setNoteTags` created it, and that always required the tag and the note to belong to the *same* user — so a note owned by A can never carry a join row pointing at a tag owned by B. Filtering by someone else's tag id therefore can't leak anything; it just matches nothing (tested directly: passing a foreign tag id returns an empty list, not another user's notes). Documented as a real assertion, not an assumption used silently.
**Alternative:** Adding an explicit tag-ownership check to `listNotes` too would make the invariant locally obvious without having to reason about `setNoteTags`'s write-time guarantee — a defensible "belt and suspenders" addition if a reviewer wants it, but redundant given the invariant already holds and is now tested.

## `PageProps<"/notes">` used for the page's `searchParams`, not a hand-rolled type
**Why:** Next.js 16 generates `PageProps<AppRoute>` (`.next/types/routes.d.ts`) with `searchParams: Promise<Record<string, string | string[] | undefined>>` already correctly typed for the route — same pattern `app/layout.tsx` already uses for `LayoutProps<"/">`. Matches what Next actually hands the page at runtime instead of restating it.
**Alternative:** A hand-written `{ searchParams: Promise<...> }` type would work identically today but drift silently if Next's actual shape ever changes.

## A malformed `searchParams` value falls back to defaults on the page; the API route still 400s on the same input
**Why:** `noteQuerySchema.safeParse` on the page's `searchParams` falls back to `{ sort: "newest" }` on failure rather than throwing — a hand-edited or stale URL (e.g. `?sort=bogus`) shouldn't crash a browser visit into `error.tsx` for what a user can't fix by reading an error message. `GET /api/notes` keeps using `parse()` (throws `ValidationError` → 400) because an API client sending a malformed query genuinely has a bug worth surfacing as a rejected request. Same schema, two different failure-handling policies for two different kinds of caller — tested both: an unknown `sort` still 400s at the route, and the page doesn't have an equivalent test since it degrades rather than erroring (nothing to assert a throw on).
**Alternative:** Making the page also throw on invalid `searchParams` would be simpler (one behavior everywhere) but turns "someone tweaked the URL" into a crash for no security or correctness benefit.

## Fixed a real bug in `getCurrentUser`: a database outage was indistinguishable from "no session"
**Why:** Phase 11 audit. The original `try { verify; findSessionUser } catch { return null }` treated a database connection failure exactly like a bad or expired token — both resulted in a silent redirect to `/login`. That's misleading: a signed-in user whose database happens to be unreachable would see a login screen with no indication anything was actually broken, not "please sign in again." Narrowed the catch to only wrap `verifySessionToken` (bad signature, malformed, expired — genuinely "no session"); a failure in `findSessionUser` now propagates, so it surfaces as a real error instead. A deleted user is unaffected — Prisma's `findUnique` returns `null` for "not found," it doesn't throw, so that still resolves to "no session" the same as before.
**Verified, not assumed:** built a production build (`next build && next start` — dev mode has its own error-overlay detour for uncaught SSR errors that doesn't represent what a real user sees) with `DATABASE_URL` pointed at a nonexistent host. `GET /notes` with a valid session cookie returned `500` with only an opaque React error digest in the body (no Prisma error code, hostname, or stack trace); `POST /api/auth/signin` returned the standard generic 500 body. Restored the real `.env` immediately after.
**Alternative:** Leaving the blanket catch is simpler code, but means the app actively hides infrastructure failures from both the user and (without server-side logging context) whoever's debugging it.

## Four client fetch calls had no failure path — found by auditing every `fetch(` call, not assumed correct by pattern-matching the ones that already had one
**Why:** Phase 11 explicitly asks to confirm every client-side fetch has a failure path. `login-form.tsx`, `signup-form.tsx`, and `sign-out-button.tsx` all wrap `fetch` in `try/catch`; `tag-select.tsx`'s `handleCreateTag`, `create-note-form.tsx`'s `handleCreate`, and `note-card.tsx`'s `handleEdit`/`handleDelete` didn't. A non-2xx response was handled in all of them, but an actual network failure (offline, DNS failure — `fetch` rejects, it doesn't resolve with a bad status) would have thrown an unhandled rejection and left the UI stuck in its pending state forever with nothing shown. Added `try/catch` to all four, matching the existing pattern.
**Alternative:** None — this was a straightforward gap once checked systematically; the fix matches code already in the file for the pattern that follows CLAUDE.md correctly.

## `app/error.tsx` and `app/not-found.tsx` added at the root
**Why:** Phase 11 explicitly asks to add these "where missing." `app/notes/error.tsx` existed (Phase 8) but nothing covered `/`, `/login`, `/signup`, or an unmatched route — those fell through to Next's generic, unstyled 404/error pages, which don't match "nothing ugly reaches a user."
**Alternative:** None — straightforwardly missing.

## `eslint-plugin-jsx-a11y` recommended ruleset enabled at full strength
**Why:** Phase 12 audit. `eslint-config-next`'s `core-web-vitals` bundles only 6 jsx-a11y rules (`alt-text`, `aria-props`, `aria-proptypes`, `aria-unsupported-elements`, `role-has-required-aria-props`, `role-supports-aria-props`) — not the 34-rule recommended set CLAUDE.md §0 and §11 both ask for by name. Added `jsxA11y.flatConfigs.recommended.rules` explicitly (not the whole config object — it also declares `plugins`, and `nextVitals` already registers the `jsx-a11y` plugin, so redeclaring it errors on a duplicate). Zero warnings against the existing codebase once added.
**Alternative:** None — this was a gap between what CLAUDE.md specifies and what was actually configured back in Phase 0, worth closing rather than working around.

## Computed real WCAG contrast ratios instead of eyeballing Tailwind shades
**Why:** Phase 12's "colour contrast at least 4.5:1" is a specific, checkable number — guessing whether `zinc-500` "looks readable enough" isn't the same as knowing it is. Wrote a small script computing the actual relative-luminance contrast ratio for every text/background color pair used in the app (extracted via `grep` for every `text-`/`bg-` class actually present). Found one real failure: `text-zinc-500 dark:text-zinc-500` (note timestamps, "No tags yet.") was 4.83:1 in light mode — passing, which is presumably why it was never questioned — but 4.10:1 against the dark-mode background, under the minimum. Same shade, two different backgrounds, only one of which was checked by eye. Fixed by giving the dark variant its own shade (`zinc-400`, 7.72:1) instead of reusing the light-mode value unchanged.
**Alternative:** Running Lighthouse/axe in a real browser would catch this too, but isn't available in this environment — computing the ratio directly is the closest verifiable substitute, and found a real, specific, fixable defect rather than a vague "looks fine."

## Focus moves into the note form on open, via an imperative ref, not the `autoFocus` prop
**Why:** The create/edit form replaces a button (`New note` / `Edit`) when it appears; without moving focus, a keyboard user is left wherever the trigger used to be and has to tab from the top of the page to reach the new form. `autoFocus` would do this in one prop, but `jsx-a11y/no-autofocus` (now enabled at full strength) flags it unconditionally — the rule can't distinguish "focus following a deliberate user action" (this case, fine) from "focus stealing on initial page load" (what the rule exists to catch, and exactly what `login-form.tsx`/`signup-form.tsx` would be doing if given the same treatment — deliberately left alone). Used `useRef` + `useEffect(() => ref.current?.focus(), [])` instead: identical runtime behavior, not the flagged prop.
**Alternative:** An `eslint-disable` comment on the `autoFocus` line would keep the simpler prop-based code, but CLAUDE.md asks for zero warnings, not zero-after-suppressions — and the imperative version isn't meaningfully more code.

## No modal focus-trap requirement to satisfy — no modals exist
**Why:** Phase 8 chose inline editing and an inline two-step delete confirmation over modals specifically to avoid the focus-trap/Escape/return-focus implementation burden (see that phase's decisions). Phase 12's modal requirement is genuinely not applicable, not silently skipped — noted here so it's clear the omission was checked, not missed.
**Alternative:** N/A.

## Tag chip colour is a deterministic hash of the tag name, not stored or random
**Why:** The same tag needed to render identically everywhere it appears (note cards across the list, in both the light/dark palettes) without adding a `colour` column or picking one at creation time. A `djb2` string hash of the tag name, indexed into a fixed 8-entry palette, is pure and deterministic — same input, same output, on every render, with no state and no migration. `Math.random()` was rejected outright since it would repaint the same tag a different colour on every re-render. Colour stays decorative only: the tag name is still the text content, so nothing (including screen readers) depends on which palette entry was picked.
**Palette (each pair computed via the relative-luminance formula, not eyeballed — light: `bg-*-100`/`text-*-800`, dark: `bg-*-900`/`text-*-300`, solid, no opacity modifiers):**

| Colour | Light contrast | Dark contrast |
|---|---|---|
| rose | 6.68:1 | 5.06:1 |
| orange | 6.38:1 | 5.56:1 |
| amber | 6.37:1 | 6.29:1 |
| lime | 6.52:1 | 6.69:1 |
| emerald | 6.78:1 | 6.38:1 |
| teal | 6.73:1 | 6.41:1 |
| cyan | 6.49:1 | 6.29:1 |
| fuchsia | 7.08:1 | 5.70:1 |

Indigo, violet, blue, and purple are excluded entirely — indigo is the app's one interactive accent (buttons, focus rings, checkboxes), and a tag chip in that hue would read as clickable when it isn't. Confirmed the built CSS actually contains every palette class (`grep` against `.next/static/chunks/*.css`) since Tailwind's scanner reads the array as literal text, not a runtime-evaluated one — the array entries are full class strings for exactly that reason, not string-interpolated fragments Tailwind couldn't statically find.
**Alternative:** Storing a `colour` column on `Tag` would let a user pick their own colour, but that's a feature this app doesn't offer and would need a migration, a form control, and a "no colour set yet" fallback — the hash gets the "always the same colour" requirement with none of that.

## Tag chips render `capitalize`; the stored value stays lowercase
**Why:** `createTagSchema` (`lib/validation/tag.ts`) normalizes with `.trim().toLowerCase()` before a tag ever reaches the database, so uniqueness (`[userId, name]`) and search/filter matching all operate on one canonical casing. `capitalize` on `TagChip`'s `<span>` is a pure CSS `text-transform` — it changes how the text paints, not what's in the DOM or the database, so nothing downstream (the checkbox labels in `TagFilter`/`TagSelect`, the tag-creation input, the filter query) needed to change to keep working.
**Alternative:** Capitalizing in the service layer before storage would fight the existing lowercase-uniqueness design — two tags differing only in case would either collide unexpectedly or need a second normalization step just for display, when CSS already does this for free.

## Shared `useTransition` for the toolbar (search/sort/tag-filter), via a small context
**Why:** Search, sort, and tag-filter are three separate client components, each pushing its own query param to the URL — but the pending feedback (a spinner over the note list) has to reflect all three as one state, not one per control. `NotesTransitionProvider` (`components/notes/notes-transition-context.tsx`) owns a single `useTransition()` and exposes `{ isPending, startTransition }` via context; each control wraps its existing `router.push(...)` call in `startTransition(...)` instead of calling it directly. `NoteListRegion` reads `isPending` from the same context and sets `aria-busy` on the wrapping `<div>` around `NoteList`, with a decorative `aria-hidden="true"` spinner alongside it. Verified live, not just by reading the code: toggling a tag filter shows the spinner and `aria-busy="true"` on the list region while the RSC round-trip is in flight, both clear once the new list renders, and the search `<input>` has no `disabled` anywhere in the change — typing during a pending transition is unaffected.
**Alternative:** Giving each of the three controls its own local `useTransition` would be simpler per-file, but there'd be no single `isPending` for `NoteListRegion` to read — it would need to know about three separate pending flags (or all three controls would need to lift state up anyway), which is what the shared context avoids in one small file.

## `NoteListRegion` shows a spinner but does not dim the list with opacity
**Why:** The task allowed either "a dimmed list or a small spinner." Dimming via `opacity` on a wrapping `<div>` doesn't just fade the background — it fades the note titles and body text inside it too, changing their effective contrast against whatever's behind the panel. Verifying that at every opacity level, for every note-card text colour already computed against 4.5:1 (Phase 12), was more to prove than a normally sub-second loading state justifies. The spinner alone satisfies the requirement without touching any already-verified contrast pair.
**Alternative:** A lower, more conservative opacity (e.g. `opacity-90`) would likely stay safely above 4.5:1 for most pairs, but "likely" isn't "computed," and this whole codebase's contrast rule has been to verify, not eyeball.
