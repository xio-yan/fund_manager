const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

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
let activities = []; // 活動，每個活動可有多筆款項
let adminUser = { username: "admin", password: "admin" };

// 登入 API
app.post("/login", (req, res) => {
  const { username, password } = req.body;
  if (username === adminUser.username && password === adminUser.password) {
    req.session.user = { username };
    res.json({ success: true });
  } else {
    res.json({ success: false, message: "帳號或密碼錯誤" });
  }
});

// 登出 API
app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

// 取得目前登入使用者
app.get("/api/current-user", (req, res) => {
  if (req.session.user) {
    res.json({ username: req.session.user.username });
  } else {
    res.json({ username: null });
  }
});

// 前台：新增活動及款項（不用登入）
app.post("/api/activity", (req, res) => {
  const { applicant, activityName, items } = req.body;
  if (!applicant || !activityName || !items || !Array.isArray(items)) {
    return res.json({ success: false, message: "資料不完整" });
  }
  const newActivity = {
    id: activities.length + 1,
    applicant,
    name: activityName,
    applyDate: new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }),
    items: items.map((it, idx) => ({
      id: idx + 1,
      description: it.description,
      amount: parseInt(it.amount),
      source: it.source,
      status: "申請中",
      payDate: null,
      repayDate: null,
      schoolSubsidy: 0,
      studentUnionSubsidy: 0,
      cashReturn: 0,
    })),
  };
  activities.push(newActivity);
  res.json({ success: true, activity: newActivity });
});

// 後台：取得所有活動
app.get("/api/activities", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  res.json(activities);
});

// 後台：標記已付款
app.post("/api/activity/:activityId/item/:itemId/pay", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  const activity = activities.find(a => a.id == req.params.activityId);
  if (!activity) return res.json({ success: false });
  const item = activity.items.find(i => i.id == req.params.itemId);
  if (!item || item.status !== "申請中") return res.json({ success: false });
  item.status = "已付款";
  item.payDate = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  res.json({ success: true, item });
});

// 後台：還款
app.post("/api/activity/:activityId/item/:itemId/repay", (req, res) => {
  if (!req.session.user) return res.status(401).json({ success: false });
  const activity = activities.find(a => a.id == req.params.activityId);
  if (!activity) return res.json({ success: false });
  const item = activity.items.find(i => i.id == req.params.itemId);
  if (!item || item.status !== "已付款") return res.json({ success: false });
  const { schoolSubsidy, studentUnionSubsidy } = req.body;
  item.schoolSubsidy = parseInt(schoolSubsidy);
  item.studentUnionSubsidy = parseInt(studentUnionSubsidy);
  item.cashReturn = item.amount - item.schoolSubsidy - item.studentUnionSubsidy;
  item.status = "已還款";
  item.repayDate = new Date().toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  res.json({ success: true, item });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
