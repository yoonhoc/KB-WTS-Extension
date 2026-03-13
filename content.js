(function () {
  'use strict';

  const CONFIG = {
    GLOBAL_INIT: '__kbWtsContentInit',
    POLL_MS: 700,
    UPDATE_INTERVAL_MS: 50,
  };

  // 1. 중복 실행 방지
  if (window[CONFIG.GLOBAL_INIT]) return;
  window[CONFIG.GLOBAL_INIT] = true;

  // ===== UTILS =====
  // 등락률 포맷팅 함수 (ex: +1.23%)
  function fmtPct(x) {
    if (x == null || Number.isNaN(x)) return '';
    return (x > 0 ? '+' : '') + x.toFixed(2) + '%';
  }

  // ===== TRADINGVIEW DATA EXTRACTORS =====
  // 크로스헤어(마우스 커서) 위치의 가격 및 요소 기준 픽셀 좌표(x, y) 추출
  function getCrosshairData(model) {
    try {
      const fn = model.crossHairSource || model.crosshairSource;
      const src = fn && fn.call(model);
      if (!src || src.x == null || src.y == null || src.price == null) return null;
      return { x: src.x, y: src.y, price: src.price };
    } catch { return null; }
  }

  // 현재 차트의 최신 종가 데이터 추출
  function getLastPrice(model) {
    try {
      const panes = model.panes && model.panes();
      if (!panes?.length) return null;
      
      const ps = panes[0].defaultPriceScale?.();
      if (!ps?.mainSource) return null;
      
      const ms = ps.mainSource();
      if (typeof ms?.lastValueData !== 'function') return null;
      
      const lv = ms.lastValueData();
      if (!lv || lv.noData) return null;
      
      const str = lv.formattedPriceAbsolute ?? lv.text ?? null;
      if (!str) return null;
      
      const num = parseFloat(String(str).replace(/[^\d.\-]/g, ''));
      return Number.isNaN(num) ? null : num;
    } catch { return null; }
  }

  // ===== TOOLTIP UI =====
  const PANEL_ID = 'kb-wts-crosshair-tooltip';

  // iframe 내부에 직접 툴팁 DOM을 삽입하여 전체화면 적용시 깜박임 및 이벤트 충돌을 원천 차단
  function createTooltip(idoc) {
    const old = idoc.getElementById(PANEL_ID);
    if (old) old.remove();

    const el = idoc.createElement('div');
    el.id = PANEL_ID;

    // 툴팁 기본 스타일 설정
    Object.assign(el.style, {
      display:       'none',
      position:      'fixed',  // iframe 뷰포트 기준 절대 위치
      top:           '0',
      left:          '0',
      padding:       '3px 7px',
      background:    'rgba(26,28,35,0.85)',
      color:         '#fff',
      borderRadius:  '4px',
      fontSize:      '13px',
      fontFamily:    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      fontWeight:    '500',
      letterSpacing: '0.5px',
      pointerEvents: 'none',
      zIndex:        '2147483647', // 최상단 노출
      whiteSpace:    'nowrap',
      boxShadow:     '0 2px 6px rgba(0,0,0,0.35)',
      willChange:    'transform',  // GPU 가속을 통한 부드러운 위치 이동
    });

    idoc.documentElement.appendChild(el);

    // 최초 1회 렌더링을 통해 툴팁의 크기를 측정하여 캐싱 (성능 최적화)
    el.style.display = 'block';
    el.textContent = '+00.00%';
    const cachedW = el.offsetWidth;
    const cachedH = el.offsetHeight;
    el.style.display = 'none';
    el.textContent = '';

    return {
      show(x, y, text, color) {
        el.textContent = text;
        el.style.color = color;
        el.style.display = 'block';

        // 툴팁이 화면 밖으로 넘어가지 않도록 경계 좌표 보정
        const vw = idoc.documentElement.clientWidth;
        const vh = idoc.documentElement.clientHeight;
        const OFF = 8; // 마우스 우하단 오프셋 간격
        
        let fx = x + OFF;
        let fy = y + OFF;
        
        if (fx + cachedW > vw) fx = x - cachedW - OFF;
        if (fy + cachedH > vh) fy = y - cachedH - OFF;
        if (fx < 0) fx = 0;
        if (fy < 0) fy = 0;

        // top/left 변경을 피하고 transform을 사용하여 reflow 렌더링 비용 최소화
        el.style.transform = `translate(${fx}px, ${fy}px)`;
      },
      hide() {
        el.style.display = 'none';
      }
    };
  }

  // ===== TRADINGVIEW IFRAME EXPLORER =====
  // M-able 와이드 웹의 복잡한 DOM 구조(프레임 중첩)를 탐색하여 실제 차트 iframe을 추출
  function findTradingViewWindow() {
    try {
      const tradingBody = document.getElementById('tradingBody')?.contentDocument;
      if (!tradingBody) return null;

      const tradingBoard = tradingBody.getElementById('tradingBoard')?.contentDocument;
      if (!tradingBoard) return null;

      const tvIframe = Array.from(tradingBoard.querySelectorAll('iframe'))
        .find(f => /^tradingview_/i.test(f.id || ''));
      if (!tvIframe) return null;

      const w = tvIframe.contentWindow;
      // 내부 위젯 컬렉션이 정상적으로 로드되었는지 확인
      if (!w?.chartWidgetCollection) return null;

      return { w, idoc: tvIframe.contentDocument || w.document };
    } catch { return null; }
  }

  // ===== CORE APPLICATION LOGIC =====
  const INIT_KEY  = '__kbWtsTvInit';
  const TIMER_KEY = '__kbWtsTvTimer';

  function init() {
    const result = findTradingViewWindow();
    if (!result) return false;

    const { w, idoc } = result;
    if (w[INIT_KEY]) return true; // 이중 초기화 방지

    const widgets = w.chartWidgetCollection.getAll();
    if (!widgets?.length) return false;

    const model = widgets[0]._model;
    if (!model) return false;

    const tooltip = createTooltip(idoc);

    // 주기적으로 십자선(crosshair)과 최근 가격을 읽어와 툴팁을 렌더링
    function update() {
      const ch = getCrosshairData(model);
      const lp = getLastPrice(model);

      if (!ch || lp == null || lp === 0) {
        tooltip.hide();
        return;
      }

      // 등락률 계산
      const pct   = ((ch.price - lp) / lp) * 100;
      const text  = fmtPct(pct);
      const color = pct > 0 ? '#ff4d4d' : pct < 0 ? '#4d94ff' : '#fff';

      // ch.x, ch.y는 이미 해당 대상 iframe 기준 내부 픽셀 좌표이므로 그대로 사용
      tooltip.show(ch.x, ch.y, text, color);
    }

    if (w[TIMER_KEY]) clearInterval(w[TIMER_KEY]);
    w[TIMER_KEY] = setInterval(update, CONFIG.UPDATE_INTERVAL_MS);
    update();

    w[INIT_KEY] = true;
    console.log('[KB WTS] TradingView 차트 툴팁 주입 완료');
    return true;
  }

  // 차트가 완전히 로드될 때까지 지속적으로 폴링(polling) 시도
  function loop() {
    try { init(); } catch (e) { console.error('[KB WTS] Initialization Error:', e); }
    setTimeout(loop, CONFIG.POLL_MS);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loop);
  } else {
    loop();
  }
})();