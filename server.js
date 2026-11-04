// SchoolBites demo server: zero dependencies, in-memory data. Run: node server.js
const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const SCHOOL={name:'Sampaguita National High School',fee:0};
const E=(s,m)=>Object.assign(new Error(m),{status:s});
const canteens=[
 {id:'A',name:'Canteen A',tag:'Rice Meals & Filipino Dishes',hours:'7:00 AM–3:00 PM',open:true,prep:15,emoji:'🍛'},
 {id:'B',name:'Canteen B',tag:'Snacks & Sandwiches',hours:'7:00 AM–4:00 PM',open:true,prep:8,emoji:'🥪'},
 {id:'C',name:'Canteen C',tag:'Drinks & Desserts',hours:'7:00 AM–4:00 PM',open:true,prep:5,emoji:'🧋'},
 {id:'D',name:'Canteen D',tag:'Noodles & Fast Food',hours:'9:00 AM–2:00 PM',open:false,prep:12,emoji:'🍜'}];
const SZ=(a=10)=>({n:'Size',multi:false,c:[{n:'Regular',p:0},{n:'Large',p:a}]});
const SP={n:'Spice level',multi:false,c:[{n:'Mild',p:0},{n:'Medium',p:0},{n:'Hot',p:0}]};
const RC={n:'Rice portion',multi:false,c:[{n:'Regular rice',p:0},{n:'Extra rice',p:15}]};
let k=0;const F=(c,name,cat,price,emoji,desc,opts=[],avail=true)=>({id:'f'+(++k),c,name,cat,price,emoji,desc,opts,avail,pop:Math.floor(Math.random()*90)+10});
const foods=[
 F('A','Chicken Rice Meal','Rice Meals',75,'🍗','Crispy fried chicken with garlic rice.',[RC,SP]),
 F('A','Pork Adobo Rice','Rice Meals',65,'🍖','Soy-vinegar braised pork over steamed rice.',[RC]),
 F('A','Tapsilog','Rice Meals',80,'🍳','Beef tapa, garlic rice and fried egg.',[RC]),
 F('A','Sinigang na Baboy','Rice Meals',85,'🍲','Sour tamarind soup with pork and veggies.',[RC],false),
 F('B','Burger','Sandwiches',45,'🍔','Beef patty, lettuce and house sauce.',[{n:'Add-ons',multi:true,c:[{n:'Cheese',p:10},{n:'Egg',p:15},{n:'Bacon',p:20}]}]),
 F('B','Club Sandwich','Sandwiches',55,'🥪','Triple-decker ham, egg and cheese.'),
 F('B','French Fries','Snacks',40,'🍟','Golden fries with your choice of dip.',[SZ(15)]),
 F('B','Hotdog Sandwich','Sandwiches',35,'🌭','Juicy hotdog in a soft bun.'),
 F('C','Iced Tea','Drinks',25,'🥤','Freshly brewed lemon iced tea.',[SZ(10)]),
 F('C','Milk Tea','Drinks',60,'🧋','Classic milk tea, made to order.',[SZ(10),{n:'Add-ons',multi:true,c:[{n:'Pearls',p:10},{n:'Pudding',p:10}]}]),
 F('C','Donut','Desserts',20,'🍩','Glazed donut baked fresh each morning.'),
 F('C','Chocolate Brownie','Desserts',30,'🍫','Fudgy brownie square.',[],false),
 F('D','Pancit','Noodles',50,'🍜','Stir-fried noodles with vegetables.',[{n:'Add-ons',multi:true,c:[{n:'Egg',p:10}]},SP]),
 F('D','Spaghetti','Noodles',55,'🍝','Sweet-style Filipino spaghetti.'),
 F('D','Chicken Nuggets','Snacks',60,'🍗','Six crispy nuggets with sauce.'),
 F('D','Cup Noodles','Noodles',35,'🥡','Hot cup noodles, ready in minutes.')];
const users=[
 {username:'student',role:'student',name:'Juan Dela Cruz'},
 {username:'vendor',role:'vendor',canteen:'A',name:'Canteen A Vendor'},
 {username:'vendorb',role:'vendor',canteen:'B',name:'Canteen B Vendor'},
 {username:'admin',role:'admin',name:'School Admin'}];
const tokens={},idem={},parents=[],vos=[];
const FLOW=['Pending Confirmation','Accepted','Preparing','Ready for Pickup','Completed'];
const log=[];
function parentStatus(p){const v=p.vendors.map(id=>vos.find(x=>x.id===id).status).filter(s=>s!=='Cancelled');
 if(!v.length)return'Cancelled';const m=Math.min(...v.map(s=>FLOW.indexOf(s)));
 if(m>=4)return'Completed';if(m>=3)return'Ready for Pickup';
 return v.some(s=>FLOW.indexOf(s)>=2)?'Preparing':v.some(s=>s==='Accepted')?'Accepted':'Pending Confirmation';}
const viewParent=p=>({...p,status:parentStatus(p),vendors:p.vendors.map(id=>{const v=vos.find(x=>x.id===id);return{...v,canteenName:canteens.find(c=>c.id===v.canteen).name}}),total:p.vendors.reduce((s,id)=>s+vos.find(x=>x.id===id).subtotal,0)+p.fee});
function createOrder(u,b){
 if(!b.key)throw E(400,'Missing submission key');if(idem[b.key])return idem[b.key];
 if(!Array.isArray(b.items)||!b.items.length)throw E(400,'Your cart is empty.');
 if(!b.name||!b.name.trim())throw E(400,'Please enter your name.');
 const by={};
 for(const i of b.items){const fd=foods.find(x=>x.id===i.foodId);if(!fd)throw E(400,'An item no longer exists.');
  const c=canteens.find(x=>x.id===fd.c);
  if(!c.open)throw E(409,c.name+' is closed. Remove its items to continue.');
  if(!fd.avail)throw E(409,fd.name+' is sold out. Remove it to continue.');
  const q=Math.max(1,Math.min(20,parseInt(i.qty)||1));let unit=fd.price;const chosen=[];
  for(const o of fd.opts)for(const ch of o.c)if((i.opts||[]).includes(o.n+': '+ch.n)){unit+=ch.p;chosen.push(o.n+': '+ch.n)}
  (by[c.id]=by[c.id]||[]).push({foodId:fd.id,name:fd.name,qty:q,unit,opts:chosen,note:String(i.note||'').slice(0,120)});}
 const p={id:'SB-'+Math.floor(100000+Math.random()*900000),userId:u.username,name:b.name.trim().slice(0,60),sid:String(b.sid||'').slice(0,30),
  pickupType:b.pickupType==='point'?'Designated pickup point':'Canteen counter',pickupTime:String(b.pickupTime||'ASAP').slice(0,20),
  payment:b.payment==='gcash'?'GCash (demo placeholder, not verified)':'Cash on pickup',notes:String(b.notes||'').slice(0,200),fee:SCHOOL.fee,createdAt:new Date().toISOString(),vendors:[]};
 for(const cid in by){const items=by[cid];const vo={id:p.id+'-'+cid,parent:p.id,canteen:cid,items,subtotal:items.reduce((s,i)=>s+i.unit*i.qty,0),status:'Pending Confirmation',updatedAt:p.createdAt};vos.push(vo);p.vendors.push(vo.id)}
 parents.push(p);log.push({t:p.createdAt,m:`${u.username} placed ${p.id}`});return idem[b.key]=viewParent(p);}
const scope=u=>vos.filter(v=>u.role==='admin'||v.canteen===u.canteen).map(v=>{const p=parents.find(x=>x.id===v.parent);return{...v,orderNo:p.id,customer:p.name,sid:p.sid,notes:p.notes,pickup:p.pickupTime+' · '+p.pickupType,payment:p.payment,createdAt:p.createdAt,canteenName:canteens.find(c=>c.id===v.canteen).name}}).reverse();
function stats(u){const day=new Date().toDateString(),mine=scope(u),today=mine.filter(v=>new Date(v.createdAt).toDateString()===day),ok=today.filter(v=>v.status!=='Cancelled'),best={};
 ok.forEach(v=>v.items.forEach(i=>best[i.name]=(best[i.name]||0)+i.qty));
 return{ordersToday:today.length,salesToday:ok.reduce((s,v)=>s+v.subtotal,0),activeCanteens:canteens.filter(c=>c.open).length,pending:mine.filter(v=>v.status==='Pending Confirmation').length,
  best:Object.entries(best).sort((a,b)=>b[1]-a[1]).slice(0,5),cancelled:mine.filter(v=>v.status==='Cancelled').length}}
const body=r=>new Promise(res=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>{try{res(JSON.parse(d||'{}'))}catch{res({})}})});
const send=(r,s,o,t='application/json')=>{r.writeHead(s,{'Content-Type':t});r.end(t==='application/json'?JSON.stringify(o):o)};
async function api(req,res,url){
 const me=tokens[(req.headers.authorization||'').replace('Bearer ','')],b=req.method==='GET'?{}:await body(req),p=url.pathname.replace('/api/','').split('/'),m=req.method;
 const need=(...roles)=>{if(!me)throw E(401,'Please sign in.');if(roles.length&&!roles.includes(me.role))throw E(403,'You do not have access to this.');return me};
 if(p[0]==='login'&&m==='POST'){const u=users.find(x=>x.username===b.username);if(!u||b.password!=='demo')throw E(401,'Invalid demo credentials.');const t=crypto.randomUUID();tokens[t]=u;return send(res,200,{token:t,user:u})}
 if(p[0]==='me')return send(res,200,{user:me||null});
 if(p[0]==='config')return send(res,200,{school:SCHOOL.name,fee:SCHOOL.fee});
 if(p[0]==='canteens'&&m==='GET')return send(res,200,canteens);
 if(p[0]==='canteens'&&m==='PATCH'){const u=need('vendor','admin'),c=canteens.find(x=>x.id===p[1]);if(!c)throw E(404,'Not found');
  if(u.role==='vendor'&&u.canteen!==c.id)throw E(403,'Not your canteen.');if(typeof b.open==='boolean')c.open=b.open;if(b.prep&&u.role!=='student')c.prep=Math.max(1,Math.min(90,+b.prep));log.push({t:new Date().toISOString(),m:`${u.username} updated ${c.name}`});return send(res,200,c)}
 if(p[0]==='foods'&&m==='GET')return send(res,200,foods);
 if(p[0]==='foods'&&m==='PATCH'){const u=need('vendor','admin'),f=foods.find(x=>x.id===p[1]);if(!f)throw E(404,'Not found');
  if(u.role==='vendor'&&u.canteen!==f.c)throw E(403,'Not your menu.');if(typeof b.avail==='boolean')f.avail=b.avail;if(b.price>0)f.price=Math.round(b.price);return send(res,200,f)}
 if(p[0]==='orders'&&m==='POST')return send(res,200,createOrder(need('student','admin','vendor'),b));
 if(p[0]==='orders'&&m==='GET'){const u=need();return send(res,200,parents.filter(x=>x.userId===u.username).map(viewParent).reverse())}
 if(p[0]==='vendor-orders'&&m==='GET')return send(res,200,scope(need('vendor','admin')));
 if(p[0]==='vendor-orders'&&m==='PATCH'){const u=need('vendor','admin'),v=vos.find(x=>x.id===p[1]);if(!v)throw E(404,'Not found');
  if(u.role==='vendor'&&v.canteen!==u.canteen)throw E(403,'This order belongs to another canteen.');
  if(![...FLOW,'Cancelled'].includes(b.status))throw E(400,'Invalid status.');v.status=b.status;v.updatedAt=new Date().toISOString();log.push({t:v.updatedAt,m:`${u.username} set ${v.id} to ${b.status}`});return send(res,200,v)}
 if(p[0]==='stats')return send(res,200,stats(need('vendor','admin')));
 if(p[0]==='activity')return send(res,200,log.slice(-30).reverse().concat(need('admin')&&[]));
 if(p[0]==='export'){const u=need('admin','vendor'),rows=[['Order','Canteen','Customer','Status','Subtotal','Created'],...scope(u).map(v=>[v.id,v.canteenName,v.customer,v.status,v.subtotal,v.createdAt])];
  return send(res,200,rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n'),'text/csv')}
 throw E(404,'Not found');}
http.createServer(async(req,res)=>{const url=new URL(req.url,'http://x');
 try{if(url.pathname.startsWith('/api/'))return await api(req,res,url);
  send(res,200,fs.readFileSync(path.join(__dirname,'public','index.html')),'text/html')}
 catch(e){send(res,e.status||500,{error:e.message})}}).listen(process.env.PORT||3000,()=>console.log('SchoolBites running on http://localhost:'+(process.env.PORT||3000)));
