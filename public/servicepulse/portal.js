const $=id=>document.getElementById(id);
const format=n=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'}).format(n);
const config=window.SERVICEPULSE_CONFIG||{};
let db=null,user=null,workspaces=[],workspace=null,leads=[],quotes=[];
function hide(id,yes=true){$(id).classList.toggle('portal-hidden',yes)}
function status(text){$('appStatus').textContent=text}
function cents(input){const x=Number(input);if(!Number.isFinite(x)||x<0||x>99999999)throw Error('Enter a valid ZAR amount.');return Math.round(x*100)}
function selectOptions(el,values,empty){el.replaceChildren();if(empty){const o=document.createElement('option');o.value='';o.textContent=empty;el.append(o)}values.forEach(v=>{const o=document.createElement('option');o.value=v.id;o.textContent=v.label;el.append(o)})}
async function initialize(){
 if(!config.supabaseUrl||!config.supabasePublishableKey){$('connectionNotice').textContent='SETUP REQUIRED: This secure portal has not been connected to the approved Supabase project. The public website and example quote calculator remain operational. No customer records can be stored here yet.';return}
 try{
  const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.95.0');
  db=createClient(config.supabaseUrl,config.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  $('connectionNotice').textContent='Supabase connected. Customer records are accessible only after sign-in and subject to row-level security.';
  db.auth.onAuthStateChange((_event,session)=>{void renderSession(session)});
  const {data,error}=await db.auth.getSession();if(error)throw error;await renderSession(data.session);
 }catch(err){$('connectionNotice').textContent='Connection failed: '+err.message}
}
async function renderSession(session){
 user=session?.user||null;
 hide('authPanel',!!user);hide('workspacePanel',!user);hide('signOut',!user);
 if(!user)return;
 try{await loadWorkspaces()}catch(err){status('Cannot load your workspace: '+err.message)}
}
async function loadWorkspaces(){
 const {data,error}=await db.from('servicepulse_workspaces').select('id,business_name,owner_id,created_at').eq('owner_id',user.id).order('created_at');
 if(error)throw error;
 workspaces=data||[];
 const previous=workspace?.id;
 workspace=workspaces.find(x=>x.id===previous)||workspaces[0]||null;
 selectOptions($('workspaceSelect'),workspaces.map(x=>({id:x.id,label:x.business_name})));
 $('workspaceSelect').value=workspace?.id||'';
 hide('createWorkspace',!!workspace);hide('workspaceContent',!workspace);
 if(workspace)await loadRecords();
}
async function loadRecords(){
 if(!workspace)return;
 const [lr,qr]=await Promise.all([
 db.from('servicepulse_leads').select('id,client_name,service,source,status,inquiry_date').eq('owner_id',user.id).eq('workspace_id',workspace.id).order('inquiry_date',{ascending:false}).limit(500),
 db.from('servicepulse_quotes').select('id,lead_id,quote_number,amount_cents,estimated_cost_cents,status,issued_at').eq('owner_id',user.id).order('issued_at',{ascending:false}).limit(500)
 ]);
 if(lr.error)throw lr.error;if(qr.error)throw qr.error;
 leads=lr.data||[];
 const ids=new Set(leads.map(l=>l.id));quotes=(qr.data||[]).filter(q=>ids.has(q.lead_id));
 $('countLeads').textContent=String(leads.length);
 $('valueQuotes').textContent=format(quotes.filter(q=>q.status==='accepted').reduce((s,q)=>s+q.amount_cents,0)/100);
 $('countFollowups').textContent=String(leads.filter(l=>['new','contacted','quoted'].includes(l.status)).length);
 selectOptions($('leadSelect'),leads.map(l=>({id:l.id,label:l.client_name+' — '+l.service})),'Choose customer enquiry');
 const body=$('privateLeadRows');body.replaceChildren();
 leads.forEach(l=>{
  const tr=document.createElement('tr');
  for(const v of [l.client_name,l.service,l.source]){const cell=document.createElement('td');cell.textContent=v;tr.append(cell)}
  const st=document.createElement('td');st.textContent=l.status;tr.append(st);
  const actions=document.createElement('td'),sel=document.createElement('select');
  ['new','contacted','quoted','won','lost'].forEach(s=>{const op=document.createElement('option');op.value=s;op.textContent=s;sel.append(op)});sel.value=l.status;sel.setAttribute('aria-label','Update status for '+l.client_name);
  sel.addEventListener('change',async()=>{try{const {error}=await db.from('servicepulse_leads').update({status:sel.value}).eq('id',l.id).eq('owner_id',user.id);if(error)throw error;status('Lead updated.');await loadRecords()}catch(e){status(e.message);sel.value=l.status}});
  actions.append(sel);tr.append(actions);body.append(tr);
 });
 const qb=$('privateQuoteRows');qb.replaceChildren();
 quotes.forEach(q=>{
  const tr=document.createElement('tr');
  for(const v of [q.quote_number,format(q.amount_cents/100),format(q.estimated_cost_cents/100),q.status]){const td=document.createElement('td');td.textContent=v;tr.append(td)}
  const td=document.createElement('td'),sel=document.createElement('select');
  ['draft','sent','accepted','declined'].forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;sel.append(o)});sel.value=q.status;
  sel.setAttribute('aria-label','Update quote '+q.quote_number);
  sel.addEventListener('change',async()=>{try{const {error}=await db.from('servicepulse_quotes').update({status:sel.value}).eq('owner_id',user.id).eq('id',q.id);if(error)throw error;status('Quotation updated. Accepted quote value is not settled revenue.');await loadRecords()}catch(e){status(e.message);sel.value=q.status}});
  td.append(sel);tr.append(td);qb.append(tr);
 });
}
async function authAction(type){
 const email=$('authEmail').value.trim(),password=$('authPassword').value;
 if(!email||(!password&&type!=='reset')){$('authStatus').textContent='Enter your email and password.';return}
 try{
  let result;
  if(type==='signin')result=await db.auth.signInWithPassword({email,password});
  if(type==='register')result=await db.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});
  if(type==='reset')result=await db.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});
  if(result.error)throw result.error;
  $('authStatus').textContent=type==='signin'?'Sign-in request completed.':type==='register'?'Registration received. Check your inbox if email verification is enabled.':'If this email is registered, password recovery instructions will be sent.';
 }catch(err){$('authStatus').textContent=err.message}
}
document.addEventListener('DOMContentLoaded',()=>{
 $('authForm').addEventListener('submit',e=>{e.preventDefault();void authAction('signin')});
 $('register').addEventListener('click',()=>void authAction('register'));
 $('resetPassword').addEventListener('click',()=>void authAction('reset'));
 $('signOut').addEventListener('click',async()=>{if(db)await db.auth.signOut();status('Signed out.')});
 $('reload').addEventListener('click',()=>void loadWorkspaces().catch(err=>status(err.message)));
 $('workspaceSelect').addEventListener('change',()=>{workspace=workspaces.find(w=>w.id===$('workspaceSelect').value)||null;void loadRecords().catch(e=>status(e.message))});
 $('workspaceForm').addEventListener('submit',async e=>{e.preventDefault();try{const {error}=await db.from('servicepulse_workspaces').insert({owner_id:user.id,business_name:$('businessName').value.trim()});if(error)throw error;status('Workspace created.');await loadWorkspaces()}catch(err){status(err.message)}});
 $('leadForm').addEventListener('submit',async e=>{e.preventDefault();if(!workspace)return;try{const v=new FormData(e.currentTarget);const {error}=await db.from('servicepulse_leads').insert({owner_id:user.id,workspace_id:workspace.id,client_name:String(v.get('client_name')).trim(),client_email:String(v.get('client_email')||'').trim(),client_phone:String(v.get('client_phone')||'').trim(),service:String(v.get('service')).trim(),source:String(v.get('source')),status:'new'});if(error)throw error;e.currentTarget.reset();status('Enquiry saved to your private workspace.');await loadRecords()}catch(err){status(err.message)}});
 $('quoteForm').addEventListener('submit',async e=>{e.preventDefault();try{const v=new FormData(e.currentTarget),lead=String(v.get('lead'));if(!leads.some(l=>l.id===lead))throw Error('Choose an enquiry from your workspace.');const {error}=await db.from('servicepulse_quotes').insert({owner_id:user.id,lead_id:lead,quote_number:String(v.get('reference')).trim(),amount_cents:cents(v.get('amount')),estimated_cost_cents:cents(v.get('cost')),status:'draft'});if(error)throw error;e.currentTarget.reset();status('Draft quotation saved. No payment has been recorded.');await loadRecords()}catch(err){status(err.message)}});
 void initialize();
});