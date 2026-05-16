#!/usr/bin/env bash
# =============================================================================
# setup-branch-protection.sh
# MentorBridgeX — GitHub 브랜치 보호 규칙 일괄 적용 스크립트
# 인프라 설계서 §6 기준
#
# 사전 요구사항:
#   1. GitHub CLI (gh) 설치 및 로그인 완료
#      $ gh auth login
#   2. 저장소 Admin 권한 보유
#
# 사용법:
#   $ chmod +x scripts/setup-branch-protection.sh
#   $ REPO="team-code-bridge-kr/MentorBridgeX" ./scripts/setup-branch-protection.sh
#
# 또는 환경변수 없이 실행하면 기본값(아래 REPO 변수) 사용:
#   $ ./scripts/setup-branch-protection.sh
# =============================================================================

set -euo pipefail

# ─────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────
REPO="${REPO:-team-code-bridge-kr/MentorBridgeX}"

echo "========================================"
echo " MentorBridgeX 브랜치 보호 규칙 설정"
echo " 대상 저장소: $REPO"
echo "========================================"

# gh CLI 설치 확인
if ! command -v gh &>/dev/null; then
  echo "[ERROR] GitHub CLI(gh)가 설치되어 있지 않습니다."
  echo "        https://cli.github.com 에서 설치 후 다시 실행하세요."
  exit 1
fi

# 로그인 상태 확인
if ! gh auth status &>/dev/null; then
  echo "[ERROR] GitHub CLI 로그인이 필요합니다: gh auth login"
  exit 1
fi

echo ""
echo "▶ 1/2  main 브랜치 보호 규칙 적용 중..."
# ─────────────────────────────────────────────
# main 브랜치 보호 규칙 (§6.1)
#   - 직접 푸시 금지
#   - PR 통해서만 변경
#   - CI 모든 게이트 통과 필수
#   - 리뷰 승인 최소 2명
# ─────────────────────────────────────────────
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO}/branches/main/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint & Format",
      "Unit Tests",
      "Integration Tests",
      "Security Scan",
      "Permission Matrix Check",
      "Dart Analyze & Format",
      "Unit & Widget Tests",
      "Build Android (APK)",
      "Build iOS (Simulator)",
      "Build Windows"
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 2,
    "require_last_push_approval": true
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF

echo "   ✅ main 브랜치 보호 규칙 적용 완료"

echo ""
echo "▶ 2/2  develop 브랜치 보호 규칙 적용 중..."
# ─────────────────────────────────────────────
# develop 브랜치 보호 규칙 (§6.2)
#   - 직접 푸시 금지
#   - CI 통과 필수
#   - 리뷰 승인 최소 1명
#   - CODEOWNERS 리뷰 필수
# ─────────────────────────────────────────────
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  "/repos/${REPO}/branches/develop/protection" \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "Lint & Format",
      "Unit Tests",
      "Security Scan",
      "Dart Analyze & Format",
      "Unit & Widget Tests"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF

echo "   ✅ develop 브랜치 보호 규칙 적용 완료"

# ─────────────────────────────────────────────
# 결과 확인
# ─────────────────────────────────────────────
echo ""
echo "========================================"
echo " 적용 결과 확인"
echo "========================================"

echo ""
echo "[ main ]"
gh api "/repos/${REPO}/branches/main/protection" \
  --jq '{
    required_reviews: .required_pull_request_reviews.required_approving_review_count,
    codeowners_review: .required_pull_request_reviews.require_code_owner_reviews,
    enforce_admins: .enforce_admins.enabled,
    allow_force_pushes: .allow_force_pushes.enabled,
    status_checks: [.required_status_checks.contexts[]]
  }' 2>/dev/null || echo "  (확인 실패 — 권한 또는 브랜치 존재 여부 확인)"

echo ""
echo "[ develop ]"
gh api "/repos/${REPO}/branches/develop/protection" \
  --jq '{
    required_reviews: .required_pull_request_reviews.required_approving_review_count,
    codeowners_review: .required_pull_request_reviews.require_code_owner_reviews,
    allow_force_pushes: .allow_force_pushes.enabled,
    status_checks: [.required_status_checks.contexts[]]
  }' 2>/dev/null || echo "  (확인 실패 — develop 브랜치가 아직 없을 수 있음)"

echo ""
echo "========================================"
echo " 완료!"
echo " GitHub 웹에서 최종 확인:"
echo " https://github.com/${REPO}/settings/branches"
echo "========================================"
