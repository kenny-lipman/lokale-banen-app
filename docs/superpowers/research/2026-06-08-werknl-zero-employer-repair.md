# Werk.nl zero-employer repair

Datum: 2026-06-08.

## Probleem

Werk.nl detailpayloads kunnen `employer.referenceNumber = 0` teruggeven. Dat is geen stabiele werkgever-id, maar werd opgeslagen als `companies.werknl_employer_id = '0'`. Daardoor zijn veel Werk.nl-vacatures gekoppeld aan een bestaande company:

- company_id: `846fd26d-0dcf-4468-adfa-67027cbdee52`
- name: `Euregio Habets Royen`
- werknl_employer_id: `'0'`

Read-only impact op 2026-06-08T07:36:34Z:

- affected Werk.nl jobs: `13093`
- active: `13093`
- enriched: `13093`
- affected queue status: `success = 13093`
- zero-employer companies: alleen `846fd26d-0dcf-4468-adfa-67027cbdee52`

## Volgorde

1. Merge en deploy eerst de codefix die `referenceNumber <= 0` naar `null` normaliseert.
2. Controleer dat er geen nieuwe `companies.werknl_employer_id = '0'` meer ontstaan.
3. Voer pas daarna onderstaande repair uit.

## Preflight

```sql
select id, name
from job_sources
where name = 'Werk.nl';

select id, name, source, werknl_employer_id, website, hoofddomein, city, postal_code
from companies
where id = '846fd26d-0dcf-4468-adfa-67027cbdee52';

with werk_source as (
  select id from job_sources where name = 'Werk.nl'
)
select count(*) as affected_jobs
from job_postings jp
join werk_source ws on ws.id = jp.source_id
where jp.company_id = '846fd26d-0dcf-4468-adfa-67027cbdee52';

with werk_source as (
  select id from job_sources where name = 'Werk.nl'
),
affected as (
  select jp.id
  from job_postings jp
  join werk_source ws on ws.id = jp.source_id
  where jp.company_id = '846fd26d-0dcf-4468-adfa-67027cbdee52'
)
select coalesce(q.status, 'missing') as queue_status, count(*)
from affected a
left join werk_nl_scrape_queue q on q.job_posting_id = a.id
group by 1
order by 1;

select id, name, source
from companies
where werknl_employer_id = '0';
```

## Repair

Pas `expected_count` aan naar de preflight-count van dat moment.

```sql
begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create temp table repair_werknl_zero_employer_jobs on commit drop as
select jp.id
from job_postings jp
join job_sources js on js.id = jp.source_id
where js.name = 'Werk.nl'
  and jp.company_id = '846fd26d-0dcf-4468-adfa-67027cbdee52';

do $$
declare
  n int;
  expected_count int := 13093;
begin
  select count(*) into n from repair_werknl_zero_employer_jobs;
  if n <> expected_count then
    raise exception 'Unexpected affected job count: %, expected %', n, expected_count;
  end if;
end $$;

update job_postings jp
set company_id = null,
    detail_scraped_at = null
from repair_werknl_zero_employer_jobs a
where jp.id = a.id
  and jp.company_id = '846fd26d-0dcf-4468-adfa-67027cbdee52';

insert into werk_nl_scrape_queue (
  job_posting_id,
  orchestration_id,
  enqueued_at,
  picked_at,
  completed_at,
  status,
  attempts,
  error_message,
  result_stats
)
select
  id,
  'werknl-zero-employer-repair-2026-06-08',
  now(),
  null,
  null,
  'pending',
  0,
  null,
  jsonb_build_object(
    'repair', 'zero_employer',
    'previous_company_id', '846fd26d-0dcf-4468-adfa-67027cbdee52'
  )
from repair_werknl_zero_employer_jobs
on conflict (job_posting_id) do update
set
  orchestration_id = excluded.orchestration_id,
  enqueued_at = now(),
  picked_at = null,
  completed_at = null,
  status = 'pending',
  attempts = 0,
  error_message = null,
  result_stats = jsonb_build_object(
    'repair', 'zero_employer',
    'previous_company_id', '846fd26d-0dcf-4468-adfa-67027cbdee52',
    'previous_queue_status', werk_nl_scrape_queue.status
  );

update companies
set werknl_employer_id = null
where id = '846fd26d-0dcf-4468-adfa-67027cbdee52'
  and werknl_employer_id = '0';

commit;
```

## Postflight

```sql
with werk_source as (
  select id from job_sources where name = 'Werk.nl'
)
select count(*) as remaining_bad_links
from job_postings jp
join werk_source ws on ws.id = jp.source_id
where jp.company_id = '846fd26d-0dcf-4468-adfa-67027cbdee52';

select status, count(*)
from werk_nl_scrape_queue
where orchestration_id = 'werknl-zero-employer-repair-2026-06-08'
group by status
order by status;

select count(*) as zero_employer_companies
from companies
where werknl_employer_id = '0';
```
