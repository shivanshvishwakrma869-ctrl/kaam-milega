const categories=[['⚡','Electrician'],['🔧','Plumber'],['📸','Photographer'],['✂️','Tailor'],['🎨','Designer'],['💻','Video Editor']];
const workers=[
{name:'Rahul Kumar',skill:'Electrician',city:'Ayodhya',phone:'9876500011',rating:'4.9'},
{name:'Amit Verma',skill:'Plumber',city:'Lucknow',phone:'9876500012',rating:'4.8'},
{name:'Neha Singh',skill:'Photographer',city:'Ayodhya',phone:'9876500013',rating:'4.9'},
{name:'Pooja Yadav',skill:'Tailor',city:'Faizabad',phone:'9876500014',rating:'4.7'},
{name:'Ravi Sharma',skill:'Video Editor',city:'Lucknow',phone:'9876500015',rating:'4.8'},
{name:'Arjun Mishra',skill:'Designer',city:'Ayodhya',phone:'9876500016',rating:'4.6'}];
const jobs=[['Home wiring','Electrician','Ayodhya','₹1,500–₹3,000'],['Bathroom repair','Plumber','Lucknow','₹800–₹2,000'],['Wedding shoot','Photographer','Ayodhya','₹8,000–₹20,000']];
let activeSkill='All';

// --- Security helper: escape any dynamic text before it is inserted as HTML.
// This prevents stored/reflected XSS the moment real (user-supplied) data
// replaces the hardcoded demo data above.
function escapeHTML(str){
  return String(str==null?'':str).replace(/[&<>"']/g,c=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// --- Validation helpers (client-side only; a real backend must re-validate
// all of this server-side too, since client-side checks can be bypassed).
function isValidIndianPhone(p){return /^[6-9]\d{9}$/.test(String(p).trim());}
function isNonEmpty(v){return String(v||'').trim().length>0;}

function show(id){document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));document.getElementById(id).classList.add('active');window.scrollTo(0,0);if(id==='workers')renderWorkers()}

function card(w){
  const name=escapeHTML(w.name),skill=escapeHTML(w.skill),city=escapeHTML(w.city),rating=escapeHTML(w.rating),phone=escapeHTML(w.phone);
  const initial=escapeHTML(w.name[0]);
  const waMsg=encodeURIComponent(`Hi ${w.name}, I found your profile on KaamMilega.`);
  return `<div class="card worker"><div class="avatar">${initial}</div><div style="width:100%"><h3>${name}</h3><p class="muted">${skill} • ${city}</p><span class="badge green">● Active</span> <span>⭐ ${rating}</span><div class="actions"><button class="primary" onclick="call('${phone}')">📞 Call</button><button class="wa" onclick="wa('${phone}','${waMsg}')">WhatsApp</button></div></div></div>`;
}

function renderHome(){
  document.getElementById('cats').innerHTML=categories.map(c=>`<div class="card" onclick="filterSkill('${escapeHTML(c[1])}')" style="cursor:pointer"><div class="category">${c[0]}</div><h3>${escapeHTML(c[1])}</h3><p class="muted">Find local professionals</p></div>`).join('');
  document.getElementById('featured').innerHTML=workers.slice(0,3).map(card).join('');
  document.getElementById('jobList').innerHTML=jobs.map(j=>`<div class="card job"><div><h3>${escapeHTML(j[0])}</h3><p class="muted">${escapeHTML(j[1])} • ${escapeHTML(j[2])}</p></div><b>${escapeHTML(j[3])}</b><button class="primary" onclick="alert('Demo: job request started')">Apply</button></div>`).join('');
}

function renderWorkers(){
  const q=(document.getElementById('workerSearch')?.value||'').toLowerCase();
  document.getElementById('chips').innerHTML=['All',...categories.map(x=>x[1])].map(s=>`<button class="${activeSkill===s?'active':''}" onclick="filterSkill('${escapeHTML(s)}')">${escapeHTML(s)}</button>`).join('');
  let list=workers.filter(w=>(activeSkill==='All'||w.skill===activeSkill)&&(`${w.name} ${w.skill} ${w.city}`).toLowerCase().includes(q));
  document.getElementById('workerList').innerHTML=list.length?list.map(card).join(''):'<div class="card"><h3>No worker found</h3><p class="muted">Try another skill or name.</p></div>';
}

function filterSkill(s){activeSkill=s;show('workers');renderWorkers();document.getElementById('workerSearch').value=''}
function searchWorkers(){const q=document.getElementById('homeSearch').value;show('workers');document.getElementById('workerSearch').value=q;activeSkill='All';renderWorkers()}
function call(p){location.href='tel:'+encodeURIComponent(p)}
function wa(p,encodedMsg){location.href='https://wa.me/91'+encodeURIComponent(p)+'?text='+encodedMsg}
function openLogin(){document.getElementById('modal').classList.remove('hidden')}
function closeLogin(){document.getElementById('modal').classList.add('hidden')}

function demoLogin(){
  const inputs=document.querySelectorAll('#modal input');
  const idVal=inputs[0]?.value||'', pass=inputs[1]?.value||'';
  const msg=document.getElementById('loginMsg');
  if(!isNonEmpty(idVal)||!isNonEmpty(pass)){
    msg.textContent='Please enter both mobile/email and password.';
    msg.style.color='#b91c1c';
    return;
  }
  if(pass.length<4){
    msg.textContent='Password looks too short.';
    msg.style.color='#b91c1c';
    return;
  }
  msg.style.color='';
  msg.textContent='Demo login successful. Backend authentication is not connected.';
}

function saveProfile(){
  const name=document.getElementById('pname').value.trim();
  const skill=document.getElementById('pskill').value.trim();
  const city=document.getElementById('pcity').value.trim();
  const phone=document.getElementById('pphone').value.trim();
  const msg=document.getElementById('saveMsg');

  if(!isNonEmpty(name)||!isNonEmpty(skill)||!isNonEmpty(city)||!isNonEmpty(phone)){
    msg.style.color='#b91c1c';
    msg.textContent='Please fill in name, skill, city and mobile number.';
    return;
  }
  if(!isValidIndianPhone(phone)){
    msg.style.color='#b91c1c';
    msg.textContent='Enter a valid 10-digit Indian mobile number.';
    return;
  }
  msg.style.color='';
  msg.textContent='Profile saved locally for this demo page.';
}

renderHome();renderWorkers();
