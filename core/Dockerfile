FROM python:3.12-slim

WORKDIR /app
COPY . .

RUN apt-get update && apt-get install -y tesseract-ocr && rm -rf /var/lib/apt/lists/*

RUN pip install uv
RUN uv pip install --system -r core/pyproject.toml

EXPOSE 8000

CMD ["uvicorn", "core.main:app", "--host", "0.0.0.0", "--port", "8000"]