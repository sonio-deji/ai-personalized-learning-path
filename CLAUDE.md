# Project: AI-Driven Personalised Learning Path for WAEC/JAMB Mathematics Using Knowledge Tracing

12-week M.Sc. project (Nigeria). The author is strong in React/Next.js, Node.js, Kubernetes and cloud, and newer to ML, so explain ML code clearly.

## What the system does
Students answer WAEC/JAMB maths questions in a web app. A knowledge-tracing (KT) model estimates each student's mastery of each topic after every answer, and the app picks the next question the student most needs. It needs an internet connection; it is **not** offline-first, so don't add PWA/service-worker/IndexedDB work.

## Research question
Can a KT model trained on foreign student data (ASSISTments 2009; Eedi or Junyi as backups) predict Nigerian students' performance and choose useful next questions, and how does it compare with a fixed sequence of questions?

Compared conditions/models:
- **Fixed order** (baseline, no ML): topics in curriculum order, N questions each.
- **BKT** (pyBKT / NumPy implementation; per-skill prior, learn, guess, slip).
- **DKT** (LSTM in PyTorch).

Evaluation: AUC on Nigerian students' answers; a 1–2 week pilot with 30–60 students aged 18+ (pre-degree/JUPEB) comparing pre/post-test gains for the personalised path vs fixed order; SUS survey.

## Architecture
```
Next.js web app  ->  Node.js API  ->  FastAPI model service
(student UI)         (auth, questions,   (BKT update, DKT predict)
                     attempts, policy)
                         |
                     PostgreSQL          MLflow (model versions)
```
- The model service **only predicts** mastery per topic. The **Node API owns the next-question policy** and condition assignment, so fixed / BKT / DKT can be swapped with one setting.
- BKT state is stored in Postgres (`mastery` table). Each update needs only the current p_known and the latest answer.
- DKT needs the student's full attempt history on every call.
- Topic↔skill translation (WAEC/JAMB topic → ASSISTments skill IDs and back) happens **inside the model service**, using `ml/topic_skill_map.csv` (the Q-matrix). A topic's mastery is the average over its mapped skills.

## Repo layout
```
apps/web/          Next.js (TypeScript)
apps/api/          Node.js (Express or Fastify) + Prisma
services/model/    FastAPI: POST /bkt/update, POST /dkt/predict, GET /health
ml/                notebooks (01_bkt_starter.ipynb exists), training scripts, topic_skill_map.csv
infra/             docker-compose.yml, k8s/ manifests, .github/workflows
```

## Data model (PostgreSQL)
- `users`: id, condition ('personalised' | 'fixed'), consent, created_at
- `topics`: id, name, curriculum_order (10–15 WAEC/JAMB topics)
- `questions`: id, topic_id, stem, options (json), answer, source, difficulty
- `attempts`: id, user_id, question_id, correct, response_time_ms, created_at, **p_bkt, p_dkt**
- `mastery`: user_id, topic_id, p_known, updated_at
- `tests`: pre/post test items and scores; `sus_responses`

**Critical:** before revealing whether an answer is correct, store both models' predicted P(correct) in `attempts.p_bkt` and `attempts.p_dkt`. These are the data for the AUC evaluation (RQ1/RQ2).

## BKT update (reference)
```
p_correct = pK*(1-slip) + (1-pK)*guess
post      = correct ? pK*(1-slip)/p_correct : pK*slip/(1-p_correct)
pK_next   = post + (1-post)*learn
```
Mastery threshold: 0.95. Bound guess ≤ 0.30 and slip ≤ 0.40 when fitting (avoids degenerate fits). Parameters are exported by `ml/01_bkt_starter.ipynb` to `artifacts/bkt_params.json` as `{default, skills: {skill: {prior, learn, guess, slip}}}`.

## ML conventions
- Split train/test **by student** (GroupShuffleSplit), never by row.
- ASSISTments cleaning: drop null skills; keep `original == 1`; `correct` in {0,1}; dedupe on (order_id, skill_name); drop skills with fewer than 50 rows; sort by order_id. Document every preprocessing choice.
- Report AUC, RMSE, accuracy and log-loss. Log runs to MLflow.

## Build order (weeks 3–10)
1. Week 3: monorepo, `docker compose up` (postgres, api, model, web), schema, ~50 seeded questions.
2. Week 4: working loop with **no ML**: login → answer → next question in fixed order (this is the baseline).
3. Week 5: BKT in FastAPI plus the mastery policy; mastery bars in the UI.
4. Weeks 6–7: train DKT on ASSISTments, register it in MLflow, serve it, store p_dkt.
5. Week 8: random condition assignment, pre/post tests, SUS form, CSV export for analysis.
6. Week 9: GitHub Actions CI/CD, Kubernetes deploy (one small cluster or k3s), dry run with 3–5 users.
7. Week 10: fixes and code freeze. Week 11 is the pilot; week 12 is the write-up.

## Preferences
- TypeScript for web and API; Python 3.11+ for the model service and ML.
- Keep Kubernetes simple; use Docker Compose for everyday development.
- Add tests for the BKT update and the next-question policy.
