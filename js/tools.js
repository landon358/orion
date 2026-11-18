/**
 * What the UI knows about each of ORION's tool bands, keyed by id.
 *
 * ORION sends the list itself (snapshot `tools`, innermost first), currently 11 for the owner:
 * memory, planner, web, files, voice, email, shopify, meta, clarity, github, printer.
 * A guest gets memory, planner, web and voice.
 * Nothing here decides which tools exist; it only fills in a group, a line of
 * description and two skills when ORION's own entry leaves them out. Unknown ids
 * still work: they fall back to the generic "Tool" group and icon.
 */
export const BANDS = {
  memory:  { name: 'Memory',     group: 'Core',          desc: 'What ORION remembers about you and past work', skills: ['Notes', 'Facts'] },
  planner: { name: 'Planner',    group: 'Core',          desc: 'Scheduled tasks ORION runs himself, reminders, timers and lists', skills: ['Scheduled', 'Reminders'] },
  web:     { name: 'Web',        group: 'Research',      desc: 'Searches, reads pages and cites its sources',   skills: ['Search', 'Research'] },
  files:   { name: 'Files',      group: 'ORION machine', desc: 'Reads documents, sheets, PDFs and pictures; makes files', skills: ['Read', 'Create'] },
  voice:   { name: 'Voice',      group: 'Voice',         desc: 'Whisper hears you, Kokoro speaks',             skills: ['Whisper', 'Kokoro'] },
  email:   { name: 'Email',      group: 'Connectors',    desc: 'Reads and drafts mail; sending needs your OK',  skills: ['Read', 'Draft'] },
  meta:    { name: 'Meta Ads',   group: 'Ciel ops',      desc: 'Ciel ad spend, results and creatives',         skills: ['Insights', 'Ads'] },
  clarity: { name: 'Clarity',    group: 'Ciel ops',      desc: 'Session replays and heatmaps for the Ciel site', skills: ['Replays', 'Heatmaps'] },
  github:  { name: 'GitHub',     group: 'Connectors',    desc: 'Repos, issues and pushes',                     skills: ['Repos', 'Issues'] },
  printer: { name: 'Printer',    group: 'ORION machine', desc: 'The 3D printer',                               skills: ['Print', 'Queue'] },
  shopify: { name: 'Shopify',    group: 'Ciel ops',      desc: 'Ciel orders, products and customers (read only)', skills: ['Orders', 'Products'] },
  // an older id the demo data used; harmless if ORION never sends it
  gelato:  { name: 'Gelato',     group: 'Ciel ops',      desc: 'Print fulfillment for Ciel orders',            skills: ['Print queue', 'Shipping'] },
};

export const groupOf = (id) => BANDS[id]?.group ?? 'Tool';
export const skillsOf = (id) => BANDS[id]?.skills ?? [];
/** A tool entry with ORION's fields first and ours as the fallback. */
export const describe = (t) => ({ ...t, name: t.name || BANDS[t.id]?.name || t.id, desc: t.desc || BANDS[t.id]?.desc || '' });
