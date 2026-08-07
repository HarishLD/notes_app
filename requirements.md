# requirements.md

Build spec for the Notes app. **Read `CLAUDE.md` before writing any code — it is binding.**

---

## How to use this file

Work **one phase at a time.** Do not start Phase N+1 until Phase N's acceptance criteria all pass.

At the end of every phase:
1. Run `npm run lint` — zero errors, zero warnings
2. Run `npm run test` — all pass
3. Run `npx tsc --noEmit` — clean
4. Report which acceptance criteria pass and which do not. **Do not claim a phase is complete if any criterion fails.**
5. Append any architectural choice you made to `DECISIONS.md` (format in that file)

If a requirement here conflicts with `CLAUDE.md`, **`CLAUDE.md` wins** — flag the conflict instead of guessing.

If something is ambiguous, state the ambiguity and your assumption. Do not silently invent scope.

---

## Product summary

A multi-tenant notes app. A user signs up, signs in, and manages notes that only they can see. Notes carry tags. Notes can be filtered by tag, sorted by date, and searched by title.

**The single most important property:** a user must never be able to read, modify, or delete another user's data, and this must be enforced on the server, in the database query itself.

---

## Stack (fixed — do not substitute)

| Concern | Choice |
|---|---|
| Framework | Next.js 16, App Router, TypeScript strict |
| Database | PostgreSQL (Neon) |
| ORM | Prisma 7 |
| Validation | Zod |
| Password hashing | bcryptjs |
| Tokens | jose (HS256 JWT) |
| Session transport | httpOnly cookie — **never localStorage or sessionStorage** |
| Testing | Vitest |
| Styling | Tailwind |
| Hosting | Vercel |

Do not add any dependency not listed here without asking first.

---

# PHASE 0 — Scaffold and deploy

**Goal:** an empty app running in production before any feature exists.

**Build:**
- `create-next-app` with TypeScript, ESLint, App Router, no `src/` directory, Tailwind
- `tsconfig.json` with `"strict": true`
- ESLint config including `eslint-plugin-jsx-a11y` (recommended ruleset)
- Prettier config + `.prettierignore`
- Vitest config with `@` path alias resolving to the project root
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `test` (= `vitest run`), `postinstall` (= `prisma generate`)
- `.env.example` listing `DATABASE_URL`, `DIRECT_URL`, `JWT_SECRET` with empty values
- `.gitignore` covering `.env*.local`, `.env`, and the Prisma generated client directory
- A placeholder root page

**Acceptance:**
- [ ] `npm run dev` serves a page on localhost
- [ ] `npm run lint` clean
- [ ] `npm run build` clean
- [ ] `npx tsc --noEmit` clean
- [ ] Repo pushed to GitHub
- [ ] Deployed to Vercel, live URL loads
- [ ] No secret values committed anywhere

**Do NOT do in this phase:** any schema, any auth, any UI beyond a placeholder.

---

# PHASE 1 — Database schema and migrations

**Goal:** the data model exists, migrates cleanly, and is seeded.

**Build `prisma/schema.prisma`:**

- `generator client` using provider `prisma-client` with an explicit `output` path (`lib/generated/prisma`) (Prisma 7 requires this)
- `datasource db` — `postgresql`, `url = env("DATABASE_URL")`, `directUrl = env("DIRECT_URL")`

**Models:**

**User**
| Field | Type | Notes |
|---|---|---|
| id | String | `@id @default(cuid())` |
| email | String | `@unique`, stored lowercased |
| passwordHash | String | never returned by any API |
| createdAt | DateTime | `@default(now())` |
| notes | Note[] | |
| tags | Tag[] | |

**Note**
| Field | Type | Notes |
|---|---|---|
| id | String | `@id @default(cuid())` |
| title | String | |
| body | String | |
| createdAt | DateTime | `@default(now())` |
| updatedAt | DateTime | `@updatedAt` |
| userId | String | FK → User, `onDelete: Cascade` |
| noteTags | NoteTag[] | |

Index: `@@index([userId, createdAt])`

**Tag**
| Field | Type | Notes |
|---|---|---|
| id | String | `@id @default(cuid())` |
| name | String | stored trimmed and lowercased |
| userId | String | FK → User, `onDelete: Cascade` |
| noteTags | NoteTag[] | |

Constraint: `@@unique([userId, name])` — tags are per-user, so two users may each own a tag named "work"

**NoteTag** (explicit join model — required, do not use implicit many-to-many)
| Field | Type | Notes |
|---|---|---|
| noteId | String | FK → Note, `onDelete: Cascade` |
| tagId | String | FK → Tag, `onDelete: Cascade` |

Composite primary key: `@@id([noteId, tagId])`

**Also build:**
- `prisma/seed.ts` creating two users with hashed passwords, each with several notes and tags, and some notes carrying multiple tags. One user is the reviewer test account — read its credentials from env vars with sensible defaults, do not hardcode a password in a way that ends up in git as the real one.
- `lib/prisma.ts` — singleton client guarded against dev hot-reload creating new pools
- `package.json` → `"prisma": { "seed": "tsx prisma/seed.ts" }`

**Acceptance:**
- [ ] `npx prisma migrate dev --name init` succeeds and writes a migration under `prisma/migrations/`
- [ ] `npx prisma generate` succeeds
- [ ] `npx prisma db seed` succeeds and is idempotent (safe to run twice)
- [ ] `npx prisma studio` shows all four tables populated
- [ ] Deleting a user cascades to their notes, tags, and join rows
- [ ] The generated client directory is gitignored

**Do NOT do in this phase:** any API route, any auth logic, any UI.

---

# PHASE 2 — Validation schemas and unit tests

**Goal:** every shape that crosses the network boundary has a Zod schema, and those schemas are tested.

**Build in `lib/validation/`:**

`auth.ts`
- `signupSchema` — email (valid, trimmed, lowercased), password (min 8 chars)
- `signinSchema` — email, password (presence only, no strength rule)

`note.ts`
- `createNoteSchema` — title (1–200 chars, trimmed, non-empty after trim), body (0–10000 chars)
- `updateNoteSchema` — same fields, all optional, but must reject an empty object
- `noteQuerySchema` — parses URL search params: `tags` (comma-separated ids, optional), `sort` (`newest` | `oldest`, default `newest`), `q` (search string, optional, max 200)

`tag.ts`
- `createTagSchema` — name (1–40 chars, trimmed, lowercased, non-empty after trim)

Export the inferred TypeScript type alongside every schema.

**Tests — `lib/validation/__tests__/`:**
- [ ] Valid input passes and returns the coerced value (e.g. email is lowercased, title is trimmed)
- [ ] Malformed email rejected
- [ ] Password under 8 chars rejected
- [ ] Whitespace-only title rejected
- [ ] Title over the max length rejected
- [ ] `sort` defaults to `newest` when absent
- [ ] `sort` rejects an unknown value
- [ ] `updateNoteSchema` rejects an empty object

**Acceptance:**
- [ ] All validation tests pass
- [ ] No schema uses `any`
- [ ] Every schema exports its inferred type

**Do NOT do in this phase:** wire schemas into routes. Routes don't exist yet.

---

# PHASE 3 — Auth primitives

**Goal:** hashing, token signing, and session reading exist as tested, standalone functions.

**Build:**

`lib/errors.ts` — the error class hierarchy defined in `CLAUDE.md` (`AppError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`)

`lib/auth/password.ts`
- `hashPassword(plain): Promise<string>` — bcryptjs, cost factor 12
- `verifyPassword(plain, hash): Promise<boolean>`

`lib/auth/jwt.ts`
- `signSessionToken(userId): Promise<string>` — jose, HS256, `sub` = userId, 7-day expiry
- `verifySessionToken(token): Promise<{ sub: string }>` — throws `UnauthorizedError` on invalid signature, malformed token, or expiry
- Read `JWT_SECRET` from env; throw at module load if it is missing

`lib/auth/session.ts`
- `setSessionCookie(token)` — httpOnly, `secure` in production, `sameSite: "lax"`, `path: "/"`, 7-day maxAge
- `clearSessionCookie()`
- `getCurrentUser(): Promise<User | null>` — reads cookie, verifies token, loads user, returns null on any failure
- `requireUser(): Promise<User>` — same but throws `UnauthorizedError` when there is no valid session

`requireUser()` must never return a `passwordHash`. Use a `select` that excludes it.

**Tests:**
- [ ] A hashed password does not equal the plaintext
- [ ] `verifyPassword` returns true for the correct password, false for the wrong one
- [ ] A signed token verifies and its `sub` matches the input
- [ ] A tampered token throws `UnauthorizedError`
- [ ] A token signed with a different secret throws
- [ ] An expired token throws

**Acceptance:**
- [ ] All auth primitive tests pass
- [ ] `JWT_SECRET` is read from env, never hardcoded, never defaulted to a literal
- [ ] No function in this module returns a password hash to a caller

**Do NOT do in this phase:** API routes or UI.

---

# PHASE 4 — Auth API routes

**Goal:** signup, signin, and signout work over HTTP with correct status codes.

**Build:**

| Route | Method | Behaviour |
|---|---|---|
| `/api/auth/signup` | POST | Validate → 400 on failure. Email already registered → **409**. Hash, create user, sign token, set cookie → **201** with the user's id and email only |
| `/api/auth/signin` | POST | Validate → 400. Look up user, verify password → **401** with a generic message if either fails. Sign, set cookie → **200** with id and email |
| `/api/auth/signout` | POST | Clear cookie → **200**. Idempotent — succeeds even with no session |

**Security requirements:**
- Signin must return an identical error message and status whether the email is unknown or the password is wrong
- Run a bcrypt comparison against a dummy hash even when the user is not found, so response timing does not reveal which emails are registered
- No response from any of these routes may contain `passwordHash`

**Tests — API level, calling the exported handlers directly:**
- [ ] Signup with valid input returns 201 and sets a `Set-Cookie` header with `HttpOnly`
- [ ] Signup with an existing email returns 409
- [ ] Signup with an invalid email returns 400
- [ ] Signup with a 5-char password returns 400
- [ ] Signup response body contains no `passwordHash`
- [ ] Signin with correct credentials returns 200 and sets the cookie
- [ ] Signin with a wrong password returns 401
- [ ] Signin with an unknown email returns 401 **with the same body as the wrong-password case**
- [ ] Signout returns 200 and clears the cookie

**Acceptance:**
- [ ] All auth API tests pass
- [ ] Every handler is wrapped in the shared error boundary from `CLAUDE.md`
- [ ] No raw Prisma error, stack trace, or constraint name appears in any response body

**Do NOT do in this phase:** UI, notes, or `proxy.ts`.

---

# PHASE 5 — Route protection and auth UI

**Goal:** unauthenticated users get redirected; authenticated users can sign in and out from the browser.

**Build:**

`proxy.ts` at project root (**Next 16 — not `middleware.ts`**):
- Optimistic check only: if there is no session cookie and the path is protected, redirect to `/login`
- If a session cookie is present and the path is `/login` or `/signup`, redirect to `/notes`
- `config.matcher` covering `/notes` and its subpaths, `/login`, `/signup`
- **Do not verify the JWT here. Do not query the database here.** Add a comment saying why, referencing the authoritative check in `requireUser()`

`app/(auth)/login/page.tsx` and `app/(auth)/signup/page.tsx`:
- Server component page rendering a client component form
- Email and password fields with real `<label htmlFor>`
- Inline field-level errors from the 400 response body
- A form-level error region with `aria-live="polite"` for 401 and 409
- Submit button disabled while the request is in flight, with accessible busy state
- On success, navigate to `/notes` and refresh
- Cross-links between login and signup

A sign-out control in the app shell that POSTs to `/api/auth/signout` and redirects to `/login`.

**Acceptance:**
- [ ] Visiting `/notes` while signed out redirects to `/login`
- [ ] Signing up creates the account and lands on `/notes`
- [ ] Signing in and out works end to end in the browser
- [ ] A wrong password shows a readable message, not a raw error
- [ ] Both forms are fully keyboard operable, submit via Enter
- [ ] The session cookie is visible in devtools as HttpOnly and is **not** in localStorage
- [ ] Deployed to Vercel and the whole flow works on the live URL

**Do NOT do in this phase:** notes or tags.

---

# PHASE 6 — Notes service layer and ownership tests

**Goal:** the security-critical layer. **Write the tests first.**

**Build `lib/notes/service.ts`.** Every exported function takes `userId` as its first parameter. There is no function that reads or writes a note without a user scope.

```
listNotes(userId, { tagIds?, sort, q })  → Note[] with tags
getNote(userId, noteId)                  → Note | throws NotFoundError
createNote(userId, data)                 → Note
updateNote(userId, noteId, data)         → Note | throws NotFoundError
deleteNote(userId, noteId)               → void  | throws NotFoundError
```

**Rules:**
- Ownership goes **in the `where` clause**. Use `findFirst({ where: { id, userId } })`, `updateMany({ where: { id, userId } })`, `deleteMany({ where: { id, userId } })`. Never fetch a row and then compare `note.userId === userId` in application code.
- When a mutation affects zero rows, throw `NotFoundError` — **404, not 403**. A 403 would confirm the resource exists.
- Route handlers must never import `prisma` directly. All notes DB access lives here.

**Tests — write these before the implementation:**
- [ ] `listNotes` returns only the caller's notes
- [ ] `getNote` on another user's note id throws `NotFoundError`
- [ ] `updateNote` on another user's note id throws `NotFoundError` **and leaves the row unchanged**
- [ ] `deleteNote` on another user's note id throws `NotFoundError` **and the row still exists afterwards**
- [ ] `getNote` with a non-existent id throws `NotFoundError`
- [ ] `createNote` assigns the note to the calling user
- [ ] Notes come back with their tags attached

**Acceptance:**
- [ ] All ownership tests pass
- [ ] `grep -rn "prisma\." app` returns nothing
- [ ] No function in the service can be called without a `userId`
- [ ] Tests run against a separate test database, never the dev database

---

# PHASE 7 — Notes API routes

**Goal:** HTTP surface over the service layer.

| Route | Method | Behaviour |
|---|---|---|
| `/api/notes` | GET | `requireUser()` → parse query with `noteQuerySchema` → `listNotes` → 200 |
| `/api/notes` | POST | `requireUser()` → validate → `createNote` → 201 |
| `/api/notes/[id]` | GET | `requireUser()` → `getNote` → 200 / 404 |
| `/api/notes/[id]` | PATCH | `requireUser()` → validate → `updateNote` → 200 / 404 |
| `/api/notes/[id]` | DELETE | `requireUser()` → `deleteNote` → 204 / 404 |

Remember `params` is a Promise in Next 16 — await it.

Handlers must be thin: authenticate, validate, delegate, respond. No business logic, no Prisma.

**Tests:**
- [ ] Every route with no session returns 401
- [ ] GET `/api/notes` returns only the caller's notes
- [ ] POST with an empty title returns 400
- [ ] GET, PATCH, DELETE on another user's note id all return **404**
- [ ] DELETE of an own note returns 204 and the note is gone
- [ ] Malformed JSON in the body returns 400, not 500

**Acceptance:**
- [ ] All notes API tests pass
- [ ] Every handler uses the shared error boundary
- [ ] Status codes match the table exactly

---

# PHASE 8 — Notes UI

**Goal:** create, read, edit, and delete notes in the browser.

**Build:**
- `/notes` as a **server component** that calls `requireUser()` and `listNotes()` directly — do not fetch its own API over HTTP
- `loading.tsx` and `error.tsx` for the notes segment
- Note list as a semantic `<ul>` / `<li>`, each card showing title, body excerpt, created date, and tag chips
- Create form (client component) — inline validation errors, disabled while submitting
- Edit — inline or modal, your choice, but if it is a modal it must trap focus, close on Escape, and return focus to the trigger
- Delete with a confirmation step
- Empty state when the user has no notes
- After every mutation, call `router.refresh()`. Use this consistently — do not mix refresh strategies.

**Acceptance:**
- [ ] Full create / edit / delete cycle works in the browser
- [ ] Signing in as the other seeded user shows a completely different set of notes
- [ ] Errors surface as readable messages, never a stack trace or raw JSON
- [ ] Empty and loading states both render
- [ ] Works end to end on the deployed URL

---

# PHASE 9 — Tags

**Goal:** many-to-many tagging.

**Build:**
- `lib/tags/service.ts` — `listTags(userId)`, `createTag(userId, name)`, `setNoteTags(userId, noteId, tagIds)`
- `setNoteTags` must verify **both** that the note belongs to the user and that every tag id belongs to the user, before writing any join rows. Do this in one transaction.
- `/api/tags` — GET (list own tags, 200), POST (create, 201; duplicate name for the same user → 409)
- Tag assignment on the note create and edit forms — multi-select
- Tag chips rendered on every note card

**Tests:**
- [ ] `listTags` returns only the caller's tags
- [ ] Creating a duplicate tag name for the same user returns 409
- [ ] Two different users can each create a tag with the same name
- [ ] `setNoteTags` with another user's note id throws `NotFoundError`
- [ ] `setNoteTags` with another user's tag id is rejected and writes **no** join rows
- [ ] A note can hold multiple tags and a tag can be on multiple notes
- [ ] Deleting a note removes its join rows but leaves the tags

**Acceptance:**
- [ ] All tag tests pass
- [ ] Tags visible on note cards in the UI
- [ ] No path exists to attach a tag you do not own

---

# PHASE 10 — Filtering, sorting, search

**Goal:** the remaining brief features.

**Build in `listNotes`:**
- **Filter by one or more tags.** Choose AND (note must have every selected tag) or OR (any). Record the choice in `DECISIONS.md` and make the tests assert the chosen behaviour.
- **Sort** by `createdAt`, `newest` or `oldest`
- **Search** by title, case-insensitive substring
- All three must compose — a tag filter plus a search plus a sort in one request
- Every query stays scoped by `userId`

**UI:** tag filter control, sort select, search input. Drive them through URL search params so state survives a refresh and is shareable. The page reads `searchParams` (a Promise in Next 16 — await it).

**Tests:**
- [ ] Filtering by one tag returns only notes carrying it
- [ ] Filtering by two tags matches the chosen AND/OR semantics
- [ ] Sort newest and oldest return opposite orders
- [ ] Search matches case-insensitively and on partial titles
- [ ] Search does not match on body content
- [ ] Filter + search + sort combined returns the correct set in the correct order
- [ ] **Filters never leak another user's notes** — same filter as another user returns only own notes

**Acceptance:**
- [ ] All filter and sort tests pass
- [ ] Controls work in the UI and survive a page refresh
- [ ] An empty result set shows a distinct "no matches" state, not the generic empty state

---

# PHASE 11 — Error handling audit

**Goal:** nothing ugly reaches a user, every status code is deliberate.

**Do:**
- Walk every route handler and confirm the status code matches the table in `CLAUDE.md`
- Confirm every handler uses the shared error boundary
- Confirm no response body contains a Prisma error code, constraint name, stack trace, or raw exception message
- Add `error.tsx` and `not-found.tsx` where missing
- Confirm every client-side fetch has a failure path that renders a message
- Confirm loading and empty states exist on every list and form

**Acceptance:**
- [ ] Manually break the DB connection string locally → the app shows a friendly error, not a stack trace
- [ ] POST malformed JSON to every route → 400, never 500
- [ ] Request a non-existent note id → 404 with a clean body
- [ ] `grep -rn "console.log" app lib components` returns nothing

---

# PHASE 12 — Accessibility

**Goal:** pass the brief's a11y bar.

**Do:**
- Semantic landmarks: `<main>`, `<nav>`, `<header>`; lists as `<ul>`/`<li>`
- One `<h1>` per page, heading levels in order with no skips
- Every input has an associated `<label>`; icon-only buttons have `aria-label`
- Error regions use `aria-live="polite"` and inputs use `aria-describedby` / `aria-invalid`
- Every interactive element is a real `<button>` or `<a>` — no `<div onClick>`
- Visible focus indicators everywhere; never `outline: none` without a replacement
- Modals: focus moves in on open, is trapped, Escape closes, focus returns to the trigger
- Tag filter is operable entirely by keyboard
- Colour contrast at least 4.5:1 for body text

**Acceptance:**
- [ ] Complete every user flow — signup, signin, create, tag, filter, edit, delete, signout — using only the keyboard
- [ ] axe DevTools reports zero violations on every page
- [ ] Lighthouse accessibility score 95+
- [ ] `npm run lint` clean with `jsx-a11y` rules enabled

---

# PHASE 13 — Green run and deploy

**Goal:** provably shippable.

**Checklist:**
- [ ] `npm run lint` — zero errors, zero warnings
- [ ] `npm run test` — all pass
- [ ] `npx tsc --noEmit` — clean
- [ ] `npm run build` — clean
- [ ] `grep -rn ": any\|as any\|<any>" app lib components` — nothing
- [ ] `grep -rn "localStorage\|sessionStorage" app lib components` — nothing
- [ ] `git log -p | grep -i "secret\|password=\|postgres://"` — no real values in history
- [ ] `.env.example` committed with all required keys
- [ ] Vercel build command runs `prisma migrate deploy` before `next build`
- [ ] Production env vars set on Vercel
- [ ] Seed run against production so the test account exists
- [ ] **Sign in on the live URL in a fresh incognito window using the reviewer test account**
- [ ] Sign in as the second seeded user and confirm the note sets are entirely different

---

# PHASE 14 — README

**Goal:** the document the reviewer reads first.

`README.md` must cover, in this order:
1. What the app is, live URL, and the reviewer test account credentials
2. How to run locally — prerequisites, env vars, install, migrate, seed, dev, test
3. **The DB schema and why it was designed this way** — include the relationship diagram, and justify the explicit join model, the per-user tag uniqueness, and the composite primary key
4. **Tradeoffs and shortcuts** taken under the time constraint — be specific and honest
5. **Testing approach and where TDD influenced the implementation** — name the tests that were written before the code and explain what they forced (the ownership tests requiring `userId` in every service signature)
6. **What would be improved with more time**
7. **How AI coding tools were used** — specific and honest: what was generated, what was corrected by hand, what was rejected

Source items 3–6 from `DECISIONS.md`. Do not invent claims that the code does not support.

---

## Traceability — every brief requirement mapped

| Brief requirement | Phase |
|---|---|
| Sign up with email and password | 4 |
| Sign in / sign out | 4 |
| Passwords hashed (bcrypt or argon2) | 3 |
| Protected routes, redirect unauthenticated | 5 |
| Session via JWT or server-side session, not localStorage | 3, 5 |
| Create, edit, delete notes | 7, 8 |
| Notes private to their owner | 6 |
| Server-side ownership checks on every API call | 6, 7 |
| Create and assign tags | 9 |
| Many-to-many via join table | 1, 9 |
| Display tags on each note | 8, 9 |
| Filter by one or more tags | 10 |
| Sort by created date | 10 |
| Search by title | 10 |
| TypeScript strict, no `any` | all, verified 13 |
| ESLint + Prettier, no warnings | 0, verified 13 |
| Meaningful folder structure | `CLAUDE.md` |
| No hardcoded secrets | 0, verified 13 |
| Relational DB, proper schema design | 1 |
| Migrations | 1 |
| User → Notes one-to-many | 1 |
| Notes ↔ Tags many-to-many via join table | 1 |
| Server-side input validation with Zod | 2, 4, 7, 9 |
| Proper HTTP status codes | 4, 7, 9, 11 |
| Graceful frontend error states | 8, 11 |
| TDD on critical paths | 3, 4, 6 |
| Unit tests for utilities and validation | 2, 3 |
| Integration tests for auth flows | 4 |
| API tests for ownership enforcement | 6, 7 |
| Tests for filtering and sorting | 10 |
| All tests pass with `npm run test` | 13 |
| Semantic HTML | 12 |
| Keyboard navigable | 12 |
| ARIA labels where needed | 12 |
| No axe or Lighthouse errors | 12 |
| Deployed and fully functional | 0, 13 |
| Test account provided | 1, 13, 14 |
| README with all six sections | 14 |
