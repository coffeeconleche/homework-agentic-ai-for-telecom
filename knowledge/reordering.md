# Demo replenishment policy

These are fictional policies for the local StockAI demo, not the original business's rules.

## Reorder thresholds and quantities
An item needs replenishment when its current stock is at or below its reorder point.
Suggested order quantity = target stock minus current stock, with a minimum of zero.
Estimate purchase cost using the item's unit cost, not its selling price. Report all costs
in the item's currency. Do not combine different currencies into a single total.

## Supplier lead times
Coffee (COF-001) and peanuts (PEA-001) have a supplier lead time of 3 business days.
Milk (MIL-001) has a supplier lead time of 1 business day. Other demo products take
2 business days. These lead times are estimates, not delivery commitments.

## Perishable stock
Milk is perishable. Before recommending its full target quantity, ask for expiry dates
and recent demand if they have not been supplied. The demo dataset has no expiry dates
or demand forecast. Flag this limitation and label any milk estimate provisional.
