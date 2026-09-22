# Existing NHSO Authen lookup — not enabled in the automatic importer

`nhso-authen-status.cjs` implements GET check-authen-status with a Kiosk Authentication Token. It does not create Authen, write HOSxP, or certify claim readiness.

Documented reference: NHSO Authentication presentation 25 April 2023, page 9, https://www.saleamhealth.com/wp-content/uploads/2024/06/Authentication_สปสช_25042023.pdf . This historical reference is not proof of current token validity or response schema.

Before live use:

1. Confirm that the locally supplied token is a New Authen Kiosk Authentication Token; do not assume a token found in HOSxP is interchangeable. Never place it in NEXT_PUBLIC variables or Git.
2. Confirm the service code for the specific FIT visit. No OPD example code is defaulted.
3. Read the current visit date and patient identity from HOSxP, with a unique match. Obtain an explicitly selected first visit for read-only verification.
4. Verify current response fields for identity, provider, service/date, code, and cancellation status before implementing a mapper. Multiple matches or missing fields must block writes.
5. A future write must recheck the visit, preserve existing codes, prevent reuse across visits, and log the actor and outcome without raw patient data or tokens.

Current result is always `received_requires_mapping_review`, `writeAllowed: false`. The module is intentionally not wired into the scheduled import or browser: live setup and response mapping remain incomplete. Never log the request URL (it contains CID), Authorization header, or raw response.
