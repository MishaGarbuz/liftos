#!/bin/bash
# Run API locally with SAM CLI
echo "Starting local API on http://localhost:3001"
sam local start-api --port 3001 --template template.yaml
