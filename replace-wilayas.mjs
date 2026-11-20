import fs from 'node:fs';

const file = 'C:\\Users\\zakaria\\Documents\\REA\\MOVEDZ\\src\\domain\\seedData.ts';
let text = fs.readFileSync(file, 'utf8');

const start = text.indexOf('export const SEED_WILAYAS: Wilaya[] = [');
const end = text.indexOf('export const SEED_ROUTE_MATRIX', start);
if (start < 0 || end < 0) throw new Error('Bloc SEED_WILAYAS introuvable');

text = text.slice(0, start) + '// Les 69 wilayas sont définies dans ./wilayas (Loi 26-06, 2026).\nexport { SEED_WILAYAS } from \'./wilayas\';\n\n' + text.slice(end);
fs.writeFileSync(file, text, 'utf8');
console.log('Bloc remplacé. Wilaya import supprimé si inutilisé :', text.includes('Wilaya,'));
