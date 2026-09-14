#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

# Install backend dependencies
pip install -r requirements.txt

# Collect static files with WhiteNoise
python manage.py collectstatic --no-input

# Run database migrations on Supabase
python manage.py migrate
