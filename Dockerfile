# Backend image for Supplier Resilience Radar (Railway)
FROM python:3.11-slim

WORKDIR /app

# Install CPU-only torch FIRST so sentence-transformers does not pull the
# multi-GB CUDA build. This is the single biggest lever on image size.
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Bake the embedding model into the image so the first ?fresh=true run does not
# download it at request time. Remove these two lines to shrink the image by
# ~100MB at the cost of a slower first fresh run.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy the app, INCLUDING data/cache/SUP-001.json (the committed demo brief)
COPY . .

# Railway injects $PORT
CMD ["sh", "-c", "uvicorn backend.api:app --host 0.0.0.0 --port ${PORT:-8000}"]
