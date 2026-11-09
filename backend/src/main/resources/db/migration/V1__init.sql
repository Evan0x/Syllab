CREATE TABLE users (
  id            UUID PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower ON users (lower(email));

CREATE TABLE courses (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       VARCHAR(200) NOT NULL,
  term_name  VARCHAR(50),
  term_start DATE,
  term_end   DATE,
  time_zone  VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  CHECK (term_end IS NULL OR term_start IS NULL OR term_end >= term_start)
);
CREATE INDEX courses_user ON courses (user_id);

CREATE TABLE syllabi (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL,
  course_id      UUID NOT NULL,
  file_sha256    CHAR(64) NOT NULL,
  original_name  VARCHAR(255),
  model_name     VARCHAR(100) NOT NULL,
  prompt_version VARCHAR(50) NOT NULL,
  status         VARCHAR(20) NOT NULL CHECK (status IN ('PROCESSING','READY','FAILED')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (course_id, user_id) REFERENCES courses (id, user_id) ON DELETE CASCADE
);

CREATE TABLE events (
  id             UUID PRIMARY KEY,
  user_id        UUID NOT NULL,
  course_id      UUID NOT NULL,
  syllabus_id    UUID REFERENCES syllabi(id) ON DELETE SET NULL,
  title          VARCHAR(300) NOT NULL,
  type           VARCHAR(20) NOT NULL
                 CHECK (type IN ('ASSIGNMENT','EXAM','QUIZ','PROJECT','ADMIN','OTHER')),
  event_date     DATE NOT NULL,
  start_time     TIME,
  end_time       TIME,
  location       VARCHAR(200),
  weight_percent NUMERIC(5,2) CHECK (weight_percent BETWEEN 0 AND 100),
  confidence     VARCHAR(10) CHECK (confidence IN ('HIGH','MEDIUM','LOW')),
  source_quote   TEXT CHECK (char_length(source_quote) <= 500),
  review_status  VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                 CHECK (review_status IN ('PENDING','CONFIRMED')),
  extracted      JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (course_id, user_id) REFERENCES courses (id, user_id) ON DELETE CASCADE,
  CHECK (end_time IS NULL OR (start_time IS NOT NULL AND end_time > start_time))
);
CREATE INDEX events_user_date ON events (user_id, event_date);