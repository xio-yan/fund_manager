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

// ===== 資料庫 =====
const db = new sqlite3.Database('./fund.db');

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    activity TEXT,
    apply_date TEXT,
    total_amount REAL,
    status TEXT
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

app.get('/dashboard.html', checkAuth, (req,res,next)=>{ next(); });

// ===== 新增預支 =====
app.post('/advance', (req,res)=>{
  const { name, activity, items } = req.body;
  const apply_date = new Date().toISOString().split('T')[0];
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
    let count = 0;

    advances.forEach(a=>{
      db.all(`SELECT * FROM advance_items WHERE advance_id=?`, [a.id], (err,items)=>{
        if(err) return res.status(500).send(err.message);
        result.push({ ...a, items });
        count++;
        if(count === advances.length) {
          // 按ID排序
          result.sort((x,y)=>x.id-y.id);
          res.send(result);
        }
      });
    });
  });
});

// ===== 標記已給款 =====
app.post('/markPaid/:id', (req,res)=>{
  const id = req.params.id;
  db.run(`UPDATE advances SET status='paid' WHERE id=?`, [id], function(err){
    if(err) return res.status(500).send(err.message);
    res.send({ message:'已標記給款' });
  });
});

// ===== 登記還款 =====
app.post('/repay', (req,res)=>{
  const { advance_id, school_paid, student_council_paid, remaining_cash } = req.body;
  const repayment_date = new Date().toISOString().split('T')[0];

  db.run(`INSERT INTO repayments (advance_id, repayment_date, school_paid, student_council_paid, remaining_cash, confirmed)
          VALUES (?,?,?,?,?,?)`,
          [advance_id, repayment_date, school_paid, student_council_paid, remaining_cash, 1], (err)=>{
    if(err) return res.status(500).send(err.message);
    db.run(`UPDATE advances SET status='repaid' WHERE id=?`, [advance_id]);
    res.send({ message:'還款完成', remaining_cash });
  });
});

// ===== 啟動伺服器 =====
const listener = app.listen(process.env.PORT || 3000, ()=>{
  console.log('Server running on port '+listener.address().port);
});
