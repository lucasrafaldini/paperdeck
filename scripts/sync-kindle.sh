#!/bin/sh
set -e

KINDLE_IP="${1:-$KINDLE_IP}"
PORT="${PORT:-8787}"

if [ -z "$KINDLE_IP" ]; then
  echo "Uso: ./scripts/sync-kindle.sh <IP_DO_KINDLE>"
  exit 1
fi

# Detecta IP do PC na rede local
DETECTED_PC_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "")
PC_IP="${PC_IP:-$DETECTED_PC_IP}"
if [ -z "$PC_IP" ]; then
  echo "Defina PC_IP=<IP_DO_PC> ou passe por variável de ambiente."
  exit 1
fi

echo "==> Aguardando Kindle conectar em $KINDLE_IP..."
while ! ssh -o ConnectTimeout=2 -o BatchMode=yes "root@$KINDLE_IP" "echo ok" >/dev/null 2>&1; do
  sleep 2
done

echo "==> Kindle conectado! Enviando scripts e extensão KUAL..."
ssh "root@$KINDLE_IP" "mkdir -p /mnt/us/extensions/dashboard"
scp kindle/dash-loop.sh "root@$KINDLE_IP:/mnt/us/dash-loop.sh"
scp kindle/dash-autostart.sh "root@$KINDLE_IP:/mnt/us/dash-autostart.sh"
scp kindle/extensions/dashboard/* "root@$KINDLE_IP:/mnt/us/extensions/dashboard/"

ssh "root@$KINDLE_IP" "echo 'PC=http://${PC_IP}:${PORT}/dash.png' > /mnt/us/dash-autostart.env"
ssh "root@$KINDLE_IP" "chmod +x /mnt/us/dash-loop.sh /mnt/us/dash-autostart.sh"

echo "==> Iniciando loop no Kindle..."
ssh -n "root@$KINDLE_IP" "sh /mnt/us/dash-autostart.sh"

echo "==> Concluído! O Kindle está rodando o dashboard (PC: http://${PC_IP}:${PORT}/dash.png)."
