#!/bin/bash

# Gallery Debug Script
# Tests RPC, Contract, and IPFS connectivity

echo "🔍 Gallery Debug Tool"
echo "===================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CONTRACT="0x136b70baaDA29Dd86190F85F45281b0C0d1bdeDC"
RPC="https://testnet.rpc.intuition.systems"
EXPECTED_CHAIN_ID="0x350b"  # 13579 in hex

echo "📡 Test 1: RPC Endpoint"
echo "----------------------"
CHAIN_ID=$(curl -s -X POST $RPC \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' \
  | grep -o '"result":"[^"]*"' | cut -d'"' -f4)

if [ "$CHAIN_ID" = "$EXPECTED_CHAIN_ID" ]; then
  echo -e "${GREEN}✅ RPC is UP! Chain ID: $CHAIN_ID (13579)${NC}"
else
  echo -e "${RED}❌ RPC FAILED or wrong chain. Got: $CHAIN_ID${NC}"
  echo -e "${YELLOW}💡 The Intuition network may be down${NC}"
fi
echo ""

echo "📝 Test 2: Contract baseURI()"
echo "----------------------------"
# Call baseURI() function (selector: 0x6c0360eb)
BASE_URI_HEX=$(curl -s -X POST $RPC \
  -H "Content-Type: application/json" \
  -d "{\"jsonrpc\":\"2.0\",\"method\":\"eth_call\",\"params\":[{\"to\":\"$CONTRACT\",\"data\":\"0x6c0360eb\"},\"latest\"],\"id\":1}" \
  | grep -o '"result":"[^"]*"' | cut -d'"' -f4)

if [ -n "$BASE_URI_HEX" ] && [ "$BASE_URI_HEX" != "0x" ]; then
  echo -e "${GREEN}✅ Contract responded${NC}"
  echo "Raw hex: $BASE_URI_HEX"
  # Note: Decoding hex to string requires more complex parsing
else
  echo -e "${RED}❌ Contract call failed${NC}"
fi
echo ""

echo "🌐 Test 3: IPFS Gateways"
echo "------------------------"
CID="bafybeiblnvkisfvcxeferver2gjazzlt44mje53ql6wauv6jwcdc2utg2u"
GATEWAYS=(
  "https://nftstorage.link/ipfs/"
  "https://cloudflare-ipfs.com/ipfs/"
  "https://ipfs.io/ipfs/"
  "https://gateway.pinata.cloud/ipfs/"
  "https://dweb.link/ipfs/"
)

for gateway in "${GATEWAYS[@]}"; do
  url="${gateway}${CID}/1.json"
  status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url")
  
  gateway_name=$(echo $gateway | sed 's|https://||' | sed 's|/ipfs/||')
  
  if [ "$status" = "200" ]; then
    echo -e "${GREEN}✅ $gateway_name - OK${NC}"
  else
    echo -e "${RED}❌ $gateway_name - HTTP $status${NC}"
  fi
done
echo ""

echo "📦 Test 4: Metadata Fetch"
echo "-------------------------"
METADATA=$(curl -s --max-time 10 "https://ipfs.io/ipfs/${CID}/1.json")
if echo "$METADATA" | grep -q "Milo"; then
  echo -e "${GREEN}✅ Metadata loaded successfully!${NC}"
  echo "$METADATA" | head -5
else
  echo -e "${RED}❌ Metadata fetch failed${NC}"
fi
echo ""

echo "🖼️  Test 5: Image Accessibility"
echo "------------------------------"
IMAGE_CID="bafybeiem2wj7wzpvv4ifw4z45vvdckp6o6fzjn2v3mql35chpnn4nl3tre"
IMAGE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "https://ipfs.io/ipfs/${IMAGE_CID}/image-kitten-01.png")

if [ "$IMAGE_STATUS" = "200" ]; then
  echo -e "${GREEN}✅ Image is accessible${NC}"
else
  echo -e "${RED}❌ Image failed (HTTP $IMAGE_STATUS)${NC}"
fi
echo ""

echo "📋 Summary"
echo "=========="
echo "If all tests pass but gallery is empty, check:"
echo "1. Browser console for JavaScript errors"
echo "2. Network tab for failed requests"
echo "3. localStorage cache (may be corrupted)"
echo ""
echo "To clear cache, run in browser console:"
echo "  localStorage.clear()"
