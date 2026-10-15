-- Run only AFTER authenticated sessions, ownership policies and signed-photo
-- frontend have been deployed and verified. Does not delete any photos.
update storage.buckets set public=false where id='tecnodrill-fotos';
select id,public from storage.buckets where id='tecnodrill-fotos';
