const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({ secret: 'secret-key', resave: false, saveUninitialized: true }));
app.use(express.static('public'));

// ---------------------- 資料儲存 ----------------------
const admin = { username: 'admin', password: 'admin' };
let advances = [];
let advanceId = 1;

// ---------------------- 登入登出 ----------------------
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if(username===admin.username && password===admin.password){
    req.session.user = { username: admin.username };
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '帳號或密碼錯誤' });
  }
});

app.post('/logout', (req,res)=>{
  req.session.destroy();
  res.json({success:true});
});

// ---------------------- 預支管理 ----------------------
app.post('/advances',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'請先登入'});
  const { name, activity, items } = req.body; 
  let total_amount = items.reduce((sum,i)=>sum+i.amount,0);
  advances.push({
    id: advanceId++,
    name,
    activity,
    apply_date: new Date().toLocaleDateString(),
    items,
    total_amount,
    status:'pending',
    repayment: null
  });
  res.json({message:'送出成功'});
});

app.get('/advances',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'請先登入'});
  res.json(advances);
});

app.post('/markPaid/:id',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'請先登入'});
  const id = parseInt(req.params.id);
  const adv = advances.find(a=>a.id===id);
  if(adv) adv.status='paid';
  res.json({message:'已給款'});
});

app.post('/repay',(req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'請先登入'});
  const { advance_id, school_paid, student_council_paid } = req.body;
  const adv = advances.find(a=>a.id===advance_id);
  if(!adv) return res.status(404).json({message:'找不到預支'});
  let paidTotal = school_paid + student_council_paid;
  let remaining_cash = adv.total_amount - paidTotal;
  adv.repayment = { school_paid, student_council_paid, remaining_cash, date: new Date().toLocaleDateString() };
  adv.status='repaid';
  res.json({remaining_cash});
});

// ---------------------- 啟動 ----------------------
app.listen(PORT,()=>console.log(`Server running on port ${PORT}`));
