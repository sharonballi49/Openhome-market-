-- Run once in a NEW Supabase project's SQL editor, as the project administrator.
-- No service-role key belongs in the website. See SETUP.md before enabling.
begin;
create table public.listings (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null check (length(trim(title)) between 1 and 80),
 area text not null check (length(trim(area)) between 1 and 50),
 zip text not null check (zip ~ '^[0-9]{5}$'),
 price bigint not null check (price between 1 and 100000000),
 beds integer not null check (beds between 0 and 30),
 baths numeric(3,1) not null check (baths between 0.5 and 30 and mod(baths,0.5)=0),
 sqft integer not null check (sqft between 1 and 1000000),
 type text not null check (type in ('House','Townhome','Condo')),
 description text not null check (length(trim(description)) between 1 and 1500),
 photos text[] not null default '{}' check (cardinality(photos) between 1 and 6),
 status text not null default 'pending' check (status in ('pending','published','archived')),
 created_at timestamptz not null default now()
);
alter table public.listings enable row level security;
revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon, authenticated;
grant insert (id,owner_id,title,area,zip,price,beds,baths,sqft,type,description,photos,status),
 update (title,area,zip,price,beds,baths,sqft,type,description,photos,status) on public.listings to authenticated;
create policy visible_homes on public.listings for select using (status='published' or owner_id=(select auth.uid()));
create policy submit_own_home on public.listings for insert to authenticated with check (owner_id=(select auth.uid()) and status='pending');
create policy edit_own_home on public.listings for update to authenticated using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()) and status in ('pending','archived'));
create index on public.listings(owner_id);
create index on public.listings(status,created_at desc);

-- A seller may not attach another seller's photographs or approve their own listing.
create function public.validate_home_photos() returns trigger language plpgsql set search_path='' as $$
declare photo text;
begin
 foreach photo in array new.photos loop
  if photo not like new.owner_id::text || '/' || new.id::text || '/%' then
   raise exception 'Photo does not belong to this listing';
  end if;
 end loop;
 return new;
end;
$$;
create trigger validate_home_photos before insert or update on public.listings for each row execute function public.validate_home_photos();

create table public.inquiries (
 id uuid primary key default gen_random_uuid(),
 listing_id uuid not null references public.listings(id) on delete cascade,
 seller_id uuid not null references auth.users(id) on delete cascade,
 buyer_id uuid not null references auth.users(id) on delete cascade,
 buyer_name text not null check (length(trim(buyer_name)) between 1 and 80),
 buyer_email text not null,
 message text not null check (length(trim(message)) between 10 and 2000),
 created_at timestamptz not null default now()
);
alter table public.inquiries enable row level security;
revoke all on public.inquiries from anon,authenticated;
grant select on public.inquiries to authenticated;
create policy own_inquiries on public.inquiries for select to authenticated using ((select auth.uid())=seller_id or (select auth.uid())=buyer_id);
create index on public.inquiries(seller_id,created_at desc);
create index on public.inquiries(buyer_id,created_at desc);

-- The server supplies both identities and the verified email. Direct inserts are denied.
create function public.send_inquiry(home_id uuid,sender_name text,body text) returns uuid
language plpgsql security definer set search_path='' as $$
declare sender uuid:=auth.uid(); receiver uuid; email_address text; inquiry_id uuid;
begin
 if sender is null then raise exception 'Sign in to contact the owner'; end if;
 -- Serialize per-buyer sends so concurrent requests cannot bypass the limit.
 perform pg_advisory_xact_lock(hashtextextended(sender::text,0));
 select email into email_address from auth.users where id=sender and email_confirmed_at is not null;
 if email_address is null then raise exception 'Verify your email before contacting an owner'; end if;
 select owner_id into receiver from public.listings where id=home_id and status='published' for share;
 if receiver is null then raise exception 'This home is no longer available'; end if;
 if receiver=sender then raise exception 'You cannot send an inquiry to yourself'; end if;
 if (select count(*) from public.inquiries where buyer_id=sender and created_at>now()-interval '1 hour')>=10 then
  raise exception 'You have reached the hourly inquiry limit. Please try later';
 end if;
 if exists(select 1 from public.inquiries where buyer_id=sender and listing_id=home_id and created_at>now()-interval '5 minutes') then
  raise exception 'Please wait five minutes before contacting this owner again';
 end if;
 insert into public.inquiries(listing_id,seller_id,buyer_id,buyer_name,buyer_email,message)
 values(home_id,receiver,sender,trim(sender_name),email_address,trim(body)) returning id into inquiry_id;
 return inquiry_id;
end;
$$;
revoke all on function public.send_inquiry(uuid,text,text) from public,anon;
grant execute on function public.send_inquiry(uuid,text,text) to authenticated;

-- Private bucket: pending photos are readable only by their owner. Published
-- listing photos can be served with a time-limited signed URL (one hour).
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('home-photos','home-photos',false,10485760,array['image/jpeg','image/png','image/webp']);
create policy upload_own_photos on storage.objects for insert to authenticated
with check (bucket_id='home-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy read_home_photos on storage.objects for select using (
 bucket_id='home-photos' and (
 (storage.foldername(name))[1]=(select auth.uid())::text
 or exists(select 1 from public.listings l where l.status='published' and storage.objects.name=any(l.photos))
 ));
create policy delete_own_photos on storage.objects for delete to authenticated
using (bucket_id='home-photos' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;
