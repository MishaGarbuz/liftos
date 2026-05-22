#!/bin/bash
# Add an existing Cognito user to the admins group (program preview, admin tools).
set -e

export AWS_PAGER=""

REGION="${AWS_DEFAULT_REGION:-ap-southeast-2}"
STACK_NAME="${STACK_NAME:-lifting-tracker}"
GROUP_NAME="${COGNITO_ADMIN_GROUP:-admins}"

POOL_ID=$(aws cloudformation describe-stacks \
  --stack-name "$STACK_NAME" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" \
  --output text)

EMAIL="${1:-}"

if [[ -z "$POOL_ID" || "$POOL_ID" == "None" ]]; then
  echo "Could not find CognitoUserPoolId. Deploy the stack first: ./deploy.sh"
  exit 1
fi

if [[ -z "$EMAIL" ]]; then
  echo "Usage: ./grant-admin.sh <email>"
  echo "Example: ./grant-admin.sh you@example.com"
  exit 1
fi

echo "Adding $EMAIL to Cognito group '$GROUP_NAME' in pool $POOL_ID ..."
aws cognito-idp admin-add-user-to-group \
  --user-pool-id "$POOL_ID" \
  --username "$EMAIL" \
  --group-name "$GROUP_NAME" \
  --region "$REGION"

echo "Done. Sign out and sign in again at https://www.auxos.app so your ID token includes the admins group."
