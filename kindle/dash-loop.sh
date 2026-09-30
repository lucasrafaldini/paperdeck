#!/bin/sh
# Token Dashboard — loop no Kindle otimizado para bateria.
# - Intervalo diurno otimizado (padrão 180s / 3 min)
# - Modo Deep Sleep via RTC na madrugada (01:00 AM às 10:00 AM)
# - Desativa luz frontal / backlight para economia máxima
# - Desliga Wi-Fi durante a suspensão profunda (01h-10h)
# - Auto-recuperação e auto-atualização via backend Mac

PC="${PC:-}"
IMG=/mnt/us/dash.png
INTERVAL="${INTERVAL:-180}"         # segundos entre atualizações diurnas (padrão 3 min)
NIGHT_INTERVAL="${NIGHT_INTERVAL:-3600}" # segundos entre atualizações em deep sleep (padrão 1 hora)
FULL_EVERY="${FULL_EVERY:-20}"     # full-refresh (flash anti-ghosting) a cada N ciclos
WIFI_RETRY_EVERY="${WIFI_RETRY_EVERY:-3}" # tenta recuperar WiFi após N falhas seguidas
MAX_FAILURES="${MAX_FAILURES:-0}"   # para o script após N falhas consecutivas (0 = sem limite)
STOP=/mnt/us/dash-loop.stop
PIDFILE=/mnt/us/dash-loop.pid

if [ -x /mnt/us/libkh/bin/fbink ]; then
  FBINK=/mnt/us/libkh/bin/fbink
elif [ -x /usr/bin/fbink ]; then
  FBINK=/usr/bin/fbink
else
  FBINK=fbink
fi

case "$INTERVAL" in ''|*[!0-9]*) INTERVAL=180;; esac
case "$NIGHT_INTERVAL" in ''|*[!0-9]*) NIGHT_INTERVAL=3600;; esac
case "$FULL_EVERY" in ''|*[!0-9]*|0) FULL_EVERY=20;; esac
case "$WIFI_RETRY_EVERY" in ''|*[!0-9]*|0) WIFI_RETRY_EVERY=3;; esac
case "$MAX_FAILURES" in ''|*[!0-9]*) MAX_FAILURES=0;; esac

if [ -z "$PC" ]; then
  echo "[dash-loop] PC is required. Set PC to http://<PC_IP>:<PORT>/dash.png"
  exit 2
fi

# Instância única: mata a anterior se houver
if [ -f "$PIDFILE" ]; then
  OLD=$(cat "$PIDFILE" 2>/dev/null)
  if [ -n "$OLD" ] && kill -0 "$OLD" 2>/dev/null; then kill "$OLD" 2>/dev/null; sleep 1; fi
fi
echo $$ > "$PIDFILE"

turn_off_frontlight() {
  lipc-set-prop com.lab126.powerd flWorkflow 0 2>/dev/null
  lipc-set-prop com.lab126.powerd flIntensity 0 2>/dev/null
  if [ -d /sys/class/backlight/mxc_msp430_fl.0 ]; then
    echo 0 > /sys/class/backlight/mxc_msp430_fl.0/brightness 2>/dev/null
  fi
}

cleanup() {
  lipc-set-prop com.lab126.powerd preventScreenSaver 0 2>/dev/null
  lipc-set-prop com.lab126.powerd disableScreenOff 0 2>/dev/null
  lipc-set-prop com.lab126.wifid enable 1 2>/dev/null
  rm -f "$PIDFILE" "$IMG.tmp"
}
trap cleanup EXIT INT TERM

reconnect_wifi() {
  STATE=$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null)
  echo "[dash-loop] $(date) recuperando WiFi (estado=${STATE:-desconhecido})"
  lipc-set-prop com.lab126.wifid enable 1 >/dev/null 2>&1
  wpa_cli -i wlan0 reassociate >/dev/null 2>&1
  sleep 6
}

discover_pc() {
  ENV_FILE=/mnt/us/dash-autostart.env
  # 1. Tenta mDNS
  for host in "${PC_HOSTNAME:-paperdeck.local}" "paperdeck.local" "localhost"; do
    if curl -fsS --connect-timeout 2 --max-time 3 "http://${host}:8787/api/ping" >/dev/null 2>&1; then
      PC="http://${host}:8787/dash.png"
      [ -f "$ENV_FILE" ] && sed -i '/^PC=/d' "$ENV_FILE" 2>/dev/null
      echo "PC=$PC" >> "$ENV_FILE"
      echo "[dash-loop] auto-descoberta via mDNS: $PC"
      return 0
    fi
  done
  # 2. Varre sub-rede local procurando pela porta 8787
  MY_IP=$(lipc-get-prop com.lab126.wifid ipAddress 2>/dev/null)
  [ -z "$MY_IP" ] && return 1
  PREFIX=$(echo "$MY_IP" | cut -d. -f1-3)
  for octet in 2 3 4 5 10 15 20 25 30 35 40 45 50; do
    TEST_IP="${PREFIX}.${octet}"
    if [ "$TEST_IP" != "$MY_IP" ]; then
      if curl -fsS --connect-timeout 1 --max-time 2 "http://${TEST_IP}:8787/api/ping" >/dev/null 2>&1; then
        PC="http://${TEST_IP}:8787/dash.png"
        [ -f "$ENV_FILE" ] && sed -i '/^PC=/d' "$ENV_FILE" 2>/dev/null
        echo "PC=$PC" >> "$ENV_FILE"
        echo "[dash-loop] auto-descoberta: Host encontrado em $TEST_IP ($PC)"
        return 0
      fi
    fi
  done
  return 1
}

wait_for_wifi() {
  retries=15
  while [ "$retries" -gt 0 ]; do
    STATE=$(lipc-get-prop com.lab126.wifid cmState 2>/dev/null)
    [ "$STATE" = "CONNECTED" ] && return 0
    sleep 1
    retries=$((retries - 1))
  done
  return 1
}

is_night_time() {
  # Retorna 0 se hora estiver entre 01:00 e 09:59 (janela 01h-10h AM)
  H=$(date +%H 2>/dev/null)
  case "$H" in
    01|02|03|04|05|06|07|08|09) return 0 ;;
    *) return 1 ;;
  esac
}

get_night_sleep_seconds() {
  H=$(date +%H 2>/dev/null)
  M=$(date +%M 2>/dev/null)
  S=$(date +%S 2>/dev/null)
  H_NUM=$((10#$H))
  M_NUM=$((10#$M))
  S_NUM=$((10#$S))
  CURRENT_DAY_SECS=$(( (H_NUM * 3600) + (M_NUM * 60) + S_NUM ))
  TARGET_10AM_SECS=$(( 10 * 3600 )) # 36000s = 10:00 AM
  SECS_UNTIL_10AM=$(( TARGET_10AM_SECS - CURRENT_DAY_SECS ))

  if [ "$SECS_UNTIL_10AM" -le 0 ]; then
    echo "$INTERVAL"
    return
  fi

  if [ "$SECS_UNTIL_10AM" -lt "$NIGHT_INTERVAL" ]; then
    echo "$SECS_UNTIL_10AM"
  else
    echo "$NIGHT_INTERVAL"
  fi
}

enter_deep_sleep() {
  SLEEP_TIME="$1"
  [ -z "$SLEEP_TIME" ] && SLEEP_TIME=3600
  case "$SLEEP_TIME" in ''|*[!0-9]*|0) SLEEP_TIME=3600;; esac

  echo "[dash-loop] $(date) entrando em deep sleep (${SLEEP_TIME}s)"

  # Garante bloqueio do screensaver para a imagem permanecer na tela
  lipc-set-prop com.lab126.powerd preventScreenSaver 1 2>/dev/null
  lipc-set-prop com.lab126.powerd disableScreenOff 1 2>/dev/null

  # 1. Alarme RTC no hardware (rtc1 e rtc0)
  lipc-set-prop com.lab126.powerd rtcWakeup "$SLEEP_TIME" 2>/dev/null
  echo 0 > /sys/class/rtc/rtc1/wakealarm 2>/dev/null
  echo "+$SLEEP_TIME" > /sys/class/rtc/rtc1/wakealarm 2>/dev/null
  echo 0 > /sys/class/rtc/rtc0/wakealarm 2>/dev/null
  echo "+$SLEEP_TIME" > /sys/class/rtc/rtc0/wakealarm 2>/dev/null

  # 2. Desliga Wi-Fi para cortar consumo do rádio
  lipc-set-prop com.lab126.wifid enable 0 2>/dev/null

  # Breve pausa para o controlador e-ink finalizar a transição de pigmentos
  sleep 1

  # 3. Suspende SoC para RAM (Kernel dorme aqui com o dashboard fixo na tela)
  echo mem > /sys/power/state 2>/dev/null || sleep "$SLEEP_TIME"

  # --- CPU ACORDOU ---
  echo "[dash-loop] $(date) acordou do deep sleep"

  # 4. Restaura Wi-Fi
  lipc-set-prop com.lab126.wifid enable 1 2>/dev/null
  wpa_cli -i wlan0 reassociate >/dev/null 2>&1
  wait_for_wifi
}

check_auto_update() {
  UPDATE_URL="${PC%/dash.png}/kindle/dash-loop.sh"
  if curl -fsS --connect-timeout 4 --max-time 10 "$UPDATE_URL" -o "/mnt/us/dash-loop.sh.new" 2>/dev/null && [ -s "/mnt/us/dash-loop.sh.new" ]; then
    NEW_HASH=$(md5sum < /mnt/us/dash-loop.sh.new 2>/dev/null | cut -d' ' -f1)
    CUR_HASH=$(md5sum < /mnt/us/dash-loop.sh 2>/dev/null | cut -d' ' -f1)
    if [ -n "$NEW_HASH" ] && [ -n "$CUR_HASH" ] && [ "$NEW_HASH" != "$CUR_HASH" ]; then
      if sh -n "/mnt/us/dash-loop.sh.new" 2>/dev/null; then
        echo "[dash-loop] nova versao valida detectada ($NEW_HASH != $CUR_HASH), atualizando..."
        mv "/mnt/us/dash-loop.sh.new" "/mnt/us/dash-loop.sh"
        chmod 755 "/mnt/us/dash-loop.sh"
        exec /bin/sh "/mnt/us/dash-loop.sh"
      else
        echo "[dash-loop] erro de sintaxe na nova versao baixada, abortando atualizacao"
      fi
    fi
  fi
  rm -f "/mnt/us/dash-loop.sh.new" 2>/dev/null
}

rm -f "$STOP"
i=0
failures=0
turn_off_frontlight
echo "[dash-loop] start $(date) pid=$$ PC=$PC interval=${INTERVAL}s night_interval=${NIGHT_INTERVAL}s"

while [ ! -f "$STOP" ]; do
  turn_off_frontlight
  lipc-set-prop com.lab126.powerd preventScreenSaver 1 2>/dev/null
  lipc-set-prop com.lab126.powerd disableScreenOff 1 2>/dev/null

  BATT=$(lipc-get-prop com.lab126.powerd battLevel 2>/dev/null || echo "")
  CHG=$(lipc-get-prop com.lab126.powerd isCharging 2>/dev/null || echo "0")
  REQ_URL="${PC}?bat=${BATT}&chg=${CHG}"
  HDR_FILE=/mnt/us/dash.headers

  SERVER_NIGHT=""
  SERVER_SLEEP=""

  if curl -fsS -D "$HDR_FILE" --connect-timeout 10 --max-time 30 "$REQ_URL" -o "$IMG.tmp" 2>/dev/null && [ -s "$IMG.tmp" ]; then
    mv "$IMG.tmp" "$IMG"
    failures=0

    SERVER_NIGHT=$(grep -i '^x-kindle-night:' "$HDR_FILE" 2>/dev/null | tr -d '\r\n' | awk '{print $2}')
    SERVER_SLEEP=$(grep -i '^x-kindle-sleep:' "$HDR_FILE" 2>/dev/null | tr -d '\r\n' | awk '{print $2}')
    SERVER_INT=$(grep -i '^x-kindle-interval:' "$HDR_FILE" 2>/dev/null | tr -d '\r\n' | awk '{print $2}')
    [ -n "$SERVER_INT" ] && INTERVAL="$SERVER_INT"
    rm -f "$HDR_FILE" 2>/dev/null

    if [ $((i % FULL_EVERY)) -eq 0 ]; then
      "$FBINK" -f -c >/dev/null 2>&1
    fi
    "$FBINK" -g file="$IMG",w=-2,h=-2 -W GC16 >/dev/null 2>&1

    # Checa auto-atualizacao a cada 30 ciclos
    if [ $((i % 30)) -eq 1 ]; then
      check_auto_update
    fi
  else
    rm -f "$IMG.tmp" "$HDR_FILE" 2>/dev/null
    failures=$((failures + 1))
    echo "[dash-loop] $(date) falha no curl (${failures} seguida(s))"
    if [ "$MAX_FAILURES" -gt 0 ] && [ "$failures" -ge "$MAX_FAILURES" ]; then
      echo "[dash-loop] $(date) ${failures} falhas consecutivas — encerrando"
      cleanup
      exit 0
    fi
    if [ $((failures % WIFI_RETRY_EVERY)) -eq 0 ]; then
      reconnect_wifi
      discover_pc
    fi
  fi

  i=$((i + 1))

  # Escolhe proximo sono (Deep Sleep entre 01:00 e 10:00, ou sleep normal diurno)
  is_night=0
  if [ "$SERVER_NIGHT" = "1" ]; then
    is_night=1
  elif [ -z "$SERVER_NIGHT" ] && is_night_time; then
    is_night=1
  fi

  if [ "$is_night" = "1" ]; then
    NIGHT_SLEEP="${SERVER_SLEEP:-$(get_night_sleep_seconds)}"
    enter_deep_sleep "$NIGHT_SLEEP"
  else
    # Se falhou repetidamente (ex: Mac suspenso), dorme mais tempo para nao torrar bateria
    if [ "$failures" -ge 3 ]; then
      sleep 120
    else
      sleep "$INTERVAL"
    fi
  fi
done

echo "[dash-loop] parado $(date) (encontrou $STOP)"
