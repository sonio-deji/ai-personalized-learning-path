import Link from "next/link";
import { redirect } from "next/navigation";
import { api, type Feedback, type NextQuestion, type Progress, type TopicMastery } from "@/lib/api";
import { getUserId } from "@/lib/session";
import { requireStage } from "@/lib/stage";
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
    if (res.ok) return <FeedbackView feedback={res.data} mastery={await getMastery(userId)} />;
    if (res.status === 404 || res.status === 400) redirect("/practice");
    return <Unavailable />;
  }

  // Practice is only open after the pre-test; once it's finished, the post-test follows.
  await requireStage(userId, ["practice"]);

  const res = await api<NextQuestion>(`/users/${userId}/next-question`);
  if (!res.ok) {
    if (res.error === "user_not_found" || res.status === 400) redirect("/logout");
    if (res.error === "pre_test_required") redirect("/test");
    return <Unavailable />;
  }

  const next = res.data;
  if (next.done) redirect("/"); // practice finished: on to the post-test
  const mastery = await getMastery(userId);

  const { question } = next;
  return (
    <Shell progress={next.progress} mastery={mastery}>
      {error === "model_unavailable" && (
        <p role="alert" className="error">Your answer could not be saved. Please submit it again.</p>
      )}
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

function FeedbackView({ feedback, mastery }: { feedback: Feedback; mastery: TopicMastery[] | null }) {
  const { correct, question } = feedback;
  return (
    <Shell mastery={mastery}>
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

async function getMastery(userId: string) {
  const res = await api<TopicMastery[]>(`/users/${userId}/mastery`);
  return res.ok ? res.data : null; // the bars are optional; the page works without them
}

function progressLabel({ answered, total }: Progress) {
  return `Question ${Math.min(answered + 1, total)} of ${total}`;
}

function Shell({
  progress,
  mastery,
  children,
}: {
  progress?: Progress;
  mastery?: TopicMastery[] | null;
  children: React.ReactNode;
}) {
  return (
    <main>
      <header className="bar">
        <span>{progress ? progressLabel(progress) : ""}</span>
        <form action="/logout" method="post">
          <button type="submit" className="link">Log out</button>
        </form>
      </header>
      {progress && <progress value={progress.answered} max={progress.total} />}
      {children}
      {mastery && <MasteryBars mastery={mastery} />}
    </main>
  );
}

// Estimated mastery per topic from BKT. Shown to both conditions, so the only difference
// between the groups is how the next question is chosen.
function MasteryBars({ mastery }: { mastery: TopicMastery[] }) {
  return (
    <section className="mastery" aria-label="Your progress by topic">
      <h2>Your topics</h2>
      <ul>
        {mastery.map((t) => {
          const pct = Math.round(t.pKnown * 100);
          return (
            <li key={t.topicId}>
              <span className="name">
                {t.name}
                {t.mastered && <span className="badge"> ✓ mastered</span>}
              </span>
              <span className="track" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                <span className={t.mastered ? "fill done" : "fill"} style={{ width: `${pct}%` }} />
              </span>
              <span className="pct">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
