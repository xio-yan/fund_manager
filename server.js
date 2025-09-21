const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'fundmanagersecret',
  resave: false,
  saveUninitialized: true
}));

// ===== 輔助函數：取得台灣日期 YYYY-MM-DD =====
function taiwanDate(){
  const d = new Date();
  const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
  const tw = new Date(utc + 8*60*60*1000);
  return tw.toISOString().split('T')[0];
}

// ===== 資料庫 =====
const db = new sqlite3.Database('./fund.db');

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    activity TEXT,
    apply_date TEXT,
    total_amount REAL,
    status TEXT,
    paid_date TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS advance_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advance_id INTEGER,
    description TEXT,
    amount REAL,
    source TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS repayments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advance_id INTEGER,
    repayment_date TEXT,
    school_paid REAL,
    student_council_paid REAL,
    remaining_cash REAL,
    confirmed INTEGER
  )`);
});

// ===== 靜態檔案 =====
app.use(express.static('public'));

// ===== 登入驗證 =====
app.post('/login', (req,res)=>{
  const { username, password } = req.body;
  if(username==='admin' && password==='admin'){
    req.session.loggedIn = true;
    res.send({ success:true });
  } else {
    res.send({ success:false });
  }
});

function checkAuth(req,res,next){
  if(req.session.loggedIn) next();
  else res.redirect('/login.html');
}

// 登出
app.post('/logout', (req,res)=>{
  req.session.destroy();
  res.send({ message:'已登出' });
});

app.get('/dashboard.html', checkAuth, (req,res,next)=>{ next(); });

// ===== 新增預支 =====
app.post('/advance', (req,res)=>{
  const { name, activity, items } = req.body;
  const apply_date = taiwanDate(); // 台灣日期
  let total = 0;
  items.forEach(i=> total+=i.amount);

  db.run(`INSERT INTO advances (name, activity, apply_date, total_amount, status)
          VALUES (?,?,?,?,?)`, [name, activity, apply_date, total, 'pending'], function(err){
    if(err) return res.status(500).send(err.message);
    const advance_id = this.lastID;
    items.forEach(item=>{
      db.run(`INSERT INTO advance_items (advance_id, description, amount, source) VALUES (?,?,?,?)`,
              [advance_id, item.description, item.amount, item.source]);
    });
    res.send({ message:'預支成功', advance_id });
  });
});

// ===== 查詢所有預支及明細 =====
app.get('/advances', (req,res)=>{
  db.all(`SELECT * FROM advances`, (err,advances)=>{
    if(err) return res.status(500).send(err.message);
    if(advances.length===0) return res.send([]);

    let result = [];
    let c
