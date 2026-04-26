#!/usr/bin/env bash
# Render deployment script for SEVAK backend

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run database migrations (if any)
# python -m backend.migrate

echo "Backend build complete!"
