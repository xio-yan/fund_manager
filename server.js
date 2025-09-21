const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// 時區處理
const getTaiwanTime = () => {
  return new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
};

// 模擬資料庫
let advances = []; // 預支紀錄
let users = [{ username: "admin", password: "admin", role: "admin" }]; // 只留 admin

// 中介軟體
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  })
);
app.use(express.static(path.join(__dirname, "public")));

// 登入檢查
function checkLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect("/login.html");
  }
  next();
}

// ===== 路由 =====

// 首頁
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// 登入頁
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

// 登入處理
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (user) {
    req.session.user = user;
    res.redirect("/dashboard");
  } else {
    res.send("<script>alert('帳號或密碼錯誤');window.location='/login.html';</script>");
  }
});

// 登出
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// 後台主頁
app.get("/dashboard", checkLogin, (req, res) => {
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

// API: 新增預支（前台）
app.post("/api/advance", (req, res) => {
  const { applicant, description, amount, source } = req.body;
  const record = {
    id: advances.length + 1,
    applicant,
    description,
    amount: Number(amount),
    source,
    status: "pending", // pending -> paid -> repaid
    applyDate: getTaiwanTime(),
    payDate: null,
    repayDate: null,
    schoolSubsidy: 0,
    studentUnionSubsidy: 0,
    cashReturn: 0,
  };
  advances.push(record);
  res.json({ success: true, record });
});

// API: 取得所有預支紀錄（後台）
app.get("/api/advances", checkLogin, (req, res) => {
  res.json(advances);
});

// API: 已付款
app.post("/api/advance/:id/pay", checkLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const record = advances.find((r) => r.id === id);
  if (record && record.status === "pending") {
    record.status = "paid";
    record.payDate = getTaiwanTime();
    res.json({ success: true, record });
  } else {
    res.status(400).json({ success: false, message: "無效操作" });
  }
});

// API: 還款
app.post("/api/advance/:id/repay", checkLogin, (req, res) => {
  const id = parseInt(req.params.id);
  const { schoolSubsidy, studentUnionSubsidy } = req.body;
  const record = advances.find((r) => r.id === id);

  if (record && record.status === "paid") {
    const school = Number(schoolSubsidy) || 0;
    const studentUnion = Number(studentUnionSubsidy) || 0;
    const cashReturn = record.amount - school - studentUnion;

    record.schoolSubsidy = school;
    record.studentUnionSubsidy = studentUnion;
    record.cashReturn = cashReturn >= 0 ? cashReturn : 0;
    record.status = "repaid";
    record.repayDate = getTaiwanTime();

    res.json({ success: true, record });
  } else {
    res.status(400).json({ success: false, message: "無效操作" });
  }
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`伺服器啟動於 http://localhost:${PORT}`);
});
