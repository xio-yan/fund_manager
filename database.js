const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('fund.db');

// 建立表格
db.serialize(() => {
  // 預支總表
  db.run(`CREATE TABLE IF NOT EXISTS advances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    activity TEXT,
    apply_date TEXT,
    total_amount REAL,
    school_amount REAL,
    student_council_amount REAL,
    status TEXT
  )`);

  // 明細表
  db.run(`CREATE TABLE IF NOT EXISTS advance_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advance_id INTEGER,
    description TEXT,
    amount REAL,
    source TEXT,
    FOREIGN KEY(advance_id) REFERENCES advances(id)
  )`);

  // 還款表
  db.run(`CREATE TABLE IF NOT EXISTS repayments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    advance_id INTEGER,
    repayment_date TEXT,
    school_paid REAL,
    student_council_paid REAL,
    remaining_cash REAL,
    FOREIGN KEY(advance_id) REFERENCES advances(id)
  )`);
});

module.exports = db;
