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
      if (action === 'stop' && isLotting) {
        // Dừng quay số
        if (rotateObj && rotateObj.stop) {
          rotateObj.stop();
        }
        btns.lottery.innerHTML = "Bắt đầu quay";
        setLotteryStatus(false);
      } else if (action === 'start' && !isLotting) {
        // Bắt đầu quay số
        button.click();
      } else if (action !== 'stop' && action !== 'start') {
        // Các lệnh khác
        button.click();
      }
    }
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
      COMPANY = data.cfgData.COMPANY;
      HIGHLIGHT_CELL = createHighlight();
      basicData.prizes = prizes;
      setPrizes(prizes);

      TOTAL_CARDS = ROW_COUNT * COLUMN_COUNT;

      // Đọc kết quả quay số đã được thiết lập hiện tại
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

  var vector = new THREE.Vector3();

  for (var i = 0, l = threeDCards.length; i < l; i++) {
    var phi = Math.acos(-1 + (2 * i) / l);
    var theta = Math.sqrt(l * Math.PI) * phi;
    var object = new THREE.Object3D();
    object.position.setFromSphericalCoords(800 * Resolution, phi, theta);
    vector.copy(object.position).multiplyScalar(2);
    object.lookAt(vector);
    targets.sphere.push(object);
  }

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
        rotateObj.stop();
        btns.lottery.innerHTML = "Bắt đầu quay";
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
        setLotteryStatus(true);
        // Mỗi lần quay số trước tiên lưu dữ liệu quay số lần trước
        saveData();
        //Cập nhật hiển thị số lượng quay số còn lại
        changePrize();
        resetCard().then(res => {
          // Quay số
          lottery();
        });
        addQipao(`Đang quay [${currentPrize.title}], chuẩn bị tư thế`);
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
      // Xuất kết quả quay số
      case "save":
        saveData().then(res => {
          resetCard().then(res => {
            // Xóa bản ghi trước đó
            currentLuckys = [];
          });
          exportData();
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
      transform(targets.sphere, 2000);
      break;
  }
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
      element.classList.add("highlight");
    }
  } else {
    element.className = "element";
    element.style.backgroundColor =
      "rgba(0,127,127," + (Math.random() * 0.7 + 0.25) + ")";
  }
  //Thêm nhận diện công ty
  element.appendChild(createElement("company", COMPANY));

  element.appendChild(createElement("name", user[1]));

  element.appendChild(createElement("details", user[0] + "<br/>" + user[2]));
  return element;
}

function removeHighlight() {
  document.querySelectorAll(".highlight").forEach(node => {
    node.classList.remove("highlight");
  });
}

function addHighlight() {
  document.querySelectorAll(".lightitem").forEach(node => {
    node.classList.add("highlight");
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
  return new Promise((resolve, reject) => {
    scene.rotation.y = 0;
    rotateObj = new TWEEN.Tween(scene.rotation);
    rotateObj
      .to(
        {
          y: Math.PI * 6 * ROTATE_LOOP
        },
        ROTATE_TIME * ROTATE_LOOP
      )
      .onUpdate(render)
      // .easing(TWEEN.Easing.Linear)
      .start()
      .onStop(() => {
        scene.rotation.y = 0;
        resolve();
      })
      .onComplete(() => {
        resolve();
      });
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
  let width = 140,
    tag = -(currentLuckys.length - 1) / 2,
    locates = [];

  // Tính toán thông tin vị trí, lớn hơn 5 thì hiển thị thành 2 hàng
  if (currentLuckys.length > 5) {
    let yPosition = [-87, 87],
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
  addQipao(
    `Chúc mừng ${text.join("、")} đã trúng ${currentPrize.title}, năm mới thịnh vượng.`
  );

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
      target = targets.sphere[index];

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
  rotateBall().then(() => {
    // Xóa bản ghi trước đó
    currentLuckys = [];
    selectedCardIndex = [];
    // Số lượng quay cùng lúc hiện tại, sau khi quay hết giải hiện tại vẫn có thể tiếp tục quay nhưng không ghi dữ liệu
    let perCount = EACH_COUNT[currentPrizeIndex],
      luckyData = basicData.luckyUsers[currentPrize.type],
      leftCount = basicData.leftUsers.length,
      leftPrizeCount = currentPrize.count - (luckyData ? luckyData.length : 0);

    if (leftCount < perCount) {
      addQipao("Số người tham gia quay số còn lại không đủ, bây giờ đặt lại tất cả người tham gia để có thể quay lần hai！");
      basicData.leftUsers = basicData.users.slice();
      leftCount = basicData.leftUsers.length;
    }

    for (let i = 0; i < perCount; i++) {
      let luckyId = random(leftCount);
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

    // console.log(currentLuckys);
    selectCard();
  });
}

/**
 * Lưu kết quả quay số lần trước
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

  card.innerHTML = `<div class="company">${COMPANY}</div><div class="name">${
    user[1]
  }</div><div class="details">${user[0] || ""}<br/>${user[2] || "PSST"}</div>`;
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

let onload = window.onload;

window.onload = function () {
  onload && onload();

  let music = document.querySelector("#music");

  let rotated = 0,
    stopAnimate = false,
    musicBox = document.querySelector("#musicBox");

  function animate() {
    requestAnimationFrame(function () {
      if (stopAnimate) {
        return;
      }
      rotated = rotated % 360;
      musicBox.style.transform = "rotate(" + rotated + "deg)";
      rotated += 1;
      animate();
    });
  }

  musicBox.addEventListener(
    "click",
    function (e) {
      if (music.paused) {
        music.play().then(
          () => {
            stopAnimate = false;
            animate();
          },
          () => {
            addQipao("Nhạc nền tự động phát thất bại, vui lòng phát thủ công！");
          }
        );
      } else {
        music.pause();
        stopAnimate = true;
      }
    },
    false
  );

  setTimeout(function () {
    musicBox.click();
  }, 1000);
};
