# RETRO ARCADE — 레트로 아케이드

고전 오락실 감성의 모바일 게임 팩 (15종 + 메타 레이어). 설치/빌드 없이 브라우저에서 바로 실행되며, 홈 화면에 추가하면 오프라인에서도 플레이할 수 있습니다.

## 게임

| 게임 | 장르 | 조작 |
|---|---|---|
| NEON RUNNER | 지오메트리 대시풍 러너 | 탭 = 점프 (홀드 시 연속) |
| SKY HOPPER | 네모 점프 플랫포머 | 드래그로 좌우 이동, 자동 점프 |
| GALAXY RAIDERS | 갤러그풍 슈팅 | 드래그 이동 · 자동 발사 |
| TURBO RUSH | 톱다운 레이싱 | 드래그 조향 · 자동 가속, 3랩 |
| DUNGEON DEPTHS | 초경량 액션 RPG | 드래그 이동 · 자동 공격, 5층 |
| WORM.IO | 지렁이/io풍 | 드래그 조종 + BOOST 버튼 |
| BLOCK FALL | 고전 블록 퍼즐 (테트리스풍) | 탭 좌/우 = 이동 · 가운데 = 회전 · 아래 스와이프 = 하드드롭 |
| BRICK BREAK | 벽돌깨기 (Breakout풍) | 드래그 패들 · 자동 발사, 아이템 3종 · 콤보 · 5스테이지 |
| FLAPPY WING | 플래피버드풍 | 탭 = 플랩, 파이프 통과 |
| STACK UP | 타워 쌓기 | 탭 = 낙하, PERFECT 콤보 보너스 |
| SNAKE CLASSIC | 그리드 스네이크 | 스와이프 방향 전환, 먹이 성장 |
| PONG DUEL | 클래식 퐁 (AI 대전) | 드래그 패들, 7점 선승 |
| MERGE DROP | 숫자 머지 퍼즐 (2048 가족) | 드래그 조준 · 탭 드롭, 인접 같은 수 합침 · 연쇄 콤보 |
| MINESWEEPER | 지뢰찾기 | 탭 = 열기 · 길게누름 = 깃발 · 숫자 탭 = 코르드(주변 일괄 개봉), 첫 탭 안전 보장 |
| DODGE ROYALE | 탄막 생존 | 드래그 이동, 탄막 회피 · GRAZE 근접 보너스 스트릭 · 실드 아이템 |

## 메타 레이어 (v1.3 → v1.4)

- **코인**: 게임 종료 시 점수 → 코인 자동 환산 (게임별 환율 상이, 판정선 50점)
- **일일 미션**: 매일 자정 리셋, 전 계정 동일한 3종 (시드 셔픔) — 달성 시 보상 코인 수령
- **업적 (v1.4)**: 영구 업적 7종 — 달성 시 자동 코인 지급, 로비 ACHIEVEMENTS 패널에서 확인
- **스킨 상점**: 로비 테마 5종 (CLASSIC/SUNSET/MATRIX/BUBBLEGUM/GOLD) — 코인으로 구매·장착, CSS 변수 실시간 반영
- 모든 진행 상태는 `localStorage` 저장, 서버 불필요

## 실행

**지금 바로 플레이 (GitHub Pages 공개 배포):**

```
https://0archlinux0.github.io/retro-arcade/
```

로컬에서 실행:

아무 정적 서버나 사용:

```bash
cd retro-arcade
python3 -m http.server 8123
# http://localhost:8123
```

폰에서 테스트하려면 같은 와이파이에서 `http://<맥 아이피>:8123` 접속.

특정 게임을 바로 시작하려면 `?auto=` 파라미터 사용:

```
http://localhost:8123/?auto=pong      # PONG DUEL 즉시 실행
http://localhost:8123/?auto=snake     # SNAKE CLASSIC 즉시 실행
```

(녹화/데모/테스트 자동화용 — 게임 선택 화면을 건너뛰고 바로 플레이 상태로 진입)

## 특징

- **제로 에셋**: 그래픽은 전부 Canvas 코드, 음악/효과음은 WebAudio 칩튠 실시간 생성
- **BGM 16종**: 메뉴 + 게임별 전용 트랙 (드럼 킥/스네어/해럿 포함 16스텝 시퀀서)
- **메타 레이어**: 코인 · 일일 미션 · 업적 7종 · 스킨 상점 (v1.3~v1.4)
- **PWA**: `manifest.json` + `sw.js` — 홈 화면에 추가하면 오프라인 실행 가능
- **고전 감성**: CRT 스캔라인, 픽셀 폰트(Press Start 2P), 네온 파레트
- **최고 점수**: localStorage 저장
- **모바일 퍼스트**: 세로 화면 기준, 한 손 조작 (탭/드래그)

## 테스트

헤드리스(Node) 스위트가 전부 통과된 상태입니다:

```bash
node tests/run-headless.js       # 15개 게임 시뮬레이션 + 오디오/로비/메타/업적
node tests/verify-blockfall.js   # 블록 퍼즐 탭 입력/중력/스태킹 스모크
node tests/verify-brickbreak.js  # 벽돌깨기 드래그 플레이 + 공 소실 경로 검증
node tests/verify-pong.js        # 퐁 실매치 시뮬레이션 (7점 완주 + AI 실책 검증)
node tests/verify-mergedrop.js   # 머지드롭 머지/연쇄/게임오버 결정론 검증
node tests/verify-v14.js         # 지뢰찾기+탄막 딥 게임플레이 검증 (v1.4)
node tests/verify-drums.js       # BGM 16종 드럼 트랙 재생 검증
node tests/verify-fixes.js       # 핵심 버그 수정 회귀 (RPG 피격·레이싱 완주·웜 봇 정리)
node tests/diag-race.js          # 레이싱 트랙 지오메트리 진단 도구
node tests/diag-pong.js          # 퐁 상태 덤프 진단 도구
node tests/verify-race.js        # 비례 조향 드라이버로 실제 3랩 완주 검증
```

지속 감시(디버깅 시각화):

```bash
./debug-watch.sh    # 문법검사+전체테스트+레이스 진단 (15초마다 재실행)
./debug-suite.sh    # 테스트 사이클러: 전체 스위트+타깃 검증 배너 표시 (20초마다)
./debug-monitor.sh  # 리소스 모니터: CPU/메모리/프로세스 (2초마다 갱신)
```

## 앱으로 출시하기

스토어 등록 절차·리스팅 텍스트·체크리스트는 [LAUNCH.md](LAUNCH.md) 참고.

- **PWA**: ✅ 배포됨 (위 링크, 홈 화면 추가 시 오프라인 실행)
- **Android**: `android/` 프로젝트 준비 완료 — `./gradlew bundleRelease`로 AAB 빌드
- **iOS**: `ios/` 프로젝트 생성 완료 — Xcode 설치 후 `npx cap sync ios` 재실행

빠른 명령:

```bash
./make-www.sh && npx cap sync      # 웹에셋 → 네이티브 동기화
npx cap open android               # Android Studio
npx cap open ios                   # Xcode
```

## 구조

```
retro-arcade/
├── index.html        # 셸 (로비 + 게임 화면)
├── manifest.json     # PWA 매니페스트
├── sw.js             # 서비스 워커 (오프라인)
├── debug-watch.sh    # 테스트 감시 루프 (디버깅 시각화)
├── debug-suite.sh    # 테스트 사이클러 (전체 스위트 배너)
├── debug-monitor.sh  # 리소스 모니터
├── css/style.css
├── js/
│   ├── core.js       # 캔버스/입력/파티클/HUD 엔진
│   ├── audio.js      # 칩튠 사운드 엔진 (BGM 14종 + SFX)
│   ├── meta.js       # 메타 레이어 (코인/일일미션/스킨)
│   ├── lobby.js      # 로비 (?auto= 자동 실행 지원)
│   └── games/*.js    # 게임 13종
├── icons/
└── tests/            # 헤드리스 테스트 스위트
```

## 로드맵

다음 추가 게임 계획은 [ROADMAP.md](ROADMAP.md) 참고.
