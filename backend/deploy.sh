#!/bin/bash
set -e

STACK_NAME="lifting-tracker"
REGION="${AWS_DEFAULT_REGION:-ap-southeast-2}"
S3_BUCKET="${STACK_NAME}-deploy-$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo '123456789')"

echo "=== Lifting Tracker Backend Deploy ==="
echo "Stack:  $STACK_NAME"
echo "Region: $REGION"
echo ""

# Create S3 deploy bucket if needed
aws s3 mb "s3://$S3_BUCKET" --region "$REGION" 2>/dev/null || true

# Package
echo "Packaging SAM..."
sam package \
  --template-file template.yaml \
  --output-template-file packaged.yaml \
  --s3-bucket "$S3_BUCKET" \
  --region "$REGION"

# Deploy
echo "Deploying CloudFormation stack..."
sam deploy \
  --template-file packaged.yaml \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset

# Get API URL
API_URL=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

# Write frontend config (served by Amplify at /config.json)
CONFIG_FILE="$(cd "$(dirname "$0")/.." && pwd)/config.json"
cat > "$CONFIG_FILE" <<EOF
{
  "apiUrl": "$API_URL",
  "appUrl": "https://liftos.app"
}
EOF

echo ""
echo "✅ Deploy complete!"
echo "API URL: $API_URL"
echo "Updated: $CONFIG_FILE"
echo ""
echo "Redeploy Amplify (or drag-drop index.html + config.json) to pick up the new API URL."
