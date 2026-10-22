import { ArrowRight, Check, ReceiptText, X } from 'lucide-react'
import type { TransactionDraft } from './api'

type Props = {
  draft: TransactionDraft
  busy: boolean
  deciding: boolean
  onDecide: (id: string, decision: 'confirm' | 'cancel') => void
}

export default function TransactionCard({
  draft,
  busy,
  deciding,
  onDecide,
}: Props) {
  const pending = draft.status === 'pending'
  const label = draft.kind === 'sale' ? 'Sale' : 'Purchase'
  return (
    <section
      className={`transaction-card transaction-${draft.status}`}
      aria-label={`${label} ${draft.status}`}
    >
      <div className="transaction-header">
        <ReceiptText size={17} />
        <span>
          {pending ? `Review this ${draft.kind}` : `${label} ${draft.status}`}
        </span>
        <small>
          {pending ? 'NOT RECORDED YET' : draft.status.toUpperCase()}
        </small>
      </div>
      <div className="transaction-product">
        <strong>{draft.product}</strong>
        <span>{draft.sku}</span>
      </div>
      <dl className="transaction-details">
        <div>
          <dt>Quantity</dt>
          <dd>
            {draft.quantity} × {draft.unit}
          </dd>
        </div>
        <div>
          <dt>Total price</dt>
          <dd>
            {draft.currency} {draft.total}
          </dd>
        </div>
        {draft.status !== 'cancelled' && (
          <div>
            <dt>
              {draft.status === 'confirmed'
                ? 'Stock updated'
                : 'Stock if confirmed'}
            </dt>
            <dd>
              {draft.stock_before}
              <ArrowRight size={12} />
              {draft.stock_after}
            </dd>
          </div>
        )}
      </dl>
      {pending ? (
        <>
          <p>
            Confirm to record this {draft.kind} and update your sample stock.
          </p>
          <div className="transaction-actions">
            <button
              className="confirm-transaction"
              disabled={busy}
              onClick={() => onDecide(draft.id, 'confirm')}
            >
              <Check size={14} />
              {deciding ? 'Saving…' : `Confirm ${draft.kind}`}
            </button>
            <button
              className="cancel-transaction"
              disabled={busy}
              onClick={() => onDecide(draft.id, 'cancel')}
            >
              <X size={14} />
              Cancel
            </button>
          </div>
        </>
      ) : (
        <p role="status">
          {draft.status === 'confirmed'
            ? `Recorded as transaction #${draft.transaction_id}. Sample stock updated.`
            : 'Nothing was recorded. Stock was not changed.'}
        </p>
      )}
    </section>
  )
}
