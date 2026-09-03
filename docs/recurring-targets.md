# Recurring targets

Performance targets can be one-time or recurring. A recurring target uses its
start and end dates as the active window; a blank end date is stored as the
open-ended sentinel `2099-12-31` by the mutation layer.

Recurring cadence is selected with the target period:

- Day: the value applies to each Monday-Saturday trading day.
- Week: the value is divided equally across the six Monday-Saturday trading days.
- Month: the value is divided equally across that month's Monday-Saturday trading days.

Sundays receive zero target because stores are closed. Existing one-time targets
retain their explicit period and continue using the same trading-day proration.

The resolver is shared by dashboard revenue, Commercial category targets, daily
store reports, and weekly/monthly store reports. Target changes should be made
with a new effective start date and the previous recurring target should be
ended the day before; this preserves the audit trail and prevents overlapping
target versions from being summed.
