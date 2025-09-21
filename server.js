const express = require('express');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public')); // 放前端頁面

// ================== 新增預支 ==================
app.post('/advance', (req, res) => {
  const { name, activity, items } = req.body;
  const apply_date = new Date().toISOString().split('T')[0];

  let total = 0, school_total = 0, student_council_total = 0;
  items.forEach(item => {
    total += item.amount;
    if(item.source==='school') school_total += item.amount;
    else if(item.source==='student_council') student_council_total += item.amount;
  });

  db.run(`INSERT INTO advances (name, activity, apply_date, total_amount, school_amount, student_council_amount, status)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [name, activity, apply_date, total, school_total, student_council_total, 'pending'], function(err){
    if(err) return res.status(500).send(err.message);

    const advance_id = this.lastID;
    items.forEach(item => {
      db.run(`INSERT INTO advance_items (advance_id, description, amount, source)
              VALUES (?, ?, ?, ?)`,
              [advance_id, item.description, item.amount, item.source]);
    });

    res.send({ message: '預支成功', advance_id });
  });
});

// ================== 查詢所有預支 ==================
app.get('/advances', (req, res) => {
  db.all(`SELECT * FROM advances`, (err, rows) => {
    if(err) return res.status(500).send(err.message);
    res.send(rows);
  });
});

// ================== 標記已給款 ==================
app.post('/markPaid/:id', (req, res) => {
  const id = req.params.id;
  db.run(`UPDATE advances SET status='paid' WHERE id=?`, [id], function(err){
    if(err) return res.status(500).send(err.message);
    res.send({ message: '已標記給款' });
  });
});

// ================== 登記還款 ==================
app.post('/repay', (req, res) => {
  const { advance_id, school_paid, student_council_paid } = req.body;
  const repayment_date = new Date().toISOString().split('T')[0];

  db.get(`SELECT total_amount FROM advances WHERE id=?`, [advance_id], (err, advance) => {
    if(err) return res.status(500).send(err.message);
    const remaining = advance.total_amount - school_paid - student_council_paid;

    db.run(`INSERT INTO repayments (advance_id, repayment_date, school_paid, student_council_paid, remaining_cash)
            VALUES (?, ?, ?, ?, ?)`,
            [advance_id, repayment_date, school_paid, student_council_paid, remaining], (err) => {
      if(err) return res.status(500).send(err.message);
      res.send({ message: '還款紀錄成功', remaining });
    });
  });
});

// ================== 啟動伺服器 ==================
const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Server running on port ' + listener.address().port);
});
