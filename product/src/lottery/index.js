import "./index.css";
import "../css/animate.min.css";
import "./canvas.js";
import {
  addQipao,
  setPrizes,
  showPrizeList,
  setPrizeData,
  resetPrize
} from "./prizeList";
import { NUMBER_MATRIX } from "./config.js";

const ROTATE_TIME = 3000;
const ROTATE_LOOP = 1000;
const BASE_HEIGHT = 1080;

let TOTAL_CARDS,
  btns = {
    enter: document.querySelector("#enter"),
    lotteryBar: document.querySelector("#lotteryBar"),
    lottery: document.querySelector("#lottery")
  },
  prizes,
  EACH_COUNT,
  ROW_COUNT = 7,
  COLUMN_COUNT = 17,
  COMPANY,
  HIGHLIGHT_CELL = [],
  // Tỷ lệ hiện tại
  Resolution = 1;

let camera,
  scene,
  renderer,
  controls,
  threeDCards = [],
  targets = {
    table: [],
    sphere: []
  };

let rotateObj;

let ticker = {
  el: null,
  track: null,
  items: [],
  raf: null,
  running: false,
  speed: 28,
  stopAfter: 0,
  stopAt: 0,
  winner: null
};

let tickerLive = {
  el: null,
  listEl: null,
  active: false
};

function initTickerLive() {
  if (tickerLive.el) return;

  const el = document.createElement('div');
  el.id = 'tickerLiveName';
  el.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:50%',
    'transform:translate(-50%,-50%)',
    'z-index:8',
    'pointer-events:none',
    'padding:12px 18px',
    'border-radius:16px',
    'font-size:3.2vh',
    'font-weight:900',
    'color: transparent !important',
    'background: transparent !important',
    'border: none !important',
    'box-shadow: none !important',
    'max-width: min(1000px, calc(100vw - 120px))',
    'overflow: hidden',
    'text-overflow: ellipsis',
    'white-space: nowrap',
    'opacity: 0',
    'transition: opacity 120ms ease'
  ].join(';');
  document.body.appendChild(el);
  tickerLive.el = el;

  const list = document.createElement('div');
  list.id = 'tickerLiveList';
  list.style.cssText = [
    'position:fixed',
    'left:50%',
    'top:50%',
    'max-height:40vh',
    'overflow:hidden',
    'transform:translate(-50%,-50%)',
    'z-index:7',
    'pointer-events:none',
    'display:flex',
    'gap:12px',
    'flex-wrap:wrap',
    'justify-content:center',
    'max-width:min(1100px,calc(100vw - 80px))',
    'padding:0 18px',
    'opacity:0',
    'transition:opacity 120ms ease'
  ].join(';');
  document.body.appendChild(list);
  tickerLive.listEl = list;
}

function resetTickerLive() {
  if (tickerLive.el) {
    tickerLive.el.textContent = '';
  }
  if (tickerLive.listEl) {
    tickerLive.listEl.innerHTML = '';
  }
}

function setTickerLiveActive(active) {
  initTickerLive();
  tickerLive.active = !!active;
  if (tickerLive.el) {
    tickerLive.el.style.opacity = active ? '1' : '0';
  }
  if (tickerLive.listEl) {
    tickerLive.listEl.style.opacity = active ? '1' : '0';
  }
}

function formatUserLine(u) {
  if (!u) return '';
  const dept = u[2] ? ` · ${u[2]}` : '';
  return `${u[1]} · ${u[0]}${dept}`;
}

function getTickerNearestUserIds(count) {
  const maxPerDraw = Math.max(1, count | 0);
  const leftPrizeCount = currentPrize
    ? (currentPrize.count - ((basicData.luckyUsers[currentPrize.type] || []).length || 0))
    : 0;
  const maxAllowed = Math.max(1, Math.min(maxPerDraw, basicData.leftUsers.length || 0, leftPrizeCount || 0));
  const n = maxAllowed;
  if (!ticker.items || ticker.items.length === 0) return [];
  const centerX = getTickerCenterX();
  const scored = ticker.items.map((el) => {
    const x = parseFloat(el.dataset.x || '0');
    const w = el.offsetWidth || 0;
    const itemCenter = x + w / 2;
    const dist = Math.abs(itemCenter - centerX);
    const id = el.dataset && el.dataset.userId ? el.dataset.userId : el.textContent;
    return { id, dist };
  });
  scored.sort((a, b) => a.dist - b.dist);
  const out = [];
  const seen = new Set();
  for (const s of scored) {
    const key = String(s.id || '');
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= n) break;
  }
  return out;
}

function setTickerLiveList(ids) {
  if (!tickerLive.active) return;
  if (!tickerLive.listEl) return;
  tickerLive.listEl.innerHTML = '';

  const resolved = ids
    .map((id) => {
      const u = basicData.leftUsers.find(x => x && String(x[0]) === String(id)) ||
        basicData.users.find(x => x && String(x[0]) === String(id));
      return u ? formatUserLine(u) : String(id);
    })
    .filter(Boolean);

  for (const text of resolved) {
    const chip = document.createElement('div');
    chip.style.cssText = [
      'padding:10px 16px',
      'border-radius:14px',
      'font-size:2.2vh',
      'font-weight:900',
      'color:rgba(255,255,255,0.96)',
      'background:linear-gradient(135deg, rgba(255, 0, 0, 0.85) 0%, rgba(255, 0, 0, 0.85) 0%)',
      'backdrop-filter:blur(10px)',
      'border:1px solid rgba(255,255,255,0.20)',
      'box-shadow:0 12px 30px rgba(0,0,0,0.28)',
      'max-width:46vw',
      'overflow:hidden',
      'text-overflow:ellipsis',
      'white-space:nowrap'
    ].join(';');
    chip.textContent = text;
    tickerLive.listEl.appendChild(chip);
  }
}

function setTickerLiveName(name) {
  if (!tickerLive.active) return;
  if (!tickerLive.el) return;
  if (!name) {
    tickerLive.el.textContent = '';
    return;
  }

  const byId = basicData.leftUsers.find(u => u && String(u[0]) === String(name)) ||
    basicData.users.find(u => u && String(u[0]) === String(name));
  if (byId) {
    const dept = byId[2] ? ` · ${byId[2]}` : '';
    tickerLive.el.textContent = `${byId[1]} · ${byId[0]}${dept}`;
  } else {
    tickerLive.el.textContent = String(name);
  }
}

function getTickerCenterX() {
  if (!ticker.el) return window.innerWidth / 2;
  const rect = ticker.el.getBoundingClientRect();
  return rect.left + rect.width / 2;
}

function getTickerWinnerFromPositions() {
  if (!ticker.items || ticker.items.length === 0) return null;
  const centerX = getTickerCenterX();
  let best = null;
  let bestDist = Infinity;
  for (const el of ticker.items) {
    const x = parseFloat(el.dataset.x || '0');
    const w = el.offsetWidth || 0;
    const itemCenter = x + w / 2;
    const dist = Math.abs(itemCenter - centerX);
    if (dist < bestDist) {
      bestDist = dist;
      best = el;
    }
  }
  return best ? (best.dataset && best.dataset.userId ? best.dataset.userId : best.textContent) : null;
}

let selectedCardIndex = [],
  rotate = false,
  basicData = {
    prizes: [], //Thông tin giải thưởng
    users: [], //Tất cả người tham gia
    luckyUsers: {}, //Người đã trúng thưởng
    leftUsers: [] //Người chưa trúng thưởng
  },
  interval,
  // Giải thưởng hiện tại đang quay, bắt đầu từ giải thấp nhất đến giải cao nhất
  currentPrizeIndex,
  currentPrize,
  // Đang quay số
  isLotting = false,
  currentLuckys = [];

initAll();
initVisualEffects();

// WebSocket connection for remote control
let ws = null;
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // Kết nối đến server backend (port 18888 trong dev, 8090 trong production)
  const port = window.location.port === '9000' ? 18888 : (window.location.port || 8090);
  const wsUrl = `${protocol}//${window.location.hostname}:${port}`;
  
  console.log('Lottery page connecting to WebSocket:', wsUrl);
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log('WebSocket connected for lottery control');
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'command') {
        handleRemoteCommand(data.action);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected, reconnecting...');
    setTimeout(initWebSocket, 3000);
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

function handleRemoteCommand(action) {
  console.log('Nhận lệnh từ controller:', action);
  const buttonMap = {
    'enter': '#enter',
    'start': '#lottery',
    'stop': '#lottery',
    'reset': '#reset',
    'save': '#save',
    'reLottery': '#reLottery'
  };

  const buttonId = buttonMap[action];
  if (buttonId) {
    const button = document.querySelector(buttonId);
    if (button) {
      if (action === 'stop') {
        if (isLotting) {
          button.click();
        }
        return;
      }
      if (action === 'start') {
        if (!isLotting) {
          button.click();
        }
        return;
      }

      // reset/save/reLottery/enter: gọi trực tiếp logic để tránh confirm/popup
      if (action === 'reset') {
        addQipao("Đặt lại tất cả dữ liệu, quay lại từ đầu");
        addHighlight();
        resetCard();
        currentLuckys = [];
        basicData.leftUsers = Object.assign([], basicData.users);
        basicData.luckyUsers = {};
        currentPrizeIndex = basicData.prizes.length - 1;
        currentPrize = basicData.prizes[currentPrizeIndex];
        resetPrize(currentPrizeIndex);
        reset();
        switchScreen("enter");
        return;
      }

      if (action === 'save') {
        saveData().then(() => {
          resetCard().then(() => {
            currentLuckys = [];
          });
          exportData();
          addQipao(`Dữ liệu đã được lưu vào EXCEL.`);
        });
        return;
      }

      if (action === 'reLottery') {
        if (currentLuckys.length === 0) {
          addQipao(`Hiện tại chưa quay số, không thể quay lại~~`);
          return;
        }
        setErrorData(currentLuckys);
        addQipao(`Quay lại [${currentPrize.title}], chuẩn bị sẵn sàng`);
        setLotteryStatus(true);
        resetCard().then(() => {
          lottery();
        });
        return;
      }

     

      // enter fallback
      button.click();
    }
  }

  if (action === 'save-result') {
    saveData().then(res => {
      resetCard().then(res => {
        // Xóa bản ghi trước đó
        currentLuckys = [];
      });
      
      addQipao(`Dữ liệu đã được lưu vào EXCEL.`);
    });
    addHighlight();
    resetCard();
    switchScreen("enter");
    // reload page
    //window.location.reload();
    return;
  }

  if (action === 'refresh') {
    // reload page
    window.location.reload();
    initAll();
    return;
  }
}

// Initialize WebSocket
setTimeout(initWebSocket, 1000);

/**
 * Khởi tạo tất cả DOM
 */
function initAll() {
  window.AJAX({
    url: "/getTempData",
    success(data) {
      // Lấy dữ liệu cơ bản
      prizes = data.cfgData.prizes;
      EACH_COUNT = data.cfgData.EACH_COUNT;
      window.LOTTERY_PER_DRAW = EACH_COUNT;
      COMPANY = data.cfgData.COMPANY;
      HIGHLIGHT_CELL = createHighlight();
      // Nếu đang ở màn hình "welcome" (enter) thì bật highlight ngay
      // (tránh trường hợp initCards chạy trước khi CSS3D cards render xong)
      setTimeout(addHighlight, 0);
      basicData.prizes = prizes;
      setPrizes(prizes);

      TOTAL_CARDS = ROW_COUNT * COLUMN_COUNT;

      // Đọc ket-qua-quay-so-so đã được thiết lập hiện tại
      basicData.leftUsers = data.leftUsers;
      basicData.luckyUsers = data.luckyData;

      let prizeIndex = basicData.prizes.length - 1;
      for (; prizeIndex > -1; prizeIndex--) {
        if (
          data.luckyData[prizeIndex] &&
          data.luckyData[prizeIndex].length >=
            basicData.prizes[prizeIndex].count
        ) {
          continue;
        }
        currentPrizeIndex = prizeIndex;
        currentPrize = basicData.prizes[currentPrizeIndex];
        break;
      }

      showPrizeList(currentPrizeIndex);
      let curLucks = basicData.luckyUsers[currentPrize.type];
      setPrizeData(currentPrizeIndex, curLucks ? curLucks.length : 0, true);
    }
  });

  window.AJAX({
    url: "/getUsers",
    success(data) {
      basicData.users = data;

      initCards();
      // startMaoPao();
      animate();
      shineCard();
    }
  });
}

function initCards() {
  let member = basicData.users.slice(),
    showCards = [],
    length = member.length;

  let isBold = false,
    showTable = basicData.leftUsers.length === basicData.users.length,
    index = 0,
    totalMember = member.length,
    position = {
      x: (140 * COLUMN_COUNT - 20) / 2,
      y: (180 * ROW_COUNT - 20) / 2
    };

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    10000
  );
  camera.position.z = 3000;

  scene = new THREE.Scene();

  for (let i = 0; i < ROW_COUNT; i++) {
    for (let j = 0; j < COLUMN_COUNT; j++) {
      isBold = HIGHLIGHT_CELL.includes(j + "-" + i);
      var element = createCard(
        member[index % length],
        isBold,
        index,
        showTable
      );

      var object = new THREE.CSS3DObject(element);
      object.position.x = Math.random() * 4000 - 2000;
      object.position.y = Math.random() * 4000 - 2000;
      object.position.z = Math.random() * 4000 - 2000;
      scene.add(object);
      threeDCards.push(object);
      //

      var object = new THREE.Object3D();
      object.position.x = j * 140 - position.x;
      object.position.y = -(i * 180) + position.y;
      targets.table.push(object);
      index++;
    }
  }

  // sphere

  // bỏ chế độ sphere (chuyển sang ticker)

  renderer = new THREE.CSS3DRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("container").appendChild(renderer.domElement);

  //

  controls = new THREE.TrackballControls(camera, renderer.domElement);
  controls.rotateSpeed = 0.5;
  controls.minDistance = 500;
  controls.maxDistance = 6000;
  controls.addEventListener("change", render);

  bindEvent();

  initTicker();

  if (showTable) {
    switchScreen("enter");
  } else {
    switchScreen("lottery");
  }
}

function setLotteryStatus(status = false) {
  isLotting = status;
}

/**
 * Liên kết sự kiện
 */
function bindEvent() {
  document.querySelector("#menu").addEventListener("click", function (e) {
    e.stopPropagation();
    // Nếu đang quay số, cấm mọi thao tác
    if (isLotting) {
      if (e.target.id === "lottery") {
        // Kết thúc quay
        rotateObj && rotateObj.stop && rotateObj.stop();
      } else {
        addQipao("Đang quay số, xin chờ một chút～～");
      }
      return false;
    }

    let target = e.target.id;
    switch (target) {
      // Hiển thị tường số
      case "welcome":
        switchScreen("enter");
        rotate = false;
        break;
      // Vào quay số
      case "enter":
        removeHighlight();
        addQipao(`Sắp quay [${currentPrize.title}], đừng rời đi.`);
        // rotate = !rotate;
        rotate = true;
        switchScreen("lottery");
        break;
      // Đặt lại
      case "reset":
        let doREset = window.confirm(
          "Bạn có chắc chắn muốn đặt lại dữ liệu? Sau khi đặt lại, tất cả các giải đã quay sẽ bị xóa?"
        );
        if (!doREset) {
          return;
        }
        addQipao("Đặt lại tất cả dữ liệu, quay lại từ đầu");
        addHighlight();
        resetCard();
        // Đặt lại tất cả dữ liệu
        currentLuckys = [];
        basicData.leftUsers = Object.assign([], basicData.users);
        basicData.luckyUsers = {};
        currentPrizeIndex = basicData.prizes.length - 1;
        currentPrize = basicData.prizes[currentPrizeIndex];

        resetPrize(currentPrizeIndex);
        reset();
        switchScreen("enter");
        break;
      // Quay số
      case "lottery":
        if (!isLotting) {
          // Bắt đầu quay
          // Khi bắt đầu quay thì bỏ highlight năm
          removeHighlight();
          // Ẩn chữ trắng tickerLive (nếu có)
          setTickerLiveActive(false);
          setLotteryStatus(true);
          // Mỗi lần quay số trước tiên lưu dữ liệu quay số lần trước
          saveData();
          //Cập nhật hiển thị số lượng quay số còn lại
          changePrize();
          resetCard().then(() => {
            // Quay số
            lottery();
          });
          addQipao(`Đang quay [${currentPrize.title}], chuẩn bị tư thế`);
        } else {
          // Kết thúc quay
          rotateObj && rotateObj.stop && rotateObj.stop();
        }
        break;
      // Quay lại
      case "reLottery":
        if (currentLuckys.length === 0) {
          addQipao(`Hiện tại chưa quay số, không thể quay lại~~`);
          return;
        }
        setErrorData(currentLuckys);
        addQipao(`Quay lại [${currentPrize.title}], chuẩn bị sẵn sàng`);
        setLotteryStatus(true);
        // Quay lại thì trực tiếp quay, không lưu dữ liệu quay số lần trước
        // Quay số
        resetCard().then(res => {
          // Quay số
          lottery();
        });
        break;
      // Xuất ket-qua-quay-so-so
      case "save":
        saveData().then(res => {
          resetCard().then(res => {
            // Xóa bản ghi trước đó
            currentLuckys = [];
          });
          exportData();
          addQipao(`Dữ liệu đã được lưu vào EXCEL.`);
        });
        case 'save-result':
          saveData().then(res => {
            resetCard().then(res => {
              // Xóa bản ghi trước đó
              currentLuckys = [];
            });
            addQipao(`Dữ liệu đã được lưu vào EXCEL.`);
            
          });
        break;
    }
  });

  window.addEventListener("resize", onWindowResize, false);
}

function switchScreen(type) {
  switch (type) {
    case "enter":
      btns.enter.classList.remove("none");
      btns.lotteryBar.classList.add("none");
      transform(targets.table, 2000);
      break;
    default:
      btns.enter.classList.add("none");
      btns.lotteryBar.classList.remove("none");
      transform(targets.table, 2000);
      break;
  }
}

function initTicker() {
  if (ticker.el) return;
  ticker.el = document.createElement('div');
  ticker.el.id = 'ticker';
  ticker.el.innerHTML = `
    <div class="ticker-center"></div>
    <div class="ticker-track"></div>
  `;
  document.body.appendChild(ticker.el);
  ticker.track = ticker.el.querySelector('.ticker-track');
}

function buildTickerItems() {
  if (!ticker.track) return;
  const src = basicData.leftUsers.length ? basicData.leftUsers : basicData.users;
  const pool = src.length ? src : [["", "...", ""]];

  ticker.track.innerHTML = '';
  ticker.items = [];

  const repeat = Math.max(6, Math.ceil(window.innerWidth / 220) + 10);
  for (let i = 0; i < repeat; i++) {
    const u = pool[random(pool.length)];
    const name = (u && u[1]) ? u[1] : '...';
    const item = document.createElement('div');
    item.className = 'ticker-item';
    item.textContent = name;
    item.dataset.userId = (u && u[0]) ? String(u[0]) : '';
    ticker.track.appendChild(item);
    ticker.items.push(item);
  }
}

function startTicker() {
  initTicker();
  buildTickerItems();
  ticker.el.classList.add('active');
  ticker.running = true;
  ticker.stopAfter = 0;
  ticker.stopAt = 0;
  ticker.winner = null;
  setTickerLiveActive(true);

  let last = performance.now();
  const step = (now) => {
    if (!ticker.running) return;
    const dt = Math.min(48, now - last);
    last = now;

    ticker.stopAfter += dt;

    const dx = (ticker.speed * dt) / 16.67;
    for (const el of ticker.items) {
      const x = parseFloat(el.dataset.x || '0') - dx;
      el.dataset.x = String(x);
      el.style.transform = `translate3d(${x}px, 0, 0)`;
    }

    // cập nhật danh sách tên theo perDraw
    const perDraw = (EACH_COUNT && EACH_COUNT[currentPrizeIndex]) ? EACH_COUNT[currentPrizeIndex] : 1;
    const ids = getTickerNearestUserIds(perDraw);
    setTickerLiveName(ids[0]);
    setTickerLiveList(ids);

    // wrap
    let maxRight = -Infinity;
    let maxWidth = 160;
    for (const el of ticker.items) {
      const x = parseFloat(el.dataset.x || '0');
      const w = el.offsetWidth || 160;
      const right = x + w;
      if (right > maxRight) {
        maxRight = right;
        maxWidth = w;
      }
    }

    for (const el of ticker.items) {
      const x = parseFloat(el.dataset.x || '0');
      const w = el.offsetWidth || 160;
      if (x + w < -40) {
        const newX = maxRight + 24;
        el.dataset.x = String(newX);
        el.style.transform = `translate3d(${newX}px, 0, 0)`;
        maxRight = newX + w;
      }
    }

    if (ticker.stopAt && now >= ticker.stopAt) {
      ticker.running = false;
      cancelAnimationFrame(ticker.raf);
      ticker.raf = null;
      finishTicker();
      return;
    }

    ticker.raf = requestAnimationFrame(step);
  };

  // init x positions
  let x = window.innerWidth;
  ticker.items.forEach((el) => {
    el.dataset.x = String(x);
    el.style.transform = `translate3d(${x}px, 0, 0)`;
    x += el.offsetWidth + 24;
  });

  ticker.raf = requestAnimationFrame(step);
}

function requestStopTicker() {
  if (!ticker.running) return;
  // nếu đã yêu cầu dừng rồi thì bỏ qua
  if (ticker.stopAt) return;
  // giảm tốc dần trong ~800ms rồi dừng
  const start = performance.now();
  const startSpeed = ticker.speed;
  const decelMs = 800;
  const decel = (now) => {
    const t = Math.min(1, (now - start) / decelMs);
    ticker.speed = startSpeed * (1 - t) + 2;
    if (t < 1 && ticker.running) {
      requestAnimationFrame(decel);
    } else {
      const perDraw = (EACH_COUNT && EACH_COUNT[currentPrizeIndex]) ? EACH_COUNT[currentPrizeIndex] : 1;
      const ids = getTickerNearestUserIds(perDraw);
      ticker.winner = ids[0] || getTickerWinnerFromPositions();
      ticker.stopAt = performance.now() + 150;
    }
  };
  requestAnimationFrame(decel);
}

function finishTicker() {
  ticker.speed = 28;
  ticker.el && ticker.el.classList.remove('active');
  setTickerLiveActive(false);

  const forcedWinner = ticker.winner || getTickerWinnerFromPositions();

  // chọn người thắng và gán lên card theo flow cũ
  currentLuckys = [];
  selectedCardIndex = [];

  let perCount = EACH_COUNT && EACH_COUNT[currentPrizeIndex] ? EACH_COUNT[currentPrizeIndex] : 1,
    luckyData = basicData.luckyUsers[currentPrize.type],
    leftCount = basicData.leftUsers.length,
    leftPrizeCount = currentPrize.count - (luckyData ? luckyData.length : 0);

  // không vượt quá số giải còn lại
  perCount = Math.min(perCount, Math.max(0, leftPrizeCount));

  if (leftCount < perCount) {
    addQipao("Số người tham gia quay số còn lại không đủ, bây giờ đặt lại tất cả người tham gia để có thể quay lần hai！");
    basicData.leftUsers = basicData.users.slice();
    leftCount = basicData.leftUsers.length;
  }

  for (let i = 0; i < perCount; i++) {
    let luckyId = random(leftCount);
    if (i === 0 && forcedWinner) {
      const forcedIndex = basicData.leftUsers.findIndex(u => u && (u[1] === forcedWinner || String(u[0]) === String(forcedWinner)));
      if (forcedIndex >= 0) {
        luckyId = forcedIndex;
      }
    }
    currentLuckys.push(basicData.leftUsers.splice(luckyId, 1)[0]);
    leftCount--;
    leftPrizeCount--;

    let cardIndex = random(TOTAL_CARDS);
    while (selectedCardIndex.includes(cardIndex)) {
      cardIndex = random(TOTAL_CARDS);
    }
    selectedCardIndex.push(cardIndex);

    if (leftPrizeCount === 0) {
      break;
    }
  }

  selectCard();
  
}

/**
 * Tạo phần tử
 */
function createElement(css, text) {
  let dom = document.createElement("div");
  dom.className = css || "";
  dom.innerHTML = text || "";
  return dom;
}

/**
 * Tạo thẻ tên
 */
function createCard(user, isBold, id, showTable) {
  var element = createElement();
  element.id = "card-" + id;

  if (isBold) {
    element.className = "element lightitem";
    if (showTable) {
      element.classList.add("highlight", "start-year");
    }
  } else {
    element.className = "element";
    element.style.backgroundColor =
      "rgba(0,127,127," + (Math.random() * 0.7 + 0.25) + ")";
  }
  // Bỏ tên công ty - không hiển thị
  // element.appendChild(createElement("company", COMPANY));

  element.appendChild(createElement("name", user[1]));

  element.appendChild(createElement("details", user[0] + "<br/>" + user[2]));
  return element;
}

function removeHighlight() {
  document.querySelectorAll(".highlight").forEach(node => {
    node.classList.remove("highlight", "start-year");
  });
}

function addHighlight() {
  document.querySelectorAll(".lightitem").forEach(node => {
    node.classList.add("highlight", "start-year");
  });
}

/**
 * Render quả cầu 3D
 */
function transform(targets, duration) {
  // TWEEN.removeAll();
  for (var i = 0; i < threeDCards.length; i++) {
    var object = threeDCards[i];
    var target = targets[i];

    new TWEEN.Tween(object.position)
      .to(
        {
          x: target.position.x,
          y: target.position.y,
          z: target.position.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: target.rotation.x,
          y: target.rotation.y,
          z: target.rotation.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  }

  new TWEEN.Tween(this)
    .to({}, duration * 2)
    .onUpdate(render)
    .start();
}

// function rotateBall() {
//   return new Promise((resolve, reject) => {
//     scene.rotation.y = 0;
//     new TWEEN.Tween(scene.rotation)
//       .to(
//         {
//           y: Math.PI * 8
//         },
//         ROTATE_TIME
//       )
//       .onUpdate(render)
//       .easing(TWEEN.Easing.Exponential.InOut)
//       .start()
//       .onComplete(() => {
//         resolve();
//       });
//   });
// }

function rotateBall() {
  // giữ API cũ nhưng chuyển sang ticker
  return new Promise((resolve) => {
    rotateObj = { stop: () => requestStopTicker() };
    startTicker();
    // resolve khi bắt đầu chạy (dừng sẽ gọi finishTicker)
    resolve();
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  render();
}

function animate() {
  // Cho phép cảnh quay qua trục x hoặc y
  // rotate && (scene.rotation.y += 0.088);

  requestAnimationFrame(animate);
  TWEEN.update();
  controls.update();

  // Vòng lặp render
  // render();
}

function render() {
  renderer.render(scene, camera);
}

function selectCard(duration = 600) {
  rotate = false;
  let width = 240,
    tag = -(currentLuckys.length - 1) / 2,
    locates = [];

  // Khi hiển thị kết quả: tắt tickerLive (tên đang chạy ở giữa)
  setTickerLiveActive(false);
  resetTickerLive();

  // Tính toán thông tin vị trí, lớn hơn 5 thì hiển thị thành 2 hàng
  if (currentLuckys.length > 3) {
    let yPosition = [-150, 150],
      l = selectedCardIndex.length,
      mid = Math.ceil(l / 2);
    tag = -(mid - 1) / 2;
    for (let i = 0; i < mid; i++) {
      locates.push({
        x: tag * width * Resolution,
        y: yPosition[0] * Resolution
      });
      tag++;
    }

    tag = -(l - mid - 1) / 2;
    for (let i = mid; i < l; i++) {
      locates.push({
        x: tag * width * Resolution,
        y: yPosition[1] * Resolution
      });
      tag++;
    }
  } else {
    for (let i = selectedCardIndex.length; i > 0; i--) {
      locates.push({
        x: tag * width * Resolution,
        y: 0 * Resolution
      });
      tag++;
    }
  }

  let text = currentLuckys.map(item => item[1]);
  addQipao({
    title: "KẾT QUẢ QUAY",
    names: text.join(" · "),
    prize: `Trúng: ${currentPrize.title}`
  });
  
  // Hiệu ứng pháo hoa khi công bố kết quả
  startFireworks();

  selectedCardIndex.forEach((cardIndex, index) => {
    changeCard(cardIndex, currentLuckys[index]);
    var object = threeDCards[cardIndex];
    new TWEEN.Tween(object.position)
      .to(
        {
          x: locates[index].x,
          y: locates[index].y * Resolution,
          z: 2200
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: 0,
          y: 0,
          z: 0
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    object.element.classList.add("prize");
    tag++;
  });

  new TWEEN.Tween(this)
    .to({}, duration * 2)
    .onUpdate(render)
    .start()
    .onComplete(() => {
      // Sau khi hoạt ảnh kết thúc có thể thao tác
      setLotteryStatus();
    });
}

/**
 * Đặt lại nội dung thẻ quay số
 */
function resetCard(duration = 500) {
  if (currentLuckys.length === 0) {
    return Promise.resolve();
  }

  selectedCardIndex.forEach(index => {
    let object = threeDCards[index],
      target = targets.table[index];

    new TWEEN.Tween(object.position)
      .to(
        {
          x: target.position.x,
          y: target.position.y,
          z: target.position.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();

    new TWEEN.Tween(object.rotation)
      .to(
        {
          x: target.rotation.x,
          y: target.rotation.y,
          z: target.rotation.z
        },
        Math.random() * duration + duration
      )
      .easing(TWEEN.Easing.Exponential.InOut)
      .start();
  });

  return new Promise((resolve, reject) => {
    new TWEEN.Tween(this)
      .to({}, duration * 2)
      .onUpdate(render)
      .start()
      .onComplete(() => {
        selectedCardIndex.forEach(index => {
          let object = threeDCards[index];
          object.element.classList.remove("prize");
        });
        resolve();
      });
  });
}

/**
 * Quay số
 */
function lottery() {
  // if (isLotting) {
  //   rotateObj.stop();
  //   btns.lottery.innerHTML = "Bắt đầu quay";
  //   return;
  // }
  btns.lottery.innerHTML = "Kết thúc quay";
  rotateBall();
}

/**
 * Lưu ket-qua-quay-so-so lần trước
 */
function saveData() {
  if (!currentPrize) {
    //Nếu giải thưởng đã quay hết, thì không ghi dữ liệu nữa, nhưng vẫn có thể quay số
    return;
  }

  let type = currentPrize.type,
    curLucky = basicData.luckyUsers[type] || [];

  curLucky = curLucky.concat(currentLuckys);

  basicData.luckyUsers[type] = curLucky;

  if (currentPrize.count <= curLucky.length) {
    currentPrizeIndex--;
    if (currentPrizeIndex <= -1) {
      currentPrizeIndex = 0;
    }
    currentPrize = basicData.prizes[currentPrizeIndex];
  }

  if (currentLuckys.length > 0) {
    // todo by xc Thêm cơ chế lưu dữ liệu để tránh mất dữ liệu khi server sập
    return setData(type, currentLuckys);
  }
  return Promise.resolve();
}

function changePrize() {
  let luckys = basicData.luckyUsers[currentPrize.type];
  let luckyCount = (luckys ? luckys.length : 0) + EACH_COUNT[currentPrizeIndex];
  // Sửa số lượng và phần trăm của prize bên trái
  setPrizeData(currentPrizeIndex, luckyCount);
}

/**
 * Quay số ngẫu nhiên
 */
function random(num) {
  // Math.floor lấy số từ 0 đến num-1 với xác suất bằng nhau
  return Math.floor(Math.random() * num);
}

/**
 * Chuyển đổi thông tin người trên thẻ tên
 */
function changeCard(cardIndex, user) {
  let card = threeDCards[cardIndex].element;

  card.innerHTML = `<div class="name">${user[1]}</div><div class="details">${
    user[0] || ""
  }<br/>${user[2] || ""}</div>`;
}

/**
 * Chuyển đổi nền thẻ tên
 */
function shine(cardIndex, color) {
  let card = threeDCards[cardIndex].element;
  card.style.backgroundColor =
    color || "rgba(0,127,127," + (Math.random() * 0.7 + 0.25) + ")";
}

/**
 * Chuyển đổi ngẫu nhiên nền và thông tin người
 */
function shineCard() {
  let maxCard = 10,
    maxUser;
  let shineCard = 10 + random(maxCard);

  setInterval(() => {
    // Đang quay số thì dừng nhấp nháy
    if (isLotting) {
      return;
    }
    maxUser = basicData.leftUsers.length;
    for (let i = 0; i < shineCard; i++) {
      let index = random(maxUser),
        cardIndex = random(TOTAL_CARDS);
      // Danh sách đã trúng thưởng hiện đang hiển thị không chuyển đổi ngẫu nhiên
      if (selectedCardIndex.includes(cardIndex)) {
        continue;
      }
      shine(cardIndex);
      changeCard(cardIndex, basicData.leftUsers[index]);
    }
  }, 500);
}

function setData(type, data) {
  return new Promise((resolve, reject) => {
    window.AJAX({
      url: "/saveData",
      data: {
        type,
        data
      },
      success() {
        resolve();
      },
      error() {
        reject();
      }
    });
  });
}

function setErrorData(data) {
  return new Promise((resolve, reject) => {
    window.AJAX({
      url: "/errorData",
      data: {
        data
      },
      success() {
        resolve();
      },
      error() {
        reject();
      }
    });
  });
}

function exportData() {
  window.AJAX({
    url: "/export",
    success(data) {
      if (data.type === "success") {
        location.href = data.url;
      }
    }
  });
}

function reset() {
  window.AJAX({
    url: "/reset",
    success(data) {
      console.log("Đặt lại thành công");
    }
  });
}

function createHighlight() {
  let year = new Date().getFullYear() + "";
  let step = 4,
    xoffset = 1,
    yoffset = 1,
    highlight = [];

  year.split("").forEach(n => {
    highlight = highlight.concat(
      NUMBER_MATRIX[n].map(item => {
        return `${item[0] + xoffset}-${item[1] + yoffset}`;
      })
    );
    xoffset += step;
  });

  return highlight;
}

/**
 * Khởi tạo các hiệu ứng visual
 */
function initVisualEffects() {
  // Tạo floating particles nền
  createFloatingParticles();
  
  // Thêm sparkles khi hover vào buttons
  addButtonSparkles();
}

/**
 * Tạo floating particles trên background
 */
function createFloatingParticles() {
  const particlesContainer = document.createElement('div');
  particlesContainer.className = 'floating-particles';
  document.body.appendChild(particlesContainer);
  
  const particleCount = 30;
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    
    const size = Math.random() * 8 + 4; // 4-12px
    const startX = Math.random() * window.innerWidth;
    const startY = Math.random() * window.innerHeight;
    const delay = Math.random() * 20;
    
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.left = startX + 'px';
    particle.style.top = startY + 'px';
    particle.style.animationDelay = delay + 's';
    particle.style.opacity = Math.random() * 0.5 + 0.2;
    
    particlesContainer.appendChild(particle);
  }
}

/**
 * Thêm hiệu ứng sparkles khi hover vào buttons
 */
function addButtonSparkles() {
  const buttons = document.querySelectorAll('button');
  
  buttons.forEach(button => {
    button.addEventListener('mouseenter', (e) => {
      createSparkles(e.target);
    });
  });
}

/**
 * Tạo sparkles tại vị trí button
 */
function createSparkles(element) {
  const rect = element.getBoundingClientRect();
  const sparkleCount = 8;
  
  for (let i = 0; i < sparkleCount; i++) {
    const sparkle = document.createElement('div');
    sparkle.className = 'sparkle';
    
    const x = Math.random() * rect.width;
    const y = Math.random() * rect.height;
    const delay = Math.random() * 0.3;
    
    sparkle.style.left = (rect.left + x) + 'px';
    sparkle.style.top = (rect.top + y) + 'px';
    sparkle.style.animationDelay = delay + 's';
    
    document.body.appendChild(sparkle);
    
    setTimeout(() => {
      sparkle.remove();
    }, 600);
  }
}

/**
 * Hiệu ứng pháo hoa khi công bố kết quả trúng giải
 */
function startFireworks() {
  const colors = [
    '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', 
    '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739',
    '#FF1493', '#00CED1', '#FF6347', '#32CD32', '#FF69B4'
  ];
  const fireworkCount = 12;
  const duration = 3000;

  for (let i = 0; i < fireworkCount; i++) {
    setTimeout(() => {
      createFirework(colors);
    }, i * 150);
  }
}

function createFirework(colors) {
  const firework = document.createElement('div');
  firework.className = 'firework';
  
  // Vị trí ngẫu nhiên trên màn hình, tập trung ở giữa
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  const spreadX = window.innerWidth * 0.4;
  const spreadY = window.innerHeight * 0.3;
  
  const x = centerX + (Math.random() - 0.5) * spreadX;
  const y = centerY + (Math.random() - 0.5) * spreadY;
  
  firework.style.left = x + 'px';
  firework.style.top = y + 'px';
  
  document.body.appendChild(firework);
  
  // Chọn màu chủ đạo cho pháo hoa này
  const primaryColor = colors[Math.floor(Math.random() * colors.length)];
  const secondaryColor = colors[Math.floor(Math.random() * colors.length)];
  
  // Tạo các hạt pháo hoa với nhiều kích thước
  const particleCount = 40 + Math.floor(Math.random() * 20);
  const particles = [];
  
  for (let i = 0; i < particleCount; i++) {
    const particle = document.createElement('div');
    particle.className = 'firework-particle';
    
    // Màu sắc ngẫu nhiên từ bảng màu
    const color = Math.random() > 0.5 ? primaryColor : secondaryColor;
    const size = 4 + Math.random() * 6;
    
    particle.style.width = size + 'px';
    particle.style.height = size + 'px';
    particle.style.backgroundColor = color;
    particle.style.boxShadow = `0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px ${color}`;
    
    const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
    const velocity = 80 + Math.random() * 80;
    const vx = Math.cos(angle) * velocity;
    const vy = Math.sin(angle) * velocity;
    
    particle.style.left = '0px';
    particle.style.top = '0px';
    firework.appendChild(particle);
    
    particles.push({
      element: particle,
      vx: vx,
      vy: vy,
      x: 0,
      y: 0,
      size: size
    });
  }
  
  // Animation pháo hoa
  const startTime = Date.now();
  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = elapsed / 2500; // 2.5 giây
    
    if (progress >= 1) {
      firework.remove();
      return;
    }
    
    particles.forEach(particle => {
      // Vật lý: vận tốc giảm dần, trọng lực tăng dần
      particle.x += particle.vx * 0.016;
      particle.y += particle.vy * 0.016 + 60 * progress * progress; // Gravity tăng dần
      particle.vx *= 0.985; // Friction
      particle.vy *= 0.985;
      
      // Xoay và scale
      const rotation = progress * 360;
      const scale = 1 - progress * 0.5;
      
      particle.element.style.transform = `translate(${particle.x}px, ${particle.y}px) rotate(${rotation}deg) scale(${scale})`;
      particle.element.style.opacity = Math.max(0, 1 - progress * 1.2);
    });
    
    requestAnimationFrame(animate);
  };
  
  animate();
}

// Background music functionality has been removed as requested
