# KB WTS Extension 📈

![Version](https://img.shields.io/badge/version-1.0-blue.svg)
![Chrome](https://img.shields.io/badge/Chrome-Extension-green.svg)

KB증권 M-able 와이드 웹의 TradingView 차트에서 **현재 마우스 십자선(Crosshair) 위치의 가격과 직전 종가 대비 등락률(%)을 직관적으로 보여주는 크롬 확장 프로그램**입니다.


---

## ✨ 주요 기능 (Features)

*   **실시간 등락률 표시:** 마우스를 차트 위에 올리면 즉각적으로 계산된 퍼센트(%) 포인트를 마우스 커서 옆에 띄워줍니다.
*   **전체화면(Fullscreen) 완벽 지원:** HTML5 DOM 이벤트를 우회하여 차트 고유의 렌더링 컨텍스트 트리에 툴팁을 주입합니다. 차트를 전체화면으로 띄워도 깜빡임(Flickering) 없이 부드러운 위치 추적이 가능합니다.
*   **다중 Iframe 완벽 대응:** M-able 고유의 복잡한 중첩 Iframe 구조를 자동으로 탐색하여 최적의 부모-자식 컴포넌트를 연결합니다.
*   **극강의 성능 최적화:** `left`, `top` 등의 Reflow 유발 속성을 배제하고, GPU 가속이 들어간 `transform: translate` 방식으로 마우스 좌표를 연산하여 차트의 버벅임이 전혀 없습니다.

---

## 🚀 설치 방법 (Installation)

이 확장 프로그램은 크롬 웹 스토어에 정식 등록되기 전이므로, **'개발자 모드'**를 통해 로컬 환경에서 바로 설치할 수 있습니다.

1.  **확장 프로그램 다운로드:**
    *   이 프로젝트의 파일들(`manifest.json`, `content.js`)을 하나의 폴더(예: `KB-WTS-Extension`)에 모아둡니다.
2.  **크롬 확장 프로그램 관리 페이지 접속:**
    *   크롬 브라우저를 열고 주소창에 `chrome://extensions/` 를 입력하여 접속합니다.
3.  **개발자 모드 켜기:**
    *   페이지 우측 상단에 있는 **개발자 모드(Developer mode)** 토글 스위치를 `켜짐` 상태로 바꿉니다.
4.  **폴더 업로드 (압축해제된 확장 프로그램을 로드합니다):**
    *   좌측 상단에 나타난 **압축해제된 확장 프로그램을 로드합니다(Load unpacked)** 버튼을 클릭합니다.
    *   파일들이 모여있는 1번의 폴더(`KB-WTS-Extension`)를 선택합니다.
5.  **설치 완료! 🎉**
    *   성공적으로 로드되었다면 이제 KB증권 M-able 사이트에 접속하여 차트를 열어보세요!

---

## 🛠 구조 및 아키텍처 (Architecture)

*   **`manifest.json`:** 크롬 확장 프로그램의 기본 설정 파일로, `all_frames: true` 옵션을 통해 차트가 들어있는 iframe 내부까지 모두 스크립트를 주입시킵니다.
*   **`content.js`:** 확장 프로그램의 핵심 코어 엔진입니다.
    *   **TradingView Hook:** TradingView의 내부 인스턴스(`chartWidgetCollection`, `_model` 등)에 접근해 가격 데이터와 크로스헤어 좌표를 직접 추출합니다.
    *   **DOM Overlay:** iframe의 document 내부에 직접 `div` 패널을 만들어 주입함으로써 DOM 트리 변화에 따른 렌더링 병목을 없앴습니다.
