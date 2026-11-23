// Service status: shows that the stack is wired up. Not linked from the student pages.

// Render per request: API_URL is only known when the container runs.
export const dynamic = "force-dynamic";

const apiUrl = process.env.API_URL ?? "http://127.0.0.1:4000";

type Status = { database: boolean; model: boolean };
type Topic = { id: string; name: string; curriculumOrder: number; questionCount: number };

async function getFromApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${apiUrl}${path}`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const [status, topics] = await Promise.all([
    getFromApi<Status>("/status"),
    getFromApi<Topic[]>("/topics"),
  ]);

  const services = [
    ["API", status !== null],
    ["Database", status?.database],
    ["Model service", status?.model],
  ] as const;

  return (
    <main>
      <h1>WAEC/JAMB Maths Learning Path</h1>

      <h2>Services</h2>
      <ul>
        {services.map(([name, ok]) => (
          <li key={name}>{`${name}: ${ok ? "up" : "unavailable"}`}</li>
        ))}
      </ul>

      <h2>Topics</h2>
      {topics ? (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Topic</th>
              <th>Questions</th>
            </tr>
          </thead>
          <tbody>
            {topics.map((topic) => (
              <tr key={topic.id}>
                <td>{topic.curriculumOrder}</td>
                <td>{topic.name}</td>
                <td>{topic.questionCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Could not load topics.</p>
      )}
    </main>
  );
}
