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

## Multi-tag filter semantics: AND / OR — DECIDE IN PHASE 10
**Why:**
**Alternative:**
