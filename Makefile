.PHONY: dev test backend frontend install

VENV := backend/venv/bin

dev: backend frontend

backend:
	cd backend && $(CURDIR)/$(VENV)/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000 &

frontend:
	cd frontend && npm run dev

test:
	cd backend && $(CURDIR)/$(VENV)/python -m pytest -v

install:
	cd backend && $(CURDIR)/$(VENV)/pip install -r requirements.txt
	cd frontend && npm install
