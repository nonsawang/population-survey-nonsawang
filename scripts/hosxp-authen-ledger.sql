CREATE TABLE IF NOT EXISTS survey_authen_import_ledger (
 job_id char(36) NOT NULL PRIMARY KEY,
 batch_id char(36) NOT NULL,
 row_number int NOT NULL,
 vn varchar(13) NOT NULL,
 fingerprint char(64) NOT NULL,
 code_hash char(64) NOT NULL,
 approved_by char(36) NOT NULL,
 outcome varchar(20) NOT NULL,
 recorded_at datetime NOT NULL,
 UNIQUE KEY batch_row(batch_id,row_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
