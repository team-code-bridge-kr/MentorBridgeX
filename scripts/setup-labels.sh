#!/usr/bin/env bash
# =============================================================================
# setup-labels.sh
# MentorBridgeX — GitHub 이슈 라벨 일괄 생성 스크립트
# 인프라 설계서 §5.1 라벨 체계 기준
#
# 사용법:
#   $ REPO="team-code-bridge-kr/MentorBridgeX" ./scripts/setup-labels.sh
# =============================================================================

set -euo pipefail

REPO="${REPO:-team-code-bridge-kr/MentorBridgeX}"

echo "========================================"
echo " MentorBridgeX 이슈 라벨 생성"
echo " 대상 저장소: $REPO"
echo "========================================"

create_label() {
  local name="$1"
  local color="$2"
  local description="$3"

  # 이미 존재하면 업데이트, 없으면 생성
  if gh label list --repo "$REPO" --search "$name" --json name -q '.[].name' 2>/dev/null | grep -qxF "$name"; then
    gh label edit "$name" \
      --repo "$REPO" \
      --color "$color" \
      --description "$description" 2>/dev/null && echo "  📝 업데이트: $name" || echo "  ⚠️  업데이트 실패: $name"
  else
    gh label create "$name" \
      --repo "$REPO" \
      --color "$color" \
      --description "$description" 2>/dev/null && echo "  ✅ 생성: $name" || echo "  ⚠️  생성 실패: $name"
  fi
}

echo ""
echo "[ 도메인 ]"
create_label "feature:stt"       "0075ca" "네이티브 STT 기능 도메인"
create_label "feature:viz"       "7057ff" "온톨로지 시각화 도메인"
create_label "shared"            "e4e669" "공유 레이어 — 양 기능 영향"
create_label "infra"             "d93f0b" "인프라·빌드·배포"
create_label "docs"              "cfd3d7" "문서 관련"

echo ""
echo "[ 종류 ]"
create_label "type:bug"          "d73a4a" "잘못된 동작"
create_label "type:feature"      "0052cc" "새 기능 또는 개선"
create_label "type:chore"        "e4e669" "빌드·문서·리팩터링 등"
create_label "type:OQ"           "f9d0c4" "미결정 사항 — PM 결정 필요"

echo ""
echo "[ 우선순위 ]"
create_label "P0"                "b60205" "서비스 불가 — 즉시 처리"
create_label "P1"                "d93f0b" "주요 기능 장애"
create_label "P2"                "e99695" "부분 장애"
create_label "P3"                "f9d0c4" "경미"

echo ""
echo "[ 상태 ]"
create_label "status:triage"     "ededed" "분류 전"
create_label "status:in-progress" "0075ca" "작업 중"
create_label "status:blocked"    "d93f0b" "블로킹됨"
create_label "status:review"     "7057ff" "리뷰 대기"

echo ""
echo "[ 플랫폼 ]"
create_label "platform:ios"      "1d76db" "iOS (Flutter)"
create_label "platform:android"  "0e8a16" "Android (Flutter)"
create_label "platform:windows"  "5319e7" "Windows (Flutter)"
create_label "platform:backend"  "b60205" "Backend (FastAPI)"

echo ""
echo "[ 기타 ]"
create_label "dependency-update" "ededed" "의존성 업데이트 관련"

echo ""
echo "========================================"
echo " 완료! 라벨 확인:"
echo " https://github.com/${REPO}/labels"
echo "========================================"
