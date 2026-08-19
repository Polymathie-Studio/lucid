'use client'

/*
 * LUCID: the React binding.
 *
 * A thin wrapper over the same three-depth model and the same lucid.css classes
 * the framework-agnostic core uses, so a React app and a static page look and
 * behave the same. Written with createElement, so there is no build step and it
 * imports into any React app as-is. Import the stylesheet once from the app:
 *
 *   import 'lucid-reader/lucid.css'
 *   import { LucidProvider, Lucid } from 'lucid-reader/react'
 *
 *   <LucidProvider registry={dictionary}><App/></LucidProvider>
 *   <Lucid term="operating shape">operating shape</Lucid>
 *
 * The registry is the site's own concept dictionary, in the shape of schema.json.
 * The machine here holds no content.
 */
import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  useLayoutEffect,
  createElement as h,
  Fragment,
} from 'react'

const LucidContext = createContext({ registry: {} })

export function LucidProvider({ registry, renderVisual, getData, onSelect, children }) {
  return h(
    LucidContext.Provider,
    { value: { registry: registry || {}, renderVisual, getData, onSelect } },
    children,
  )
}

export function useConcept(term) {
  const { registry } = useContext(LucidContext)
  if (!term) return undefined
  return registry[String(term).toLowerCase()]
}

// A relation id humanized to a label when no better one is on hand.
function humanizeId(id) {
  return String(id).split(':').pop().replace(/[-_]/g, ' ')
}

// The relations pass: chips grouped by kind, distinct from the depth axis. When
// the host supplies onSelect, each chip navigates; otherwise it just names the tie.
function relationsNode(c, ctx) {
  const rel = c.relations || {}
  const chips = []
  for (const kind of ['broader', 'narrower', 'related']) {
    for (const id of rel[kind] || []) {
      const inner = [h('span', { key: 'k', className: 'lucid-pop__rel-kind' }, kind), ' ' + humanizeId(id)]
      chips.push(
        ctx.onSelect
          ? h('button', { key: kind + id, type: 'button', className: 'lucid-pop__rel', onClick: () => ctx.onSelect(id) }, inner)
          : h('span', { key: kind + id, className: 'lucid-pop__rel' }, inner),
      )
    }
  }
  return h('span', { key: 'rel', className: 'lucid-pop__rels' }, chips)
}

export function Lucid({ term, concept, children }) {
  const fromRegistry = useConcept(term)
  const ctx = useContext(LucidContext)
  const c = concept || fromRegistry
  const [open, setOpen] = useState(false)
  const [evidenceOpen, setEvidenceOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const wrapRef = useRef(null)
  const markRef = useRef(null)
  const popRef = useRef(null)
  const timer = useRef(null)

  const openNow = () => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    setOpen(true)
  }
  const closeNow = () => {
    setOpen(false)
    setEvidenceOpen(false)
  }
  // A short delay bridges the gap between the mark and the panel, so moving the
  // pointer onto the panel does not close it.
  const closeSoon = () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(closeNow, 140)
  }

  useEffect(() => {
    if (!open) return undefined
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) closeNow()
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        closeNow()
        if (markRef.current) markRef.current.focus()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Place the panel so it never runs off the page or grows taller than the screen:
  // clamp it horizontally into the viewport, open it on whichever side of the mark
  // has more room, and cap its height to that room with internal scroll. Recomputes
  // on scroll, resize, and when the evidence layer opens and the panel grows.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return undefined
    }
    function place() {
      const wrap = wrapRef.current
      if (!wrap) return
      const gutter = 8
      const vw = window.innerWidth
      const vh = window.innerHeight
      const r = wrap.getBoundingClientRect()
      const width = Math.min(320, vw - gutter * 2)
      let leftVp = r.left
      if (leftVp + width > vw - gutter) leftVp = vw - gutter - width
      if (leftVp < gutter) leftVp = gutter
      const spaceBelow = vh - r.bottom - gutter
      const spaceAbove = r.top - gutter
      const below = spaceBelow >= spaceAbove
      const maxHeight = Math.max(120, Math.round((below ? spaceBelow : spaceAbove) - 6))
      setPos({ left: Math.round(leftVp - r.left), width: Math.round(width), maxHeight, above: !below })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, evidenceOpen])

  if (!c) return h(Fragment, null, children)

  const rel = c.relations
  const hasRelations = Boolean(rel && ((rel.broader && rel.broader.length) || (rel.narrower && rel.narrower.length) || (rel.related && rel.related.length)))
  const hasVisual = Boolean(c.visual && ctx.renderVisual)
  const hasDeeper = Boolean(c.explainer || c.detail || hasVisual || hasRelations || (c.sources && c.sources.length))
  const hasEvidence = Boolean(c.sources && c.sources.length)
  const tip = c.domain ? `${c.gloss}\n\n${c.domain}` : c.gloss

  const mark = h(
    'span',
    {
      role: 'button',
      tabIndex: 0,
      'aria-label': tip,
      'data-lucid-deeper': hasDeeper ? '' : undefined,
      'aria-expanded': open,
      className: 'lucid-mark',
      ref: markRef,
      onClick: () => (open ? closeNow() : openNow()),
      onFocus: openNow,
      onBlur: (e) => {
        if (!wrapRef.current || !wrapRef.current.contains(e.relatedTarget)) closeSoon()
      },
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          open ? closeNow() : openNow()
        }
      },
    },
    children,
  )

  let pop = null
  if (open) {
    const parts = [
      h('span', { key: 'g', className: 'lucid-pop__gloss' }, c.gloss),
      c.domain ? h('span', { key: 'd', className: 'lucid-pop__domain' }, c.domain) : null,
      c.explainer ? h('span', { key: 'e', className: 'lucid-pop__explainer' }, c.explainer) : null,
      c.detail ? h('span', { key: 'dt', className: 'lucid-pop__detail' }, c.detail) : null,
      hasVisual
        ? h(
            'span',
            { key: 'v', className: 'lucid-pop__visual' },
            ctx.renderVisual({ spec: c.visual.spec, data: ctx.getData ? ctx.getData(term, c) : undefined, concept: c, term }),
          )
        : null,
      hasRelations ? relationsNode(c, ctx) : null,
      hasEvidence && !evidenceOpen
        ? h(
            'button',
            { key: 'm', type: 'button', className: 'lucid-pop__more', onClick: () => setEvidenceOpen(true) },
            'Open the source',
          )
        : null,
    ]
    if (evidenceOpen) {
      const ev = []
      if (c.sources && c.sources.length) {
        ev.push(
          h('span', { key: 's', className: 'lucid-pop__group' }, [
            h('span', { key: 'sl', className: 'lucid-pop__label lucid-pop__label--support' }, 'What supports it'),
            ...c.sources.map((s, i) =>
              h('span', { key: 'si' + i, className: 'lucid-pop__item' }, [
                s.href ? h('a', { key: 'a', href: s.href, target: '_blank', rel: 'noreferrer' }, s.label) : s.label,
                s.note ? h('span', { key: 'n', className: 'lucid-pop__note' }, ': ' + s.note) : null,
              ]),
            ),
          ]),
        )
      }
      ev.push(
        h(
          'span',
          { key: 'sov', className: 'lucid-pop__sovereign' },
          'The judgment is yours. This shows its reasons, it does not render a verdict.',
        ),
      )
      parts.push(h('span', { key: 'ev', className: 'lucid-pop__evidence' }, ev))
    }
    pop = h(
      'span',
      {
        ref: popRef,
        tabIndex: -1,
        role: 'dialog',
        className: 'lucid-pop' + (pos && pos.above ? ' lucid-pop--above' : ''),
        style: pos
          ? { left: pos.left + 'px', width: pos.width + 'px', maxWidth: 'none', maxHeight: pos.maxHeight + 'px' }
          : { visibility: 'hidden' },
      },
      parts,
    )
  }

  return h(
    'span',
    { ref: wrapRef, style: { position: 'relative', display: 'inline-block' }, onMouseEnter: openNow, onMouseLeave: closeSoon },
    [mark, pop],
  )
}
