# Synthetic CSV fixtures

- `sparkasse-camt-v8.csv`: two valid bookings, net `97450` cents. The quoted semicolon is part of the purpose. Upload the same bytes to the same account again to test deduplication.
- `sparkasse-mt940.csv`: one valid expense, `-500` cents. This fixture contains `ü` and is stored in UTF-8; tests can encode the same fixture in Windows-1252 to exercise legacy decoding.
- `scalable-transactions.csv`: two executed records, net `-9750` cents as reported in the export; line 4 is `not_executed`.
- `malformed.csv`: one valid booking (`100000` cents); errors on lines 3 (`invalid_date`) and 4 (`invalid_amount`).
- `unknown-layout.csv`: use column indexes 0 date, 1 amount, 2 counterparty, 3 purpose. Two bookings, net `14775` cents.

All transactions, names, and references are synthetic. The IBAN is a public checksum example; instrument identifiers identify public securities.
