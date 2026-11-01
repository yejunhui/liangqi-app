# Liangqi · 량치

> 현금과 신용, 양쪽 장부를 명확하게.

**언어:** [简体中文](README.md) · [繁體中文](README.zh-TW.md) · [English](README.en.md) · [日本語](README.ja.md) · **한국어** · [Español](README.es.md) · [Français](README.fr.md) · [Deutsch](README.de.md) · [Português](README.pt.md) · [Русский](README.ru.md)

**온라인:** https://arksc.cn:8002/workbook/  
**소스:** [Gitee](https://gitee.com/PharaohMan/liangqi-app) · [GitHub](https://github.com/yejunhui/liangqi-app)  
**라이선스:** AGPL-3.0-or-later

Liangqi는 **현금 지출과 신용 구매를 분리해서 관리하는 로컬 우선 공유 가계부 웹 앱**입니다.

- **현금 지출**은 즉시 예금에서 차감합니다.
- **신용 구매**는 예금을 건드리지 않고 부채만 늘립니다. 상환할 때 비용으로 인식합니다.
- 상환은 자산 → 부채의 이동이며, 상환 시점의 비용으로 기록됩니다.

데이터는 기본적으로 브라우저에 저장됩니다. 여러 장부를 만들 수 있고, GitHub / Gitee / WebDAV 저장소를 연결하면 하나의 저장소를 여러 구성원이 공유할 수 있습니다.

![Liangqi 대시보드](docs/screenshots/dashboard.png)

## 작동 방식

| 작업 | 자산 / 예금 | 부채 | 비용 |
| --- | ---: | ---: | ---: |
| 현금 구매 | −100 | 0 | +100 |
| 신용 구매 | 0 | +100 | 0 |
| 상환 | −100 | −100 | +100 |
| 대출 입금 | +100 | +100 | 0 |

- 신용 구매는 부채만 늘리고 **구매 시점에는 비용으로 잡지 않습니다**.
- 상환할 때 상환 금액을 비용으로 인식합니다.
- 순자산 = 총자산 − 총부채. 신용 구매 시 부채가 늘어 순자산은 감소하지만, 상환해도 순자산은 변하지 않습니다.

## 주요 기능

- **여러 장부**: 가족, 여행, 사업 장부를 한 라이브러리에서 관리하고 전환.
- **자산 / 부채 계정**: 현금, 은행 계좌, 신용카드, 화베이, 대출 등과 기초 잔액.
- **청구서**: 이름, 분류, 만기일, 부분 상환, 완납 상태.
- **상환**: 자산 계정에서 상환하면 부채와 예금이 함께 줄고 비용이 기록됩니다.
- **구성원**: 청구서와 거래를 가족 구성원에게 귀속. 공유 장부는 구성원별 로그인.
- **태그 / 2단계 분류**: 생활 장면, 용도, 대상 태그와 상위·하위 분류.
- **예산 / 정기 기록**: 월간·연간 예산, 분류 / 태그 / 구성원별 예산, 정기 거래.
- **CSV 가져오기**: WeChat, Alipay, 은행 CSV의 열을 자동 인식해 가져오기.
- **다중 통화 / 첨부 파일**: 외화 금액과 환율, 영수증·청구서 첨부(최대 10 MB).
- **분석 / 보고서**: 자산 추이, 분류·태그·구성원별 분석, 6개월 추세, CSV / PDF 출력.
- **AI 어시스턴트**: OpenAI 호환 API를 설정하면 장부 기반 분석과 예산 제안.
- **PWA / 오프라인**: 홈 화면에 설치하고 앱 셸을 오프라인으로 열기.
- **10개 언어**: 중국어 간체·번체, 영어, 일본어, 한국어, 스페인어, 프랑스어, 독일어, 포르투갈어, 러시아어.

## 빠른 시작

온라인 버전은 위 주소를 열면 됩니다.

로컬 실행:

```bash
pnpm install
pnpm dev
```

빌드:

```bash
pnpm build:workbook
```

자세한 배포 방법은 [docs/deployment.md](docs/deployment.md)(중국어)를 참고하세요.

## 데이터와 개인정보

- 장부는 브라우저 **IndexedDB**에 저장되며 `localStorage`가 보조 저장소로 사용됩니다.
- 원격 연결 시 데이터는 자신의 GitHub / Gitee 저장소 또는 WebDAV에 저장됩니다. Liangqi의 데이터 서버는 없습니다.
- 구성원 비밀번호는 **PBKDF2 해시**만 저장하며 평문은 저장하지 않습니다.
- 토큰과 AI API 키는 기기의 `localStorage`에 저장되며 Liangqi 서버를 거치지 않습니다.
- 브라우저 데이터를 지우면 로컬 장부도 사라집니다. 정기적으로 백업을 내보내세요.

## 후원

Liangqi가 도움이 되었다면 Alipay 또는 WeChat으로 개발을 후원할 수 있습니다.

| Alipay | WeChat |
| --- | --- |
| <img src="public/support/alipay-qr.jpg" alt="Alipay 후원 QR" width="200" /> | <img src="public/support/wechat-qr.jpg" alt="WeChat 후원 QR" width="200" /> |

## 라이선스

**GNU Affero General Public License v3.0 or later(AGPL-3.0-or-later)**로 배포됩니다. 전문은 [LICENSE](LICENSE)를 참고하세요.

- 자유롭게 사용, 수정, 재배포할 수 있습니다.
- 수정본을 배포할 때는 해당 소스와 라이선스 문구를 제공해야 합니다.
- 수정본을 네트워크로 제공할 때는 AGPL 제13조에 따라 사용자에게 해당 소스를 제공해야 합니다.
- 이전 버전은 GPL-3.0-or-later로 배포되었습니다. 기존 허가는 계속 유효합니다.

제3자 라이선스는 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)를 참고하세요.

## 면책

Liangqi는 가계부 도구이며 재무·세무·투자 조언이 아닙니다. 사용 전에 백업을 내보내세요. 데이터 손실, 계산 오류, 본 소프트웨어 사용으로 인한 손해에 대해 작성자는 책임지지 않습니다.
