FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV, pyzbar, and pylibdmtx
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1 \
    libglib2.0-0t64 \
    libzbar0 \
    libdmtx0b \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY workers/forensic_worker/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source files
COPY workers/forensic_worker /app/workers/forensic_worker

ENV PYTHONPATH=/app

CMD ["python", "workers/forensic_worker/worker.py"]
