# Criar instância WhatsApp na Evolution (correr no VPS ou no PC)
# Uso: AUTHENTICATION_API_KEY=... SERVER_URL=http://IP:8080 ./create-instance.sh

set -e
SERVER_URL="${SERVER_URL:?Defina SERVER_URL}"
AUTHENTICATION_API_KEY="${AUTHENTICATION_API_KEY:?Defina AUTHENTICATION_API_KEY}"
INSTANCE="${EVOLUTION_INSTANCE:-marcaja}"

curl -sS -X POST "${SERVER_URL}/instance/create" \
  -H "apikey: ${AUTHENTICATION_API_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"instanceName\":\"${INSTANCE}\",\"qrcode\":true,\"integration\":\"WHATSAPP-BAILEYS\"}"
