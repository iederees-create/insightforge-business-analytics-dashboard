"use strict";
const ZAR=new Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR',maximumFractionDigits:0});
const waNumber='27845272182'; // Previous public contact number. Verify ownership before promotion.
const el=id=>document.getElementById(id);
const fmt=x=>ZAR.format(x);
const fields=['property','frequency','rooms','baths','area','deep','windows','oven'];
function integer(id,max){const n=Number(el(id).value);return Number.isFinite(n)?Math.min(max,Math.max(0,Math.floor(n))):0}
function estimate(){
 const property=el('property').value,frequency=el('frequency').value;
 const area=integer('area',500),rooms=integer('rooms',12),baths=integer('baths',10);
 const base={apartment:230,house:310,office:350}[property];
 const space=Math.max(0,area-60)*2.25,roomCost=rooms*35,bathCost=baths*65;
 const extras=[['Deep clean',el('deep').checked?260:0],['Interior windows',el('windows').checked?120:0],['Oven cleaning',el('oven').checked?140:0]].filter(x=>x[1]);
 const before=base+space+roomCost+bathCost+extras.reduce((s,x)=>s+x[1],0);
 const discount={once:0,weekly:.12,biweekly:.07}[frequency];
 const total=Math.round(before*(1-discount));
 el('areaValue').textContent=String(area);
 el('estimateTotal').textContent=fmt(total);el('estimateTotalSmall').textContent=fmt(total);
 const list=[['Base service',base],['Area adjustment',space],['Bedrooms & bathrooms',roomCost+bathCost],...extras];
 if(discount)list.push(['Frequency discount',-Math.round(before*discount)]);
 const root=el('estimateBreakdown');root.replaceChildren();
 list.forEach(([name,value])=>{const row=document.createElement('div');const label=document.createElement('span');const amount=document.createElement('strong');label.textContent=name;amount.textContent=(value<0?'-':'')+fmt(Math.abs(value));row.append(label,amount);root.append(row)});
 return {property,frequency,area,rooms,baths,extras,total};
}
function whatsappMessage(text){window.open('https://wa.me/'+waNumber+'?text='+encodeURIComponent(text),'_blank','noopener,noreferrer')}
function init(){
 el('year').textContent=new Date().getFullYear();
 fields.forEach(id=>el(id).addEventListener('input',estimate));
 estimate();
 el('shareEstimate').addEventListener('click',()=>{const q=estimate();whatsappMessage('ServicePulse SA quote calculator example (not a booking):\nProperty: '+q.property+'\nArea: '+q.area+' m²\nBedrooms: '+q.rooms+'; bathrooms: '+q.baths+'\nFrequency: '+q.frequency+'\nExtras: '+(q.extras.map(x=>x[0]).join(', ')||'None')+'\nIndicative estimate: '+fmt(q.total)+'\nThis is an illustrative price only.')});
 const menu=el('menuToggle'),nav=el('navlinks');menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open))});nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');menu.setAttribute('aria-expanded','false')}));
 document.querySelectorAll('[data-plan]').forEach(a=>a.addEventListener('click',()=>{const chosen=a.dataset.plan;document.querySelector('select[name="plan"]').value=chosen}));
 el('contactForm').addEventListener('submit',event=>{event.preventDefault();const form=event.currentTarget;if(!form.reportValidity())return;const v=new FormData(form);const msg=['ServicePulse SA new business enquiry','Name: '+v.get('name'),'Business: '+v.get('business'),'Contact: '+v.get('phone'),'Package: '+v.get('plan'),'Message: '+(v.get('message')||'Not supplied')].join('\n');el('contactStatus').textContent='WhatsApp is opening. Please review and send your message there to complete your enquiry.';whatsappMessage(msg)});
}
document.addEventListener('DOMContentLoaded',init);