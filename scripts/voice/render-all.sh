#!/bin/sh
# Render (or top up) every shipped voice pack. A render that stops producing
# clips for 2 minutes is killed and restarted; renders resume where they stopped.
#   sh scripts/voice/render-all.sh
set -u
render() {
  voice=$1; speed=$2; dir="public/voice/$voice"
  for attempt in 1 2 3 4 5 6 7 8 9 10; do
    node scripts/voice/render.mjs --voice="$voice" --speed="$speed" &
    pid=$!
    started=$(date +%s)
    while kill -0 "$pid" 2>/dev/null; do
      sleep 20
      newest=$(ls -t "$dir"/*.m4a "$dir"/manifest.json 2>/dev/null | head -1)
      last=$(stat -f %m "$newest" 2>/dev/null || echo "$started")
      [ "$last" -lt "$started" ] && last=$started
      age=$(( $(date +%s) - last ))
      if [ "$age" -gt 120 ] && kill -0 "$pid" 2>/dev/null; then
        echo "render $voice stalled for ${age}s, restarting" >&2
        kill "$pid" 2>/dev/null; sleep 2; kill -9 "$pid" 2>/dev/null
      fi
    done
    wait "$pid" && return 0
    echo "render $voice exited, retry $attempt" >&2
  done
  return 1
}
render af_heart 0.72 && render af_nicole 0.82
