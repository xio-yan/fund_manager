const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const app = express();
const port = 3000;

// 時區設定
const tz = "Asia/Taipei";

app.use(bodyParser.json());
app.use(express.static("public"));
app.use(session({
  secret: "secret",
  resave: false,
  saveUninitialized: true
}));

let activities = []; // 活動資料
let activityId = 1;

// 預設帳號
const adminAccount = { username: "admin", password: "admin" };

// 登入頁
app.get("/login.html", (req, res) => {
  res.sendFile(__dirname + "/public/login.html");
});

// 登入 API
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === adminAccount.username && password === adminAccount.password) {
    req.session.user = username;
    res.json({ success: true });
  } else {
    res.json({ success: false });
  }
});

// 取得目前使用者
app.get("/api/current-user", (req, res) => {
  res.json({ username: req.session.user });
});

// 登出
app.get("/logout", (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// 新增活動（前台，不需要登入）
app.post("/api/activity", (req, res) => {
  const { applicant, activityName, items } = req.body;
  const now = new Date().toLocaleString("zh-TW", { timeZone: tz });
  const newActivity = {
    id: activityId++,
    applicant,
    name: activityName,
    applyDate: now,
    items: items.map((it, idx) => ({
      id: idx + 1,
      description: it.description,
      amount: Number(it.amount),
      source: it.source,
      status: "申請中",
      applyDate: now,
      payDate: null,
      repayDate: null,
      schoolSubsidy: 0,
      studentUnionSubsidy: 0,
      cashReturn: 0
    }))
  };
  activities.push(newActivity);
  res.json({ success: true });
});

// 後台取得所有活動（需登入 admin）
app.get("/api/activities", (req, res) => {
  if (req.session.user !== "admin") return res.status(401).json({ error: "未登入" });
  res.json(activities);
});

// 活動給款（整個活動為單位）
app.post("/api/activity/:id/pay", (req, res) => {
  if (req.session.user !== "admin") return res.status(401).json({ error: "未登入" });
  const act = activities.find(a => a.id == req.params.id);
  if (!act) return res.status(404).json({ error: "找不到活動" });
  const now = new Date().toLocaleString("zh-TW", { timeZone: tz });
  act.items.forEach(item => {
    item.status = "已付款";
    item.payDate = now;
  });
  res.json({ success: true });
});

// 活動還款（整個活動為單位）
app.post("/api/activity/:id/repay", (req, res) => {
  if (req.session.user !== "admin") return res.status(401).json({ error: "未登入" });
  const { schoolSubsidy, studentUnionSubsidy } = req.body;
  const act = activities.find(a => a.id == req.params.id);
  if (!act) return res.status(404).json({ error: "找不到活動" });
  const now = new Date().toLocaleString("zh-TW", { timeZone: tz });
  const total = act.items.reduce((sum, it) => sum + it.amount, 0);
  const school = Number(schoolSubsidy);
  const student = Number(studentUnionSubsidy);
  const cashReturn = total - school - student;
  act.items.forEach(item => {
    item.status = "已還款";
    item.repayDate = now;
    item.schoolSubsidy = school;
    item.studentUnionSubsidy = student;
    item.cashReturn = cashReturn;
  });
  res.json({ success: true });
});

app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
