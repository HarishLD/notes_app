import { z } from "zod";

// Trim/lowercase before validating format, so "  USER@Example.com  " both
// passes and normalizes to the same value the DB stores (User.email is
// unique and stored lowercased). Custom messages replace zod's defaults
// ("Invalid email address" is fine; "Too small: expected string to have
// >=8 characters" is not something to show a user).
const emailField = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address."));

export const signupSchema = z.object({
  email: emailField,
  password: z.string().min(8, "Password must be at least 8 characters."),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const signinSchema = z.object({
  email: emailField,
  // Presence only — no strength rule. Signup already enforced strength when
  // the account was created; re-checking it here would just reject correct
  // passwords created under a since-changed policy.
  password: z.string().min(1, "Enter your password."),
});
export type SigninInput = z.infer<typeof signinSchema>;
