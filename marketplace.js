'use strict';
(() => {
 const config = window.OPENHOME_CONFIG || {};
 const enabled = config.enabled === true;
 let client, user = null, homes = [], editing = null, photos = [], photoBusy = false, saving = false, inquiryId = null, signInEmail = '', loadVersion = 0;
 const bucket = 'home-photos';
 const fields = ['title','area','zip','price','beds','baths','sqft','type','description'];
 const photoUrl = p => typeof p === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p) ? p : typeof p?.url === 'string' && p.url.startsWith(config.supabaseUrl + '/storage/v1/') ? p.url : null;
 const image = p => { const src = photoUrl(p.photos?.[0]); return src ? `<img src="${safe(src)}" alt="${safe(p.title)}" loading="lazy">` : null; };
 const errorText = error => error?.message || 'Something went wrong. Please try again.';
 const findHome = id => [...drafts,...homes,...samples].find(p => p.id === id);
 function modal(id) { if (!$(id).open) $(id).showModal(); }
 function statusLabel(p) { return p.draft ? 'Private draft · this device' : ({pending:'Awaiting review',published:'Published',archived:'Withdrawn'})[p.status] || 'Draft'; }
 function drawPhotos() {
  $('photo-preview').innerHTML = photos.map((p,i) => `<div class="photo-tile"><img src="${safe(photoUrl(p)||'')}" alt="Photo ${i+1}"><span>${i===0?'Cover photo':`Photo ${i+1}`}</span>${i?`<button type="button" data-cover="${i}">Make cover</button>`:''}<button type="button" data-remove-photo="${i}">Remove</button></div>`).join('');
 }
 function openSeller(id) {
  if (enabled && !user) { $('dashboard').close(); modal('auth-dialog'); return; }
  const home = id ? findHome(id) : null;
  if (id && (!home || (enabled && home.owner_id !== user?.id))) return;
  editing = home; photos = [...(home?.photos || [])]; $('seller-form').reset();
  for (const field of fields) if (home) $('seller-form').elements[field].value = home[field];
  $('seller-title').textContent = home ? 'Make your home shine.' : 'Tell us about your home.';
  $('seller-intro').textContent = enabled ? 'Submit your home for review. Approved listings can be seen by buyers. Changes to a published listing need a new review.' : 'Your private draft and photos stay on this device. Nothing is published or sent.';
  $('publish-consent').hidden = !enabled; $('seller-form').elements.consent.required = enabled;
  $('save-listing').textContent = enabled ? 'Submit for review' : 'Save private draft';
  $('seller-error').textContent = ''; $('photo-status').textContent = ''; drawPhotos();
  $('dashboard').close(); $('detail').close(); modal('seller');
 }
 function showDetail(id) {
  const p = findHome(id); if (!p) return;
  const own = p.draft || (user && p.owner_id === user.id);
  $('detail-content').innerHTML = `<div class="detail-art" id="detail-photo">${image(p)||art(p.color||0)}</div>${p.photos?.length>1?`<div class="detail-gallery" aria-label="Home photos">${p.photos.map((photo,i)=>photoUrl(photo)?`<button data-gallery="${safe(p.id)}" data-photo-index="${i}" aria-label="View photo ${i+1}"><img src="${safe(photoUrl(photo))}" alt="Photo ${i+1}"></button>`:'').join('')}</div>`:''}<p class="eyebrow">${own?safe(statusLabel(p)):p.owner_id?'OWNER LISTING':'ILLUSTRATIVE SAMPLE · NOT FOR SALE'}</p><h2>${safe(p.title)}</h2><p class="price">${money(p.price)}</p><p>${safe(p.area)}, ${safe(p.zip)} · ${safe(p.type)}</p><p class="facts">${p.beds} beds · ${p.baths} baths · ${p.sqft.toLocaleString()} sq ft</p><p class="detail-description">${safe(p.description)}</p>${own?`<button class="primary" data-edit="${safe(p.id)}">Edit listing</button>`:enabled&&p.status==='published'?`<button class="primary" data-inquire="${safe(p.id)}">Ask the owner ↗</button><p class="small">Your name and account email are shared only when you send an inquiry.</p>`:'<div class="notice"><strong>This home is a preview.</strong><p>Buyer inquiries are available only for real published listings after the marketplace launches.</p></div>'}`;
  modal('detail');
 }
 function drawDashboard() {
  const mine = enabled ? homes.filter(p=>p.owner_id===user?.id) : drafts;
  $('dashboard-intro').textContent = enabled ? user ? `Signed in as ${user.email}. Manage your homes and check buyer inquiries here.` : 'Sign in to manage your homes and view buyer inquiries.' : 'Your private workspace. Drafts and photos are saved only in this browser; clearing browser data removes them. Public submissions are not open yet.';
  $('account-button').hidden = !enabled; $('account-button').textContent = user ? 'Sign out' : 'Sign in';
  $('inbox').hidden = !enabled || !user;
  $('dashboard-list').innerHTML = mine.length ? mine.map(p=>`<article class="workspace-card"><div class="workspace-thumb">${image(p)||art(p.color||0)}</div><div class="workspace-info"><span class="status-tag">${safe(statusLabel(p))}</span><h3>${safe(p.title)}</h3><span class="muted">${money(p.price)} · ${safe(p.area)}</span><div class="form-actions"><button class="outline" data-edit="${safe(p.id)}">Edit</button>${p.draft?`<button class="outline" data-export="${safe(p.id)}">Download backup</button><button class="danger" data-remove-draft="${safe(p.id)}">Delete</button>`:p.status!=='archived'?`<button class="outline" data-withdraw="${safe(p.id)}">Withdraw</button>`:''}</div></div></article>`).join('') : '<div class="empty"><h3>A fresh start for your next move.</h3><p>Add your first home to get started.</p></div>';
 }
 async function refresh() {
  const generation = ++loadVersion;
  if (!enabled) { render(); drawDashboard(); return; }
  $('dashboard-error').textContent = '';
  try {
   if (!client) throw new Error('Account connection is not ready. Please try again later.');
   const {data,error} = await client.from('listings').select('*').order('created_at',{ascending:false}).limit(1000);
   if (error) throw error;
   const next = data || [];
   const paths = next.flatMap(p=>p.photos||[]);
   let links = [];
   if (paths.length) {
    const signed = await client.storage.from(bucket).createSignedUrls(paths,3600);
    if (signed.error) throw signed.error;
    links = signed.data || [];
   }
   if (generation !== loadVersion) return;
   homes = next.map(p=>({...p,color:0,photos:(p.photos||[]).map(path=>({path,url:links.find(l=>l.path===path)?.signedUrl||''}))}));
   window.OpenHome.homes = homes; render(); drawDashboard();
   if (user) {
    const inbox = await client.from('inquiries').select('id,listing_id,buyer_name,buyer_email,message,created_at').eq('seller_id',user.id).order('created_at',{ascending:false}).limit(200);
    if (generation !== loadVersion) return;
    if (inbox.error) throw inbox.error;
    $('inbox-list').innerHTML = inbox.data.length ? inbox.data.map(m=>`<article class="inquiry-card"><p class="eyebrow">${safe(findHome(m.listing_id)?.title||'Property inquiry')}</p><h3>${safe(m.buyer_name)}</h3><p class="small">${safe(new Date(m.created_at).toLocaleString())}</p><p>${safe(m.message)}</p><a class="outline" href="mailto:${safe(encodeURIComponent(m.buyer_email))}?subject=${encodeURIComponent('Your OpenHome inquiry')}">Reply by email ↗</a></article>`).join('') : '<p class="muted">No buyer inquiries yet.</p>';
   } else $('inbox-list').innerHTML = '';
  } catch (error) { if (generation===loadVersion) { $('dashboard-error').textContent=errorText(error); toast('Could not refresh marketplace data. Please try again.'); } }
 }
 async function resizePhoto(file) {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Please choose JPG, PNG, or WebP photos.');
  if (file.size>10*1024*1024) throw new Error('Each photo must be 10 MB or smaller.');
  const bitmap = await createImageBitmap(file);
  try {
   if (bitmap.width*bitmap.height>60000000) throw new Error('This photo is too large. Choose a smaller version.');
   const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas'); canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
   return canvas.toDataURL('image/jpeg',.76);
  } finally { bitmap.close(); }
 }
 $('home-photos').addEventListener('change',async event=>{
  const files=Array.from(event.target.files||[]); if (!files.length) return;
  if (photos.length+files.length>6) { $('photo-status').textContent='Choose up to 6 photos in total.';event.target.value='';return; }
  photoBusy=true; $('save-listing').disabled=true;event.target.disabled=true;$('photo-status').textContent='Preparing your photos…';
  try { const added=[];for(const file of files) added.push(await resizePhoto(file));photos.push(...added);drawPhotos();$('photo-status').textContent=`${photos.length} photos ready. The first is your cover.`; }
  catch(error){$('photo-status').textContent=errorText(error);}
  finally {photoBusy=false;$('save-listing').disabled=false;event.target.disabled=false;event.target.value='';}
 });
 $('seller-form').addEventListener('submit',async event=>{
  event.preventDefault(); if (photoBusy||saving) return;
  const form=event.target; if(!form.reportValidity()) return;
  const values=Object.fromEntries(fields.map(k=>[k,form.elements[k].value.trim()]));
  for(const k of ['price','beds','baths','sqft']) values[k]=Number(values[k]);
  if(!values.title||!values.area||!values.description){$('seller-error').textContent='Please complete the title, neighborhood, and description.';return;}
  saving=true;$('save-listing').disabled=true;$('seller-error').textContent='';
  const uploaded=[]; let committed=false;
  try {
   if (enabled) {
    if(!user||!client)throw new Error('Please sign in again before saving.');
    if(!photos.length)throw new Error('Add at least one photo before submitting your home.');
    const id=editing?.id||crypto.randomUUID(), paths=[];
    for (const photo of photos) {
     if (typeof photo==='object'&&photo.path) {paths.push(photo.path);continue;}
     const blob=await (await fetch(photo)).blob();
     const path=`${user.id}/${id}/${crypto.randomUUID()}.jpg`;
     const result=await client.storage.from(bucket).upload(path,blob,{contentType:'image/jpeg',upsert:false});
     if(result.error)throw result.error;uploaded.push(path);paths.push(path);
    }
    const row={...values,photos:paths,status:'pending'};
    const result=editing ? await client.from('listings').update(row).eq('id',id).eq('owner_id',user.id).select('id').single() : await client.from('listings').insert({...row,id,owner_id:user.id}).select('id').single();
    if(result.error)throw result.error;committed=true;
    const removed=(editing?.photos||[]).filter(p=>p.path&&!paths.includes(p.path)).map(p=>p.path);
    if(removed.length)await client.storage.from(bucket).remove(removed);
   } else {
    const row={...values,id:editing?.id||'d-'+crypto.randomUUID(),photos:[...photos],draft:true,color:editing?.color||0};
    const next=[row,...drafts.filter(p=>p.id!==row.id)];
    try{localStorage.setItem('ohm-drafts-v1',JSON.stringify(next));}catch{throw new Error('This browser could not save the draft. Try fewer photos, remove an older draft, or enable browser storage. Your form is still here.');}
    drafts=next;
   }
   $('seller').close();await refresh();modal('dashboard');toast(enabled?'Submitted for review. Your listing is not public yet.':'Private draft saved on this device.');
  } catch(error){ if(uploaded.length&&!committed)await client.storage.from(bucket).remove(uploaded);$('seller-error').textContent=errorText(error); }
  finally{saving=false;$('save-listing').disabled=false;}
 });
 // Prevent closing a form mid-save; its values and photos must remain attached to the same listing.
 $('seller').addEventListener('cancel',event=>{if(saving||photoBusy)event.preventDefault();});
 $('seller').addEventListener('click',event=>{if((saving||photoBusy)&&event.target.closest('[data-close]')){event.stopPropagation();event.preventDefault();}});
 document.addEventListener('click',async event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.dataset.edit)openSeller(b.dataset.edit);
  if(b.dataset.removePhoto!==undefined&&!photoBusy&&!saving){photos.splice(Number(b.dataset.removePhoto),1);drawPhotos();}
  if(b.dataset.cover!==undefined&&!photoBusy&&!saving){photos.unshift(photos.splice(Number(b.dataset.cover),1)[0]);drawPhotos();}
  if(b.dataset.gallery){const home=findHome(b.dataset.gallery),src=photoUrl(home?.photos?.[Number(b.dataset.photoIndex)]);if(src)$('detail-photo').innerHTML=`<img src="${safe(src)}" alt="${safe(home.title)}">`;}
  if(b.dataset.removeDraft){
   if(!confirm('Delete this private draft and its photos from this browser?'))return;
   const next=drafts.filter(p=>p.id!==b.dataset.removeDraft);
   try{localStorage.setItem('ohm-drafts-v1',JSON.stringify(next));drafts=next;saved.delete(b.dataset.removeDraft);write('ohm-saved-v1',[...saved]);await refresh();}catch{$('dashboard-error').textContent='Could not delete the draft. Browser storage is unavailable.';}
  }
  if(b.dataset.export){const home=findHome(b.dataset.export);if(!home?.draft)return;const url=URL.createObjectURL(new Blob([JSON.stringify(home,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='openhome-draft-'+home.id+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  if(b.dataset.withdraw){
   if(!confirm('Withdraw this home from public search?'))return;b.disabled=true;
   try{const result=await client.from('listings').update({status:'archived'}).eq('id',b.dataset.withdraw).eq('owner_id',user.id).select('id').single();if(result.error)throw result.error;await refresh();}catch(error){$('dashboard-error').textContent=errorText(error);b.disabled=false;}
  }
  if(b.dataset.inquire){
   if(!user){$('detail').close();modal('auth-dialog');return;}
   inquiryId=b.dataset.inquire;$('inquiry-home').textContent=findHome(inquiryId)?.title||'';$('inquiry-form').reset();$('inquiry-status').textContent='';$('detail').close();modal('inquiry-dialog');
  }
 });
 $('my-listings').addEventListener('click',()=>{drawDashboard();modal('dashboard');refresh();});
 $('dashboard-new').addEventListener('click',()=>openSeller());
 $('refresh-dashboard').addEventListener('click',refresh);
 $('account-button').addEventListener('click',async()=>{
  if(!user){$('dashboard').close();modal('auth-dialog');return;}
  const {error}=await client.auth.signOut();if(error){$('dashboard-error').textContent=errorText(error);return;}
  user=null;homes=[];window.OpenHome.homes=[];$('inbox-list').innerHTML='';drawDashboard();render();await refresh();
 });
 $('auth-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!client)return;const button=$('send-code');button.disabled=true;
  signInEmail=event.target.elements.email.value.trim();$('auth-status').textContent='Sending your code…';
  try{const {error}=await client.auth.signInWithOtp({email:signInEmail});if(error)throw error;$('verify-form').hidden=false;$('auth-status').textContent='Check your email for the code. You can request a new one after a minute.';$('verify-form').elements.token.focus();}catch(error){$('auth-status').textContent=errorText(error);}finally{button.disabled=false;}
 });
 $('verify-form').addEventListener('submit',async event=>{
  event.preventDefault();const b=event.target.querySelector('button');b.disabled=true;
  try{const {data,error}=await client.auth.verifyOtp({email:signInEmail,token:event.target.elements.token.value.trim(),type:'email'});if(error)throw error;user=data.user;$('auth-dialog').close();$('verify-form').hidden=true;event.target.reset();await refresh();modal('dashboard');}catch(error){$('auth-status').textContent=errorText(error);}finally{b.disabled=false;}
 });
 $('inquiry-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.target,button=form.querySelector('button');if(button.disabled)return;button.disabled=true;$('inquiry-status').textContent='Sending…';
  try{if(!user)throw new Error('Please sign in again.');const {error}=await client.rpc('send_inquiry',{home_id:inquiryId,sender_name:form.elements.buyer_name.value.trim(),body:form.elements.message.value.trim()});if(error)throw error;form.reset();$('inquiry-dialog').close();toast('Inquiry delivered to the seller’s dashboard. They can reply by email.');}catch(error){$('inquiry-status').textContent=errorText(error);}finally{button.disabled=false;}
 });
 window.OpenHome={enabled,homes,image,openSeller,showDetail};
 async function init(){
  if(enabled){
   document.querySelector('.demo').textContent='OPENHOME MARKET · Owner-listed homes in San Antonio';
   document.querySelector('footer .small').textContent='Listings are provided by owners. Saved homes stay in this browser. Paid upgrades are not available yet.';
   try{
    if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)||!config.supabasePublishableKey)throw new Error('Marketplace connection is not configured.');
    client=window.supabase.createClient(config.supabaseUrl,config.supabasePublishableKey);
    const {data,error}=await client.auth.getSession();if(error)throw error;user=data.session?.user||null;
    client.auth.onAuthStateChange((event,session)=>{const changed=user?.id!==session?.user?.id;user=session?.user||null;if(changed){homes=[];window.OpenHome.homes=[];$('inbox-list').innerHTML='';setTimeout(refresh,0);}});
   }catch(error){$('dashboard-error').textContent=errorText(error);document.querySelector('.demo').textContent='Marketplace temporarily unavailable · Please try again later';}
  }
  await refresh();
 }
 init();
})();
