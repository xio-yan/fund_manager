const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer'); // <<< 新增

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'fundmanagersecret',
    resave: false,
    saveUninitialized: true
}));

// ===== 輔助函數：取得台灣日期 YYYY-MM-DD =====
function taiwanDate() {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    const tw = new Date(utc + 8 * 60 * 60 * 1000);
    return tw.toISOString().split('T')[0];
}

// ===== 金額格式化工具 =====
function formatAmount(num) {
    if (num === null || num === undefined) return num;
    return Number(num).toLocaleString('zh-TW');
}

// ===== 資料庫 =====
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'fund.db');

// 確保資料夾存在
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
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
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'peggy931104' && password === 'peggy931104') {
        req.session.loggedIn = true;
        res.send({ success: true });
    } else {
        res.send({ success: false });
    }
});

function checkAuth(req, res, next) {
    if (req.session.loggedIn) next();
    else res.redirect('/login.html');
}

// 登出
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.send({ message: '已登出' });
});

app.get('/dashboard.html', checkAuth, (req, res, next) => { next(); });

// ===== 郵件寄送設定 =====
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.MAIL_USER || 'wangq631@gmail.com',
        pass: process.env.MAIL_PASS || 'hokujfjoxziscdgj'
    }
});
const notifyEmail = process.env.NOTIFY_EMAIL || 'peggy110493@gmail.com';

// ===== 新增預支 =====
app.post('/advance', (req, res) => {
    const { name, activity, items } = req.body;
    const apply_date = taiwanDate();
    let total = 0;
    items.forEach(i => total += i.amount);

    db.run(`INSERT INTO advances (name, activity, apply_date, total_amount, status)
          VALUES (?,?,?,?,?)`, [name, activity, apply_date, total, 'pending'], function (err) {
        if (err) return res.status(500).send(err.message);
        const advance_id = this.lastID;
        items.forEach(item => {
            db.run(`INSERT INTO advance_items (advance_id, description, amount, source) VALUES (?,?,?,?)`,
                [advance_id, item.description, item.amount, item.source]);
        });

        // ===== 新增：寄送通知 Email =====
        const mailOptions = {
            from: process.env.MAIL_USER || 'wangq631@gmail.com',
            to: notifyEmail,
            subject: '新的預支申請通知',
            html: `
        <h3>有一筆新的預支申請</h3>
        <p><b>申請人：</b>${name}</p>
        <p><b>活動名稱：</b>${activity}</p>
        <p><b>申請日期：</b>${apply_date}</p>
        <p><b>總金額：</b>${formatAmount(total)}</p>
        <h4>明細：</h4>
        <ul>
          ${items.map(i => `<li>${i.description} - ${formatAmount(i.amount)} (${i.source})</li>`).join('')}
        </ul>
      `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('寄信失敗：', error);
            } else {
                console.log('寄信成功：', info.response);
            }
        });

        res.send({ message: '預支成功', advance_id });
    });
});

// ===== 查詢所有預支及明細 =====
app.get('/advances', (req, res) => {
    db.all(`SELECT * FROM advances`, (err, advances) => {
        if (err) return res.status(500).send(err.message);
        if (advances.length === 0) return res.send([]);

        let result = [];
        let count = 0;

        advances.forEach(a => {
            db.all(`SELECT * FROM advance_items WHERE advance_id=?`, [a.id], (err, items) => {
                if (err) return res.status(500).send(err.message);

                const formattedItems = items.map(i => ({
                    ...i,
                    amount_formatted: formatAmount(i.amount)
                }));

                result.push({
                    ...a,
                    total_amount_formatted: formatAmount(a.total_amount),
                    items: formattedItems
                });

                count++;
                if (count === advances.length) {
                    result.sort((x, y) => x.id - y.id);
                    res.send(result);
                }
            });
        });
    });
});

// ===== 標記已給款 =====
app.post('/markPaid/:id', (req, res) => {
    const id = req.params.id;
    const paid_date = taiwanDate();
    db.run(`UPDATE advances SET status='paid', paid_date=? WHERE id=?`, [paid_date, id], function (err) {
        if (err) return res.status(500).send(err.message);
        res.send({ message: '已標記給款', paid_date });
    });
});

// ===== 登記還款 =====
app.post('/repay', (req, res) => {
    const { advance_id, school_paid, student_council_paid } = req.body;
    db.get(`SELECT total_amount FROM advances WHERE id=?`, [advance_id], (err, row) => {
        if (err) return res.status(500).send(err.message);
        if (!row) return res.status(404).send({ message: '找不到預支紀錄' });
        const remaining_cash = row.total_amount - school_paid - student_council_paid;
        const repayment_date = taiwanDate();

        db.run(`INSERT INTO repayments (advance_id, repayment_date, school_paid, student_council_paid, remaining_cash, confirmed)
            VALUES (?,?,?,?,?,?)`,
            [advance_id, repayment_date, school_paid, student_council_paid, remaining_cash, 1], (err) => {
                if (err) return res.status(500).send(err.message);
                db.run(`UPDATE advances SET status='repaid' WHERE id=?`, [advance_id]);
                res.send({
                    message: '還款完成',
                    remaining_cash,
                    remaining_cash_formatted: formatAmount(remaining_cash),
                    repayment_date
                });
            });
    });
});

// ===== 查詢單筆活動的還款紀錄 =====
app.get('/repayments', (req, res) => {
    const advance_id = req.query.advance_id;
    db.all(`SELECT * FROM repayments WHERE advance_id=? ORDER BY id ASC`, [advance_id], (err, rows) => {
        if (err) return res.status(500).send(err.message);

        const formattedRows = rows.map(r => ({
            ...r,
            school_paid_formatted: formatAmount(r.school_paid),
            student_council_paid_formatted: formatAmount(r.student_council_paid),
            remaining_cash_formatted: formatAmount(r.remaining_cash)
        }));

        res.send(formattedRows);
    });
});

// ===== 啟動伺服器 =====
const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Server running on port ' + listener.address().port);
});
