#!/bin/bash
# Start the DevOps Kanban Backend

cd "$(dirname "$0")"

echo "Starting DevOps Kanban Backend..."
echo "Server will be available at: http://localhost:8000"
echo "Swagger UI: http://localhost:8000/docs"
echo ""

# Check if virtual environment exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start uvicorn
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
