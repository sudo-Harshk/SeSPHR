#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

BASE_URL="${E2E_BASE_URL:-http://127.0.0.1:5173}"
API_URL="${E2E_API_URL:-http://127.0.0.1:5000}"

echo "== Preflight: frontend $BASE_URL"
if ! curl -sf -o /dev/null "$BASE_URL"; then
  echo "Frontend not reachable. Start: cd frontend && npm run dev" >&2
  exit 1
fi

echo "== Preflight: backend $API_URL"
code="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/session" || true)"
if [[ "$code" != "200" && "$code" != "401" && "$code" != "403" ]]; then
  echo "Backend not reachable. Start: cd backend && FLASK_ENV=development python run.py" >&2
  exit 1
fi

echo "== pytest tests/backend"
python -m pytest tests/backend -v

echo "== Playwright"
cd "$ROOT/frontend"
npm run test:e2e

echo "Done. HTML report: cd frontend && npx playwright show-report"
