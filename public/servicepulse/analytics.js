"use strict";
const money=n=>new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0}).format(n);
const node=id=>document.getElementById(id);
let rows=[],mode='demo';
const sources=['Google','Referral','Facebook','Direct','Instagram'];
function sampleData(){
 const result=[];
 for(let i=0;i<80;i++){
  const month=4+Math.floor(i/14),day=1+(i*7%28),date='2026-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const status=['won','quoted','won','lost','new'][i%5],source=sources[(i*7+Math.floor(i/7))%5];
  const quote=500+(i*137%3600),cost=Math.round(quote*(.25+(i%4)*.07));
  result.push({date,client:'Demo client '+String(i+1).padStart(2,'0'),service:['Home clean','Office clean','Deep clean','Windows'][i%4],source,status,quote_amount:quote,cost_amount:cost});
 }
 return result.sort((a,b)=>b.date.localeCompare(a.date));
}
function txt(el,value){el.textContent=value}
function draw(data){
 const wins=data.filter(r=>r.status==='won'), losses=data.filter(r=>r.status==='lost'),won=wins.reduce((s,r)=>s+r.quote_amount,0),cost=wins.reduce((s,r)=>s+r.cost_amount,0),quotes=data.filter(r=>r.status!=='new').reduce((s,r)=>s+r.quote_amount,0);
 txt(node('kpiQuotes'),money(quotes));txt(node('kpiRevenue'),money(won));txt(node('kpiWinRate'),wins.length+losses.length?((wins.length/(wins.length+losses.length))*100).toFixed(1)+'%':'—');txt(node('kpiMargin'),won?((won-cost)/won*100).toFixed(1)+'%':'—');
 const groups=new Map();wins.forEach(r=>groups.set(r.source,(groups.get(r.source)||0)+r.quote_amount));
 const sorted=[...groups].sort((a,b)=>b[1]-a[1]),max=sorted[0]?.[1]||1,barRoot=node('sourceBars');barRoot.replaceChildren();
 if(!sorted.length){txt(barRoot,'No won quotes in this data.');}
 sorted.forEach(([source,value])=>{const row=document.createElement('div');row.className='barrow';const s=document.createElement('span');s.textContent=source;const track=document.createElement('div');track.className='bartrack';const fill=document.createElement('div');fill.className='barfill';fill.style.width=(value/max*100).toFixed(1)+'%';track.append(fill);const v=document.createElement('strong');v.textContent=money(value);row.append(s,track,v);barRoot.append(row)});
 const notes=node('insightList');notes.replaceChildren();
 const observation=[
  ['Records',data.length+' enquiries / quotations analysed.'],
  ['Completed decisions',(wins.length+losses.length)+' won or lost quotes; open leads excluded from win rate.'],
  ['Top source',sorted.length?sorted[0][0]+' generated '+money(sorted[0][1])+' in won quotes.':'No won quotes yet.'],
  ['Estimated gross profit',money(won-cost)+' based only on supplied estimated costs.']
 ];
 observation.forEach(([heading,content])=>{const item=document.createElement('div');item.className='insight-line';const b=document.createElement('strong');b.textContent=heading+': ';item.append(b,document.createTextNode(content));notes.append(item)});
 const table=node('leadRows');table.replaceChildren();
 data.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,15).forEach(r=>{const tr=document.createElement('tr');[r.date,r.client,r.service,r.source,r.status,money(r.quote_amount)].forEach((v,i)=>{const td=document.createElement('td');if(i===4){const sp=document.createElement('span');sp.className='chip';sp.textContent=v;td.append(sp)}else td.textContent=v;tr.append(td)});table.append(tr)});
 txt(node('chartCaption'),mode==='demo'?'Fictional sample values (ZAR).':'Calculated from the CSV imported in this browser (ZAR).');
 txt(node('dataNotice'),mode==='demo'?'DEMO DATA · All figures are fictional and are not ServicePulse revenue. Import a CSV to analyse your own data locally.':'IMPORTED DATA · Calculated locally from your selected CSV. Your rows have not been uploaded or saved on a server.');
}
function csvEncode(fields){return fields.map(v=>{const s=String(v??'');return /[",\n\r]/.test(s)?'"'+s.replaceAll('"','""')+'"':s}).join(',')}
function parseCSV(text){
 const matrix=[],row=[];let cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')quoted=false;else cell+=c}else if(c==='"')quoted=true;else if(c===','){row.push(cell);cell=''}else if(c==='\r'||c==='\n'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))matrix.push(row.slice());row.length=0;cell=''}else cell+=c}
 if(quoted)throw Error('Unclosed CSV quote');row.push(cell);if(row.some(x=>x.trim()))matrix.push(row);return matrix
}
function loadCSV(text){
 const m=parseCSV(text);if(m.length<2)throw Error('The CSV needs a header and at least one data row.');
 const headers=m.shift().map((v,i)=>(i===0?v.replace(/^\uFEFF/,''):v).trim().toLowerCase());
 const needed=['date','client','service','source','status','quote_amount','cost_amount'];
 if(needed.some(k=>!headers.includes(k)))throw Error('Missing required columns: '+needed.filter(k=>!headers.includes(k)).join(', '));
 if(m.length>5000)throw Error('Please import 5,000 rows or fewer.');
 return m.map((values,i)=>{const obj={};headers.forEach((key,j)=>obj[key]=(values[j]||'').trim());const row={date:obj.date,client:obj.client,service:obj.service,source:obj.source,status:obj.status.toLowerCase(),quote_amount:Number(obj.quote_amount),cost_amount:Number(obj.cost_amount)};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||Number.isNaN(Date.parse(row.date)))throw Error('Invalid date on row '+(i+2));
 if(!['new','quoted','won','lost'].includes(row.status))throw Error('Invalid status on row '+(i+2));
 if(!Number.isFinite(row.quote_amount)||row.quote_amount<0||!Number.isFinite(row.cost_amount)||row.cost_amount<0)throw Error('Invalid quote or cost on row '+(i+2));
 if(!row.client||!row.service||!row.source)throw Error('Missing text data on row '+(i+2));
 return row
 });
}
document.addEventListener('DOMContentLoaded',()=>{rows=sampleData();draw(rows);
 node('resetDemo').addEventListener('click',()=>{mode='demo';rows=sampleData();draw(rows);txt(node('loadStatus'),'Sample business data loaded.')});
 node('csvFile').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2*1024*1024)throw Error('CSV is larger than 2 MB');const result=loadCSV(await file.text());rows=result;mode='import';draw(rows);txt(node('loadStatus'),result.length+' records loaded locally.')}catch(err){txt(node('loadStatus'),'Import error: '+err.message)}e.target.value=''});
 node('exportCSV').addEventListener('click',()=>{const fields=['date','client','service','source','status','quote_amount','cost_amount'];const csv=[fields.join(','),...rows.map(r=>csvEncode(fields.map(k=>r[k])))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=mode==='demo'?'servicepulse_SAMPLE_data.csv':'servicepulse_import_export.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
});