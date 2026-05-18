#!/bin/bash
set -e
ZONE_ID="${1:-Z03414742IJ0Z5D5LLNGB}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
aws route53 change-resource-record-sets \
  --hosted-zone-id "$ZONE_ID" \
  --change-batch "file://${SCRIPT_DIR}/route53-liftos-net.json"
echo "Route 53 DNS updated for liftos.net"
