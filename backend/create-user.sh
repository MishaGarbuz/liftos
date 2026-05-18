#!/bin/bash
# Create your single LiftOS login (run once after deploy)
set -e

export AWS_PAGER=""

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
  --region "$REGION" \
  --output text >/dev/null 2>&1 || true

echo "Setting permanent password ..."
aws cognito-idp admin-set-user-password \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --password "$PASSWORD" \
  --permanent \
  --region "$REGION"

STATUS=$(aws cognito-idp admin-get-user \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --region "$REGION" \
  --query UserStatus \
  --output text)

if [[ "$STATUS" != "CONFIRMED" ]]; then
  echo "Warning: user status is $STATUS (expected CONFIRMED)."
  echo "Re-run this script with the same email and password, or set password in AWS Console."
  exit 1
fi

echo "Done ($STATUS). Sign in at https://www.liftos.net with that email and password."
