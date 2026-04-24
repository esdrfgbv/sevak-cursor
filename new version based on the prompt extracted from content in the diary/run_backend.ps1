$ErrorActionPreference = "Stop"

# Run from repo root:
#   .\run_backend.ps1

python -m uvicorn backend.main:app --reload

