import { redirect } from "next/navigation";
import { api, type TestItems } from "@/lib/api";
import { getUserId } from "@/lib/session";
import { requireStage } from "@/lib/stage";
import { submitTest } from "../actions";

export const dynamic = "force-dynamic";

const INTRO = {
  pre: {
    title: "Starting test",
    text: "Before you start practising, please answer these 20 questions. You won't be told which answers are right. It's fine not to know some of them: just choose the answer you think is best.",
  },
  post: {
    title: "Final test",
    text: "You have finished your practice. Please answer these 20 questions once more. You won't be told which answers are right: just choose the answer you think is best.",
  },
};

export default async function TestPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const userId = await getUserId();
  if (!userId) redirect("/");
  const stage = await requireStage(userId, ["pre_test", "post_test"]);
  const { error } = await searchParams;
  if (!stage) return <Unavailable />;

  const kind = stage === "pre_test" ? "pre" : "post";
  const res = await api<TestItems>(`/users/${userId}/tests/${kind}`);
  if (!res.ok) {
    if (res.error === "wrong_stage") redirect("/");
    return <Unavailable />;
  }

  return (
    <main>
      <h1>{INTRO[kind].title}</h1>
      <p>{INTRO[kind].text}</p>
      {error && <p role="alert" className="error">Your answers could not be sent. Please submit again.</p>}

      <form action={submitTest} className="stack">
        {res.data.items.map((item, i) => (
          <fieldset key={item.id} className="test-item">
            <legend className="stem">
              {i + 1}. {item.stem}
            </legend>
            {Object.entries(item.options).map(([key, text]) => (
              <label key={key} className="option">
                <input type="radio" name={`q:${item.id}`} value={key} required />
                <span>
                  <b>{key}.</b> {text}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
        <input type="hidden" name="kind" value={kind} />
        {/* Server time at render, used to record how long the test took. */}
        <input type="hidden" name="servedAt" value={Date.now()} />
        <button type="submit">Submit test</button>
      </form>
    </main>
  );
}

function Unavailable() {
  return (
    <main>
      <p role="alert" className="error">The server is not responding. Please refresh the page in a moment.</p>
    </main>
  );
}
