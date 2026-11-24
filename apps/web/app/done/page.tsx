import { redirect } from "next/navigation";
import { getUserId } from "@/lib/session";
import { requireStage } from "@/lib/stage";

export const dynamic = "force-dynamic";

export default async function Done() {
  const userId = await getUserId();
  if (!userId) redirect("/");
  await requireStage(userId, ["finished"]);

  return (
    <main>
      <h1>Thank you!</h1>
      <p>You have finished the study. Your answers have been saved. You can close this page now.</p>
      <form action="/logout" method="post">
        <button type="submit">Log out</button>
      </form>
    </main>
  );
}
