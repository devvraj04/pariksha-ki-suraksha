#!/bin/bash
# ParikshaSetu AI Edge Node Proctor - Deployment Script
# Targets: Ubuntu-based local servers running inside examination centers

set -e

# Default variables
PORT=${PORT:-8080}
MASTER_API=${MASTER_API:-"http://master.parikshasetu.in/api/v1"}
CENTER_ID=${CENTER_ID:-"unknown-center-uuid"}
ROOM_ID=${ROOM_ID:-"unknown-room-uuid"}
IMAGE_NAME="parikshasetu-edge-node"

echo "=== PARIKSHASETU AI: DEPLOYING EDGE PROCTOR NODE ==="
echo "Configuring node for Center: ${CENTER_ID}, Room: ${ROOM_ID}"

# 1. Check Docker installation
if ! [ -x "$(command -v docker)" ]; then
  echo "Error: docker is not installed. Installing docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
fi

# 2. Build Docker container
echo "Building edge node Docker container..."
docker build -t $IMAGE_NAME .

# 3. Stop existing container if any
if [ "$(docker ps -aq -f name=parikshasetu_edge)" ]; then
    echo "Stopping and removing existing edge container..."
    docker stop parikshasetu_edge || true
    docker rm parikshasetu_edge || true
fi

# 4. Run the edge node container
echo "Starting Edge Proctor Node container on port ${PORT}..."
docker run -d \
  --name parikshasetu_edge \
  -p ${PORT}:8080 \
  -e MASTER_API_URL=${MASTER_API} \
  -e EDGE_CENTER_ID=${CENTER_ID} \
  -e EDGE_ROOM_ID=${ROOM_ID} \
  --restart unless-stopped \
  $IMAGE_NAME

echo "Edge node deployed successfully!"
echo "Check health at: http://localhost:${PORT}/health"
echo "Check Docker logs: docker logs -f parikshasetu_edge"
