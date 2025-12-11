create table flows (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  status text default 'draft',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table nodes (
  id text primary key,
  flow_id uuid references flows(id) on delete cascade not null,
  type text not null,
  content text not null,
  options jsonb,
  position_x numeric not null,
  position_y numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table edges (
  id text primary key,
  flow_id uuid references flows(id) on delete cascade not null,
  source_node text references nodes(id) on delete cascade not null,
  target_node text references nodes(id) on delete cascade not null,
  condition text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create table submissions (
  id uuid default gen_random_uuid() primary key,
  flow_id uuid references flows(id) on delete cascade not null,
  answers jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
