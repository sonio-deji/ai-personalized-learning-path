import { redirect } from "next/navigation";
import { getUserId } from "@/lib/session";
import { login } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid_code: "Enter your participant code: 3 to 20 letters, digits or hyphens (for example P017).",
  consent_required: "This is a new participant code. Please read and tick the consent box to begin.",
  api_unreachable: "The server is not responding. Please try again in a moment.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getUserId()) redirect("/practice");
  const { error } = await searchParams;

  return (
    <main>
      <h1>WAEC/JAMB Maths Practice</h1>

      {error && (
        <p role="alert" className="error">
          {ERRORS[error] ?? "Something went wrong. Please try again."}
        </p>
      )}

      <form action={login} className="stack">
        <label>
          Participant code
          <input name="code" required autoComplete="off" autoCapitalize="characters" placeholder="e.g. P017" />
        </label>

        {/* Placeholder wording: replace with the ethics-approved consent text before the pilot. */}
        <label className="check">
          <input type="checkbox" name="consent" />
          <span>
            I am 18 or older. I agree that my answers and response times are recorded,
            without my name, for a research study on personalised maths practice.
            (Only needed the first time you log in.)
          </span>
        </label>

        <button type="submit">Start</button>
      </form>
    </main>
  );
}
