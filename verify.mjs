#!/usr/bin/env node
/*
 * LUCID: verify a concept dictionary against the schema's rules. Zero deps.
 *
 *   node verify.mjs path/to/registry.json
 *
 * Asserts every concept has a non-empty gloss, every source has a label, and no
 * unknown fields are present. Exits nonzero on any failure. Also exported as
 * validateRegistry for programmatic use.
 */
import { readFileSync } from 'node:fs'

const CONCEPT_KEYS = new Set(['gloss', 'explainer', 'detail', 'domain', 'sources', 'relations', 'visual'])
const SOURCE_KEYS = new Set(['label', 'href', 'note'])
const RELATION_KEYS = new Set(['broader', 'narrower', 'related'])

export function validateRegistry(registry) {
  const errors = []
  if (registry == null || typeof registry !== 'object' || Array.isArray(registry)) {
    return ['registry must be an object mapping a term to a concept']
  }
  for (const [term, c] of Object.entries(registry)) {
    const at = `"${term}"`
    if (c == null || typeof c !== 'object' || Array.isArray(c)) {
      errors.push(`${at}: concept must be an object`)
      continue
    }
    if (typeof c.gloss !== 'string' || c.gloss.trim() === '') {
      errors.push(`${at}: gloss is required and must be a non-empty string`)
    }
    for (const k of Object.keys(c)) {
      if (!CONCEPT_KEYS.has(k)) errors.push(`${at}: unknown field "${k}"`)
    }
    if ('explainer' in c && typeof c.explainer !== 'string') errors.push(`${at}: explainer must be a string`)
    if ('detail' in c && typeof c.detail !== 'string') errors.push(`${at}: detail must be a string`)
    if ('domain' in c && typeof c.domain !== 'string') errors.push(`${at}: domain must be a string`)
    if ('sources' in c) {
      if (!Array.isArray(c.sources)) {
        errors.push(`${at}: sources must be an array`)
      } else {
        c.sources.forEach((s, i) => {
          const sa = `${at} sources[${i}]`
          if (s == null || typeof s !== 'object' || Array.isArray(s)) {
            errors.push(`${sa}: must be an object`)
            return
          }
          if (typeof s.label !== 'string' || s.label.trim() === '') errors.push(`${sa}: label is required`)
          for (const k of Object.keys(s)) {
            if (!SOURCE_KEYS.has(k)) errors.push(`${sa}: unknown field "${k}"`)
          }
        })
      }
    }
    if ('relations' in c) {
      const r = c.relations
      if (r == null || typeof r !== 'object' || Array.isArray(r)) {
        errors.push(`${at}: relations must be an object`)
      } else {
        for (const k of Object.keys(r)) {
          if (!RELATION_KEYS.has(k)) {
            errors.push(`${at} relations: unknown kind "${k}"`)
          } else if (!Array.isArray(r[k])) {
            errors.push(`${at} relations.${k}: must be an array`)
          } else {
            r[k].forEach((id, i) => {
              if (typeof id !== 'string' || id.trim() === '') errors.push(`${at} relations.${k}[${i}]: must be a non-empty string`)
            })
          }
        }
      }
    }
    if ('visual' in c) {
      const v = c.visual
      if (v == null || typeof v !== 'object' || Array.isArray(v)) {
        errors.push(`${at}: visual must be an object`)
      } else if (v.spec == null || typeof v.spec !== 'object' || Array.isArray(v.spec)) {
        errors.push(`${at} visual: spec is required and must be an object`)
      }
    }
  }
  return errors
}

function main() {
  const path = process.argv[2]
  if (!path) {
    console.error('usage: node verify.mjs <registry.json>')
    process.exit(2)
  }
  let registry
  try {
    registry = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`could not read ${path}: ${e.message}`)
    process.exit(2)
  }
  const errors = validateRegistry(registry)
  const count = registry && typeof registry === 'object' ? Object.keys(registry).length : 0
  if (errors.length) {
    console.error(`LUCID: ${errors.length} problem(s) across ${count} concept(s):`)
    for (const e of errors) console.error('  - ' + e)
    process.exit(1)
  }
  console.log(`LUCID: ${count} concept(s) valid.`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
