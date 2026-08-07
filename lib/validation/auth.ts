import { z } from "zod";

// Trim/lowercase before validating format, so "  USER@Example.com  " both
// passes and normalizes to the same value the DB stores (User.email is
// unique and stored lowercased).
const emailField = z.string().trim().toLowerCase().pipe(z.email());

export const signupSchema = z.object({
  email: emailField,
  password: z.string().min(8),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: emailField,
  // Presence only — no strength rule. Signup already enforced strength when
  // the account was created; re-checking it here would just reject correct
  // passwords created under a since-changed policy.
  password: z.string().min(1),
});
export type SigninInput = z.infer<typeof signinSchema>;
