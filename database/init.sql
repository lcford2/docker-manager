-- Create database (this will be done by docker-compose)
-- CREATE DATABASE docker_manager;

-- Create user (this will be done by docker-compose)
-- CREATE USER docker_manager WITH PASSWORD 'docker_manager';
-- GRANT ALL PRIVILEGES ON DATABASE docker_manager TO docker_manager;

-- Connect to the database
\c docker_manager;

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

--
-- Name: container_stats; Type: TABLE; Schema: public;
--

CREATE TABLE public.container_stats (
    id character varying NOT NULL,
    name character varying NOT NULL,
    status character varying NOT NULL,
    image character varying,
    cpu_percent double precision,
    memory_percent double precision,
    memory_usage bigint,
    memory_limit bigint,
    network_rx bigint,
    network_tx bigint,
    block_read bigint,
    block_write bigint,
    uptime_seconds bigint DEFAULT 0,
    "timestamp" timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean,
    stat_id bigint NOT NULL
);

--
-- Name: container_stats_stat_id_seq; Type: SEQUENCE; Schema: public;
--

CREATE SEQUENCE public.container_stats_stat_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: system_info; Type: TABLE; Schema: public;
--

CREATE TABLE public.system_info (
    id integer NOT NULL,
    containers_running integer,
    containers_total integer,
    images_count integer,
    volumes_count integer,
    networks_count integer,
    "timestamp" timestamp with time zone
);

--
-- Name: system_info_id_seq; Type: SEQUENCE; Schema: public;
--

CREATE SEQUENCE public.system_info_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: container_stats stat_id; Type: DEFAULT; Schema: public;
--

ALTER TABLE ONLY public.container_stats ALTER COLUMN stat_id SET DEFAULT nextval('public.container_stats_stat_id_seq'::regclass);


--
-- Name: system_info id; Type: DEFAULT; Schema: public;
--

ALTER TABLE ONLY public.system_info ALTER COLUMN id SET DEFAULT nextval('public.system_info_id_seq'::regclass);


--
-- Name: container_stats container_stats_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.container_stats
    ADD CONSTRAINT container_stats_pkey PRIMARY KEY (stat_id);


--
-- Name: container_stats container_stats_unique_per_instant; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.container_stats
    ADD CONSTRAINT container_stats_unique_per_instant UNIQUE (id, "timestamp");


--
-- Name: system_info system_info_pkey; Type: CONSTRAINT; Schema: public;
--

ALTER TABLE ONLY public.system_info
    ADD CONSTRAINT system_info_pkey PRIMARY KEY (id);


--
-- Name: idx_container_stats_id_ts; Type: INDEX; Schema: public;
--

CREATE INDEX idx_container_stats_id_ts ON public.container_stats USING btree (id, "timestamp" DESC);


--
-- Name: idx_system_info_ts; Type: INDEX; Schema: public;
--

CREATE INDEX idx_system_info_ts ON public.system_info USING btree ("timestamp" DESC);
