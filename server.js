const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();

app.use(express.static('public'));
app.use(bodyParser.json());
app.use(session({
  secret: 'mysecret',
  resave: false,
  saveUninitialized: true
}));

// --------- 資料存放 ---------
let users = [
  { username: 'admin', password: 'admin', role: 'admin' },
  { username: 'khuscsu', password: '23rdkhuscsu', role: 'manager' }
];

let advances = [];
let repayments = [];

// --------- 登入 / 登出 ---------
app.post('/login', (req,res)=>{
  const { username, password } = req.body;
  const user = users.find(u=>u.username===username && u.password===password);
  if(user){
    req.session.user = { username: user.username, role: user.role };
    res.json({ success:true, username:user.username, role:user.role });
  } else res.json({ success:false });
});

app.post('/logout', (req,res)=>{
  req.session.destroy();
  res.json({success:true});
});

// --------- 權限中介 ---------
function authAdmin(req,res,next){
  if(!req.session.user || req.session.user.role!=='admin') return res.status(403).json({ message:'無權限' });
  next();
}

function authLoggedIn(req,res,next){
  if(!req.session.user) return res.status(401).json({ message:'請先登入' });
  next();
}

// --------- 用戶管理 API ---------
app.get('/users', authLoggedIn, (req,res)=>{
  res.json(users.map(u=>({username:u.username, role:u.role})));
});

app.post('/users', authAdmin, (req,res)=>{
  const { username, password, role } = req.body;
  if(users.find(u=>u.username===username)) return res.json({message:'使用者已存在'});
  users.push({username, password, role});
  res.json({message:'新增成功'});
});

app.post('/users/:username/password', authLoggedIn, (req,res)=>{
  const { username } = req.params;
  const { newPassword } = req.body;
  const loginUser = req.session.user;
  if(loginUser.role!=='admin' && loginUser.username!==username)
    return res.status(403).json({message:'無權限'});
  const user = users.find(u=>u.username===username);
  if(!user) return res.json({message:'使用者不存在'});
  user.password = newPassword;
  res.json({message:'修改成功'});
});

app.delete('/users/:username', authAdmin, (req,res)=>{
  const { username } = req.params;
  if(username==='admin') return res.json({message:'不能刪除 admin'});
  const idx = users.findIndex(u=>u.username===username);
  if(idx===-1) return res.json({message:'使用者不存在'});
  users.splice(idx,1);
  res.json({message:'刪除成功'});
});

// --------- 預支管理 API ---------
app.get('/advances', authLoggedIn, (req,res)=>{
  res.json(advances);
});

app.post('/advances', authLoggedIn, (req,res)=>{
  const { name, activity, items } = req.body;
  if(!name || !activity || !items || items.length===0) return res.json({message:'資料不完整'});
  const total_amount = items.reduce((sum,i)=>sum+i.amount,0);
  const advance = {
    id: advances.length+1,
    name, activity, items,
    apply_date: new Date().toLocaleDateString(),
    total_amount,
    status:'pending'
  };
  advances.push(advance);
  res.json({message:'預支申請成功'});
});

app.post('/markPaid/:id', authLoggedIn, (req,res)=>{
  const id = parseInt(req.params.id);
  const advance = advances.find(a=>a.id===id);
  if(!advance) return res.json({message:'找不到預支'});
  advance.status='paid';
  res.json({message:'已標記給款'});
});

// --------- 還款管理 ---------
app.post('/repay', authLoggedIn, (req,res)=>{
  const { advance_id, school_paid, student_council_paid } = req.body;
  const advance = advances.find(a=>a.id===advance_id);
  if(!advance) return res.json({message:'找不到預支'});
  const remaining_cash = advance.total_amount - school_paid - student_council_paid;
  repayments.push({
    advance_id,
    school_paid,
    student_council_paid,
    remaining_cash,
    repayment_date: new Date().toLocaleDateString()
  });
  res.json({message:'已登記還款', remaining_cash});
});

app.get('/repayments', authLoggedIn, (req,res)=>{
  const advance_id = parseInt(req.query.advance_id);
  res.json(repayments.filter(r=>r.advance_id===advance_id));
});

// --------- 啟動服務 ---------
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=>console.log(`Server running on port ${PORT}`));
