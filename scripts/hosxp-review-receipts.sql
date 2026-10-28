CREATE TABLE IF NOT EXISTS survey_person_review_receipts (
 approval_id CHAR(36) PRIMARY KEY,
 fingerprint CHAR(64) NOT NULL,
 recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
