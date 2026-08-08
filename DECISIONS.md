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

## Multi-tag filter semantics: AND / OR — DECIDE IN PHASE 10
**Why:**
**Alternative:**
