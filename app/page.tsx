import { redirect } from "next/navigation";

// "/" has nothing of its own to show — send visitors straight to /notes,
// which proxy.ts's existing check then redirects on to /login if they're
// signed out.
export default function Home(): never {
  redirect("/notes");
}
