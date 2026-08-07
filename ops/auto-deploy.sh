#!/usr/bin/env bash
#
# 홈서버 자동 배포 — develop 이 바뀌면 받아서 다시 세운다.
#
# 왜 GitHub Actions 가 아닌가: 호스팅이 EC2 에서 홈서버(docker-compose +
# Cloudflare Tunnel)로 옮겨 오면서 `deploy-web.yml` 이 꺼졌다. 그 뒤로 배포가
# 완전 수동이 됐고, GitHub 에서 아무리 머지해도 이 서버에서 빌드하지 않으면
# 화면이 그대로였다(실제로 팀원이 cede5b3 이 반영 안 됐다고 연락했다).
# 밖에서 들어오는 길을 새로 뚫는 대신, 서버가 스스로 당겨 온다.
#
# 안전장치
#   - develop 에서만 돈다. 다른 가지를 보고 있으면 건드리지 않는다.
#   - 고치던 파일이 있으면(더러운 작업 트리) 아무것도 하지 않는다.
#     이 서버에서 직접 작업하는 사람의 손을 빼앗으면 안 된다.
#   - `--ff-only` 로만 당긴다. 서버가 멋대로 머지하지 않는다.
#   - 겹쳐 돌지 않게 잠근다(flock).
#   - **바뀐 자리만** 다시 세운다. 웹만 바뀌었는데 API 컨테이너를 새로 올리면
#     쓰는 사람의 요청이 끊긴다.
set -uo pipefail

# cron 은 로그인 셸이 아니라서 PATH 가 /usr/bin:/bin 뿐이다. node 는 nvm 안에
# 있어 그대로는 `npm: not found` 로 조용히 실패한다 — 처음 붙였을 때 실제로
# 그랬다. 여기서 직접 찾아 붙인다.
if ! command -v npm >/dev/null 2>&1; then
  for d in "$HOME"/.nvm/versions/node/*/bin; do
    [ -x "$d/npm" ] && PATH="$d:$PATH"
  done
  export PATH
fi

REPO="${MBX_REPO:-/home/activejang/MentorBridgeX}"
BRANCH="develop"
LOG="${MBX_DEPLOY_LOG:-$HOME/.mbx-deploy.log}"
LOCK="/tmp/mbx-auto-deploy.lock"

log() { printf '%s %s\n' "$(date '+%F %T')" "$*" >>"$LOG"; }

# 로그가 무한히 자라지 않게 — 1MB 넘으면 절반을 버린다
if [ -f "$LOG" ] && [ "$(stat -c%s "$LOG" 2>/dev/null || echo 0)" -gt 1048576 ]; then
  tail -n 500 "$LOG" >"$LOG.tmp" && mv "$LOG.tmp" "$LOG"
fi

exec 9>"$LOCK"
flock -n 9 || exit 0   # 앞 회차가 아직 돌고 있다. 조용히 빠진다.

cd "$REPO" || { log "!! 저장소를 찾지 못함: $REPO"; exit 1; }

cur_branch=$(git rev-parse --abbrev-ref HEAD)
[ "$cur_branch" = "$BRANCH" ] || exit 0

if ! git diff --quiet || ! git diff --cached --quiet; then
  log "-- 고치던 파일이 있어 건너뜀"
  exit 0
fi

git fetch --quiet origin "$BRANCH" || { log "!! fetch 실패"; exit 1; }
before=$(git rev-parse HEAD)
after=$(git rev-parse "origin/$BRANCH")
[ "$before" = "$after" ] && exit 0

# 서버가 오히려 앞서 있는 경우(여기서 커밋했는데 아직 안 올렸다). 당길 것이
# 없는데 merge --ff-only 는 "이미 최신" 이라며 0 을 돌려주므로, 그냥 두면
# 바뀐 것도 없이 매번 다시 빌드한다.
if git merge-base --is-ancestor "$after" "$before"; then
  log "-- 서버에 아직 안 올린 커밋이 있다. 그대로 둔다"
  exit 0
fi

changed=$(git diff --name-only "$before" "$after")
if ! git merge --ff-only "origin/$BRANCH" --quiet; then
  # 서버에만 있는 커밋이 있다는 뜻이다. 사람이 봐야 한다.
  log "!! ff-only 실패 — 서버에 origin 에 없는 커밋이 있다. 손으로 정리 필요"
  exit 1
fi
log "== ${before:0:7} → ${after:0:7} ($(git log -1 --pretty=%s | cut -c1-60))"

ok=1
if grep -q '^apps/web/' <<<"$changed"; then
  if grep -q '^apps/web/package-lock.json$' <<<"$changed"; then
    log "   의존성 바뀜 → npm ci"
    (cd apps/web && npm ci --silent) >>"$LOG" 2>&1 || { log "   !! npm ci 실패"; ok=0; }
  fi
  if [ "$ok" = 1 ]; then
    if (cd apps/web && npm run build) >>"$LOG" 2>&1; then
      log "   웹 빌드 완료 → $(ls apps/web/dist/assets/index-*.js | head -1 | xargs basename)"
    else
      log "   !! 웹 빌드 실패 — 옛 dist 를 그대로 둔다: $(tail -3 "$LOG" | grep -iE 'error|not found' | head -1)"
      ok=0
    fi
  fi
fi

if [ "$ok" = 1 ] && grep -qE '^(services/api/|docker-compose\.yml)' <<<"$changed"; then
  if docker compose up -d --build api >>"$LOG" 2>&1; then
    log "   API 다시 올림"
  else
    log "   !! API 빌드 실패"
    ok=0
  fi
fi

# 실제로 뜨는지까지 본다. "배포했다"는 말은 화면이 떠야 참이다.
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:8080/ || echo 000)
api=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 http://localhost:8000/health || echo 000)
log "   확인: web $code / api $api"
[ "$code" = 200 ] && [ "$api" = 200 ] && [ "$ok" = 1 ] || log "   !! 배포 뒤 상태가 정상이 아니다"
