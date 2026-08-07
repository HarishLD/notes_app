// Vitest does not load .env files itself. Route handlers and services read
// secrets straight from process.env, so tests need the same values loaded
// before any module (e.g. lib/auth/jwt.ts) runs its module-load checks.
import "dotenv/config";
