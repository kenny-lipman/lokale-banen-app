-- supabase/migrations/20260607120000_create_agent_chat_foundation.sql

create table agent_chat_conversations (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  title           text,
  model_provider  text not null default 'anthropic',
  model_id        text not null,
  metadata        jsonb not null default '{}'::jsonb,
  archived_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table agent_chat_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references agent_chat_conversations(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  role            text not null check (role in ('user','assistant','system','tool')),
  ui_message_id   text,
  content_text    text,
  parts           jsonb not null default '[]'::jsonb,
  model_message   jsonb,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  constraint agent_chat_messages_conversation_ui_message_unique unique (conversation_id, ui_message_id)
);

create table agent_chat_audit_events (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid references agent_chat_conversations(id) on delete cascade,
  message_id      uuid references agent_chat_messages(id) on delete set null,
  user_id         uuid references auth.users(id) on delete set null,
  event_type      text not null,
  event_source    text not null default 'agent_chat',
  payload         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index idx_agent_chat_conversations_user_created
  on agent_chat_conversations(user_id, created_at desc);

create index idx_agent_chat_messages_conversation_created
  on agent_chat_messages(conversation_id, created_at asc);

create index idx_agent_chat_audit_conversation_created
  on agent_chat_audit_events(conversation_id, created_at desc);

create or replace function agent_chat_touch_conversation_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_agent_chat_conversations_updated_at
before update on agent_chat_conversations
for each row execute function agent_chat_touch_conversation_updated_at();

alter table agent_chat_conversations enable row level security;
alter table agent_chat_messages enable row level security;
alter table agent_chat_audit_events enable row level security;

create policy "agent_chat_conversations own read"
  on agent_chat_conversations for select
  to authenticated
  using (user_id = auth.uid());

create policy "agent_chat_messages own read"
  on agent_chat_messages for select
  to authenticated
  using (
    exists (
      select 1
      from agent_chat_conversations c
      where c.id = agent_chat_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

create policy "agent_chat_audit_events own read"
  on agent_chat_audit_events for select
  to authenticated
  using (
    exists (
      select 1
      from agent_chat_conversations c
      where c.id = agent_chat_audit_events.conversation_id
        and c.user_id = auth.uid()
    )
  );

-- Writes are performed by service-role clients from authenticated API routes.
