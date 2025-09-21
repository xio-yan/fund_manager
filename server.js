const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 時區工具
const nowInTaipei = () =>
  new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });

app.use(bodyParser.json());
app.use(express.static('public'));

app.use(
  session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
  })
);

// 模擬資料庫
let advances = [];
let users = [{ username: 'admin', password: 'admin' }];

// Middleware 驗證登入
function requireLogin(req, res, next) {
  if (req.session.user) next();
  else res.status(401).json({ success: false, message: '尚未登入' });
}

// 登入
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );
  if (user) {
    req.session.user = user.username;
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '帳號或密碼錯誤' });
  }
});

// 登出
app.post('/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// 新增預支（前台）
app.post('/advances', (req, res) => {
  const { name, activity, items } = req.body;
  if (!name || !activity || !items || !items.length) {
    return res.status(400).json({ success: false, message: '資料不完整' });
  }
  const total = items.reduce((sum, i) => sum + parseFloat(i.amount || 0), 0);
  const newAdvance = {
    id: advances.length + 1,
    name,
    activity,
    items,
    total,
    status: '申請中',
   申請日期: nowInTaipei(),
    給款日期: null,
    還款日期: null,
    schoolSubsidy: 0,
    studentSubsidy: 0,
    cashRemaining: 0,
  };
  advances.push(newAdvance);
  res.json({ success: true, message: '預支已送出', data: newAdvance });
});

// 後台：取得全部預支
app.get('/advances', requireLogin, (req, res) => {
  res.json(advances);
});

// 出納：已付款
app.post('/advances/:id/pay', requireLogin, (req, res) => {
  const adv = advances.find((a) => a.id == req.params.id);
  if (!adv) return res.status(404).json({ success: false, message: '找不到紀錄' });
  adv.status = '已付款';
  adv.給款日期 = nowInTaipei();
  res.json({ success: true, message: '已付款', data: adv });
});

// 出納：還款
app.post('/advances/:id/repay', requireLogin, (req, res) => {
  const { schoolSubsidy, studentSubsidy } = req.body;
  const adv = advances.find((a) => a.id == req.params.id);
  if (!adv) return res.status(404).json({ success: false, message: '找不到紀錄' });
  if (adv.status !== '已付款')
    return res.status(400).json({ success: false, message: '尚未付款，不能還款' });

  adv.schoolSubsidy = parseFloat(schoolSubsidy) || 0;
  adv.studentSubsidy = parseFloat(studentSubsidy) || 0;
  adv.cashRemaining = adv.total - (adv.schoolSubsidy + adv.studentSubsidy);
  adv.status = '已還款';
  adv.還款日期 = nowInTaipei();

  res.json({ success: true, message: '已還款完成', data: adv });
});

// 啟動伺服器
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
