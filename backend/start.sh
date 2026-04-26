#!/usr/bin/env bash
# Start script for Render deployment

# Start the FastAPI server
uvicorn backend.main:app --host 0.0.0.0 --port $PORT
