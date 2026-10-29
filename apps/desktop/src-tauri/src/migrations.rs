//! Migrações do banco SQLite. Cada item do array é aplicado uma única vez,
//! controlado por `PRAGMA user_version`. Nunca edite uma migração já publicada:
//! adicione uma nova ao final.
//!
//! Convenção: todos os valores monetários são INTEGER em centavos (evita erro de arredondamento).

pub const MIGRATIONS: &[&str] = &[
    // v1 — estrutura inicial
    r#"
    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS members (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        relation   TEXT,
        color      TEXT DEFAULT '#0f766e',
        created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS categories (
        id       INTEGER PRIMARY KEY AUTOINCREMENT,
        name     TEXT NOT NULL,
        kind     TEXT NOT NULL CHECK (kind IN ('receita','despesa')),
        color    TEXT DEFAULT '#64748b',
        archived INTEGER DEFAULT 0
    );

    -- Contas bancárias, carteira, investimentos e cartões de crédito
    CREATE TABLE IF NOT EXISTS accounts (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        name            TEXT NOT NULL,
        type            TEXT NOT NULL CHECK (type IN ('corrente','poupanca','investimento','carteira','cartao_credito','outro')),
        bank            TEXT,
        initial_balance INTEGER DEFAULT 0,
        credit_limit    INTEGER DEFAULT 0,
        closing_day     INTEGER,
        due_day         INTEGER,
        color           TEXT DEFAULT '#0f766e',
        archived        INTEGER DEFAULT 0,
        created_at      TEXT DEFAULT (datetime('now'))
    );

    -- Fontes de renda: CLT, PJ, autônomo, aposentadoria, aluguel...
    CREATE TABLE IF NOT EXISTS income_sources (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        type        TEXT NOT NULL,
        gross       INTEGER DEFAULT 0,
        net         INTEGER NOT NULL DEFAULT 0,
        pay_day     INTEGER DEFAULT 5,
        member_id   INTEGER REFERENCES members(id) ON DELETE SET NULL,
        account_id  INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        active      INTEGER DEFAULT 1,
        notes       TEXT
    );

    -- Compromissos: contas avulsas/recorrentes, financiamentos, empréstimos, consórcios, assinaturas
    CREATE TABLE IF NOT EXISTS commitments (
        id                 INTEGER PRIMARY KEY AUTOINCREMENT,
        name               TEXT NOT NULL,
        type               TEXT NOT NULL,
        amount             INTEGER NOT NULL DEFAULT 0,
        total_installments INTEGER,
        start_date         TEXT NOT NULL,
        due_day            INTEGER NOT NULL DEFAULT 10,
        interest_rate      REAL,
        financed_amount    INTEGER,
        category_id        INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        account_id         INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        scope              TEXT DEFAULT 'familiar' CHECK (scope IN ('pessoal','familiar')),
        member_id          INTEGER REFERENCES members(id) ON DELETE SET NULL,
        active             INTEGER DEFAULT 1,
        notes              TEXT
    );

    CREATE TABLE IF NOT EXISTS trips (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        name        TEXT NOT NULL,
        destination TEXT,
        start_date  TEXT,
        end_date    TEXT,
        budget      INTEGER DEFAULT 0,
        travelers   INTEGER DEFAULT 1,
        status      TEXT DEFAULT 'planejando' CHECK (status IN ('planejando','confirmada','em_andamento','concluida','cancelada')),
        notes       TEXT
    );

    CREATE TABLE IF NOT EXISTS trip_items (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id     INTEGER NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        category    TEXT NOT NULL,
        description TEXT NOT NULL,
        planned     INTEGER DEFAULT 0,
        actual      INTEGER DEFAULT 0,
        paid        INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS goals (
        id                   INTEGER PRIMARY KEY AUTOINCREMENT,
        name                 TEXT NOT NULL,
        type                 TEXT NOT NULL,
        target               INTEGER NOT NULL,
        current              INTEGER DEFAULT 0,
        target_date          TEXT,
        monthly_contribution INTEGER DEFAULT 0,
        expected_return      REAL DEFAULT 0,
        priority             INTEGER DEFAULT 2,
        notes                TEXT
    );

    CREATE TABLE IF NOT EXISTS goal_contributions (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        amount  INTEGER NOT NULL,
        date    TEXT NOT NULL
    );

    -- Orçamento familiar mensal por categoria
    CREATE TABLE IF NOT EXISTS budgets (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        month       TEXT NOT NULL,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        planned     INTEGER NOT NULL DEFAULT 0,
        UNIQUE (month, category_id)
    );

    -- Lançamentos (receitas, despesas). amount sempre positivo; o sinal vem de `kind`.
    CREATE TABLE IF NOT EXISTS transactions (
        id                INTEGER PRIMARY KEY AUTOINCREMENT,
        kind              TEXT NOT NULL CHECK (kind IN ('receita','despesa')),
        description       TEXT NOT NULL,
        amount            INTEGER NOT NULL,
        date              TEXT NOT NULL,          -- competência / vencimento (no cartão: vencimento da fatura)
        purchase_date     TEXT,                   -- data real da compra (cartão de crédito)
        status           TEXT NOT NULL DEFAULT 'pago' CHECK (status IN ('pago','pendente')),
        category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
        account_id        INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
        scope             TEXT DEFAULT 'pessoal' CHECK (scope IN ('pessoal','familiar')),
        member_id         INTEGER REFERENCES members(id) ON DELETE SET NULL,
        commitment_id     INTEGER REFERENCES commitments(id) ON DELETE SET NULL,
        income_source_id  INTEGER REFERENCES income_sources(id) ON DELETE SET NULL,
        trip_id           INTEGER REFERENCES trips(id) ON DELETE SET NULL,
        installment_no    INTEGER,
        installment_total INTEGER,
        group_key         TEXT,
        ref_key           TEXT UNIQUE,
        notes             TEXT,
        created_at        TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_tx_date     ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_tx_kind     ON transactions(kind);
    CREATE INDEX IF NOT EXISTS idx_tx_account  ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_tx_status   ON transactions(status);

    -- Categorias padrão (brasileiras)
    INSERT INTO categories (name, kind, color) VALUES
      ('Salário',            'receita', '#16a34a'),
      ('Pró-labore / PJ',    'receita', '#22c55e'),
      ('13º e férias',       'receita', '#15803d'),
      ('Freelance',          'receita', '#4ade80'),
      ('Aluguel recebido',   'receita', '#65a30d'),
      ('Rendimentos',        'receita', '#0d9488'),
      ('Outras receitas',    'receita', '#84cc16'),
      ('Moradia',            'despesa', '#b45309'),
      ('Financiamento',      'despesa', '#9a3412'),
      ('Energia / Água / Gás','despesa','#ca8a04'),
      ('Internet / Telefone','despesa', '#7c3aed'),
      ('Mercado',            'despesa', '#dc2626'),
      ('Alimentação fora',   'despesa', '#f97316'),
      ('Transporte',         'despesa', '#2563eb'),
      ('Combustível',        'despesa', '#1d4ed8'),
      ('Saúde',              'despesa', '#db2777'),
      ('Educação',           'despesa', '#0891b2'),
      ('Lazer',              'despesa', '#a855f7'),
      ('Vestuário',          'despesa', '#e11d48'),
      ('Assinaturas',        'despesa', '#6366f1'),
      ('Impostos e taxas',   'despesa', '#475569'),
      ('Cartão de crédito',  'despesa', '#be123c'),
      ('Pets',               'despesa', '#a16207'),
      ('Presentes / Doações','despesa', '#c026d3'),
      ('Viagem',             'despesa', '#0284c7'),
      ('Outras despesas',    'despesa', '#64748b');

    INSERT INTO accounts (name, type, bank, initial_balance, color) VALUES
      ('Carteira', 'carteira', NULL, 0, '#15803d');
    "#,
];
