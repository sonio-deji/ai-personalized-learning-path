# Personalised learning path for WAEC/JAMB Mathematics

A web app, API and knowledge-tracing model service. [CLAUDE.md](CLAUDE.md) describes the research
design and build plan.

## Requirements

Docker with Compose 2.20 or newer. On Windows, in PowerShell as Administrator:

```powershell
wsl --install --no-distribution
# restart Windows, then:
winget install -e --id Docker.DockerDesktop
# open Docker Desktop once and wait for "Engine running"
```

Node and Python are only needed to work outside Docker.

## Start

From the repository root:

```powershell
docker compose up --build
```

| Service  | Address                      | Source           |
| -------- | ---------------------------- | ---------------- |
| web      | http://localhost:3000        | `apps/web`       |
| api      | http://localhost:4000/status | `apps/api`       |
| model    | http://localhost:8000/docs   | `services/model` |
| postgres | localhost:5432               | database `plp`   |

No `.env` is needed. To change ports or the password, copy `.env.example` to `.env`.

The API applies pending migrations and then runs the seed each time it starts.

## Check a first start

```powershell
docker compose up --build -d --wait
docker compose ps
curl.exe http://localhost:4000/status
docker compose exec postgres psql -U plp -d plp -c "select count(*) from questions"
docker compose restart api
docker compose up -d --wait
docker compose exec postgres psql -U plp -d plp -c "select count(*) from questions"
```

Expect four healthy services, `{"database":true,"model":true}`, and a count of 120 (100 practice + 20 test) both times.
If something fails, run `docker compose logs api` (or the name of the failing service).

## Using the app

Open http://localhost:3000 and enter a participant code such as `P017` (3 to 20 letters, digits or
hyphens; case doesn't matter). The first login with a new code needs the consent box ticked and
creates the participant. Later logins with the same code continue where they left off.

Each participant goes through the study in this order; the home page always sends them to their
current step, and the API refuses steps out of order:

1. **Pre-test**: 20 items (2 per topic, `testQuestions` in `seed-data.ts`), no feedback.
2. **Practice**: one question at a time with feedback and mastery bars, under their condition.
3. **Post-test**: the same 20 items, opened as soon as the participant's practice set ends.
4. **SUS survey**: the ten standard System Usability Scale statements ("system" → "app").

The test items are never used in practice, so the tests measure learning rather than memory of
practice questions.

### Conditions

A participant's condition is set when they first log in, from `NEW_USER_CONDITION`:

- `random` (default, for the pilot): permuted blocks of 4, so every 4 sign-ups contain 2 of each
  condition in random order, and the groups never differ by more than 2.
- `fixed` / `personalised`: force one condition while developing, e.g.
  `NEW_USER_CONDITION=personalised docker compose up -d`, then log in with a new code.

What the conditions do in practice:

- `fixed`: topics in curriculum order, up to `FIXED_QUESTIONS_PER_TOPIC` questions each
  (default 5), easiest first.
- `personalised`: the earliest topic not yet mastered, easiest unanswered question first. A
  topic counts as mastered when BKT p_known ≥ 0.95 **and** the student has answered at least
  `PERSONALISED_MIN_ANSWERS` questions on it (default 2), so one lucky guess can't skip a topic.
  Mastered topics are skipped; a topic that runs out of questions is left.

Because the post-test opens when practice ends, personalised participants (whose path is
usually shorter) tend to sit it after fewer questions than fixed-order ones. Record and report
the number of practice answers per participant (`attempts.csv`) alongside the test gains.

The service status page is at http://localhost:3000/status.

### Exporting the data

Each table is written as CSV to stdout. Participant codes are not included; rows link by `user_id`.

```bash
for t in participants attempts tests sus; do
  docker compose exec -T api node dist/src/scripts/export.js $t > $t.csv
done
```

- `participants.csv`: condition, consent, sign-up time.
- `attempts.csv`: one row per practice answer, in order, with `p_bkt` and `p_dkt` (predicted before
  the answer), response time, topic and difficulty.
- `tests.csv`: one row per test item per test (long format), with the test score and duration.
- `sus.csv`: the ten responses and the SUS score (0–100).

## Knowledge tracing (BKT)

Every answer, in both conditions, goes through BKT in the model service. P(correct) predicted
from earlier answers is stored in `attempts.p_bkt` before the student sees the result, and
`mastery.p_known` is updated. If the model service is down, the answer is not stored and the
student is asked to submit again.

The model service reads two files from `ml/` at start-up:

- `ml/artifacts/bkt_params.json`, exported by `ml/01_bkt_starter.ipynb`. Until it exists every
  topic uses placeholder parameters, and `/health` on port 8000 says so.
- `ml/topic_skill_map.csv`, the WAEC/JAMB topic → ASSISTments skill map (see
  `ml/topic_skill_map.md`). A topic's parameters are the mean of its mapped skills' parameters.

After changing either file, run `docker compose restart model`.

## Knowledge tracing (DKT)

DKT (an LSTM, `ml/03_dkt.ipynb`) only **predicts**: on every answer the API sends the student's
earlier answers to `POST /dkt/predict` and stores the result in `attempts.p_dkt`, before the
student sees whether they were right. It does not choose questions; BKT drives the
personalised path (notebook 03 explains why DKT's output is not a mastery estimate).

The model service loads `ml/artifacts/dkt/` (`dkt.onnx` + `dkt_meta.json`, exported by notebook
03) at start-up and refuses to start if the files don't match their checksum or test vectors.
Topics are translated through `ml/topic_skill_map.csv`:

- input: each answer is one event for the topic's first mapped skill that DKT knows;
- output: the mean P(correct) over the topic's mapped skills that DKT knows;
- topics with no known skill (currently Number Bases and Sequences and Series) are left out of
  the input and get the mean over all skills, so their `p_dkt` hardly varies: analyse them
  separately. `GET /dkt/topics` on port 8000 shows the translation.

Without an export the app still works and stores `p_dkt` as null. **Before each pilot session,
check http://localhost:3000/status (or `/status` on the API) shows DKT as loaded.**

The participant code is the only credential, so hand out codes that aren't easy to guess. The
consent wording on the login page is a placeholder until the ethics-approved text is ready.

## Everyday commands

```powershell
docker compose up --build -d   # rebuild after a code change (there is no hot reload in Docker)
docker compose logs -f api
docker compose down            # stop and keep the data
docker compose down -v         # stop and DELETE the database
npm test --workspace @plp/api  # unit tests (after npm ci)
docker run --rm -v "$PWD/services/model:/srv" -w /srv \
  -e DKT_TEST_DIR=/dkt -v "$PWD/ml/artifacts/dkt:/dkt:ro" python:3.13-slim-bookworm \
  sh -c "pip install -q -r requirements-dev.txt && python -m pytest -p no:cacheprovider tests"   # model tests
```

## Questions

`apps/api/prisma/seed-data.ts` is the source of truth. Seeding overwrites seeded rows, so make
edits there and not in the database. Don't reuse a question ID for a different question, because
stored attempts point to it.

The 100 practice questions (10 per topic) and 20 test items are samples written in WAEC/JAMB style. They are not past questions and need
review by a maths teacher before students see them.

Every answer key is checked by `apps/api/prisma/questions.py`, which recomputes each correct
answer independently and compares every question with `seed-data.ts`. It needs only Python 3.8+:

```powershell
python3 apps/api/prisma/questions.py           # verify all questions (exit code 1 on any problem)
python3 apps/api/prisma/questions.py --emit    # print TypeScript for questions added there but not yet seeded
```

To add a question, add a `q(...)` entry with its check to `questions.py`, run `--emit`, paste the
output into `seed-data.ts` after that topic's last question, and run the check again. A passing
check proves the intended answer is right, not that every distractor is wrong, so read the options too.

## Changing the schema

Needs Node 24 and a running Postgres.

```powershell
npm ci
docker compose up -d postgres
$env:DATABASE_URL = "postgresql://plp:plp_dev_password@localhost:5432/plp"
npm run db:migrate --workspace @plp/api -- --name describe_the_change
```

The range checks at the end of the init migration are hand-written SQL and do not appear in
`schema.prisma`.

## Changing Python dependencies

Edit `services/model/requirements.in`, then regenerate the fully pinned `requirements.txt`
from a clean Python 3.13 environment.
