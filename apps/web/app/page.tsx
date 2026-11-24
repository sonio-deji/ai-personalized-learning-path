import { redirect } from "next/navigation";
import { getUserId } from "@/lib/session";
import { getStage, STAGE_PATH } from "@/lib/stage";
import { login } from "./actions";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid_code: "Enter your participant code: 3 to 20 letters, digits or hyphens (for example P017).",
  consent_required: "This is a new participant code. Please read and tick the consent box to begin.",
  api_unreachable: "The server is not responding. Please try again in a moment.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const userId = await getUserId();
  if (userId) {
    const stage = await getStage(userId);
    if (stage) redirect(STAGE_PATH[stage]);
    return (
      <main>
        <p role="alert" className="error">The server is not responding. Please refresh the page in a moment.</p>
      </main>
    );
  }

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
