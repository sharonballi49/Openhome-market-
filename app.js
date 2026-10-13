'use strict';
const samples = [
 {id:'s1',title:'Room to grow in Stone Oak',area:'Stone Oak',zip:'78258',price:459000,beds:4,baths:3,sqft:2460,type:'House',color:0,description:'An imagined San Antonio home with a generous living area, a shaded patio, and room for your next chapter. This is sample content, not a real property for sale.'},
 {id:'s2',title:'A fresh start in Alamo Heights',area:'Alamo Heights',zip:'78209',price:635000,beds:3,baths:2,sqft:2105,type:'House',color:1,description:'An illustrative cottage concept with warm finishes and an inviting front porch. All pricing and property information are fictional.'},
 {id:'s3',title:'Easy living near the city',area:'Southtown',zip:'78210',price:325000,beds:2,baths:2.5,sqft:1540,type:'Townhome',color:2,description:'A fictional townhome concept with open living spaces and a compact courtyard. This example demonstrates how owner listings will appear.'},
 {id:'s4',title:'A little more room to unwind',area:'Helotes',zip:'78023',price:525000,beds:4,baths:3,sqft:2870,type:'House',color:3,description:'An imagined home with generous gathering spaces and an outdoor retreat. Illustration and details are for demonstration only.'},
 {id:'s5',title:'Your own corner of the city',area:'Downtown',zip:'78205',price:279000,beds:2,baths:2,sqft:1195,type:'Condo',color:4,description:'A sample urban condo listing with simple, comfortable spaces. Not an actual property, building, or offer.'},
 {id:'s6',title:'Settle into something special',area:'Alamo Ranch',zip:'78253',price:389000,beds:3,baths:2,sqft:1880,type:'House',color:5,description:'An illustrative home concept with a welcoming entrance and a relaxed layout. No real listing or seller is associated with this example.'}
];
const $ = id => document.getElementById(id);
function read(key,fallback){try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}}
function write(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{toast('Browser storage is unavailable. Changes will last only for this session.');return false;}}
let drafts=read('ohm-drafts-v1',[]); if(!Array.isArray(drafts)) drafts=[];
drafts=drafts.filter(p=>p&&typeof p.id==='string'&&p.draft===true&&['title','area','zip','type','description'].every(k=>typeof p[k]==='string')&&['price','beds','baths','sqft','color'].every(k=>Number.isFinite(p[k])));
let storedSaved=read('ohm-saved-v1',[]);const saved=new Set(Array.isArray(storedSaved)?storedSaved.filter(x=>typeof x==='string'):[]);let savedOnly=false;
const money=n=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
function safe(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function art(index,hero=false){const colors=[['#e7c9a8','#966947'],['#f2e8ce','#537367'],['#c4cdb9','#576c60'],['#ddd0b8','#806a51'],['#e4d7ca','#7e8276'],['#dbb8a0','#835f51']];const [wall,roof]=colors[Math.abs(Math.floor(index))%colors.length];return `<svg viewBox="0 0 700 480" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Illustrated home concept, not a property photograph"><rect width="700" height="480" fill="${hero?'#d6dfcb':'#e4e9dd'}"/><circle cx="546" cy="86" r="50" fill="#f8f0d7"/><path d="M0 302 Q160 208 350 289 T700 249V480H0Z" fill="#b7c4a2"/><path d="M0 379Q350 304 700 357V480H0Z" fill="#92a47e"/><path d="M294 379H408L464 480H240Z" fill="#dfd5c0"/><rect x="115" y="214" width="469" height="170" fill="${wall}"/><path d="M84 223L220 124H424L612 223Z" fill="${roof}"/><path d="M263 246L350 165L440 246" fill="${wall}"/><path d="M253 246L350 153L450 246" fill="none" stroke="${roof}" stroke-width="14"/><rect x="316" y="276" width="64" height="108" rx="2" fill="#446253"/><rect x="329" y="289" width="38" height="55" fill="#b4c4b4"/><circle cx="367" cy="350" r="3" fill="#e6c291"/><g fill="#607d75" stroke="#f4ebd9" stroke-width="8"><rect x="151" y="269" width="76" height="72"/><rect x="468" y="269" width="76" height="72"/></g><g stroke="#f4ebd9" stroke-width="4"><path d="M189 269V341M151 305H227M506 269V341M468 305H544"/></g><rect x="294" y="253" width="9" height="134" fill="#f2e7d0"/><rect x="397" y="253" width="9" height="134" fill="#f2e7d0"/><path d="M55 381V212M630 388V218" stroke="#776e4e" stroke-width="15"/><g fill="#778c63"><ellipse cx="49" cy="220" rx="67" ry="86"/><ellipse cx="649" cy="225" rx="65" ry="95"/></g><g fill="#617953"><ellipse cx="160" cy="382" rx="71" ry="21"/><ellipse cx="505" cy="382" rx="72" ry="21"/></g><g fill="#d1ab72"><circle cx="128" cy="376" r="4"/><circle cx="164" cy="370" r="4"/><circle cx="185" cy="382" r="4"/><circle cx="480" cy="373" r="4"/><circle cx="523" cy="376" r="4"/></g></svg>`;}
function allHomes(){return window.OpenHome?.enabled ? window.OpenHome.homes.filter(p=>p.status==='published') : [...drafts,...samples];}
function homeImage(p){return window.OpenHome?.image(p) || art(p.color||0);}
function selectedHomes(){const q=$('query').value.trim().toLowerCase();return allHomes().filter(p=>(!savedOnly||saved.has(p.id))&&(!q||`${p.title} ${p.area} ${p.zip}`.toLowerCase().includes(q))&&(!$('price').value||p.price<=Number($('price').value))&&p.beds>=Number($('beds').value)&&(!$('type').value||p.type===$('type').value)).sort((a,b)=>$('sort').value==='low'?a.price-b.price:$('sort').value==='high'?b.price-a.price:0);}
function render(){const homes=selectedHomes();$('result-count').textContent=`${homes.length} ${savedOnly?'saved ':''}${window.OpenHome?.enabled?'':'demo '}${homes.length===1?'home':'homes'}`;$('saved-count').textContent=allHomes().filter(p=>saved.has(p.id)).length;$('saved-toggle').setAttribute('aria-pressed',String(savedOnly));$('empty').hidden=homes.length>0;$('grid').innerHTML=homes.map(p=>`<article class="card"><div class="property-art">${homeImage(p)}<span class="badge">${p.draft?'Your private draft':p.owner_id?'Owner listing':'Sample owner listing'}</span><button class="save" data-save="${safe(p.id)}" aria-pressed="${saved.has(p.id)}" aria-label="${saved.has(p.id)?'Unsave':'Save'} ${safe(p.title)}">${saved.has(p.id)?'♥':'♡'}</button></div><div class="card-body"><p class="price">${money(p.price)}</p><h3>${safe(p.title)}</h3><p class="muted">${safe(p.area)} · ${safe(p.zip)}</p><p class="facts">${p.beds} beds &nbsp; · &nbsp; ${p.baths} baths &nbsp; · &nbsp; ${p.sqft.toLocaleString()} sq ft</p><div class="card-bottom"><span>${safe(p.type)} · ${p.photos?.length?'Photos':'Illustration'}</span><button data-detail="${safe(p.id)}">View home ↗</button></div></div></article>`).join('');}
let timer;function toast(message){$('toast').textContent=message;$('toast').hidden=false;clearTimeout(timer);timer=setTimeout(()=>$('toast').hidden=true,4500);}
function showDetail(id){window.OpenHome?.showDetail(id);}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-sell'))window.OpenHome?.openSeller();if(b.dataset.close)$(b.dataset.close).close();if(b.dataset.detail)showDetail(b.dataset.detail);if(b.dataset.save){const id=b.dataset.save;saved.has(id)?saved.delete(id):saved.add(id);write('ohm-saved-v1',[...saved]);render();const replacement=Array.from(document.querySelectorAll('[data-save]')).find(el=>el.dataset.save===id);if(replacement)replacement.focus();else $('saved-toggle').focus();}});
$('filters').addEventListener('submit',e=>{e.preventDefault();render();});['query','price','beds','type','sort'].forEach(id=>$(id).addEventListener(id==='query'?'input':'change',render));
$('saved-toggle').addEventListener('click',()=>{savedOnly=!savedOnly;render();});$('saved-nav').addEventListener('click',()=>{savedOnly=true;$('filters').reset();render();$('homes').scrollIntoView();$('saved-toggle').focus({preventScroll:true});});$('clear').addEventListener('click',()=>{$('filters').reset();$('sort').value='featured';savedOnly=false;render();});
$('hero-art').insertAdjacentHTML('afterbegin',art(0,true));render();

const pricingPackages = {
 featured: {name:'Featured home',price:'$49 / 30 days',summary:'A planned 30-day sponsored placement for your home. Your basic listing stays free. No automatic renewal is planned, and visibility does not guarantee a sale.'},
 marketing: {name:'Seller marketing kit',price:'$99 / one time',summary:'Planned deliverables: polished listing copy, a downloadable property flyer, and social media graphics. Photography, printing, and paid advertising budgets are not included. Delivery timing will be confirmed before launch.'},
 trial: {name:'Founding business trial',price:'Free / 30 days',summary:'A proposed introductory directory profile for contractors, painters, cleaners, landscapers, and movers. A trial would not automatically convert to a paid membership. Applications are not open yet.'},
 directory: {name:'Business directory',price:'$49 / month',summary:'A proposed paid advertising profile with business details, photos, service area, and a website link. Final rates and subscription terms will be confirmed before launch. No leads or jobs are guaranteed. Settlement-service providers require a separately reviewed arrangement.'}
};
['seller','business'].forEach(audience => $(audience+'-pricing-button').addEventListener('click', () => {
 ['seller','business'].forEach(name => { $(name+'-pricing').hidden = name !== audience; $(name+'-pricing-button').setAttribute('aria-pressed',String(name === audience)); });
}));
document.addEventListener('click', event => {
 const button=event.target.closest('[data-plan]');
 if(!button)return;
 const plan=pricingPackages[button.dataset.plan];
 if(!plan)return;
 $('plan-title').textContent=plan.name;
 $('plan-price').textContent=plan.price;
 $('plan-summary').textContent=plan.summary;
 $('plan-detail').showModal();
});

// Lender links stay unavailable until real partner details are configured.
function partnerHttpsUrl(value) {
 try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; }
 catch { return null; }
}
function renderLenders() {
 const configured = Array.isArray(window.OPENHOME_LENDERS) ? window.OPENHOME_LENDERS : [];
 const lenders = configured.filter(partner => partner && typeof partner.name === 'string' && partner.name.trim() && typeof partner.serviceArea === 'string' && partnerHttpsUrl(partner.applicationUrl));
 $('lender-empty').hidden = lenders.length > 0;
 $('lender-list').innerHTML = lenders.map(partner => {
   const url = partnerHttpsUrl(partner.applicationUrl);
   const website = partnerHttpsUrl(partner.website);
   return `<article class="lender-card"><p class="eyebrow">${partner.sponsored === true ? 'SPONSORED LENDER PROFILE' : 'INDEPENDENT LENDER'}</p><h3>${safe(partner.name)}</h3><p>${safe(partner.serviceArea)}</p>${website ? `<a class="lender-website" href="${safe(website)}" target="_blank" rel="noopener noreferrer${partner.sponsored === true ? ' sponsored' : ''}">Visit lender website ↗ <span class="sr-only">(opens a new tab)</span></a>` : ''}<a class="primary lender-apply" href="${safe(url)}" target="_blank" rel="noopener noreferrer${partner.sponsored === true ? ' sponsored' : ''}">View loan options ↗ <span class="sr-only">(opens a new tab on the lender's website)</span></a><p class="small">Opens the lender's website. Eligibility, rates, and approval are determined by the lender.</p></article>`;
 }).join('');
}
renderLenders();
