-- Existing rows receive the default from ADD COLUMN and stay verified.
-- SET DEFAULT then applies only to later inserts, so new password accounts are unverified.
-- password_hash is unchanged and remains required.
ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ALTER COLUMN email_verified SET DEFAULT false;

CREATE TABLE email_verification_codes (
  id         UUID PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash  VARCHAR(64) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);
CREATE INDEX email_verification_codes_user ON email_verification_codes (user_id);
