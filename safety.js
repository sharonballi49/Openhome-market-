'use strict';
(() => {
 const api=()=>window.OpenHome, live=()=>api()?.enabled===true;
 const demoSeller='demo-seller',demoBuyer='demo-buyer';
 let moderator=false,pilot=false,tab='pending',threads=[],reports=[],reviews=[],queue=[],activeThread=null,threadMessages=[],threadState={},reviewHome=null,reportTarget=null,resolving=null,epoch=0,threadEpoch=0;
 const demoQueue=samples.slice(0,2).map((p,i)=>({...p,id:'review-'+i,status:'pending',revision:1,owner_id:'demo-owner-'+i}));
 const demoThreads=[{id:'demo-thread',listing_id:'s1',seller_id:demoSeller,buyer_id:demoBuyer,buyer_name:'Demo buyer',created_at:new Date().toISOString()}];
 const demoMessages=[{id:'demo-message',thread_id:'demo-thread',sender_id:demoBuyer,body:'Hello! Would a weekend showing be possible?',created_at:new Date().toISOString()}];
 const demoReports=[];const demoReviews=[];let demoBlocked=false;
 const labels={suspected_scam:'Suspected scam',not_authorized:'Seller authority concern',inaccurate_listing:'Incorrect listing',harassment:'Unwanted contact',other:'Other concern'};
 const me=()=>live()?api()?.user?.id:demoSeller;
 const errorText=e=>e?.message||'Could not complete this action. Please try again.';
 function modal(id){if(!$(id).open)$(id).showModal();}
 async function rpc(name,args){const {data,error}=await api().client.rpc(name,args);if(error)throw error;return data;}
 function clear(){
  epoch++;threadEpoch++;moderator=false;pilot=false;threads=[];reports=[];reviews=[];queue=[];activeThread=null;threadMessages=[];threadState={};reviewHome=null;reportTarget=null;resolving=null;
  for(const id of ['moderation','review-home','conversation','report-dialog','resolve-report'])$(id).close();
  for(const id of ['inbox-list','moderation-list','review-summary','conversation-messages','report-evidence'])$(id).textContent='';
  for(const id of ['review-form','report-form','resolve-form','reply-form'])$(id).reset();
  $('moderation-open').hidden=true;
 }
 async function canSell(){if(!live())return true;if(!api().user)return false;try{pilot=await rpc('is_pilot_seller');return pilot===true;}catch{return false;}}
 function drawInbox(){
  $('inbox').hidden=live()&&!api().user;
  $('inbox-list').innerHTML=threads.length?threads.map(t=>`<article class="inquiry-card"><p class="eyebrow">${live()?'PRIVATE CONVERSATION':'INTERACTIVE DEMO'}</p><h3>${safe(api().findHome(t.listing_id)?.title||'Property conversation')}</h3><p class="small">With ${safe(t.seller_id===me()?t.buyer_name:'the seller')} · Account emails stay private</p><button class="outline" data-thread="${safe(t.id)}">Open conversation ↗</button></article>`).join(''):'<p class="muted">No conversations yet. Inquiries and replies will appear here.</p>';
 }
 function drawModeration(){
  $('moderation-mode').textContent=live()?'Only authorized moderators can review this queue. Checks must be completed outside the website before you record approval.':'Interactive demo · Fictional listings and messages. No approval, block, or report here changes a real account.';
  document.querySelectorAll('[data-review-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.reviewTab===tab)));
  const target=$('moderation-list');
  if(tab==='pending')target.innerHTML=queue.filter(p=>p.status==='pending').map(p=>`<article class="workspace-card"><div class="workspace-thumb">${api().image(p)||art(p.color||0)}</div><div class="workspace-info"><span class="status-tag">${live()?'Awaiting review':'Demo · awaiting review'}</span><h3>${safe(p.title)}</h3><p class="muted">${safe(p.area)} · ${money(p.price)}</p><button class="outline" data-review-home="${safe(p.id)}">Review listing</button></div></article>`).join('')||'<div class="empty"><h3>All caught up.</h3><p>No listings are waiting for review.</p></div>';
  if(tab==='reports')target.innerHTML=reports.filter(r=>r.status==='open').map(r=>`<article class="inquiry-card"><span class="status-tag">${r.message_id?'Message report':'Listing report'}</span><h3>${safe(labels[r.category]||r.category)}</h3><p>${safe(r.details)}</p><button class="outline" data-resolve="${safe(r.id)}">Review report</button></article>`).join('')||'<div class="empty"><h3>No open reports.</h3><p>Reported listings and messages appear here for review.</p></div>';
  if(tab==='history')target.innerHTML=[...reviews.map(r=>`<article class="inquiry-card"><span class="status-tag">${safe(r.decision)}</span><h3>${safe(queue.find(p=>p.id===r.listing_id)?.title||'Listing review')}</h3><p>${safe(r.note)}</p></article>`),...reports.filter(r=>r.status==='resolved').map(r=>`<article class="inquiry-card"><span class="status-tag">Report resolved</span><h3>${safe(labels[r.category]||r.category)}</h3><p>${safe(r.resolution)}</p></article>`)].join('')||'<p class="muted">Review decisions and resolved reports will appear here.</p>';
 }
 async function refresh(){
  const generation=++epoch;$('moderation-error').textContent='';
  $('moderation-demo').hidden=live();$('try-messages').textContent=live()?'Open my messages':'Preview private messages';
  try{
   if(!live()){moderator=true;pilot=false;threads=demoThreads;reports=demoReports;reviews=demoReviews;queue=demoQueue;}
   else if(!api().user){clear();drawInbox();return;}
   else{
    const client=api().client;
    const results=await Promise.all([client.rpc('is_moderator'),client.rpc('is_pilot_seller'),client.from('inquiries').select('id,listing_id,seller_id,buyer_id,buyer_name,created_at').order('created_at',{ascending:false}).limit(200)]);
    if(generation!==epoch)return;
    for(const r of results)if(r.error)throw r.error;
    moderator=results[0].data===true;pilot=results[1].data===true;threads=results[2].data||[];
    if(moderator){
     const result=await Promise.all([client.from('listings').select('*').eq('status','pending').order('created_at').limit(200),client.from('safety_reports').select('*').eq('status','open').order('created_at').limit(200),client.from('listing_reviews').select('*').order('created_at',{ascending:false}).limit(200),client.from('safety_reports').select('*').eq('status','resolved').order('resolved_at',{ascending:false}).limit(50)]);
     if(generation!==epoch)return;for(const r of result)if(r.error)throw r.error;
     queue=result[0].data;reports=[...result[1].data,...result[3].data];reviews=result[2].data;
    }else{const ownReviews=await client.from('listing_reviews').select('listing_id,decision,note,created_at').order('created_at',{ascending:false}).limit(200);if(generation!==epoch)return;if(ownReviews.error)throw ownReviews.error;queue=[];reports=[];reviews=ownReviews.data;reviewHome=null;for(const id of ['moderation','review-home','resolve-report'])$(id).close();for(const id of ['moderation-list','review-summary','report-evidence'])$(id).textContent='';}
   }
   $('moderation-open').hidden=!live()||!moderator;drawInbox();
   document.querySelectorAll('[data-own-listing]').forEach(card=>{card.querySelector('.review-feedback')?.remove();const r=reviews.find(r=>r.listing_id===card.dataset.ownListing);if(r)card.querySelector('.workspace-info').insertAdjacentHTML('beforeend',`<p class="review-feedback notice"><strong>Review feedback:</strong> ${safe(r.note)}</p>`);});if(moderator)drawModeration();
  }catch(error){if(generation===epoch){moderator=false;$('moderation-open').hidden=true;$('moderation-error').textContent=errorText(error);$('dashboard-error').textContent='Could not refresh messages or review access. Please try again.';}}
 }
 async function openReview(id){
  if(!moderator)return;reviewHome=queue.find(p=>p.id===id);if(!reviewHome)return;
  const selected=reviewHome;let details={claimant_name:'Demo seller',property_address:'Fictional property — no real address',county:'Bexar',relationship:'owner',record_reference:'Demo record only'},photoMarkup=art(selected.color||0);
  $('review-error').textContent='';$('review-form').reset();
  try{
   if(live()){
    const r=await api().client.from('listing_verification').select('*').eq('listing_id',id).maybeSingle();if(r.error)throw r.error;details=r.data;
    const photos=await api().client.storage.from('home-photos').createSignedUrls(selected.photos||[],3600);if(photos.error)throw photos.error;
    photoMarkup=(photos.data||[]).map(p=>p.signedUrl?`<img src="${safe(p.signedUrl)}" alt="Seller submitted property photo">`:'').join('');
   }
   if(selected!==reviewHome||!moderator)return;
   $('review-title').textContent=selected.title;
   $('review-summary').innerHTML=`<p>${safe(selected.area)} · ${money(selected.price)}</p><p class="detail-description">${safe(selected.description)}</p><div class="review-photos">${photoMarkup}</div>${details?`<dl class="verification-details"><dt>Claimant</dt><dd>${safe(details.claimant_name)}</dd><dt>Private property address</dt><dd>${safe(details.property_address)}</dd><dt>County</dt><dd>${safe(details.county)}</dd><dt>Relationship</dt><dd>${safe(details.relationship.replaceAll('_',' '))}</dd><dt>Record reference</dt><dd>${safe(details.record_reference||'Not supplied')}</dd></dl>`:'<p class="form-error">Private verification details are missing. Return this listing to the seller.</p>'}`;
   $('moderation').close();modal('review-home');
  }catch(e){$('moderation-error').textContent=errorText(e);}
 }
 async function openThread(id,reset=true){
  const t=threads.find(t=>t.id===id);if(!t)return;
  activeThread=t;const generation=++threadEpoch;$('conversation-status').textContent='Loading messages…';$('reply-form').querySelector('button').disabled=true;$('block-contact').disabled=true;
  if(reset)$('reply-form').reset();$('dashboard').close();modal('conversation');
  try{
   if(live()){
    const result=await Promise.all([api().client.from('messages').select('id,thread_id,sender_id,body,created_at').eq('thread_id',id).order('created_at',{ascending:false}).limit(200),api().client.rpc('thread_state',{conversation_id:id})]);
    if(generation!==threadEpoch)return;for(const r of result)if(r.error)throw r.error;threadMessages=result[0].data.reverse();threadState=result[1].data;
   }else{threadMessages=demoMessages.filter(m=>m.thread_id===id);threadState={blocked_by_me:demoBlocked,messaging_blocked:demoBlocked};}
   $('conversation-title').textContent=api().findHome(t.listing_id)?.title||'Property conversation';
   $('conversation-mode').textContent=live()?'Messages are visible to the participants. Reporting shares the selected message with moderators. No email notifications are sent.':'Interactive demo · Messages stay in this preview. No person is contacted.';
   $('conversation-status').textContent=threadState.messaging_blocked?'Messaging is paused for this contact. Existing messages remain available to review or report.':'';
   $('conversation-messages').innerHTML=threadMessages.map(m=>`<article class="message-bubble ${m.sender_id===me()?'message-mine':''}"><span>${m.sender_id===me()?'You':safe(t.seller_id===me()?t.buyer_name:'Seller')}</span><p>${safe(m.body)}</p><div class="message-meta"><time>${safe(new Date(m.created_at).toLocaleString())}</time>${m.sender_id!==me()?`<button class="plain" data-report-message="${safe(m.id)}">Report</button>`:''}</div></article>`).join('');
   $('block-contact').textContent=threadState.blocked_by_me?'Unblock contact':'Block contact';$('block-contact').disabled=false;
   $('reply-form').elements.body.disabled=threadState.messaging_blocked;$('reply-form').querySelector('button').disabled=threadState.messaging_blocked;
  }catch(e){if(generation===threadEpoch){$('conversation-status').textContent=errorText(e);$('conversation-messages').textContent='';}}
 }
 function openReport(target){
  if(live()&&!api().user){$('detail').close();modal('auth-dialog');toast('Sign in, then reopen the item to report it.');return;}
  reportTarget=target;$('report-form').reset();$('report-error').textContent='';$('report-mode').textContent=live()?'Your concern will go to the OpenHome moderation team.':'Demo report · No real report will be submitted. You can review the example in the demo dashboard.';
  $('detail').close();$('conversation').close();modal('report-dialog');
 }
 $('review-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!reviewHome||!moderator)return;const f=event.target,b=f.querySelector('button');if(b.disabled)return;
  const decision=f.elements.decision.value,identity=f.elements.identity.checked,authority=f.elements.authority.checked,note=f.elements.note.value.trim();
  if(decision==='published'&&(!identity||!authority)){$('review-error').textContent='Complete both identity and authority checks before approving.';return;}
  if(note.length<5){$('review-error').textContent='Add a review note.';return;}b.disabled=true;
  try{
   if(live())await rpc('review_listing',{home_id:reviewHome.id,expected_revision:reviewHome.revision,decision,review_note:note,identity_checked:identity,authority_checked:authority});
   else{demoReviews.unshift({listing_id:reviewHome.id,decision,note});reviewHome.status=decision;reviewHome.revision++;}
   $('review-home').close();await api().refresh();modal('moderation');toast(live()?'Review decision saved.':'Demo decision saved. No real listing was changed.');
  }catch(e){$('review-error').textContent=errorText(e);}finally{b.disabled=false;}
 });
 $('reply-form').addEventListener('submit',async event=>{
  event.preventDefault();const f=event.target,b=f.querySelector('button');if(b.disabled||!activeThread)return;const body=f.elements.body.value.trim();if(!body)return;b.disabled=true;
  try{if(live())await rpc('send_message',{conversation_id:activeThread.id,message_body:body});else{if(demoBlocked)throw Error('Unblock the contact before sending.');demoMessages.push({id:'demo-'+crypto.randomUUID(),thread_id:activeThread.id,sender_id:me(),body,created_at:new Date().toISOString()});}f.reset();await openThread(activeThread.id,false);}catch(e){$('conversation-status').textContent=errorText(e);b.disabled=!!threadState.messaging_blocked;}
 });
 $('block-contact').addEventListener('click',async()=>{
  if(!activeThread)return;const button=$('block-contact');button.disabled=true;
  try{if(live())await rpc('set_contact_block',{conversation_id:activeThread.id,should_block:!threadState.blocked_by_me});else demoBlocked=!demoBlocked;await openThread(activeThread.id,false);}catch(e){$('conversation-status').textContent=errorText(e);button.disabled=false;}
 });
 $('refresh-conversation').addEventListener('click',()=>{if(activeThread)openThread(activeThread.id,false);});
 $('report-form').addEventListener('submit',async event=>{
  event.preventDefault();const f=event.target,b=f.querySelector('button');if(b.disabled||!reportTarget)return;const details=f.elements.details.value.trim();if(details.length<10)return;b.disabled=true;
  try{
   if(live())await rpc('submit_safety_report',{home_id:reportTarget.home||null,reported_message:reportTarget.message||null,reason:f.elements.reason.value,report_details:details});
   else demoReports.unshift({id:'report-'+crypto.randomUUID(),listing_id:reportTarget.home||null,message_id:reportTarget.message||null,category:f.elements.reason.value,details,evidence:reportTarget.message?demoMessages.find(m=>m.id===reportTarget.message)?.body||'Demo message':api().findHome(reportTarget.home)?.description||'Demo listing',status:'open'});
   $('report-dialog').close();await refresh();toast(live()?'Report submitted for review.':'Demo report added to the preview review queue. No real report was sent.');
  }catch(e){$('report-error').textContent=errorText(e);}finally{b.disabled=false;}
 });
 function openResolution(id){
  if(!moderator)return;resolving=reports.find(r=>r.id===id);if(!resolving)return;
  $('report-evidence').innerHTML=`<p class="eyebrow">${safe(labels[resolving.category]||resolving.category)}</p><h3>Reporter’s concern</h3><p class="detail-description">${safe(resolving.details)}</p><h3>Reported content at submission</h3><blockquote>${safe(resolving.evidence)}</blockquote>`;
  $('resolve-form').reset();$('hide-reported-home').hidden=!resolving.listing_id;$('resolve-error').textContent='';$('moderation').close();modal('resolve-report');
 }
 $('resolve-form').addEventListener('submit',async event=>{
  event.preventDefault();if(!resolving||!moderator)return;const f=event.target,b=f.querySelector('button');if(b.disabled)return;b.disabled=true;
  try{if(live())await rpc('resolve_safety_report',{report_id:resolving.id,resolution_note:f.elements.note.value.trim(),hide_listing:!!resolving.listing_id&&f.elements.hide.checked});else{resolving.status='resolved';resolving.resolution=f.elements.note.value.trim();} $('resolve-report').close();await api().refresh();modal('moderation');toast(live()?'Report resolved.':'Demo report resolved.');}catch(e){$('resolve-error').textContent=errorText(e);}finally{b.disabled=false;}
 });
 document.addEventListener('click',event=>{
  const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-open-safety')){$('detail').close();$('safety').scrollIntoView();}
  if(b.dataset.reviewTab){tab=b.dataset.reviewTab;drawModeration();}
  if(b.dataset.reviewHome)openReview(b.dataset.reviewHome);
  if(b.dataset.thread)openThread(b.dataset.thread);
  if(b.dataset.reportHome)openReport({home:b.dataset.reportHome});
  if(b.dataset.reportMessage)openReport({message:b.dataset.reportMessage});
  if(b.dataset.resolve)openResolution(b.dataset.resolve);
 });
 for(const id of ['moderation-demo','moderation-open'])$(id).addEventListener('click',async()=>{await refresh();if(moderator)modal('moderation');});
 $('moderation-refresh').addEventListener('click',refresh);
 $('try-messages').addEventListener('click',async()=>{if(live()&&!api().user){modal('auth-dialog');return;}await refresh();if(!live())openThread('demo-thread');else{$('dashboard').showModal();}});
 window.OpenHomeSafety={refresh,clear,canSell};refresh();
})();
