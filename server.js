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
let users = [
  { username: 'admin', password: 'admin', role: 'admin' },
  { username: 'khuscsu', password: '23rdkhuscsu', role: 'manager' }
];

let advances = [];
let advanceId = 1;

// ---------------------- 登入登出 ----------------------
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = users.find(u => u.username === username && u.password === password);
  if(user){
    req.session.user = { username: user.username, role: user.role };
    res.json({ success: true });
  } else {
    res.json({ success: false, message: '帳號或密碼錯誤' });
  }
});

app.post('/logout', (req,res)=>{
  req.session.destroy();
  res.json({success:true});
});

// ---------------------- 使用者管理 ----------------------
app.get('/users', (req,res)=>{
  if(!req.session.user) return res.status(401).json({message:'請先登入'});
  res.json(users.map(u=>({username:u.username,role:u.role})));
});

app.post('/users', (req,res)=>{
  const currentUser = req.session.user;
  if(!currentUser || currentUser.role!=='admin') return res.status(403).json({message:'無權限'});
  const { username, password, role } = req.body;
  if(users.find(u=>u.username===username)) return res.json({message:'帳號已存在'});
  users.push({username,password,role});
  res.json({message:'新增成功'});
});

app.post('/users/:username/password',(req,res)=>{
  const currentUser = req.session.user;
  if(!currentUser) return res.status(401).json({message:'請先登入'});
  const { username } = req.params;
  const { newPassword } = req.body;
  if(currentUser.role!=='admin' && currentUser.username!==username) return res.status(403).json({message:'無權限'});
  const u = users.find(u=>u.username===username);
  if(!u) return res.status(404).json({message:'找不到使用者'});
  u.password = newPassword;
  res.json({message:'修改成功'});
});

app.delete('/users/:username',(req,res)=>{
  const currentUser = req.session.user;
  const { username } = req.params;
  if(!currentUser || currentUser.role!=='admin') return res.status(403).json({message:'無權限'});
  if(username==='admin') return res.json({message:'無法刪除 admin'});
  users = users.filter(u=>u.username!==username);
  res.json({message:'刪除成功'});
});

// ---------------------- 預支管理 ----------------------
app.post('/advances',(req,res)=>{
  const currentUser = req.session.user;
  if(!currentUser) return res.status(401).json({message:'請先登入'});
  const { name, activity, items } = req.body; 
  // items=[{description,amount,source}]
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
  const currentUser = req.session.user;
  if(!currentUser) return res.status(401).json({message:'請先登入'});
  const id = parseInt(req.params.id);
  const adv = advances.find(a=>a.id===id);
  if(adv) adv.status='paid';
  res.json({message:'已給款'});
});

app.post('/repay',(req,res)=>{
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
