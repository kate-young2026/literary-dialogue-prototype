-- Apply only after the school has approved storage, retention, notice and deletion.
begin;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('ld-voice','ld-voice',false,10485760,array['audio/webm','audio/ogg','audio/mp4'])
on conflict (id) do nothing;
create policy ld_voice_insert on storage.objects for insert to authenticated with check (
  bucket_id='ld-voice' and (storage.foldername(name))[1]=auth.uid()::text
  and array_length(storage.foldername(name),1)=3
  and (storage.foldername(name))[3] ~ '^[1-9][0-9]{0,4}$'
  and storage.filename(name) ~ '^[1-4]-[0-9a-f-]{36}\.(webm|mp4)$'
  and exists (select 1 from public.ld_sessions s where s.id::text=(storage.foldername(name))[2] and s.student_id=auth.uid()
    and public.ld_can_start_turn(s.id,((storage.foldername(name))[3])::integer)
    and split_part(storage.filename(name),'-',1)::integer=public.ld_next_recording_version(s.id,((storage.foldername(name))[3])::integer))
);
create policy ld_voice_read on storage.objects for select to authenticated using (
  bucket_id='ld-voice' and exists (select 1 from public.ld_sessions s where s.id::text=(storage.foldername(name))[2]
    and (s.student_id=auth.uid() or public.ld_teaches_session(s.id)))
);
commit;
