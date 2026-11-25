-- Pathao API timestamps without a timezone are Bangladesh local time.
-- Correct existing values that were previously interpreted as UTC.
update public.pathao_status_history
set event_at = event_at - interval '6 hours'
where event_time_source = 'pathao_reported';

update public.pathao_parcels
set tracking_updated_at = tracking_updated_at - interval '6 hours'
where tracking_updated_at is not null;
