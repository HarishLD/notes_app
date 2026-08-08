# CLAUDE.md

Engineering rules for this repository. **These are binding.** If a task in `requirements.md` conflicts with a rule here, this file wins — flag the conflict rather than guessing.

This is a take-home assignment that will be defended in a live code walkthrough. Every line must be explainable. Prefer boring, obvious code over clever code. If a reviewer would ask "why is this here?", either the answer is in `DECISIONS.md` or the code shouldn't exist.

---

## 1. Non-negotiables

1. **No `any`.** Not `as any`, not `<any>`, not an implicit any. If a type is genuinely unknown, use `unknown` and narrow it.
2. **No `localStorage` or `sessionStorage`.** Anywhere. The brief rules them out for session storage and there is no other need for them here.
3. **Ownership lives in the `where` clause.** Never load a row and compare ids in application code.
4. **No secrets in source.** Everything through `process.env`, every key documented in `.env.example`.
5. **No new dependencies without asking.** The stack is fixed in `requirements.md`.
6. **No `console.log` in application code.** `console.error` is allowed in exactly one place: the unhandled branch of the error boundary.
7. **Never return `passwordHash`** from any function that feeds a response.
8. **Do not hand-edit files under `prisma/migrations/`.** Change the schema and generate a new migration.

---

## 2. Layering — strict, no exceptions

```
Route Handler   →  authenticate, validate, delegate, respond.  No logic. No Prisma.
      ↓
Service Layer   →  all business logic and all DB access.  Always scoped by userId.
      ↓
Prisma Client   →  imported ONLY by lib/**/service.ts and lib/prisma.ts
```

- `app/**` must never import `prisma`. `grep -rn "prisma\." app` must return nothing.
- Server components may call service functions directly. They must not fetch the app's own API over HTTP.
- Services throw typed errors. They never return `NextResponse`, never touch cookies, never know they are in a web request.
- Services are the only place a `userId` scope can be forgotten, which is why they are the only place it is tested exhaustively.

**Every exported service function takes `userId` as its first parameter.** There must be no way to call one without a scope.

---

## 3. Folder structure

```
prisma/
  schema.prisma
  migrations/
  seed.ts
app/
  layout.tsx
  page.tsx
  (auth)/
    login/page.tsx
    signup/page.tsx
  notes/
    page.tsx
    loading.tsx
    error.tsx
  api/
    auth/{signup,signin,signout}/route.ts
    notes/route.ts
    notes/[id]/route.ts
    tags/route.ts
components/
  ui/                      generic, no domain knowledge
  notes/                   note-card, note-form, note-list
  tags/                    tag-chip, tag-filter
lib/
  prisma.ts                singleton
  errors.ts                error classes
  api/
    handler.ts             route() wrapper + toErrorResponse()
    responses.ts           json helpers
  auth/
    password.ts
    jwt.ts
    session.ts             getCurrentUser, requireUser, cookie helpers
  notes/service.ts
  tags/service.ts
  validation/{auth,note,tag}.ts
  generated/prisma/        gitignored
test/
  setup.ts
  factories.ts             createTestUser, createTestNote
proxy.ts
```

Files are `kebab-case.ts`. Components are `PascalCase` exports from `kebab-case.tsx` files. Test files sit in `__tests__/` next to what they test, named `*.test.ts`.

---

## 4. Error handling

### 4.1 The error classes

```ts
// lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  constructor(readonly fields: Record<string, string[]>) {
    super("Invalid input", 400, "VALIDATION_ERROR");
  }
}
export class UnauthorizedError extends AppError {
  constructor() { super("Not authenticated", 401, "UNAUTHORIZED"); }
}
export class ForbiddenError extends AppError {
  constructor() { super("Not allowed", 403, "FORBIDDEN"); }
}
export class NotFoundError extends AppError {
  constructor(message = "Not found") { super(message, 404, "NOT_FOUND"); }
}
export class ConflictError extends AppError {
  constructor(message: string) { super(message, 409, "CONFLICT"); }
}
```

### 4.2 One boundary, not scattered try/catch

**Do not wrap random calls in `try/catch`.** A `try/catch` that logs and rethrows adds nothing. Catch at exactly two places: the route boundary, and any point where you genuinely convert one failure into a different outcome.

```ts
// lib/api/handler.ts
import { NextResponse } from "next/server";
import { AppError, ValidationError } from "@/lib/errors";

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ValidationError) {
    return NextResponse.json(
      { error: err.message, code: err.code, fields: err.fields },
      { status: err.status },
    );
  }
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  // Unknown failure: log the detail server-side, tell the client nothing.
  console.error("[unhandled]", err);
  return NextResponse.json(
    { error: "Something went wrong", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export function route<Ctx>(
  fn: (req: Request, ctx: Ctx) => Promise<NextResponse>,
): (req: Request, ctx: Ctx) => Promise<NextResponse> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return toErrorResponse(err);
    }
  };
}
```

**Every route handler is wrapped:**

```ts
export const POST = route(async (req: Request) => {
  const user = await requireUser();              // throws UnauthorizedError → 401
  const body = await parseJson(req);             // throws ValidationError → 400
  const data = parse(createNoteSchema, body);    // throws ValidationError → 400
  const note = await createNote(user.id, data);  // throws NotFoundError → 404
  return NextResponse.json(note, { status: 201 });
});
```

No `try/catch` inside the handler. The happy path reads top to bottom.

### 4.3 Malformed JSON

`req.json()` throws on a malformed body, which would surface as a 500. Convert it:

```ts
export async function parseJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new ValidationError({ _body: ["Request body must be valid JSON"] });
  }
}
```

This is a legitimate `try/catch` — it converts a failure into a different, deliberate outcome.

### 4.4 Zod at the boundary

```ts
export function parse<T>(schema: z.ZodSchema<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.flatten().fieldErrors);
  return result.data;
}
```

Always `safeParse`, never `parse` directly from Zod.

### 4.5 What must never reach the client

Prisma error codes, constraint names, table or column names, stack traces, raw exception messages, the connection string, or anything else that describes the internals. Log it server-side; return the generic message.

---

## 5. HTTP status codes

| Code | Use |
|---|---|
| 200 | Successful read or update |
| 201 | Resource created |
| 204 | Successful delete, no body |
| 400 | Validation failure or malformed body |
| 401 | No session, or an invalid/expired one |
| 403 | Authenticated but not permitted — **not used for other users' notes** |
| 404 | Not found **or** not owned by the caller |
| 409 | Uniqueness conflict — email taken, duplicate tag name |
| 500 | Unexpected. Generic body only. |

**Another user's resource returns 404, never 403.** A 403 confirms the resource exists, which is an information leak. Record this in `DECISIONS.md`.

### Response shapes

```jsonc
// success — the resource itself, or an array of them
{ "id": "…", "title": "…" }

// error
{ "error": "Invalid input", "code": "VALIDATION_ERROR", "fields": { "title": ["Required"] } }
```

`fields` appears only on validation errors.

---

## 6. Auth rules

- Hash with bcryptjs, cost factor 12. Never store, log, or return a plaintext password.
- Sign with jose, HS256, `sub` = user id, 7-day expiry.
- Session travels in an httpOnly cookie: `httpOnly: true`, `secure` in production, `sameSite: "lax"`, `path: "/"`.
- **`proxy.ts` does an optimistic cookie-presence check only.** No JWT verification, no DB queries. Next.js 16 moved this layer to a routing concern after a middleware auth-bypass CVE; treating it as security would repeat that mistake. Put a comment in the file saying so.
- **`requireUser()` is the authoritative check** and every protected route handler and protected server component calls it first, before anything else.
- Signin failures are indistinguishable: same status, same body, whether the email is unknown or the password is wrong. Run a bcrypt comparison against a dummy hash on the unknown-email path so timing does not leak either.
- `JWT_SECRET` must throw at module load if absent. Never fall back to a literal default.

---

## 7. Next.js rules

- **These are Promises in Next 16 — always await:** `cookies()`, `headers()`, route `params`, page `searchParams`.
- **`proxy.ts`, not `middleware.ts`.** The exported function is named `proxy`.
- Server Components are the default. Add `"use client"` only when a hook or an event handler requires it.
- `"use client"` is a boundary, not a file flag — everything it imports becomes client code. Keep it at the leaves: a server page rendering a small client `<TagFilter />`, not a client page.
- Never import a service, `prisma`, or anything reading `process.env` secrets into a client component.
- Server components read data by calling service functions directly. They do not `fetch()` the app's own API.
- After a mutation from a client component, call `router.refresh()`. **Use this one strategy everywhere** — do not mix optimistic updates and refresh across different components.
- `useRouter` comes from `next/navigation`, not `next/router`.
- Filter, sort, and search state lives in URL search params, not React state, so it survives refresh and is shareable.

---

## 8. Prisma rules

- Prisma 7: the generated client has an explicit `output` path (`lib/generated/prisma`) and is imported from there, **not** from `@prisma/client`. Gitignore the generated directory.
- `migrate dev` does not run `generate` or the seed any more — chain them explicitly.
- Use the pooled connection string for the app (`DATABASE_URL`) and the direct one for migrations (`DIRECT_URL`).
- `lib/prisma.ts` exports a singleton guarded against dev hot-reload creating new pools.
- Use `select` rather than `include` when returning a `User`, so `passwordHash` cannot leak by accident.
- Multi-step writes that must not half-apply go in `prisma.$transaction`. Tag assignment is the case here — validate note ownership and tag ownership, then write join rows, all in one transaction.
- Ownership goes in the `where`: `findFirst({ where: { id, userId } })`, `updateMany({ where: { id, userId } })`, `deleteMany({ where: { id, userId } })`. When `count === 0`, throw `NotFoundError`.

---

## 9. TypeScript rules

- `strict: true`. No `any`, no unchecked `!` on values that can genuinely be null.
- Derive types rather than restating them: `z.infer<typeof schema>` for inputs, Prisma's generated types for rows.
- Function signatures carry explicit return types. Let inference handle locals.
- Prefer `type` for object shapes, `interface` only when declaration merging is needed.
- No default exports except where Next.js requires one (`page.tsx`, `layout.tsx`, `error.tsx`). `proxy.ts` uses a named export — see §7.
- No barrel `index.ts` re-export files. Import from the real path.

---

## 10. Testing rules

- Vitest. `npm run test` maps to `vitest run` — never bare `vitest`, which watches and never exits.
- Tests run against a **separate test database**. Never the dev database. Truncate in `beforeEach`.
- Test through the public surface: exported service functions, exported route handlers. Do not test private helpers.
- No mocking of Prisma. The ownership guarantees are only meaningful against a real database.
- Use factories from `test/factories.ts` — `createTestUser()`, `createTestNote()`. Do not hand-build fixtures in every test.
- Test names state the behaviour: `"returns 404 when the note belongs to another user"`, not `"test getNote"`.
- Every test asserts one behaviour.
- For destructive operations, assert the **negative side effect** too: after a rejected delete, assert the row still exists.

**Written test-first (this is what the brief means by TDD):** all validation schemas, all auth primitives, all auth API flows, every ownership rule, and the filter/sort logic. Written test-after: UI wiring and presentational components.

---

## 11. Accessibility rules

- Interactive elements are `<button>` or `<a>`. Never `<div onClick>`.
- Every input has a `<label htmlFor>`. Icon-only buttons get `aria-label`.
- Lists are `<ul>`/`<li>`. Page structure uses `<main>`, `<nav>`, `<header>`.
- One `<h1>` per page; heading levels never skip.
- Error regions: `aria-live="polite"`. Invalid inputs: `aria-invalid` and `aria-describedby` pointing at the message.
- Never remove focus indicators. Style them if needed.
- Modals: focus moves in on open, is trapped, Escape closes, focus returns to the trigger element.
- `eslint-plugin-jsx-a11y` recommended rules are enabled and must produce zero warnings.

---

## 12. Style

- Named exports. Descriptive names. No abbreviations beyond `req`, `res`, `ctx`, `id`.
- Comments explain **why**, never what. `// 404 not 403 — a 403 would confirm the note exists` is useful. `// get the note` is noise.
- No dead code, no commented-out blocks, no TODOs left in the final commit.
- Tailwind only, no custom CSS files. Plain, functional styling — visual design is not being scored, correctness is.
- Small commits with real messages: `feat: enforce note ownership in service layer`, not `wip` or `fixes`.

---

## 13. Definition of done

A task is not complete until **all** of these hold:

- [ ] `npm run lint` — zero errors, zero warnings
- [ ] `npm run test` — all pass
- [ ] `npx tsc --noEmit` — clean
- [ ] The acceptance criteria for that phase in `requirements.md` all pass
- [ ] No `any`, no `console.log`, no secrets, no `localStorage`
- [ ] Any architectural choice made is appended to `DECISIONS.md`

**Report honestly.** If something does not pass, say which criterion failed and why. Do not describe a phase as complete when it is not — this code is being walked through line by line by a reviewer, and an inaccurate status report costs more time than the failure itself.
