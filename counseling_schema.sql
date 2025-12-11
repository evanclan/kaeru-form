-- Create counseling_topics table
create table public.counseling_topics (
  id uuid not null default gen_random_uuid (),
  title text not null,
  description text null,
  created_at timestamp with time zone not null default now(),
  constraint counseling_topics_pkey primary key (id)
);

-- Create counseling_nodes table
create table public.counseling_nodes (
  id uuid not null default gen_random_uuid (),
  topic_id uuid not null,
  type text not null,
  content text null,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  data jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint counseling_nodes_pkey primary key (id),
  constraint counseling_nodes_topic_id_fkey foreign key (topic_id) references counseling_topics (id) on delete cascade
);

-- Create counseling_edges table
create table public.counseling_edges (
  id uuid not null default gen_random_uuid (),
  topic_id uuid not null,
  source uuid not null,
  target uuid not null,
  label text null,
  created_at timestamp with time zone not null default now(),
  constraint counseling_edges_pkey primary key (id),
  constraint counseling_edges_topic_id_fkey foreign key (topic_id) references counseling_topics (id) on delete cascade
);
