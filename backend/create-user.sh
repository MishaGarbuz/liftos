#!/bin/bash
# Create your single LiftOS login (run once after deploy)
set -e

REGION="${AWS_DEFAULT_REGION:-ap-southeast-2}"
STACK_NAME="${STACK_NAME:-lifting-tracker}"

POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" \
  --output text)

if [[ -z "$POOL_ID" || "$POOL_ID" == "None" ]]; then
  echo "Could not find CognitoUserPoolId. Deploy the stack first: ./deploy.sh"
  exit 1
fi

EMAIL="${1:-}"
PASSWORD="${2:-}"

if [[ -z "$EMAIL" || -z "$PASSWORD" ]]; then
  echo "Usage: ./create-user.sh <email> <password>"
  echo "Example: ./create-user.sh you@example.com 'YourSecurePass123!'"
  exit 1
fi

echo "Creating user $EMAIL in pool $POOL_ID ..."

aws cognito-idp admin-create-user \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=email_verified,Value=true \
  --message-action SUPPRESS \
  --region "$REGION" 2>/dev/null || true

aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --password "$PASSWORD" \
  --permanent \
  --region "$REGION"

echo "Done. Sign in at https://www.liftos.net with that email and password."
