\restrict uUh5LJ1U3SyqwB5JvlfijhjLjcCM1J5UnlGmYgTZJRs9sNlpuDs9AEwByiQ5i6D
CREATE TABLE public.activity_logs (
    id bigint NOT NULL,
    owner_id bigint NOT NULL,
    actor_id bigint NOT NULL,
    actor_name character varying(255),
    boutique_id bigint,
    action character varying(255) NOT NULL,
    detail character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.activity_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.activity_logs_id_seq OWNED BY public.activity_logs.id;
CREATE TABLE public.admin_settings (
    id bigint NOT NULL,
    admin_id bigint NOT NULL,
    app_name character varying(255),
    contact_email character varying(255),
    timezone character varying(255),
    premium_price numeric(12,2),
    grace_period integer,
    alerts_enabled boolean DEFAULT true NOT NULL,
    notify_new_subs boolean DEFAULT true NOT NULL,
    notify_late_payments boolean DEFAULT true NOT NULL,
    notify_reports boolean DEFAULT false NOT NULL,
    multi_sessions boolean DEFAULT true NOT NULL,
    twofa_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.admin_settings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.admin_settings_id_seq OWNED BY public.admin_settings.id;
CREATE TABLE public.admin_transfers (
    id bigint NOT NULL,
    admin_id bigint NOT NULL,
    from_account character varying(255) NOT NULL,
    to_account character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.admin_transfers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.admin_transfers_id_seq OWNED BY public.admin_transfers.id;
CREATE TABLE public.alerts (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    type character varying(255) NOT NULL,
    message character varying(255) NOT NULL,
    days integer,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.alerts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.alerts_id_seq OWNED BY public.alerts.id;
CREATE TABLE public.boutique_members (
    id bigint NOT NULL,
    owner_id bigint NOT NULL,
    ref_boutique_id bigint,
    member_id bigint,
    email character varying(255) NOT NULL,
    role character varying(255) DEFAULT 'employe'::character varying NOT NULL,
    status character varying(255) DEFAULT 'pending'::character varying NOT NULL,
    permissions json NOT NULL,
    invite_token character varying(255),
    invite_expires_at timestamp(0) without time zone,
    accepted_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    photo text,
    name character varying(255),
    phone character varying(32)
);
CREATE SEQUENCE public.boutique_members_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.boutique_members_id_seq OWNED BY public.boutique_members.id;
CREATE TABLE public.boutiques (
    id bigint NOT NULL,
    owner_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    phone character varying(255),
    address character varying(255),
    emoji character varying(255) DEFAULT '🏪'::character varying NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    photo text
);
CREATE SEQUENCE public.boutiques_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.boutiques_id_seq OWNED BY public.boutiques.id;
CREATE TABLE public.cache (
    key character varying(255) NOT NULL,
    value text NOT NULL,
    expiration bigint NOT NULL
);
CREATE TABLE public.cache_locks (
    key character varying(255) NOT NULL,
    owner character varying(255) NOT NULL,
    expiration bigint NOT NULL
);
CREATE TABLE public.caisse_closings (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    boutique_id bigint,
    date date DEFAULT CURRENT_DATE NOT NULL,
    total_especes numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_wave numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_orange numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_credits numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_retours numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    total_net numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    nb_ventes integer DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.caisse_closings_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.caisse_closings_id_seq OWNED BY public.caisse_closings.id;
CREATE TABLE public.categories (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    name character varying(255) NOT NULL,
    emoji character varying(255) DEFAULT '🏷️'::character varying NOT NULL,
    couleur character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    negociable boolean DEFAULT false NOT NULL
);
CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;
CREATE TABLE public.clients (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    boutique_id bigint,
    name character varying(255) NOT NULL,
    phone character varying(255),
    email character varying(255),
    address character varying(255),
    notes text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    deleted_at timestamp(0) without time zone,
    photo text
);
CREATE SEQUENCE public.clients_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.clients_id_seq OWNED BY public.clients.id;
CREATE TABLE public.commande_items (
    id bigint NOT NULL,
    commande_id bigint NOT NULL,
    product_id bigint NOT NULL,
    quantity integer NOT NULL,
    prix_unitaire numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.commande_items_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.commande_items_id_seq OWNED BY public.commande_items.id;
CREATE TABLE public.failed_jobs (
    id bigint NOT NULL,
    uuid character varying(255) NOT NULL,
    connection character varying(255) NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    exception text NOT NULL,
    failed_at timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE SEQUENCE public.failed_jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.failed_jobs_id_seq OWNED BY public.failed_jobs.id;
CREATE TABLE public.fournisseurs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    boutique_id bigint,
    name character varying(255) NOT NULL,
    phone character varying(255),
    email character varying(255),
    address character varying(255),
    notes text,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    photo text
);
CREATE SEQUENCE public.fournisseurs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.fournisseurs_id_seq OWNED BY public.fournisseurs.id;
CREATE TABLE public.job_batches (
    id character varying(255) NOT NULL,
    name character varying(255) NOT NULL,
    total_jobs integer NOT NULL,
    pending_jobs integer NOT NULL,
    failed_jobs integer NOT NULL,
    failed_job_ids text NOT NULL,
    options text,
    cancelled_at integer,
    created_at integer NOT NULL,
    finished_at integer
);
CREATE TABLE public.jobs (
    id bigint NOT NULL,
    queue character varying(255) NOT NULL,
    payload text NOT NULL,
    attempts smallint NOT NULL,
    reserved_at integer,
    available_at integer NOT NULL,
    created_at integer NOT NULL
);
CREATE SEQUENCE public.jobs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.jobs_id_seq OWNED BY public.jobs.id;
CREATE TABLE public.migrations (
    id integer NOT NULL,
    migration character varying(255) NOT NULL,
    batch integer NOT NULL
);
CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;
CREATE TABLE public.password_reset_tokens (
    email character varying(255) NOT NULL,
    token character varying(255) NOT NULL,
    created_at timestamp(0) without time zone
);
CREATE TABLE public.personal_access_tokens (
    id bigint NOT NULL,
    tokenable_type character varying(255) NOT NULL,
    tokenable_id bigint NOT NULL,
    name text NOT NULL,
    token character varying(64) NOT NULL,
    abilities text,
    last_used_at timestamp(0) without time zone,
    expires_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.personal_access_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.personal_access_tokens_id_seq OWNED BY public.personal_access_tokens.id;
CREATE TABLE public.product_units (
    id bigint NOT NULL,
    product_id bigint NOT NULL,
    libelle character varying(255) NOT NULL,
    facteur integer NOT NULL,
    prix integer NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.product_units_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.product_units_id_seq OWNED BY public.product_units.id;
CREATE TABLE public.products (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    category_id bigint,
    name character varying(255) NOT NULL,
    scent character varying(255),
    price integer DEFAULT 0 NOT NULL,
    price_achat integer DEFAULT 0 NOT NULL,
    stock integer DEFAULT 0 NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    boutique_id bigint,
    barcode character varying(255),
    unite_base character varying(255) DEFAULT 'piece'::character varying NOT NULL,
    prix_min integer,
    negociable boolean,
    deleted_at timestamp(0) without time zone,
    photo text
);
CREATE SEQUENCE public.products_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.products_id_seq OWNED BY public.products.id;
CREATE TABLE public.restock_deliveries (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    commande_id bigint,
    tracking_note character varying(255),
    status character varying(255) DEFAULT 'en_attente'::character varying NOT NULL,
    delivered_at timestamp(0) without time zone,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    boutique_id bigint
);
CREATE SEQUENCE public.restock_deliveries_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.restock_deliveries_id_seq OWNED BY public.restock_deliveries.id;
CREATE TABLE public.restock_orders (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    boutique_id bigint,
    fournisseur_id bigint,
    total numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    notes text,
    expected_date date,
    status character varying(255) DEFAULT 'en_attente'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.restock_orders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.restock_orders_id_seq OWNED BY public.restock_orders.id;
CREATE TABLE public.returns (
    id bigint NOT NULL,
    sale_id bigint NOT NULL,
    product_id bigint NOT NULL,
    user_id bigint NOT NULL,
    boutique_id bigint,
    quantity integer NOT NULL,
    reason character varying(255),
    refund_method character varying(255) DEFAULT 'avoir'::character varying NOT NULL,
    refund_amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.returns_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.returns_id_seq OWNED BY public.returns.id;
CREATE TABLE public.sales (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    product_id bigint NOT NULL,
    quantity integer NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    payment_method character varying(255) NOT NULL,
    client_name character varying(255),
    client_phone character varying(255),
    due_date date,
    paid boolean DEFAULT true NOT NULL,
    repayment_method character varying(255),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    client_id bigint,
    boutique_id bigint,
    quantite_base integer,
    unit_id bigint,
    unit_libelle character varying(255),
    prix_reference integer,
    prix_reel integer,
    remise integer DEFAULT 0 NOT NULL,
    cogs integer,
    vendu_par bigint,
    vendu_par_nom character varying(255),
    deleted_at timestamp(0) without time zone,
    client_uuid uuid,
    backfilled boolean DEFAULT false NOT NULL
);
CREATE SEQUENCE public.sales_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.sales_id_seq OWNED BY public.sales.id;
CREATE TABLE public.sessions (
    id character varying(255) NOT NULL,
    user_id bigint,
    ip_address character varying(45),
    user_agent text,
    payload text NOT NULL,
    last_activity integer NOT NULL
);
CREATE TABLE public.tontines (
    id bigint NOT NULL,
    name character varying(255) NOT NULL,
    type character varying(255),
    amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    members integer DEFAULT 0 NOT NULL,
    created_date timestamp(0) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.tontines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tontines_id_seq OWNED BY public.tontines.id;
CREATE TABLE public.twofa_codes (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    code character varying(255) NOT NULL,
    expires_at timestamp(0) without time zone NOT NULL,
    used boolean DEFAULT false NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.twofa_codes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.twofa_codes_id_seq OWNED BY public.twofa_codes.id;
CREATE TABLE public.users (
    id bigint NOT NULL,
    username character varying(255) NOT NULL,
    password character varying(255) NOT NULL,
    company_name character varying(255),
    phone character varying(255),
    role character varying(255) DEFAULT 'user'::character varying NOT NULL,
    status character varying(255) DEFAULT 'Actif'::character varying NOT NULL,
    plan character varying(255) DEFAULT 'Free'::character varying NOT NULL,
    payment_status character varying(255) DEFAULT 'À jour'::character varying NOT NULL,
    payment_method character varying(255),
    expiration date,
    amount numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    upgrade_status character varying(255) DEFAULT 'validé'::character varying NOT NULL,
    remember_token character varying(100),
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone,
    current_boutique_id bigint,
    twofa_enabled boolean DEFAULT false NOT NULL,
    photo text,
    preferences json
);
CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
CREATE TABLE public.withdrawals (
    id bigint NOT NULL,
    admin_id bigint NOT NULL,
    amount numeric(12,2) NOT NULL,
    method character varying(255) NOT NULL,
    status character varying(255) DEFAULT 'en attente'::character varying NOT NULL,
    created_at timestamp(0) without time zone,
    updated_at timestamp(0) without time zone
);
CREATE SEQUENCE public.withdrawals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.withdrawals_id_seq OWNED BY public.withdrawals.id;
ALTER TABLE ONLY public.activity_logs ALTER COLUMN id SET DEFAULT nextval('public.activity_logs_id_seq'::regclass);
ALTER TABLE ONLY public.admin_settings ALTER COLUMN id SET DEFAULT nextval('public.admin_settings_id_seq'::regclass);
ALTER TABLE ONLY public.admin_transfers ALTER COLUMN id SET DEFAULT nextval('public.admin_transfers_id_seq'::regclass);
ALTER TABLE ONLY public.alerts ALTER COLUMN id SET DEFAULT nextval('public.alerts_id_seq'::regclass);
ALTER TABLE ONLY public.boutique_members ALTER COLUMN id SET DEFAULT nextval('public.boutique_members_id_seq'::regclass);
ALTER TABLE ONLY public.boutiques ALTER COLUMN id SET DEFAULT nextval('public.boutiques_id_seq'::regclass);
ALTER TABLE ONLY public.caisse_closings ALTER COLUMN id SET DEFAULT nextval('public.caisse_closings_id_seq'::regclass);
ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);
ALTER TABLE ONLY public.clients ALTER COLUMN id SET DEFAULT nextval('public.clients_id_seq'::regclass);
ALTER TABLE ONLY public.commande_items ALTER COLUMN id SET DEFAULT nextval('public.commande_items_id_seq'::regclass);
ALTER TABLE ONLY public.failed_jobs ALTER COLUMN id SET DEFAULT nextval('public.failed_jobs_id_seq'::regclass);
ALTER TABLE ONLY public.fournisseurs ALTER COLUMN id SET DEFAULT nextval('public.fournisseurs_id_seq'::regclass);
ALTER TABLE ONLY public.jobs ALTER COLUMN id SET DEFAULT nextval('public.jobs_id_seq'::regclass);
ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);
ALTER TABLE ONLY public.personal_access_tokens ALTER COLUMN id SET DEFAULT nextval('public.personal_access_tokens_id_seq'::regclass);
ALTER TABLE ONLY public.product_units ALTER COLUMN id SET DEFAULT nextval('public.product_units_id_seq'::regclass);
ALTER TABLE ONLY public.products ALTER COLUMN id SET DEFAULT nextval('public.products_id_seq'::regclass);
ALTER TABLE ONLY public.restock_deliveries ALTER COLUMN id SET DEFAULT nextval('public.restock_deliveries_id_seq'::regclass);
ALTER TABLE ONLY public.restock_orders ALTER COLUMN id SET DEFAULT nextval('public.restock_orders_id_seq'::regclass);
ALTER TABLE ONLY public.returns ALTER COLUMN id SET DEFAULT nextval('public.returns_id_seq'::regclass);
ALTER TABLE ONLY public.sales ALTER COLUMN id SET DEFAULT nextval('public.sales_id_seq'::regclass);
ALTER TABLE ONLY public.tontines ALTER COLUMN id SET DEFAULT nextval('public.tontines_id_seq'::regclass);
ALTER TABLE ONLY public.twofa_codes ALTER COLUMN id SET DEFAULT nextval('public.twofa_codes_id_seq'::regclass);
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);
ALTER TABLE ONLY public.withdrawals ALTER COLUMN id SET DEFAULT nextval('public.withdrawals_id_seq'::regclass);
ALTER TABLE ONLY public.activity_logs
    ADD CONSTRAINT activity_logs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.admin_transfers
    ADD CONSTRAINT admin_transfers_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.boutique_members
    ADD CONSTRAINT boutique_members_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.boutiques
    ADD CONSTRAINT boutiques_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.cache_locks
    ADD CONSTRAINT cache_locks_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.cache
    ADD CONSTRAINT cache_pkey PRIMARY KEY (key);
ALTER TABLE ONLY public.caisse_closings
    ADD CONSTRAINT caisse_closings_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.caisse_closings
    ADD CONSTRAINT caisse_closings_user_boutique_date_unique UNIQUE (user_id, boutique_id, date);
ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.commande_items
    ADD CONSTRAINT commande_items_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.failed_jobs
    ADD CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid);
ALTER TABLE ONLY public.fournisseurs
    ADD CONSTRAINT fournisseurs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.job_batches
    ADD CONSTRAINT job_batches_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.jobs
    ADD CONSTRAINT jobs_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (email);
ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.personal_access_tokens
    ADD CONSTRAINT personal_access_tokens_token_unique UNIQUE (token);
ALTER TABLE ONLY public.product_units
    ADD CONSTRAINT product_units_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.restock_deliveries
    ADD CONSTRAINT restock_deliveries_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.restock_orders
    ADD CONSTRAINT restock_orders_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_client_uuid_unique UNIQUE (client_uuid);
ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.tontines
    ADD CONSTRAINT tontines_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.twofa_codes
    ADD CONSTRAINT twofa_codes_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);
ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_unique UNIQUE (username);
ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_pkey PRIMARY KEY (id);
CREATE INDEX activity_logs_owner_id_index ON public.activity_logs USING btree (owner_id);
CREATE INDEX boutique_members_invite_token_index ON public.boutique_members USING btree (invite_token);
CREATE INDEX boutique_members_member_id_index ON public.boutique_members USING btree (member_id);
CREATE INDEX boutique_members_owner_id_email_index ON public.boutique_members USING btree (owner_id, email);
CREATE INDEX boutiques_owner_id_index ON public.boutiques USING btree (owner_id);
CREATE INDEX cache_expiration_index ON public.cache USING btree (expiration);
CREATE INDEX cache_locks_expiration_index ON public.cache_locks USING btree (expiration);
CREATE INDEX clients_user_id_name_index ON public.clients USING btree (user_id, name);
CREATE INDEX failed_jobs_connection_queue_failed_at_index ON public.failed_jobs USING btree (connection, queue, failed_at);
CREATE INDEX fournisseurs_user_id_name_index ON public.fournisseurs USING btree (user_id, name);
CREATE INDEX jobs_queue_index ON public.jobs USING btree (queue);
CREATE INDEX personal_access_tokens_expires_at_index ON public.personal_access_tokens USING btree (expires_at);
CREATE INDEX personal_access_tokens_tokenable_type_tokenable_id_index ON public.personal_access_tokens USING btree (tokenable_type, tokenable_id);
CREATE INDEX products_barcode_index ON public.products USING btree (barcode);
CREATE INDEX products_user_boutique_idx ON public.products USING btree (user_id, boutique_id);
CREATE INDEX restock_deliveries_user_id_created_at_index ON public.restock_deliveries USING btree (user_id, created_at);
CREATE INDEX restock_orders_user_id_created_at_index ON public.restock_orders USING btree (user_id, created_at);
CREATE INDEX returns_user_id_created_at_index ON public.returns USING btree (user_id, created_at);
CREATE INDEX sales_user_created_idx ON public.sales USING btree (user_id, created_at);
CREATE INDEX sessions_last_activity_index ON public.sessions USING btree (last_activity);
CREATE INDEX sessions_user_id_index ON public.sessions USING btree (user_id);
ALTER TABLE ONLY public.admin_settings
    ADD CONSTRAINT admin_settings_admin_id_foreign FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.admin_transfers
    ADD CONSTRAINT admin_transfers_admin_id_foreign FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.boutique_members
    ADD CONSTRAINT boutique_members_member_id_foreign FOREIGN KEY (member_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.boutique_members
    ADD CONSTRAINT boutique_members_owner_id_foreign FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.boutiques
    ADD CONSTRAINT boutiques_owner_id_foreign FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.caisse_closings
    ADD CONSTRAINT caisse_closings_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.commande_items
    ADD CONSTRAINT commande_items_commande_id_foreign FOREIGN KEY (commande_id) REFERENCES public.restock_orders(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.commande_items
    ADD CONSTRAINT commande_items_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.fournisseurs
    ADD CONSTRAINT fournisseurs_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.product_units
    ADD CONSTRAINT product_units_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_category_id_foreign FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.restock_deliveries
    ADD CONSTRAINT restock_deliveries_commande_id_foreign FOREIGN KEY (commande_id) REFERENCES public.restock_orders(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.restock_deliveries
    ADD CONSTRAINT restock_deliveries_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.restock_orders
    ADD CONSTRAINT restock_orders_fournisseur_id_foreign FOREIGN KEY (fournisseur_id) REFERENCES public.fournisseurs(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.restock_orders
    ADD CONSTRAINT restock_orders_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_sale_id_foreign FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.returns
    ADD CONSTRAINT returns_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_client_id_foreign FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_product_id_foreign FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.sales
    ADD CONSTRAINT sales_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.twofa_codes
    ADD CONSTRAINT twofa_codes_user_id_foreign FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE ONLY public.withdrawals
    ADD CONSTRAINT withdrawals_admin_id_foreign FOREIGN KEY (admin_id) REFERENCES public.users(id) ON DELETE CASCADE;
\unrestrict uUh5LJ1U3SyqwB5JvlfijhjLjcCM1J5UnlGmYgTZJRs9sNlpuDs9AEwByiQ5i6D
