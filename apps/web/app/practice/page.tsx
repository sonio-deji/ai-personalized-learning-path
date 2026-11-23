import Link from "next/link";
import { redirect } from "next/navigation";
import { api, type Feedback, type NextQuestion, type Progress } from "@/lib/api";
import { getUserId } from "@/lib/session";
import { submitAnswer } from "../actions";

export const dynamic = "force-dynamic";

type Search = Promise<{ attempt?: string; error?: string }>;

export default async function Practice({ searchParams }: { searchParams: Search }) {
  const userId = await getUserId();
  if (!userId) redirect("/");
  const { attempt, error } = await searchParams;

  // After an answer: show whether it was right, then a link on to the next question.
  if (attempt) {
    const res = await api<Feedback>(`/users/${userId}/attempts/${encodeURIComponent(attempt)}`);
    if (res.ok) return <FeedbackView feedback={res.data} />;
    if (res.status === 404 || res.status === 400) redirect("/practice");
    return <Unavailable />;
  }

  const res = await api<NextQuestion>(`/users/${userId}/next-question`);
  if (!res.ok) {
    if (res.error === "user_not_found" || res.status === 400) redirect("/logout");
    return <Unavailable />;
  }

  const next = res.data;
  if (next.done) {
    return (
      <Shell progress={next.progress}>
        <h2>All done</h2>
        <p>You have answered every question in this practice set. Thank you!</p>
      </Shell>
    );
  }

  const { question } = next;
  return (
    <Shell progress={next.progress}>
      {error === "not_current_question" && (
        <p role="alert" className="error">That answer was already submitted. Here is your current question.</p>
      )}
      {error === "invalid_answer" && <p role="alert" className="error">Please choose one of the options.</p>}

      <p className="topic">{question.topic.name}</p>
      <form action={submitAnswer} className="stack">
        <fieldset>
          <legend className="stem">{question.stem}</legend>
          {Object.entries(question.options).map(([key, text]) => (
            <label key={key} className="option">
              <input type="radio" name="answer" value={key} required />
              <span>
                <b>{key}.</b> {text}
              </span>
            </label>
          ))}
        </fieldset>
        <input type="hidden" name="questionId" value={question.id} />
        {/* Server time at render, used to compute the response time on submit. */}
        <input type="hidden" name="servedAt" value={Date.now()} />
        <button type="submit">Submit answer</button>
      </form>
    </Shell>
  );
}

function FeedbackView({ feedback }: { feedback: Feedback }) {
  const { correct, question } = feedback;
  return (
    <Shell>
      <p className="topic">{question.topic.name}</p>
      <p className="stem">{question.stem}</p>
      {correct ? (
        <p className="result correct">Correct!</p>
      ) : (
        <p className="result incorrect">
          Not quite. The answer is <b>{question.answer}. {question.answerText}</b>
        </p>
      )}
      <Link href="/practice" className="button">
        Next question
      </Link>
    </Shell>
  );
}

function Unavailable() {
  return (
    <Shell>
      <p role="alert" className="error">The server is not responding. Please refresh the page in a moment.</p>
    </Shell>
  );
}

function Shell({ progress, children }: { progress?: Progress; children: React.ReactNode }) {
  return (
    <main>
      <header className="bar">
        <span>{progress ? `Question ${Math.min(progress.answered + 1, progress.total)} of ${progress.total}` : ""}</span>
        <form action="/logout" method="post">
          <button type="submit" className="link">Log out</button>
        </form>
      </header>
      {progress && <progress value={progress.answered} max={progress.total} />}
      {children}
    </main>
  );
}
