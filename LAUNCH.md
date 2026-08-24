# RETRO ARCADE — 스토어 출시 킷

이 문서 하나로 두 스토어 등록을 진행할 수 있도록 모든 텍스트·파일 위치·절차를 정리했습니다.

## 현재 상태 요약

| 항목 | 상태 |
|---|---|
| PWA (웹 공개) | ✅ https://0archlinux0.github.io/retro-arcade/ |
| 아이콘 세트 | ✅ `icons/` — iOS 1024 마스터, maskable 512, Android 밀도 5종 |
| 개인정보처리방침 | ✅ `/privacy.html` (배포됨) |
| 스크린샷 5장 | ✅ `store/shots/` (390×844 @3x 실기기 비율) |
| Capacitor Android | ✅ `android/` 프로젝트 생성 완료, 웹에셋 동기화됨 |
| Capacitor iOS | ⚠️ 프로젝트 생성됨, pod install은 **Xcode 설치 후** 재실행 필요 |

---

## A. Google Play (Android) — 바로 진행 가능

### 준비물
1. **Google Play Console 계정** — 일회성 등록비 $25 (카드)
2. 빌드: Android Studio에서 `android/` 폴더 열고 Release AAB 생성
   ```bash
   cd android
   ./gradlew bundleRelease     # → android/app/build/outputs/bundle/release/app-release.aab
   ```
   - 서명키가 없으면 Android Studio > Build > Generate Signed Bundle로 신규 생성

### 스토어 리스팅 (복붙용)

- **앱 이름** (30자): `Retro Arcade — 레트로 아케이드`
- **짧은 설명** (80자):
  > 고전 오락실 감성 게임 13종! 코인 모아 일일 미션 깨고 스킨 꾸미기
- **전체 설명**:
  ```
  🕹️ 고전 오락실 감성을 한 손에!

  지오메트리 대시풍 러너부터 테트리스, 벽돌깨기, 플래피버드, 스네이크,
  퐁, 머지 퍼즐까지 — 추억의 게임 13종을 하나의 앱에서 즐겨보세요.

  ■ 13종 게임
  · NEON RUNNER — 원탭 질주 러너
  · SKY HOPPER — 구름 밟고 무한 상승
  · GALAXY RAIDERS — 갤러그풍 슈팅
  · TURBO RUSH — 3랩 타임 어택 레이스
  · DUNGEON DEPTHS — 5층 던전 액션 RPG
  · WORM.IO — 지렁이 아레나
  · BLOCK FALL — 고전 블록 퍼즐 (월킥 지원)
  · BRICK BREAK — 벽돌깨기 · 아이템 3종 · 콤보
  · FLAPPY WING — 원탭 플래피
  · STACK UP — 타워 쌓기 PERFECT 콤보
  · SNAKE CLASSIC — 그리드 스네이크
  · PONG DUEL — AI 패들 대전 7점 선승
  · MERGE DROP — 숫자 머지 연쇄 퍼즐

  ■ 메타 레이어
  · 코인: 게임 점수가 자동으로 코인으로!
  · 일일 미션: 매일 새로운 미션 3종, 보상 코인 수령
  · 스킨 상점: 로비 테마 5종 (네온/선셋/매트릭스/버블검/골드)

  ■ 특징
  · 칩튠 BGM 14트랙 + 효과음 전부 실시간 음악 생성 (용량 최소)
  · 완전 오프라인 플레이 · 계정 가입 불필요 · 개인정보 수집 없음
  · CRT 스캔라인 레트로 감성 그래픽
  ```
- **카테고리**: Arcade
- **콘텐츠 등급**: 전체 이용가 (광고·폭력·거래 없음)
- **데이터 보안 섹션**: "데이터 수집 안 함" 선택 (개인정보처리방침 URL 입력)
  - 방침 URL: `https://0archlinux0.github.io/retro-arcade/privacy.html`
- **그래픽 에셋**: `store/shots/` 5장 (휴대전화 스크린샷), 아이콘 512px는 `icons/icon-512.png`

### 제출 체크리스트
- [ ] Play Console 계정 결제 ($25)
- [ ] `./gradlew bundleRelease` AAB 빌드 + 서명
- [ ] 리스팅 텍스트 붙여넣기 (위 복사)
- [ ] 스크린샷 5장 업로드
- [ ] 데이터 보안 설문: 수집 없음
- [ ] 콘텐츠 등급 설문: 전체이용가
- [ ] 개인정보처리방침 URL 등록
- [ ] 내부 테스트 트랙 업로드 → 본인 기기 설치 확인
- [ ] 프로덕션 트랙 제출 (심사 보통 1~7일)

---

## B. Apple App Store (iOS) — Xcode 필요

### 선행 조건
1. **Xcode 설치** (Mac App Store, 무료) — 필수
   ```bash
   sudo xcode-select -s /Applications/Xcode.app
   cd retro-arcade && npx cap sync ios   # pod install 재실행
   ```
2. **Apple Developer Program** — 연 $99 (file-tidy 공증 건과 같은 계정 사용 가능)

### 빌드
```bash
npx cap open ios    # Xcode 열림
# Signing & Capabilities에서 Team 선택 + Bundle ID com.retroarcade.game 등록
# Product > Destination: Any iOS Device > Product > Archive
```

### App Store Connect 리스팅 (복붙용)

- **제목** (30자): `Retro Arcade — 레트로 아케이드`
- **부제** (30자): `고전 게임 13종 · 코인 · 미션`
- **설명**:
  ```
  추억의 오락실 게임 13종을 한 손에! 테트리스풍 퍼즐, 벽돌깨기, 스네이크,
  퐁, 플래피버드부터 던전 RPG, 레이싱, 머지 퍼즐까지.

  · 13종 게임 — 러너·점프·슈팅·레이싱·RPG·io웜·블록퍼즐·벽돌깨기
    ·플래피·타워쌓기·스네이크·퐁·머지퍼즐
  · 코인 시스템 — 게임 점수 자동 환산
  · 일일 미션 — 매일 리셋되는 미션 3종
  · 스킨 상점 — 로비 테마 5종 언락
  · 칩튠 사운드트랙 14트랙 실시간 생성
  · 오프라인 완전 지원 · 수집 데이터 없음
  ```
- **키워드** (100자): `레트로,아케이드,테트리스,벽돌깨기,스네이크,퐁,플래피,런너,RPG,미니게임,고전게임,머지,퍼즐`
- **카테고리**: Games > Arcade (+ 보조: Games > Puzzle)
- **연령 등급**: 4+ (공포·도박·의료 콘텐츠 전무)
- **개인정보 처리 세부정보**: "데이터 수집 안 함" — 앱 추적 투명성 프롬프트 불필요
- **개인정보처리방침 URL**: `https://0archlinux0.github.io/retro-arcade/privacy.html`
- **지원 URL**: `https://github.com/0ArchLinux0/retro-arcade/issues`

### 제출 체크리스트
- [ ] Apple Developer Program 가입 ($99/년)
- [ ] Xcode 설치 + `xcode-select -s` 전환
- [ ] `npx cap sync ios` 재실행 (CocoaPods 정상화)
- [ ] Archive → Upload to App Store Connect
- [ ] 리스팅 작성 (위 복사) + 스크린샷 5장 (`store/shots/`)
- [ ] iOS 6.7"(1290×2796) 스크린샷 요구 — 현재 샷을 업스케일하거나 재촬영
- [ ] 심사 제출 (보통 24~48시간)

> 참고: 첫 iOS 심사에서 "최소한의 기능" 리젝 가능성이 낮은 편 — 13종 게임이라 충분히 방어됩니다.
> Guideline 4.2 대응 문구: WebView 래퍼가 아니라 네이티브 번들 자산으로 배포되며 오프라인 동작함을 Review Notes에 명시하세요.

---

## C. PWA 이미 출시됨 — 홍보 링크

- 메인: https://0archlinux0.github.io/retro-arcade/
- 폰 홈 화면 추가 시 오프라인 실행 지원 (서비스워커 ra-v5)

## 파일 위치 요약

```
retro-arcade/
├── icons/
│   ├── ios-icon-1024.png      # App Store 아이콘 (마스터)
│   ├── icon-maskable-512.png  # Android 적응형/PWA maskable
│   └── android-{m,h,xh,xxh,xxxh}dpi.png  # 런처 아이콘
├── store/shots/               # 스크린샷 5장 (390×844 @3x = 1170×2532)
├── privacy.html               # 개인정보처리방침 (배포됨)
├── android/                   # Android Studio 프로젝트
├── ios/                       # Xcode 프로젝트 (pod install만 남음)
├── make-www.sh                # www/ 번들 어셈블러 (cap sync 전 실행)
└── make-icons.sh              # 아이콘 리젠레이터
```
