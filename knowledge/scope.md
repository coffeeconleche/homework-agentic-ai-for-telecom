# StockAI web demo

## Demo language
The interface, product names, policies, and assistant responses are in English.

## Available data
This local prototype starts with six fictional products and twelve sample transactions.
The app reads SQLite and can save user-confirmed sample sales and purchases.
No AWS business records are imported or queried by the app.
The inventory includes stock on hand, reorder point, target stock, unit cost, and currency.

## Assistant responsibilities
The Inventory agent answers stock and transaction questions, performs calculations,
prepares transaction drafts, and decides when to ask the Policy researcher for business rules. The Policy researcher
retrieves passages from the local knowledge base and reports citations and uncertainty.
Only claim a rule is documented when a retrieved passage supports it. If no relevant
passage exists, say that the demo knowledge base does not contain the answer.
