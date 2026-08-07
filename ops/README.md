# 배포

## 지금 구조

```
GitHub develop  ──(2분마다 서버가 당김)──▶  홈서버
                                            ├ apps/web/dist  → nginx 컨테이너
                                            └ services/api   → docker compose
```

`mbx.teamcodebridge.dev` 는 이 서버의 nginx 가 **`apps/web/dist` 폴더를 그대로**
보여준다. 즉 GitHub 에서 머지해도 **이 서버에서 빌드하지 않으면 화면이 그대로**다.
실제로 그래서 팀원이 "머지한 게 배포에 없다"고 연락한 적이 있다(cede5b3).

`ops/auto-deploy.sh` 가 그 빈틈을 메운다. cron 이 2분마다 부른다.

```
*/2 * * * * /home/activejang/MentorBridgeX/ops/auto-deploy.sh >/dev/null 2>&1
```

## 무엇을 하나

1. `develop` 을 보고 있고, 고치던 파일이 없을 때만 움직인다.
2. `origin/develop` 을 **`--ff-only`** 로만 당긴다. 서버가 멋대로 머지하지 않는다.
3. **바뀐 자리만** 다시 세운다.
   - `apps/web/**` → `npm run build` (`package-lock.json` 이 바뀌었으면 `npm ci` 먼저)
   - `services/api/**` 또는 `docker-compose.yml` → `docker compose up -d --build api`
4. 웹·API 가 실제로 200 을 주는지 확인하고 로그에 적는다.

## 로그

`~/.mbx-deploy.log` — 1MB 를 넘으면 뒤 500줄만 남긴다.

```
2026-08-07 05:18:51 == 2e5644f → cede5b3 (Merge pull request #2 …)
2026-08-07 05:18:55    웹 빌드 완료 → index-CIGxRzlf.js
2026-08-07 05:18:55    확인: web 200 / api 200
```

바뀐 것이 없으면 **아무것도 적지 않는다.** 로그에 줄이 생겼다는 건 뭔가 했다는 뜻이다.

## 조심할 것

- **빌드가 실패하면 옛 `dist` 를 그대로 둔다.** 반쯤 부서진 화면을 내보내는 것보다
  어제 것이 낫다. 로그에 `!!` 로 남으니 확인할 것.
- cron 은 로그인 셸이 아니라 PATH 에 nvm 의 node 가 없다. 스크립트가 직접 찾아
  붙인다 — 이걸 빼면 `npm: not found` 로 **조용히** 실패한다(처음에 그랬다).
- 서버에서 직접 고치는 중이면(작업 트리가 더러우면) 아무것도 하지 않는다.
  서버에만 있는 커밋이 있어도 마찬가지다.

## 껐다 켜기

```bash
crontab -l                 # 확인
crontab -e                 # 그 줄을 지우면 멈춘다
./ops/auto-deploy.sh       # 손으로 한 번 돌리기
tail -f ~/.mbx-deploy.log  # 지켜보기
```

## GitHub Actions 는?

`.github/workflows/deploy-web.yml` 은 EC2 시절 것이라 꺼져 있다(`workflow_dispatch`
만 남음). 홈서버는 밖에서 들어오는 SSH 길이 없고 Cloudflare Tunnel 뒤에 있어서,
러너가 들어오게 하려면 서비스 토큰과 인바운드 경로를 새로 뚫어야 한다.
서버가 스스로 당겨 오는 편이 뚫을 구멍이 없어 더 안전하다.

<!-- 자동 배포 확인용 -->
