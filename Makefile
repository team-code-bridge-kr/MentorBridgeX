.PHONY: up down logs api test harness lint

up:
	docker compose up -d postgres neo4j redis

down:
	docker compose down

logs:
	docker compose logs -f api

api:
	cd services/api && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

api-offline:
	cd services/api && OFFLINE_DEMO=1 uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

api-docker:
	docker compose up api

test:
	cd services/api && python -m pytest tests/ -v

harness:
	cd services/api && python -m pytest tests/harness/ -v

lint:
	cd services/api && ruff check app tests && ruff format --check app tests
