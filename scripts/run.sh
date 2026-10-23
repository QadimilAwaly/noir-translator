#!/data/data/com.termux/files/usr/bin/bash
# ==============================================================================
# Noir Translator Daemon Supervisor for Termux / Linux
# Keeps server running 24/7, acquires Termux wake-lock to prevent CPU sleep,
# and automatically recovers/restarts on unexpected termination.
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PID_FILE="$DIR/.noir-server.pid"
DAEMON_PID_FILE="$DIR/.noir-daemon.pid"
LOG_FILE="$DIR/noir-server.log"

PREFIX="${PREFIX:-/data/data/com.termux/files/usr}"
export PATH="$HOME/.local/bin:$HOME/.bun/bin:$PREFIX/bin:$PATH"

cd "$DIR" || exit 1

log_msg() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [Noir Daemon] $1"
}

# 1. Acquire Termux Wake Lock (mencegah Android CPU sleep / doze saat layar mati)
if command -v termux-wake-lock >/dev/null 2>&1; then
  log_msg "🔒 Mengaktifkan Termux Wake-Lock (mencegah Android CPU Sleep)..."
  termux-wake-lock
fi

# Cleanup on explicit termination (SIGINT / SIGTERM)
cleanup() {
  log_msg "🛑 Menghentikan server dan membersihkan state..."
  if [ -f "$PID_FILE" ]; then
    CHILD_PID=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$CHILD_PID" ] && kill -0 "$CHILD_PID" 2>/dev/null; then
      kill -TERM "$CHILD_PID" 2>/dev/null || true
    fi
    rm -f "$PID_FILE"
  fi
  rm -f "$DAEMON_PID_FILE" 2>/dev/null || true
  if command -v termux-wake-unlock >/dev/null 2>&1; then
    termux-wake-unlock 2>/dev/null || true
  fi
  exit 0
}

# Abaikan SIGHUP agar daemon tetap hidup saat sesi terminal/PTS ditutup
trap '' SIGHUP
trap cleanup SIGINT SIGTERM

log_msg "🚀 Memulai Noir Translator Supervisor (PID: $$)..."

# 2. Resilient Supervisor Loop
while true; do
  # Jalankan server
  node --dns-result-order=ipv4first --max-old-space-size=512 dist/server.js >> "$LOG_FILE" 2>&1 &
  SERVER_PID=$!
  echo "$SERVER_PID" > "$PID_FILE"

  log_msg "Server aktif dengan PID: $SERVER_PID. Menunggu proses..."
  wait "$SERVER_PID"
  EXIT_CODE=$?

  rm -f "$PID_FILE"

  log_msg "⚠️ Server terhenti dengan exit code $EXIT_CODE. Restart otomatis dalam 2 detik..."
  sleep 2
done

if command -v termux-wake-unlock >/dev/null 2>&1; then
  termux-wake-unlock 2>/dev/null || true
fi
