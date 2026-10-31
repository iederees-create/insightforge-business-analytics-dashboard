"use strict";
const api=(window.SERVICEPULSE_CONFIG?.supabaseUrl||"")+"/rest/v1/";
const get=id=>document.getElementById(id);
function show(container,title,detail){const row=document.createElement("div");row.className="insight-line";const strong=document.createElement("strong");strong.textContent=title+" — ";row.append(strong,document.createTextNode(detail));container.append(row)}
async function loadPublic(){
 const key=window.SERVICEPULSE_CONFIG?.supabasePublishableKey;
 if(!key){get("liveStatus").textContent="Public key is not configured.";return}
 try{
 const paths=["servicepulse_public_summary?select=*&id=eq.1","servicepulse_public_updates?select=published_on,title,summary,status&published=eq.true&order=published_on.desc&limit=10","servicepulse_public_sources?select=source,enquiries,projects_won&order=enquiries.desc"];
 const result=await Promise.all(paths.map(async p=>{const r=await fetch(api+p,{headers:{apikey:key}});if(!r.ok)throw Error("Database status "+r.status);return r.json()}));
 const stats=result[0][0];if(!stats)throw Error("No data returned");
 get("realEnquiries").textContent=String(stats.enquiries);
 get("realQuotes").textContent=String(stats.quotes_accepted);
 get("realWon").textContent=String(stats.projects_won);
 get("realRevenue").textContent=new Intl.NumberFormat("en-ZA",{style:"currency",currency:"ZAR"}).format(Number(stats.verified_revenue_cents)/100);
 get("liveStatus").textContent="Live public metrics · updated "+new Date(stats.updated_at).toLocaleString("en-ZA");
 const milestones=get("realMilestones"),sources=get("realSources");milestones.replaceChildren();sources.replaceChildren();
 result[1].forEach(x=>show(milestones,x.title,x.summary));
 if(!result[2].length)show(sources,"No recorded channels","Real enquiry sources will appear when the business begins receiving submissions.");
 result[2].forEach(x=>show(sources,x.source,x.enquiries+" enquiries, "+x.projects_won+" won"));
 }catch(e){get("liveStatus").textContent="Could not load public metrics: "+e.message}
}
document.addEventListener("DOMContentLoaded",loadPublic);
