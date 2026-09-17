-- Run once by the HOSxP database administrator before enabling this connector.
-- The ledger MUST reside in the same database/transaction as the visit.
CREATE TABLE IF NOT EXISTS survey_fit_import_ledger (
 preparation_id CHAR(36) NOT NULL PRIMARY KEY,
 payload_hash CHAR(64) NOT NULL,
 vn VARCHAR(13) NOT NULL,
 hn VARCHAR(9) NOT NULL,
 screen_date DATE NOT NULL,
 lab_order_number INT NOT NULL,
 lab_result VARCHAR(20) NOT NULL,
 imported_at DATETIME NOT NULL,
 policy_version VARCHAR(40) NOT NULL,
 UNIQUE KEY survey_fit_vn(vn),
 UNIQUE KEY survey_fit_patient_date(hn,screen_date)
) ENGINE=InnoDB;
