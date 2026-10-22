# Demo transaction guide

## Sales and purchases
A purchase increases stock; a sale decreases stock. In the original WhatsApp system,
transaction_type 0 represents a purchase and 1 represents a sale. The web demo uses
the readable strings purchase and sale. PEN means Peruvian soles.

## Recording a transaction
For an existing product, collect its exact SKU, a positive whole-unit quantity, and
the total price in the product's currency (PEN). Confirm ambiguous quantities and whether
a quoted price is per unit or a total. Use the calculator for unit-price conversions.
Do not assume that an item's unit cost is its selling price.

The assistant can prepare a sale or purchase draft. This does not change inventory.
The user must review the displayed card and click Confirm to save the transaction and
update sample stock, or Cancel to discard it. A typed confirmation does not save a
transaction. Repeated clicks or request retries cannot save the same draft twice.
A sale cannot exceed available stock. If stock changed since preparation, cancel the
old draft and prepare a new one. Product creation, product editing, fractional quantities,
direct stock adjustments, and transaction editing are outside this demo's scope.

## Reports
Sales totals are revenue, not profit. Purchase costs and current inventory values do
not establish cost of goods sold. Do not claim gross profit without the required cost data.
The initial transactions are a small fixture dated October 2026. User-confirmed sample
transactions are added with the current UTC timestamp. No real business feed is connected.
