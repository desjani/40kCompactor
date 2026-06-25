#!/bin/bash
# Script to automate Unraid container updates for 40kCompactor
set -e

SSH_HOST="METRON"
SSH_USER="root"
REMOTE_PATH="/mnt/user/appdata/40kCompactor"
CONTAINER_NAME="40k-compactor-bot"

echo "Checking SSH connection to $SSH_USER@$SSH_HOST..."
if ! ssh -o BatchMode=yes -o ConnectTimeout=5 "${SSH_USER}@${SSH_HOST}" exit; then
  echo "Error: Connection to ${SSH_USER}@${SSH_HOST} failed or timed out." >&2
  exit 1
fi

echo "Connection successful. SSHing into remote host to perform updates..."

ssh "${SSH_USER}@${SSH_HOST}" "bash -s" << EOF
  set -e
  echo "Navigating to remote directory..."
  cd "${REMOTE_PATH}"

  echo "Pulling latest changes..."
  git pull

  echo "Stopping and removing existing container..."
  docker stop "${CONTAINER_NAME}" || true
  docker rm "${CONTAINER_NAME}" || true

  echo "Rebuilding image..."
  docker build -t "${CONTAINER_NAME}" -f DiscordApp/Dockerfile .

  echo "Running container..."
  docker run -d --name "${CONTAINER_NAME}" --restart unless-stopped --env-file DiscordApp/.env "${CONTAINER_NAME}"

  echo "Verifying container status..."
  docker ps | grep "${CONTAINER_NAME}"
EOF

echo "Deployment complete!"
