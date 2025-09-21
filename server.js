const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

// 模擬資料庫
let advances = []; // 預支紀錄
let users = [{ username: "admin", password: "admin" }];

// API: 登入
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (user) {
    req.session.user = { username: user.username };
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "帳號或密碼錯誤" });
  }
});

// API: 登出
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// API: 取得目前登入使用者
app.get("/api/current-user", (req, res) => {
  if (req.session.user) {
    res.json({ username: req.session.user.username });
  } else {
    res.json({ username: null });
  }
});

// API: 新增預支 (不用登入)
app.post("/api/advance", (req, res) => {
  const { applicant, description, amount, source } = req.body;
  const newRecord = {
    id: advances.length + 1,
    applicant,
    description,
    amount: parseInt(amount),
    source,
    applyDate: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
    payDate: null,
    repayDate: null,
    schoolSubsidy: 0,
    studentUnionSubsidy: 0,
    cashReturn: 0,
    status: "pending", // pending → paid → repaid
  };
  advances.push(newRecord);
  res.json({ success: true, record: newRecord });
});

// API: 取得所有預支 (需要登入)
app.get("/api/advances", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: "請先登入" });
  }
  res.json(advances);
});

// API: 標記已付款
app.post("/api/advance/:id/pay", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  const id = parseInt(req.params.id);
  const record = advances.find((r) => r.id === id);
  if (record && record.status === "pending") {
    record.status = "paid";
    record.payDate = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
    });
    res.json({ success: true, record });
  } else {
    res.json({ success: false, message: "操作失敗" });
  }
});

// API: 還款
app.post("/api/advance/:id/repay", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  const id = parseInt(req.params.id);
  const { schoolSubsidy, studentUnionSubsidy } = req.body;
  const record = advances.find((r) => r.id === id);

  if (record && record.status === "paid") {
    record.schoolSubsidy = parseInt(schoolSubsidy);
    record.studentUnionSubsidy = parseInt(studentUnionSubsidy);
    record.cashReturn =
      record.amount - record.schoolSubsidy - record.studentUnionSubsidy;
    record.status = "repaid";
    record.repayDate = new Date().toLocaleString("zh-TW", {
      timeZone: "Asia/Taipei",
    });
    res.json({ success: true, record });
  } else {
    res.json({ success: false, message: "操作失敗" });
  }
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
