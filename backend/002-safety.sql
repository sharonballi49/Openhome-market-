-- Apply after schema.sql. Test in a staging project before enabling the website.
begin;
create table public.moderators(user_id uuid primary key references auth.users(id) on delete cascade);
create table public.pilot_sellers(user_id uuid primary key references auth.users(id) on delete cascade, active boolean not null default true);
alter table public.moderators enable row level security;
alter table public.pilot_sellers enable row level security;
revoke all on public.moderators,public.pilot_sellers from anon,authenticated;
create function public.is_moderator() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.moderators where user_id=auth.uid());
$$;
create function public.is_pilot_seller() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.pilot_sellers where user_id=auth.uid() and active);
$$;
revoke all on function public.is_moderator(),public.is_pilot_seller() from public;
grant execute on function public.is_moderator(),public.is_pilot_seller() to anon,authenticated;

alter table public.listings drop constraint listings_status_check;
alter table public.listings add constraint listings_status_check check(status in ('pending','published','rejected','archived'));
alter table public.listings add column revision integer not null default 1;
create function public.bump_listing_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision=old.revision+1; return new; end;
$$;
create trigger bump_listing_revision before update on public.listings for each row execute function public.bump_listing_revision();
drop policy visible_homes on public.listings;
create policy visible_homes on public.listings for select using(status='published' or owner_id=(select auth.uid()) or public.is_moderator());
drop policy submit_own_home on public.listings;
create policy submit_own_home on public.listings for insert to authenticated with check(owner_id=(select auth.uid()) and status='pending' and public.is_pilot_seller());
drop policy edit_own_home on public.listings;
create policy edit_own_home on public.listings for update to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()) and (status='archived' or (status='pending' and public.is_pilot_seller())));
drop policy upload_own_photos on storage.objects;
create policy upload_own_photos on storage.objects for insert to authenticated with check(bucket_id='home-photos' and (storage.foldername(name))[1]=(select auth.uid())::text and public.is_pilot_seller());
drop policy read_home_photos on storage.objects;
create policy read_home_photos on storage.objects for select using(bucket_id='home-photos' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists(select 1 from public.listings l where (l.status='published' or public.is_moderator()) and storage.objects.name=any(l.photos))));

create table public.listing_reviews(
 id uuid primary key default gen_random_uuid(),listing_id uuid references public.listings(id) on delete set null,
 reviewer_id uuid references auth.users(id) on delete set null, reviewed_revision integer not null,
 decision text not null check(decision in ('published','rejected','archived')), note text not null,
 identity_checked boolean not null,authority_checked boolean not null,created_at timestamptz not null default now()
);
alter table public.listing_reviews enable row level security;
revoke all on public.listing_reviews from anon,authenticated;
grant select on public.listing_reviews to authenticated;
create policy own_review_results on public.listing_reviews for select to authenticated using(public.is_moderator() or exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid())));
create function public.review_listing(home_id uuid,expected_revision integer,decision text,review_note text,identity_checked boolean,authority_checked boolean) returns void language plpgsql security definer set search_path='' as $$
declare home public.listings;
begin
 if not public.is_moderator() then raise exception 'Moderator access required'; end if;
 if decision not in ('published','rejected','archived') or decision is null then raise exception 'Invalid decision'; end if;
 if length(trim(coalesce(review_note,''))) not between 5 and 1000 then raise exception 'Add a review note of 5 to 1000 characters'; end if;
 select * into home from public.listings where id=home_id for update;
 if home.id is null or home.revision is distinct from expected_revision then raise exception 'This listing changed. Refresh and review it again'; end if;
 if home.owner_id=auth.uid() then raise exception 'Another moderator must review your own listing'; end if;
 if decision='published' then
  if not exists(select 1 from public.listing_verification where listing_id=home_id and listing_revision=home.revision) then raise exception 'Current private verification details are required'; end if;
  if home.status<>'pending' then raise exception 'Only a pending listing can be approved'; end if;
  if identity_checked is distinct from true or authority_checked is distinct from true then raise exception 'Confirm identity and authority checks before approval'; end if;
  if not exists(select 1 from public.pilot_sellers where user_id=home.owner_id and active) then raise exception 'Seller is not approved for the pilot'; end if;
 end if;
 update public.listings set status=decision where id=home_id;
 insert into public.listing_reviews(listing_id,reviewer_id,reviewed_revision,decision,note,identity_checked,authority_checked)
 values(home_id,auth.uid(),expected_revision,decision,trim(review_note),coalesce(identity_checked,false),coalesce(authority_checked,false));
end;
$$;
revoke all on function public.review_listing(uuid,integer,text,text,boolean,boolean) from public;
grant execute on function public.review_listing(uuid,integer,text,text,boolean,boolean) to authenticated;

-- Legacy emails remain in the database for a deliberate retention decision;
-- the browser can no longer select the column, and new inquiries do not fill it.
alter table public.inquiries alter column buyer_email drop not null;
revoke select on public.inquiries from authenticated;
grant select(id,listing_id,seller_id,buyer_id,buyer_name,message,created_at) on public.inquiries to authenticated;
create table public.messages(
 id uuid primary key default gen_random_uuid(),thread_id uuid not null references public.inquiries(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,body text not null check(length(trim(body)) between 1 and 2000),
 created_at timestamptz not null default now()
);
insert into public.messages(thread_id,sender_id,body,created_at) select id,buyer_id,message,created_at from public.inquiries;
alter table public.messages enable row level security;
revoke all on public.messages from anon,authenticated;
grant select on public.messages to authenticated;
create policy participant_messages on public.messages for select to authenticated using(exists(select 1 from public.inquiries t where t.id=thread_id and (t.seller_id=(select auth.uid()) or t.buyer_id=(select auth.uid()))));
create index on public.messages(thread_id,created_at);
create index on public.messages(sender_id,created_at);
create table public.contact_blocks(
 blocker_id uuid not null references auth.users(id) on delete cascade,blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(blocker_id,blocked_id),check(blocker_id<>blocked_id)
);
alter table public.contact_blocks enable row level security;
revoke all on public.contact_blocks from anon,authenticated;
grant select on public.contact_blocks to authenticated;
create policy own_blocks on public.contact_blocks for select to authenticated using(blocker_id=(select auth.uid()));

create function public.thread_state(conversation_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.inquiries;peer uuid;
begin
 select * into t from public.inquiries where id=conversation_id;
 if auth.uid() is null or (auth.uid() is distinct from t.buyer_id and auth.uid() is distinct from t.seller_id) then raise exception 'Conversation not available'; end if;
 peer=case when auth.uid()=t.buyer_id then t.seller_id else t.buyer_id end;
 return jsonb_build_object('blocked_by_me',exists(select 1 from public.contact_blocks where blocker_id=auth.uid() and blocked_id=peer),'messaging_blocked',exists(select 1 from public.contact_blocks where (blocker_id=auth.uid() and blocked_id=peer) or (blocker_id=peer and blocked_id=auth.uid())));
end;
$$;
create function public.set_contact_block(conversation_id uuid,should_block boolean) returns void language plpgsql security definer set search_path='' as $$
declare t public.inquiries;peer uuid;
begin
 select * into t from public.inquiries where id=conversation_id;
 if auth.uid() is null or (auth.uid() is distinct from t.buyer_id and auth.uid() is distinct from t.seller_id) then raise exception 'Conversation not available'; end if;
 peer=case when auth.uid()=t.buyer_id then t.seller_id else t.buyer_id end;
 perform pg_advisory_xact_lock(hashtextextended(least(auth.uid(),peer)::text||greatest(auth.uid(),peer)::text,0));
 if should_block then insert into public.contact_blocks(blocker_id,blocked_id) values(auth.uid(),peer) on conflict do nothing;
 else delete from public.contact_blocks where blocker_id=auth.uid() and blocked_id=peer; end if;
end;
$$;
create or replace function public.send_inquiry(home_id uuid,sender_name text,body text) returns uuid language plpgsql security definer set search_path='' as $$
declare sender uuid:=auth.uid();receiver uuid;thread uuid;
begin
 if sender is null or not exists(select 1 from auth.users where id=sender and email_confirmed_at is not null) then raise exception 'Verify your email before contacting an owner'; end if;
 perform pg_advisory_xact_lock(hashtextextended(sender::text,0));
 select owner_id into receiver from public.listings where id=home_id and status='published' for share;
 if receiver is null or receiver=sender then raise exception 'This home is not available for your inquiry'; end if;
 perform pg_advisory_xact_lock(hashtextextended(least(sender,receiver)::text||greatest(sender,receiver)::text,0));
 if exists(select 1 from public.contact_blocks where (blocker_id=sender and blocked_id=receiver) or (blocker_id=receiver and blocked_id=sender)) then raise exception 'Messaging is unavailable for this contact'; end if;
 if exists(select 1 from public.inquiries where listing_id=home_id and buyer_id=sender) then raise exception 'You already have a conversation for this home. Open Messages to reply'; end if;
 if (select count(*) from public.inquiries where buyer_id=sender and created_at>now()-interval '1 hour')>=10 or (select count(*) from public.messages where sender_id=sender and created_at>now()-interval '1 hour')>=30 then raise exception 'Message limit reached. Please try later'; end if;
 insert into public.inquiries(listing_id,seller_id,buyer_id,buyer_name,message) values(home_id,receiver,sender,trim(sender_name),trim(body)) returning id into thread;
 insert into public.messages(thread_id,sender_id,body) values(thread,sender,trim(body));return thread;
end;
$$;
create function public.send_message(conversation_id uuid,message_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare t public.inquiries;sender uuid:=auth.uid();peer uuid;message_id uuid;
begin
 if sender is null or not exists(select 1 from auth.users where id=sender and email_confirmed_at is not null) then raise exception 'Sign in with a verified email'; end if;
 select * into t from public.inquiries where id=conversation_id;
 if sender is distinct from t.buyer_id and sender is distinct from t.seller_id then raise exception 'Conversation not available'; end if;
 peer=case when sender=t.buyer_id then t.seller_id else t.buyer_id end;
 perform pg_advisory_xact_lock(hashtextextended(sender::text,0));
 perform pg_advisory_xact_lock(hashtextextended(least(sender,peer)::text||greatest(sender,peer)::text,0));
 if exists(select 1 from public.contact_blocks where (blocker_id=sender and blocked_id=peer) or (blocker_id=peer and blocked_id=sender)) then raise exception 'Messaging is unavailable for this contact'; end if;
 if (select count(*) from public.messages where sender_id=sender and created_at>now()-interval '1 hour')>=30 or exists(select 1 from public.messages where sender_id=sender and created_at>now()-interval '3 seconds') then raise exception 'Please wait before sending another message'; end if;
 insert into public.messages(thread_id,sender_id,body) values(conversation_id,sender,trim(message_body)) returning id into message_id;return message_id;
end;
$$;
revoke all on function public.thread_state(uuid),public.set_contact_block(uuid,boolean),public.send_message(uuid,text) from public;
grant execute on function public.thread_state(uuid),public.set_contact_block(uuid,boolean),public.send_message(uuid,text) to authenticated;

create table public.safety_reports(
 id uuid primary key default gen_random_uuid(),reporter_id uuid references auth.users(id) on delete set null,
 listing_id uuid references public.listings(id) on delete set null,message_id uuid references public.messages(id) on delete set null,
 category text not null check(category in ('suspected_scam','not_authorized','inaccurate_listing','harassment','other')),
 details text not null,evidence text not null,status text not null default 'open' check(status in ('open','resolved')),
 resolution text,reviewed_by uuid references auth.users(id) on delete set null,created_at timestamptz not null default now(),resolved_at timestamptz
);
alter table public.safety_reports enable row level security;
revoke all on public.safety_reports from anon,authenticated;
grant select on public.safety_reports to authenticated;
create policy reporter_or_moderator on public.safety_reports for select to authenticated using(reporter_id=(select auth.uid()) or public.is_moderator());
create index on public.safety_reports(status,created_at);
create function public.submit_safety_report(home_id uuid,reported_message uuid,reason text,report_details text) returns uuid language plpgsql security definer set search_path='' as $$
declare snapshot text;report_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in to submit a report'; end if;
 if (home_id is null)=(reported_message is null) then raise exception 'Choose one report target'; end if;
 if length(trim(coalesce(report_details,''))) not between 10 and 2000 then raise exception 'Please give 10 to 2000 characters of detail'; end if;
 perform pg_advisory_xact_lock(hashtextextended('report-'||auth.uid()::text,0));
 if (select count(*) from public.safety_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=5 then raise exception 'Report limit reached. Please try later'; end if;
 if home_id is not null then
  select title||E'\n'||description into snapshot from public.listings where id=home_id and (status='published' or owner_id=auth.uid());
 else
  select m.body into snapshot from public.messages m join public.inquiries t on t.id=m.thread_id where m.id=reported_message and (t.buyer_id=auth.uid() or t.seller_id=auth.uid());
 end if;
 if snapshot is null then raise exception 'Report target is not available'; end if;
 if exists(select 1 from public.safety_reports where reporter_id=auth.uid() and status='open' and (listing_id=home_id or message_id=reported_message)) then raise exception 'You already have an open report for this item'; end if;
 insert into public.safety_reports(reporter_id,listing_id,message_id,category,details,evidence) values(auth.uid(),home_id,reported_message,reason,trim(report_details),snapshot) returning id into report_id;return report_id;
end;
$$;
create function public.resolve_safety_report(report_id uuid,resolution_note text,hide_listing boolean) returns void language plpgsql security definer set search_path='' as $$
declare r public.safety_reports;home public.listings;
begin
 if not public.is_moderator() then raise exception 'Moderator access required'; end if;
 if length(trim(coalesce(resolution_note,''))) not between 5 and 1000 then raise exception 'Add a resolution note'; end if;
 select * into r from public.safety_reports where id=report_id for update;
 if r.id is null or r.status<>'open' then raise exception 'Report already resolved or unavailable'; end if;
 if hide_listing then
  if r.listing_id is null then raise exception 'This report is not attached to a listing'; end if;
  select * into home from public.listings where id=r.listing_id for update;
  update public.listings set status='archived' where id=home.id;
  insert into public.listing_reviews(listing_id,reviewer_id,reviewed_revision,decision,note,identity_checked,authority_checked) values(home.id,auth.uid(),home.revision,'archived',trim(resolution_note),false,false);
 end if;
 update public.safety_reports set status='resolved',resolution=trim(resolution_note),reviewed_by=auth.uid(),resolved_at=now() where id=report_id;
end;
$$;
revoke all on function public.submit_safety_report(uuid,uuid,text,text),public.resolve_safety_report(uuid,text,boolean) from public;
grant execute on function public.submit_safety_report(uuid,uuid,text,text),public.resolve_safety_report(uuid,text,boolean) to authenticated;

-- Full address and claimant details never live in the public listing row.
create table public.listing_verification(
 listing_id uuid primary key references public.listings(id) on delete cascade,
 listing_revision integer not null,claimant_name text not null check(length(trim(claimant_name)) between 2 and 120),
 property_address text not null check(length(trim(property_address)) between 5 and 250),
 county text not null check(length(trim(county)) between 2 and 80),
 relationship text not null check(relationship in ('owner','co_owner','authorized_representative')),
 record_reference text not null default '' check(length(record_reference)<=250)
);
alter table public.listing_verification enable row level security;
revoke all on public.listing_verification from anon,authenticated;
grant select on public.listing_verification to authenticated;
create policy own_verification_details on public.listing_verification for select to authenticated using(public.is_moderator() or exists(select 1 from public.listings l where l.id=listing_id and l.owner_id=(select auth.uid())));
create function public.submit_home(home_id uuid,expected_revision integer,home_data jsonb,private_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing public.listings;new_revision integer;photo_paths text[];
begin
 if auth.uid() is null or not public.is_pilot_seller() then raise exception 'An invitation is required to list during the pilot'; end if;
 if not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email before submitting'; end if;
 select * into existing from public.listings where id=home_id for update;
 if existing.id is not null and (existing.owner_id<>auth.uid() or existing.revision is distinct from expected_revision) then raise exception 'Listing changed or unavailable. Refresh before editing'; end if;
 if existing.id is null and expected_revision is distinct from 0 then raise exception 'Listing unavailable'; end if;
 select array_agg(value) into photo_paths from jsonb_array_elements_text(home_data->'photos');
 if existing.id is null then
  insert into public.listings(id,owner_id,title,area,zip,price,beds,baths,sqft,type,description,photos,status)
  values(home_id,auth.uid(),trim(home_data->>'title'),trim(home_data->>'area'),home_data->>'zip',(home_data->>'price')::bigint,(home_data->>'beds')::integer,(home_data->>'baths')::numeric,(home_data->>'sqft')::integer,home_data->>'type',trim(home_data->>'description'),photo_paths,'pending') returning revision into new_revision;
 else
  update public.listings set title=trim(home_data->>'title'),area=trim(home_data->>'area'),zip=home_data->>'zip',price=(home_data->>'price')::bigint,beds=(home_data->>'beds')::integer,baths=(home_data->>'baths')::numeric,sqft=(home_data->>'sqft')::integer,type=home_data->>'type',description=trim(home_data->>'description'),photos=photo_paths,status='pending' where id=home_id returning revision into new_revision;
 end if;
 insert into public.listing_verification(listing_id,listing_revision,claimant_name,property_address,county,relationship,record_reference)
 values(home_id,new_revision,trim(private_data->>'claimant_name'),trim(private_data->>'property_address'),trim(private_data->>'county'),private_data->>'relationship',coalesce(private_data->>'record_reference',''))
 on conflict(listing_id) do update set listing_revision=excluded.listing_revision,claimant_name=excluded.claimant_name,property_address=excluded.property_address,county=excluded.county,relationship=excluded.relationship,record_reference=excluded.record_reference;
 return jsonb_build_object('id',home_id,'revision',new_revision);
end;
$$;
revoke all on function public.submit_home(uuid,integer,jsonb,jsonb) from public;
grant execute on function public.submit_home(uuid,integer,jsonb,jsonb) to authenticated;
commit;
