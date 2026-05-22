#!/bin/bash
set -e
ZONE_ID="${1:-}"
BATCH_FILE="${2:-route53-auxos-app.json}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -z "$ZONE_ID" ]]; then
  echo "Usage: ./apply-dns.sh <HOSTED_ZONE_ID> [route53-batch.json]"
  echo "Default batch: route53-auxos-app.json (auxos.app + www)"
  exit 1
fi
aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "file://${SCRIPT_DIR}/${BATCH_FILE}"
echo "Route 53 DNS updated from ${BATCH_FILE}"
