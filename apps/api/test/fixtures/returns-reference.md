# Reference return calculations

All dates in the XIRR example are exactly 365 days apart. The reference annual return is 10% because `-100000 - 50000 / 1.10 + 176000 / 1.10² = 0`. To verify in a spreadsheet, put dates in `A1:A3`, amounts in `B1:B3`, then use `XIRR(B1:B3,A1:A3)`.

The time-weighted result is `(160000 - 50000) / 100000 × 176000 / 160000 − 1 = 0.21`. With 10% inflation, `(1 + 0.21) / (1 + 0.10) − 1 = 0.10`.
