# SeSPHR local dev + test workflow (no Docker)
# Override URLs: make test FE_URL=http://127.0.0.1:5175

.PHONY: dev test test-backend test-e2e check reset report status

FE_URL ?= http://127.0.0.1:5173
BE_URL ?= http://127.0.0.1:5000

# ----------------------------
# Start backend + frontend (Windows)
# ----------------------------
dev:
	@echo "Starting backend and frontend..."
	@start powershell -NoExit -Command "cd backend; $$env:FLASK_ENV='development'; python run.py"
	@start powershell -NoExit -Command "cd frontend; npm run dev"

# ----------------------------
# Health check
# ----------------------------
check:
	@echo "== Checking services =="
	@echo "Backend: $(BE_URL)/api/session"
	@code=$$(curl -s -o /dev/null -w "%{http_code}" "$(BE_URL)/api/session" || echo "000"); \
	if [ "$$code" != "200" ] && [ "$$code" != "401" ] && [ "$$code" != "403" ]; then \
		echo "ERROR: Backend not reachable or unexpected HTTP $$code." >&2; \
		echo "Start: cd backend && FLASK_ENV=development python run.py" >&2; \
		exit 1; \
	fi
	@echo "Frontend: $(FE_URL)"
	@curl -sf -o /dev/null "$(FE_URL)" || { \
		echo "ERROR: Frontend not reachable at $(FE_URL)." >&2; \
		echo "Start: cd frontend && npm run dev" >&2; \
		exit 1; \
	}
	@echo "OK — backend and frontend are reachable."

# ----------------------------
# Reset state (dev-only)
# ----------------------------
reset:
	@echo "== Resetting state =="
	@curl -sS -f -X POST "$(BE_URL)/api/debug/clear-uploads" -o /dev/null || { \
		echo "ERROR: POST /api/debug/clear-uploads failed." >&2; \
		echo "Ensure FLASK_ENV=development and backend is running." >&2; \
		exit 1; \
	}
	@curl -sS -f -X POST "$(BE_URL)/api/debug/clear-audit-log" -o /dev/null || { \
		echo "ERROR: POST /api/debug/clear-audit-log failed." >&2; \
		exit 1; \
	}
	@echo "OK — uploads and audit log cleared."

# ----------------------------
# Full test pipeline
# ----------------------------
test:
	@echo "Backend: $(BE_URL)"
	@echo "Frontend: $(FE_URL)"
	@$(MAKE) check BE_URL="$(BE_URL)" FE_URL="$(FE_URL)"
	@$(MAKE) reset BE_URL="$(BE_URL)" FE_URL="$(FE_URL)"
	@echo "== Running backend tests =="
	@python -m pytest tests/backend -v || exit 1
	@echo "== Running E2E tests =="
	@cd frontend && E2E_BASE_URL=$(FE_URL) npm run test:e2e && npx playwright show-report

# ----------------------------
# Backend only
# ----------------------------
test-backend:
	@echo "== Running backend tests =="
	@python -m pytest tests/backend -v

# ----------------------------
# E2E only
# ----------------------------
test-e2e:
	@echo "== Running E2E tests =="
	@cd frontend && E2E_BASE_URL=$(FE_URL) npm run test:e2e

# ----------------------------
# Open report manually
# ----------------------------
report:
	@cd frontend && npx playwright show-report

# ----------------------------
# Quick status check
# ----------------------------
status:
	@echo "Checking services..."
	@curl -s "$(BE_URL)/api/session" > /dev/null && echo "Backend OK"
	@curl -s "$(FE_URL)" > /dev/null && echo "Frontend OK"