const express = require("express");
const opn = require("opn");
const bodyParser = require("body-parser");
const path = require("path");
const chokidar = require("chokidar");
const multer = require("multer");
const WebSocket = require("ws");
const http = require("http");
const cfg = require("./config");

const {
  loadXML,
  loadTempData,
  writeXML,
  saveDataFile,
  shuffle,
  saveErrorDataFile,
  loadPrizeConfig,
  savePrizeConfig,
  saveUsersFile
} = require("./help");

let app = express(),
  router = express.Router(),
  cwd = process.cwd(),
  dataBath = __dirname,
  port = 8090,
  curData = {},
  luckyData = {},
  errorData = [],
  defaultType = cfg.prizes[0]["type"],
  defaultPage = `default data`,
  wss = null,
  wsClients = new Set();

//Ở đây chỉ định tham số sử dụng định dạng json
app.use(
  bodyParser.json({
    limit: "1mb"
  })
);

app.use(
  bodyParser.urlencoded({
    extended: true
  })
);

if (process.argv.length > 2) {
  port = process.argv[2];
}

app.use(express.static(cwd));

// Configure multer for file uploads
const fs = require("fs");
const uploadDir = path.join(dataBath, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

//Địa chỉ yêu cầu trống, mặc định chuyển hướng đến file index.html
app.get("/", (req, res) => {
  res.redirect(301, "index.html");
});

//Thiết lập truy cập cross-origin
app.all("*", function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "X-Requested-With, Content-Type, Accept, Origin, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("X-Powered-By", " 3.2.1");
  res.header("Content-Type", "application/json;charset=utf-8");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.post("*", (req, res, next) => {
  log(`Nội dung yêu cầu：${JSON.stringify(req.path, 2)}`);
  next();
});

// Lấy dữ liệu đã thiết lập trước đó
router.post("/getTempData", (req, res, next) => {
  getLeftUsers();
  // Đồng bộ EACH_COUNT theo độ dài prizes để tránh lệch index sau khi add/delete
  if (!Array.isArray(cfg.EACH_COUNT)) {
    cfg.EACH_COUNT = [];
  }
  if (cfg.EACH_COUNT.length < cfg.prizes.length) {
    cfg.EACH_COUNT.length = cfg.prizes.length;
  }
  for (let i = 0; i < cfg.prizes.length; i++) {
    if (!cfg.EACH_COUNT[i] || cfg.EACH_COUNT[i] < 1) cfg.EACH_COUNT[i] = 1;
  }
  res.json({
    cfgData: cfg,
    leftUsers: curData.leftUsers,
    luckyData: luckyData
  });
});

// Lấy tất cả người dùng
router.post("/reset", (req, res, next) => {
  luckyData = {};
  errorData = [];
  log(`Đặt lại dữ liệu thành công`);
  saveErrorDataFile(errorData);
  // giữ nguyên cấu hình giải thưởng đã lưu
  return saveDataFile(luckyData).then(data => {
    res.json({
      type: "success"
    });
  });
});

// Lấy tất cả người dùng
router.post("/getUsers", (req, res, next) => {
  res.json(curData.users);
  log(`Trả về dữ liệu người dùng quay số thành công`);
});

// Lấy thông tin giải thưởng
router.post("/getPrizes", (req, res, next) => {
  res.json({ prizes: cfg.prizes, cfgData: { EACH_COUNT: cfg.EACH_COUNT } });
  log(`Trả về dữ liệu giải thưởng thành công`);
});

// API: Upload users
router.post("/api/uploadUsers", upload.single("file"), async (req, res, next) => {
  if (!req.file) {
    return res.json({ success: false, error: "Không có file được upload" });
  }
  try {
    // Đọc dữ liệu từ file upload
    const users = loadXML(req.file.path);
    
    // Xóa dữ liệu cũ: reset luckyData và errorData
    luckyData = {};
    errorData = [];
    
    // Lưu dữ liệu đã reset vào file
    await saveDataFile(luckyData);
    await saveErrorDataFile(errorData);
    
    // Lưu danh sách user mới vào file Excel
    const usersFilePath = path.join(dataBath, "data/users.xlsx");
    await saveUsersFile(users, usersFilePath);
    
    // Cập nhật dữ liệu trong memory
    curData.users = users;
    shuffle(curData.users);
    curData.leftUsers = Object.assign([], curData.users);
    
    // Clean up uploaded file
    fs.unlinkSync(req.file.path);
    
    res.json({ success: true, count: users.length });
    log(`Upload ${users.length} người tham gia thành công. Đã xóa dữ liệu cũ và lưu vào file.`);
  } catch (error) {
    res.json({ success: false, error: error.message });
    log(`Lỗi khi upload users: ${error.message}`);
  }
});

// API: Upload prize image
router.post("/api/uploadPrizeImg", upload.single("file"), (req, res, next) => {
  if (!req.file) {
    return res.json({ success: false, error: "Không có file được upload" });
  }

  try {
    const ext = path.extname(req.file.originalname || "").toLowerCase();
    const allowed = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);
    if (!allowed.has(ext)) {
      fs.unlinkSync(req.file.path);
      return res.json({ success: false, error: "File ảnh không hợp lệ" });
    }

    const finalName = `${req.file.filename}${ext}`;
    const finalPath = path.join(uploadDir, finalName);
    fs.renameSync(req.file.path, finalPath);

    const url = `./data/uploads/${finalName}`;
    res.json({ success: true, url });
    log(`Upload prize image thành công: ${url}`);
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: Add prize
router.post("/api/addPrize", (req, res, next) => {
  try {
    const newPrize = req.body;
    const maxType = Math.max(...cfg.prizes.map(p => p.type));
    newPrize.type = maxType + 1;
    cfg.prizes.push(newPrize);

    // Mặc định số lượng quay mỗi lần cho prize mới
    if (!Array.isArray(cfg.EACH_COUNT)) {
      cfg.EACH_COUNT = [];
    }
    if (cfg.EACH_COUNT.length < cfg.prizes.length) {
      cfg.EACH_COUNT.length = cfg.prizes.length;
    }
    const newIndex = cfg.prizes.length - 1;
    cfg.EACH_COUNT[newIndex] = cfg.EACH_COUNT[newIndex] || 1;

    savePrizeConfig({ prizes: cfg.prizes, EACH_COUNT: cfg.EACH_COUNT }).catch(() => {});

    res.json({ success: true });
    broadcast({ type: "prizeUpdate", prizes: cfg.prizes });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: Delete prize
router.delete("/api/deletePrize/:type", (req, res, next) => {
  try {
    const type = parseInt(req.params.type);
    const idx = cfg.prizes.findIndex(p => p.type === type);
    cfg.prizes = cfg.prizes.filter(p => p.type !== type);
    if (idx >= 0 && Array.isArray(cfg.EACH_COUNT)) {
      cfg.EACH_COUNT.splice(idx, 1);
    }

    savePrizeConfig({ prizes: cfg.prizes, EACH_COUNT: cfg.EACH_COUNT }).catch(() => {});
    res.json({ success: true });
    broadcast({ type: "prizeUpdate", prizes: cfg.prizes });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: Update prize
router.put("/api/updatePrize/:type", (req, res, next) => {
  try {
    const type = parseInt(req.params.type);
    if (type === defaultType) {
      return res.json({ success: false, error: "Không thể sửa giải đặc biệt" });
    }

    const idx = cfg.prizes.findIndex(p => p.type === type);
    if (idx === -1) {
      return res.json({ success: false, error: "Không tìm thấy giải thưởng" });
    }

    const payload = req.body || {};
    const updated = {
      ...cfg.prizes[idx],
      text: payload.text,
      title: payload.title,
      count: parseInt(payload.count),
      img: payload.img
    };

    if (!updated.text || !updated.title || !Number.isFinite(updated.count) || updated.count < 1) {
      return res.json({ success: false, error: "Dữ liệu không hợp lệ" });
    }

    cfg.prizes[idx] = updated;

    // cập nhật số lượng quay mỗi lần (perDraw) theo index
    if (payload.perDraw !== undefined) {
      const perDraw = parseInt(payload.perDraw);
      if (!Number.isFinite(perDraw) || perDraw < 1) {
        return res.json({ success: false, error: "Số lượng quay mỗi lần không hợp lệ" });
      }
      if (!Array.isArray(cfg.EACH_COUNT)) {
        cfg.EACH_COUNT = [];
      }
      if (cfg.EACH_COUNT.length < cfg.prizes.length) {
        cfg.EACH_COUNT.length = cfg.prizes.length;
      }
      cfg.EACH_COUNT[idx] = perDraw;
    }

    savePrizeConfig({ prizes: cfg.prizes, EACH_COUNT: cfg.EACH_COUNT }).catch(() => {});

    res.json({ success: true });
    broadcast({ type: "prizeUpdate", prizes: cfg.prizes });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: Update per-draw count for prize index
router.put("/api/updatePrizePerDraw/:type", (req, res) => {
  try {
    const type = parseInt(req.params.type);
    const idx = cfg.prizes.findIndex(p => p.type === type);
    if (idx === -1) {
      return res.json({ success: false, error: "Không tìm thấy giải thưởng" });
    }

    const perDraw = parseInt((req.body || {}).perDraw);
    if (!Number.isFinite(perDraw) || perDraw < 1) {
      return res.json({ success: false, error: "Số lượng quay mỗi lần không hợp lệ" });
    }

    if (!Array.isArray(cfg.EACH_COUNT)) {
      cfg.EACH_COUNT = [];
    }
    if (cfg.EACH_COUNT.length < cfg.prizes.length) {
      cfg.EACH_COUNT.length = cfg.prizes.length;
    }
    cfg.EACH_COUNT[idx] = perDraw;

    savePrizeConfig({ prizes: cfg.prizes, EACH_COUNT: cfg.EACH_COUNT }).catch(() => {});

    res.json({ success: true });
    broadcast({ type: "prizeUpdate", prizes: cfg.prizes });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// API: Get stats
router.get("/api/stats", (req, res, next) => {
  getLeftUsers();
  let totalPrizes = 0, drawnPrizes = 0;
  cfg.prizes.forEach(prize => {
    if (prize.type !== defaultType) {
      totalPrizes += prize.count;
      drawnPrizes += (luckyData[prize.type] || []).length;
    }
  });
  res.json({
    totalUsers: curData.users ? curData.users.length : 0,
    luckyUsers: Object.keys(luckyData).reduce((sum, key) => sum + (luckyData[key] || []).length, 0),
    leftUsers: curData.leftUsers ? curData.leftUsers.length : 0,
    totalPrizes,
    drawnPrizes,
    remainingPrizes: totalPrizes - drawnPrizes
  });
});

// API: Get winners list (grouped by prize)
router.get("/api/winners", (req, res) => {
  try {
    const prizes = cfg.prizes || [];
    const out = prizes
      .filter(p => p && p.type !== defaultType)
      .map(p => {
        const winners = luckyData[p.type] || [];
        return {
          type: p.type,
          text: p.text,
          title: p.title,
          count: p.count,
          winners
        };
      });
    res.json({ success: true, prizes: out });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Lưu dữ liệu quay số
router.post("/saveData", (req, res, next) => {
  let data = req.body;
  setLucky(data.type, data.data)
    .then(t => {
      res.json({
        type: "Thiết lập thành công！"
      });
      log(`Lưu dữ liệu giải thưởng thành công`);
    })
    .catch(data => {
      res.json({
        type: "Thiết lập thất bại！"
      });
      log(`Lưu dữ liệu giải thưởng thất bại`);
    });
});

// Lưu dữ liệu quay số
router.post("/errorData", (req, res, next) => {
  let data = req.body;
  setErrorData(data.data)
    .then(t => {
      res.json({
        type: "Thiết lập thành công！"
      });
      log(`Lưu dữ liệu người không đến thành công`);
    })
    .catch(data => {
      res.json({
        type: "Thiết lập thất bại！"
      });
      log(`Lưu dữ liệu người không đến thất bại`);
    });
});

// Lưu dữ liệu vào excel
router.post("/export", (req, res, next) => {
  let type = [1, 2, 3, 4, 5, defaultType],
    outData = [["Mã nhân viên", "Họ tên", "Phòng ban"]];
  cfg.prizes.forEach(item => {
    outData.push([item.text]);
    outData = outData.concat(luckyData[item.type] || []);
  });

  writeXML(outData, "ket-qua-quay-so-so.xlsx")
    .then(dt => {
      // res.download('/ket-qua-quay-so-so.xlsx');
      res.status(200).json({
        type: "success",
        url: "ket-qua-quay-so-so.xlsx"
      });
      log(`Xuất dữ liệu thành công！`);
    })
    .catch(err => {
      res.json({
        type: "error",
        error: err.error
      });
      log(`Xuất dữ liệu thất bại！`);
    });
});

//Đối với đường dẫn hoặc yêu cầu không khớp, trả về trang mặc định
//Phân biệt các yêu cầu khác nhau trả về nội dung trang khác nhau
router.all("*", (req, res) => {
  if (req.method.toLowerCase() === "get") {
    if (/\.(html|htm)/.test(req.originalUrl)) {
      res.set("Content-Type", "text/html");
      res.send(defaultPage);
    } else {
      res.status(404).end();
    }
  } else if (req.method.toLowerCase() === "post") {
    let postBackData = {
      error: "empty"
    };
    res.send(JSON.stringify(postBackData));
  }
});

function log(text) {
  global.console.log(text);
  global.console.log("-----------------------------------------------");
}

function setLucky(type, data) {
  if (luckyData[type]) {
    luckyData[type] = luckyData[type].concat(data);
  } else {
    luckyData[type] = Array.isArray(data) ? data : [data];
  }

  return saveDataFile(luckyData);
}

function setErrorData(data) {
  errorData = errorData.concat(data);

  return saveErrorDataFile(errorData);
}

app.use(router);

function loadData() {
  console.log("Tải file dữ liệu EXCEL");
  let cfgData = {};

  // Load config prizes/EACH_COUNT từ file nếu có
  loadPrizeConfig()
    .then((saved) => {
      if (saved && Array.isArray(saved.prizes) && saved.prizes.length) {
        cfg.prizes = saved.prizes;
      }
      if (saved && Array.isArray(saved.EACH_COUNT) && saved.EACH_COUNT.length) {
        cfg.EACH_COUNT = saved.EACH_COUNT;
      }
      // đồng bộ defaultType theo config mới
      defaultType = cfg.prizes[0] && cfg.prizes[0].type !== undefined ? cfg.prizes[0].type : defaultType;
    })
    .catch(() => {});

  // curData.users = loadXML(path.join(cwd, "data/users.xlsx"));
  curData.users = loadXML(path.join(dataBath, "data/users.xlsx"));
  // Xáo trộn lại
  shuffle(curData.users);

  // Đọc kết quả đã quay
  loadTempData()
    .then(data => {
      luckyData = data[0];
      errorData = data[1];
    })
    .catch(data => {
      curData.leftUsers = Object.assign([], curData.users);
    });
}

function getLeftUsers() {
  //  Ghi lại người dùng đã quay hiện tại
  let lotteredUser = {};
  for (let key in luckyData) {
    let luckys = luckyData[key];
    luckys.forEach(item => {
      lotteredUser[item[0]] = true;
    });
  }
  // Ghi lại người đã quay nhưng không có mặt
  errorData.forEach(item => {
    lotteredUser[item[0]] = true;
  });

  let leftUsers = Object.assign([], curData.users);
  leftUsers = leftUsers.filter(user => {
    return !lotteredUser[user[0]];
  });
  curData.leftUsers = leftUsers;
}

loadData();

// WebSocket functions
function broadcast(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

function setupWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    wsClients.add(ws);
    console.log("WebSocket client connected. Total:", wsClients.size);

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "command") {
          // Broadcast command to all clients (including the main lottery page)
          console.log("Broadcasting command:", data.action);
          broadcast({ type: "command", action: data.action });
        } else if (data.type === "ping") {
          ws.send(JSON.stringify({ type: "pong" }));
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });

    ws.on("close", () => {
      wsClients.delete(ws);
      console.log("WebSocket client disconnected. Total:", wsClients.size);
    });

    // Send initial prize info
    getLeftUsers();
    const currentPrizeIndex = cfg.prizes.length - 1;
    const currentPrize = cfg.prizes[currentPrizeIndex];
    ws.send(JSON.stringify({
      type: "prizeUpdate",
      prize: currentPrize
    }));
  });
}

module.exports = {
  run: function(devPort, noOpen) {
    let openBrowser = true;
    if (process.argv.length > 3) {
      if (process.argv[3] && (process.argv[3] + "").toLowerCase() === "n") {
        openBrowser = false;
      }
    }

    if (noOpen) {
      openBrowser = noOpen !== "n";
    }

    if (devPort) {
      port = devPort;
    }

    const server = http.createServer(app);
    setupWebSocket(server);

    server.listen(port, () => {
      let host = server.address().address;
      let port = server.address().port;
      global.console.log(`lottery server listening at http://${host}:${port}`);
      global.console.log(`WebSocket server ready`);
      openBrowser && opn(`http://127.0.0.1:${port}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} đã được sử dụng. Vui lòng dừng process khác hoặc chọn port khác.`);
        console.error(`Để tìm process: lsof -ti:${port}`);
        console.error(`Để kill process: kill -9 $(lsof -ti:${port})`);
      } else {
        console.error('Server error:', err);
      }
    });

    return server;
  },
  broadcast: broadcast
};
