// Writes the ORION wordmark as static SVGs: node tools/make_logo.mjs
import { writeFileSync } from 'node:fs';
import { orionLogo } from '../js/logo.js';
const onDark = (svg) => svg.replace('<g fill="none"', '<rect x="-60" y="-40" width="644" height="220" fill="#0B0B0C"/><g fill="none"').replace('viewBox="0 10 524 120"', 'viewBox="-40 -20 604 180"');
writeFileSync(new URL('../icons/orion-logo.svg', import.meta.url), orionLogo());
writeFileSync(new URL('../icons/orion-logo-dark.svg', import.meta.url), onDark(orionLogo()));
console.log('wrote icons/orion-logo.svg, icons/orion-logo-dark.svg');
