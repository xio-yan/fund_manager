<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>後台管理</title>
<style>
.hidden{display:none;}
.table{border-collapse:collapse;width:100%;}
.table th,.table td{border:1px solid #aaa;padding:5px;}
.details{margin:10px 0;padding:10px;border:1px solid #ccc;}
</style>
</head>
<body>
<h1>後台管理</h1>
<div>
  登入使用者：<span id="currentUser"></span>
  <button onclick="logout()">登出</button>
  <button onclick="location.href='index.html'">返回首頁</button>
</div>
<hr>
<h2>預支紀錄</h2>
<div id="records"></div>

<script>
async function loadData(){
  const res = await fetch('/advances');
  if(res.status===401){ alert('請先登入'); location.href='login.html'; return; }
  const data = await res.json();
  render(data);
}

function render(records){
  const container=document.getElementById('records');
  container.innerHTML='';
  records.forEach(r=>{
    const div=document.createElement('div');
    div.classList.add('record');
    div.innerHTML=`
      <h3>${r.activity} - ${r.name} (${r.apply_date})</h3>
      <p>總金額: ${r.total_amount} 元，狀態: ${r.status}</p>
      <button onclick="toggleDetails(${r.id})">查看明細</button>
      <div id="details-${r.id}" class="details hidden"></div>
    `;
    container.appendChild(div);
  });
}

function toggleDetails(id){
  const d = document.getElementById(`details-${id}`);
  if(!d.classList.contains('hidden')){
    d.classList.add('hidden');
    return;
  }
  d.classList.remove('hidden');
  fetchDetails(id,d);
}

function fetchDetails(id,container){
  fetch('/advances')
    .then(r=>r.json())
    .then(data=>{
      const adv=data.find(a=>a.id===id);
      if(!adv) return;
      container.innerHTML=`
        <h4>用途明細</h4>
        <table class="table">
          <tr><th>說明</th><th>金額</th><th>來源</th></tr>
          ${adv.items.map(i=>`<tr><td>${i.description}</td><td>${i.amount}</td><td>${i.source==='school'?'學校':'學生會'}</td></tr>`).join('')}
        </table>
        <h4>還款管理</h4>
        ${adv.repayment ? renderRepayment(adv) : `
          <label>學校補助: <input type="number" id="school-${id}"></label><br>
          <label>學生會補助: <input type="number" id="stu-${id}"></label><br>
          <button onclick="calcRepay(${id})">計算剩餘現金</button>
          <div id="result-${id}"></div>
        `}
      `;
    });
}

function renderRepayment(adv){
  const r=adv.repayment;
  if(!r.confirmed){
    return `
      <p>學校補助: ${r.school_paid} 元<br>
      學生會補助: ${r.student_council_paid} 元<br>
      應收現金: ${r.remaining_cash} 元</p>
      <button onclick="confirmRepay(${adv.id})">確認已還款</button>
    `;
  }else{
    return `
      <p>✅ 已還款<br>
      學校補助: ${r.school_paid} 元，學生會補助: ${r.student_council_paid} 元<br>
      現金補足: ${r.remaining_cash} 元<br>
      日期: ${r.date}</p>
    `;
  }
}

async function calcRepay(id){
  const school=parseInt(document.getElementById(`school-${id}`).value)||0;
  const stu=parseInt(document.getElementById(`stu-${id}`).value)||0;
  const res=await fetch('/repay',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({advance_id:id,school_paid:school,student_council_paid:stu})
  });
  const data=await res.json();
  document.getElementById(`result-${id}`).innerHTML=`
    <p>學校補助: ${data.school_paid} 元<br>
    學生會補助: ${data.student_council_paid} 元<br>
    應收現金: ${data.remaining_cash} 元</p>
    <button onclick="fetchDetails(${id},document.getElementById('details-${id}'))">重新整理</button>
  `;
}

async function confirmRepay(id){
  const res=await fetch('/confirmRepay/'+id,{method:'POST'});
  const data=await res.json();
  alert(data.message);
  fetchDetails(id,document.getElementById(`details-${id}`));
}

async function getUser(){
  const res=await fetch('/advances');
  if(res.status===401){ document.getElementById('currentUser').textContent='未登入'; }
  else document.getElementById('currentUser').textContent='admin';
}

loadData();
getUser();

async function logout(){
  await fetch('/logout',{method:'POST'});
  location.href='login.html';
}
</script>
</body>
</html>
