FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV and YOLOv8
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy and install requirements
COPY workers/vision_agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source files
COPY workers/vision_agent /app/workers/vision_agent

ENV PYTHONPATH=/app

CMD ["python", "workers/vision_agent/agent.py"]
