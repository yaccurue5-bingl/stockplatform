.PHONY: help install install-dev clean test lint format build run setup check docs

# Default target
help:
	@echo "Stock Platform - Development Makefile"
	@echo ""
	@echo "Available targets:"
	@echo "  make install        - Install production dependencies"
	@echo "  make install-dev    - Install development dependencies"
	@echo "  make setup          - Full setup (install-dev + pre-commit)"
	@echo "  make clean          - Remove build artifacts and cache"
	@echo "  make test           - Run tests with coverage"
	@echo "  make lint           - Run all linters (black, isort, flake8)"
	@echo "  make format         - Format code with black and isort"
	@echo "  make check          - Run lint + test"
	@echo "  make build          - Build distribution packages"
	@echo "  make run            - Run FastAPI server"
	@echo "  make docs           - Generate documentation"

# Installation
install:
	pip install -e .

install-dev:
	pip install -e ".[dev]"
	pip install pre-commit

setup: install-dev
	pre-commit install
	@echo "✅ Development environment ready!"

# Cleaning
clean:
	rm -rf build/
	rm -rf dist/
	rm -rf *.egg-info
	rm -rf .pytest_cache/
	rm -rf .coverage
	rm -rf htmlcov/
	rm -rf .mypy_cache/
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	@echo "✅ Cleaned build artifacts"

# Testing
test:
	pytest -v --cov=scripts --cov-report=term-missing --cov-report=html

test-fast:
	pytest -v -x

test-watch:
	pytest-watch -v

# Linting
lint:
	@echo "Running black..."
	black --check .
	@echo "Running isort..."
	isort --check-only .
	@echo "Running flake8..."
	flake8 .
	@echo "✅ All linters passed"

lint-fix:
	black .
	isort .
	@echo "✅ Code formatted"

format: lint-fix

# Type checking
type-check:
	mypy scripts/ --ignore-missing-imports

# Combined checks
check: lint test
	@echo "✅ All checks passed"

# Building
build: clean
	python -m build
	twine check dist/*
	@echo "✅ Build complete"

# Running
run:
	python main.py

run-dev:
	uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Database scripts
db-import-ksic:
	python scripts/import_ksic_data.py

db-validate-ksic:
	python scripts/validate_ksic_data.py

db-map-companies:
	python scripts/map_companies_to_ksic.py

db-setup-all: db-import-ksic db-validate-ksic db-map-companies
	@echo "✅ Database setup complete"

# Documentation
docs:
	@echo "Generating documentation..."
	@echo "API docs available at: http://localhost:8000/docs"

# Pre-commit
pre-commit:
	pre-commit run --all-files

# Utility targets
.PHONY: version
version:
	@python -c "import sys; print(f'Python {sys.version}')"
	@pip --version
