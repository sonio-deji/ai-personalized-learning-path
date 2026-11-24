import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getUserId } from "@/lib/session";
import { requireStage } from "@/lib/stage";
import { submitSurvey } from "../actions";

export const dynamic = "force-dynamic";

const SCALE = ["Strongly disagree", "Disagree", "Neutral", "Agree", "Strongly agree"];

// System Usability Scale: ten statements, each answered 1 (strongly disagree) to 5 (strongly agree).
export default async function Survey({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/");
  await requireStage(userId, ["survey"]);
  const { error } = await searchParams;

  const res = await api<{ items: string[] }>("/sus/items");
  if (!res.ok) {
    return (
      <main>
        <p role="alert" className="error">The server is not responding. Please refresh the page in a moment.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>About the app</h1>
      <p>Last step: how much do you agree with each statement about the app you used?</p>
      {error && <p role="alert" className="error">Your answers could not be sent. Please submit again.</p>}

      <form action={submitSurvey} className="stack">
        {res.data.items.map((statement, i) => (
          <fieldset key={i} className="test-item">
            <legend className="stem">
              {i + 1}. {statement}
            </legend>
            <div className="scale">
              {SCALE.map((label, j) => (
                <label key={label} className="option">
                  <input type="radio" name={`sus${i}`} value={j + 1} required />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <button type="submit">Submit</button>
      </form>
    </main>
  );
}
