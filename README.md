# RETRO ARCADE — 레트로 아케이드

고전 오락실 감성의 모바일 게임 팩 (8종). 설치/빌드 없이 브라우저에서 바로 실행되며, 홈 화면에 추가하면 오프라인에서도 플레이할 수 있습니다.

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

## 실행

아무 정적 서버나 사용:

```bash
cd retro-arcade
python3 -m http.server 8123
# http://localhost:8123
```

폰에서 테스트하려면 같은 와이파이에서 `http://<맥 아이피>:8123` 접속.

## 특징

- **제로 에셋**: 그래픽은 전부 Canvas 코드, 음악/효과음은 WebAudio 칩튠 실시간 생성
- **PWA**: `manifest.json` + `sw.js` — 홈 화면에 추가하면 오프라인 실행 가능
- **고전 감성**: CRT 스캔라인, 픽셀 폰트(Press Start 2P), 네온 파레트
- **최고 점수**: localStorage 저장
- **모바일 퍼스트**: 세로 화면 기준, 한 손 조작 (탭/드래그)

## 테스트

헤드리스(Node) 스위트가 전부 통과된 상태입니다:

```bash
node tests/run-headless.js       # 8개 게임 20~25초 시뮬레이션 + 오디오/로비
node tests/verify-blockfall.js   # 블록 퍼즐 탭 입력/중력/스태킹 스모크
node tests/verify-brickbreak.js  # 벽돌깨기 드래그 플레이 + 공 소실 경로 검증
node tests/verify-fixes.js       # 핵심 버그 수정 회귀 (RPG 피격·레이싱 완주·웜 봇 정리)
node tests/diag-race.js          # 레이싱 트랙 지오메트리 진단 도구
node tests/verify-race.js        # 비례 조향 드라이버로 실제 3랩 완주 검증
```

지속 감시(디버깅 시각화):

```bash
./debug-watch.sh   # 새 Terminal 창에서 15초마다 문법검사+전체테스트 자동 재실행
```

## 앱으로 출시하기 (선택)

같은 코드를 Capacitor로 감싸면 App Store / Google Play 출시 가능:

```bash
npm i -D @capacitor/cli && npm i @capacitor/core @capacitor/ios @capacitor/android
npx cap init "Retro Arcade" com.example.retroarcade --web-dir=.
npx cap add ios && npx cap add android
npx cap open ios   # Xcode에서 서명 후 업로드
```

## 구조

```
retro-arcade/
├── index.html        # 셸 (로비 + 게임 화면)
├── manifest.json     # PWA 매니페스트
├── sw.js             # 서비스 워커 (오프라인)
├── debug-watch.sh    # 테스트 감시 루프 (디버깅 시각화)
├── css/style.css
├── js/
│   ├── core.js       # 캔버스/입력/파티클/HUD 엔진
│   ├── audio.js      # 칩튠 사운드 엔진 (BGM 9종 + SFX)
│   ├── lobby.js      # 로비
│   └── games/*.js    # 게임 8종
├── icons/
└── tests/            # 헤드리스 테스트 스위트
```

## 로드맵

다음 추가 게임 계획은 [ROADMAP.md](ROADMAP.md) 참고.
