FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y tesseract-ocr && rm -rf /var/lib/apt/lists/*

RUN pip install uv

# uv management
COPY core/pyproject.toml core/pyproject.toml
COPY core/uv.lock core/uv.lock

# single files
COPY core/config.py core/config.py
COPY core/constants.py core/constants.py
COPY core/core.py core/core.py
COPY core/main.py core/main.py
COPY core/output.py core/output.py

# directories
COPY core/lm core/lm
COPY core/config core/config
# need to take out the secrets

RUN uv pip install --system --requirements core/pyproject.toml

EXPOSE 8000

CMD ["uvicorn", "core.main:app", "--host", "0.0.0.0", "--port", "8000"]