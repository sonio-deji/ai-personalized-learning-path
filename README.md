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

Expect four healthy services, `{"database":true,"model":true}`, and a count of 20 both times.
If something fails, run `docker compose logs api` (or the name of the failing service).

## Using the app

Open http://localhost:3000 and enter a participant code such as `P017` (3 to 20 letters, digits or
hyphens; case doesn't matter). The first login with a new code needs the consent box ticked and
creates the participant. Later logins with the same code continue where they left off.

Students then answer questions one at a time and see whether each answer was right before moving
on. For now every participant gets the **fixed order**: topics in curriculum order, up to
`FIXED_QUESTIONS_PER_TOPIC` questions each (default 5, set on the `api` service), easiest first.
The service status page is at http://localhost:3000/status.

The participant code is the only credential, so hand out codes that aren't easy to guess. The
consent wording on the login page is a placeholder until the ethics-approved text is ready.

## Everyday commands

```powershell
docker compose up --build -d   # rebuild after a code change (there is no hot reload in Docker)
docker compose logs -f api
docker compose down            # stop and keep the data
docker compose down -v         # stop and DELETE the database
npm test --workspace @plp/api  # unit tests (after npm ci)
```

## Questions

`apps/api/prisma/seed-data.ts` is the source of truth. Seeding overwrites seeded rows, so make
edits there and not in the database. Don't reuse a question ID for a different question, because
stored attempts point to it.

The 20 questions are samples written in WAEC/JAMB style. They are not past questions and need
review by a maths teacher before students see them.

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
