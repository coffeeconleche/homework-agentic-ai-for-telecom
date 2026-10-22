import { BookOpen, Package, ScanLine } from 'lucide-react'
import FluidOrb from './components/rare/FluidOrb'

export default function StudioWelcome() {
  return (
    <div className="studio-hero">
      <div className="studio-orb-stage">
        <div className="studio-orbit" aria-hidden="true" />
        <FluidOrb />
        <span className="studio-orb-note note-inventory">
          <Package size={13} />
          Stock checks
        </span>
        <span className="studio-orb-note note-knowledge">
          <BookOpen size={13} />
          Shop knowledge
        </span>
      </div>
      <div className="studio-eyebrow">
        <ScanLine size={13} />
        YOUR INVENTORY, IN FOCUS
      </div>
      <h2>
        A little insight.
        <br />
        <span>A clearer next move.</span>
      </h2>
      <p>
        Ask about your stock, find the right policy,
        <br className="studio-copy-break" /> or turn a question into a plan.
      </p>
    </div>
  )
}
