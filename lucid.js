/*
 * LUCID: reader-sovereign progressive disclosure. The framework-agnostic core.
 *
 * Mark a term once. Hover gives the gloss, opening gives the explainer and detail,
 * and the source is one reach further: the basis the claim rests on, with the
 * judgment left to the reader. A reader goes further into one concept, never climbs
 * to a rank above another.
 *
 * Zero dependencies, one ES module, no build step.
 *
 *   import { registerConcepts } from 'lucid-reader'
 *   registerConcepts({ 'operating shape': { gloss: '...', explainer: '...' } })
 *   // markup:  <lucid-term>operating shape</lucid-term>
 *   //     or:  <lucid-term term="operating shape">shape</lucid-term>
 *
 * Or with no JavaScript config, declare the dictionary inline:
 *   <script type="application/json" data-lucid-registry>{ "term": { "gloss": "..." } }</script>
 */

const REGISTRY = {}
const pending = new Set()

// Host-supplied hooks, kept out of the module so it stays zero-dependency: the
// host brings the visualization runtime and the instance data, and can handle a
// reader selecting a related concept.
const CONFIG = { renderVisual: null, getData: null, onSelect: null }

export function configure(opts) {
  if (!opts) return
  if ('renderVisual' in opts) CONFIG.renderVisual = opts.renderVisual
  if ('getData' in opts) CONFIG.getData = opts.getData
  if ('onSelect' in opts) CONFIG.onSelect = opts.onSelect
}

export function registerConcepts(dict) {
  if (!dict) return
  for (const key of Object.keys(dict)) REGISTRY[key.toLowerCase()] = dict[key]
  // Wire any marks that connected before their concept was registered.
  for (const node of Array.from(pending)) node.setup()
}

export function getConcept(term) {
  return term ? REGISTRY[String(term).toLowerCase()] : undefined
}

function humanizeId(id) {
  return String(id).split(':').pop().replace(/[-_]/g, ' ')
}

function hasRelations(c) {
  const r = c.relations
  return Boolean(r && ((r.broader && r.broader.length) || (r.narrower && r.narrower.length) || (r.related && r.related.length)))
}

function loadDeclaredRegistry() {
  if (typeof document === 'undefined') return
  const node = document.querySelector('script[type="application/json"][data-lucid-registry]')
  if (!node) return
  try {
    registerConcepts(JSON.parse(node.textContent || '{}'))
  } catch (e) {
    /* a malformed dictionary should not take the page down */
  }
}

function make(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text != null) node.textContent = text
  return node
}

class LucidTerm extends HTMLElement {
  connectedCallback() {
    this.setup()
  }

  setup() {
    if (this._concept) return // already wired

    const term = this.getAttribute('term') || this.textContent
    const c = getConcept(term)
    if (!c) {
      pending.add(this) // no entry yet: wait for its registration
      return
    }

    pending.delete(this)
    this._concept = c
    this.classList.add('lucid-mark')
    this.style.position = 'relative'
    this.title = c.domain ? `${c.gloss}\n\n${c.domain}` : c.gloss

    const hasVisual = Boolean(c.visual && CONFIG.renderVisual)
    const deeper = Boolean(c.explainer || c.detail || hasVisual || hasRelations(c) || (c.sources && c.sources.length))
    if (!deeper) return

    this.setAttribute('data-lucid-deeper', '')
    this.setAttribute('role', 'button')
    this.setAttribute('tabindex', '0')
    this.setAttribute('aria-expanded', 'false')
    this.addEventListener('click', (e) => {
      // Ignore clicks that land inside the open panel (explainer text, links,
      // the evidence button), so only the mark itself toggles.
      if (this._pop && this._pop.contains(e.target)) return
      this.toggle()
    })
    this.addEventListener('keydown', (e) => {
      if (this._pop && this._pop.contains(e.target)) return
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        this.toggle()
      }
    })
  }

  toggle() {
    if (this._open) this.close()
    else this.open()
  }

  open() {
    if (this._open) return
    this._open = true
    this.setAttribute('aria-expanded', 'true')

    const c = this._concept
    const pop = make('span', 'lucid-pop')
    pop.setAttribute('role', 'dialog')
    pop.appendChild(make('span', 'lucid-pop__gloss', c.gloss))
    if (c.domain) pop.appendChild(make('span', 'lucid-pop__domain', c.domain))
    if (c.explainer) pop.appendChild(make('span', 'lucid-pop__explainer', c.explainer))
    if (c.detail) pop.appendChild(make('span', 'lucid-pop__detail', c.detail))

    // The visual, rendered by the host-supplied renderer. The module stays
    // zero-dependency: it hands over the spec and the host-supplied data.
    if (c.visual && CONFIG.renderVisual) {
      const holder = make('span', 'lucid-pop__visual')
      const data = CONFIG.getData ? CONFIG.getData(this.getAttribute('term') || this.textContent, c) : undefined
      const view = CONFIG.renderVisual({ spec: c.visual.spec, data, concept: c, term: this.getAttribute('term') || this.textContent })
      if (view instanceof Node) holder.appendChild(view)
      else if (typeof view === 'string') holder.innerHTML = view
      pop.appendChild(holder)
    }

    // The relations pass, distinct from depth.
    if (hasRelations(c)) {
      const rels = make('span', 'lucid-pop__rels')
      for (const kind of ['broader', 'narrower', 'related']) {
        for (const id of (c.relations[kind] || [])) {
          const chip = make(CONFIG.onSelect ? 'button' : 'span', 'lucid-pop__rel')
          if (CONFIG.onSelect) {
            chip.type = 'button'
            chip.addEventListener('click', (e) => { e.stopPropagation(); CONFIG.onSelect(id) })
          }
          chip.appendChild(make('span', 'lucid-pop__rel-kind', kind))
          chip.appendChild(document.createTextNode(' ' + humanizeId(id)))
          rels.appendChild(chip)
        }
      }
      pop.appendChild(rels)
    }

    const hasEvidence = (c.sources && c.sources.length)
    if (hasEvidence) {
      const more = make('button', 'lucid-pop__more', 'Open the source')
      more.type = 'button'
      more.addEventListener('click', (e) => {
        e.stopPropagation()
        this.showEvidence(pop, more)
      })
      pop.appendChild(more)
    }

    this.appendChild(pop)
    this._pop = pop

    // Place it inside the viewport, then move focus in.
    pop.tabIndex = -1
    this._place()
    pop.focus()

    this._onPlace = () => this._place()
    window.addEventListener('resize', this._onPlace)
    window.addEventListener('scroll', this._onPlace, true)

    this._onDoc = (e) => {
      if (!this.contains(e.target)) this.close()
    }
    this._onKey = (e) => {
      if (e.key === 'Escape') this.close()
    }
    setTimeout(() => {
      document.addEventListener('mousedown', this._onDoc)
      document.addEventListener('keydown', this._onKey)
    }, 0)
  }

  // Place the panel so it never runs off the page or grows taller than the screen:
  // clamp it horizontally into the viewport, open it on whichever side of the mark
  // has more room, and cap its height to that room with internal scroll.
  _place() {
    const pop = this._pop
    if (!pop) return
    const gutter = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    const r = this.getBoundingClientRect()
    const width = Math.min(320, vw - gutter * 2)
    let leftVp = r.left
    if (leftVp + width > vw - gutter) leftVp = vw - gutter - width
    if (leftVp < gutter) leftVp = gutter
    const spaceBelow = vh - r.bottom - gutter
    const spaceAbove = r.top - gutter
    const below = spaceBelow >= spaceAbove
    const maxHeight = Math.max(120, Math.round((below ? spaceBelow : spaceAbove) - 6))
    pop.classList.toggle('lucid-pop--above', !below)
    pop.style.left = Math.round(leftVp - r.left) + 'px'
    pop.style.width = Math.round(width) + 'px'
    pop.style.maxWidth = 'none'
    pop.style.maxHeight = maxHeight + 'px'
  }

  showEvidence(pop, moreBtn) {
    if (this._evidenceShown) return
    this._evidenceShown = true
    if (moreBtn) moreBtn.remove()

    const c = this._concept
    const wrap = make('span', 'lucid-pop__evidence')

    if (c.sources && c.sources.length) {
      const group = make('span', 'lucid-pop__group')
      group.appendChild(make('span', 'lucid-pop__label lucid-pop__label--support', 'What supports it'))
      for (const s of c.sources) {
        const item = make('span', 'lucid-pop__item')
        if (s.href) {
          const a = make('a', null, s.label)
          a.href = s.href
          a.target = '_blank'
          a.rel = 'noreferrer'
          item.appendChild(a)
        } else {
          item.appendChild(document.createTextNode(s.label))
        }
        if (s.note) item.appendChild(make('span', 'lucid-pop__note', `: ${s.note}`))
        group.appendChild(item)
      }
      wrap.appendChild(group)
    }

    wrap.appendChild(
      make('span', 'lucid-pop__sovereign', 'The judgment is yours. This shows its reasons, it does not render a verdict.'),
    )
    pop.appendChild(wrap)
    // The panel just grew, so recompute its height cap and placement.
    this._place()
  }

  close() {
    if (!this._open) return
    this._open = false
    this._evidenceShown = false
    this.setAttribute('aria-expanded', 'false')
    // Return focus to the mark only if focus was inside the panel (Escape, or
    // interacting within it), not when the reader clicked elsewhere.
    const returnFocus = this.contains(document.activeElement)
    if (this._pop) {
      this._pop.remove()
      this._pop = null
    }
    document.removeEventListener('mousedown', this._onDoc)
    document.removeEventListener('keydown', this._onKey)
    if (this._onPlace) {
      window.removeEventListener('resize', this._onPlace)
      window.removeEventListener('scroll', this._onPlace, true)
      this._onPlace = null
    }
    if (returnFocus) {
      try {
        this.focus()
      } catch (e) {
        /* mark may be gone */
      }
    }
  }

  disconnectedCallback() {
    pending.delete(this)
    this.close()
  }
}

if (typeof window !== 'undefined' && window.customElements && !customElements.get('lucid-term')) {
  loadDeclaredRegistry()
  customElements.define('lucid-term', LucidTerm)
}
