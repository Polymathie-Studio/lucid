import type { ReactNode, ReactElement } from 'react'

export interface EvidenceSource {
  label: string
  href?: string
  note?: string
}

export interface ConceptRelations {
  broader?: string[]
  narrower?: string[]
  related?: string[]
}

export interface VisualBinding {
  /** A declarative, data-deferred visual spec, Vega-Lite-shaped. The data source
   * is named, never inline; the host supplies the rows at render through getData. */
  spec: Record<string, unknown>
  /** The instance-data contract the spec implies: the fields the host must supply. */
  dataContract?: Record<string, unknown>
}

export interface Concept {
  /** Depth one, always present. */
  gloss: string
  /** Depth two, for the reader who needs to use it. */
  explainer?: string
  /** Depth three text, the fuller detail. */
  detail?: string
  /** An optional plain-language frame surfaced at the gloss depth. */
  domain?: string
  /** The deepest rung: the reachable path back to the basis. */
  sources?: EvidenceSource[]
  /** Relations to other concepts. A separate axis from disclosure depth. */
  relations?: ConceptRelations
  /** An optional declarative visual binding, rendered by a host-supplied renderer. */
  visual?: VisualBinding
}

export type ConceptRegistry = Record<string, Concept>

export interface RenderVisualArgs {
  spec: Record<string, unknown>
  data: unknown
  concept: Concept
  term?: string
}

export function LucidProvider(props: {
  registry: ConceptRegistry
  /** Renders a concept's visual binding. Keeps the module zero-dependency: the
   * host brings the visualization runtime (for example Vega-Lite). */
  renderVisual?: (args: RenderVisualArgs) => ReactNode
  /** Supplies the instance data for a concept's visual at render (type versus
   * instance separation: the dictionary holds the spec, the host holds the data). */
  getData?: (term: string | undefined, concept: Concept) => unknown
  /** Called when a reader selects a related concept, so the host can navigate. */
  onSelect?: (id: string) => void
  children: ReactNode
}): ReactElement

export function useConcept(term?: string): Concept | undefined

export function Lucid(props: { term?: string; concept?: Concept; children: ReactNode }): ReactElement
