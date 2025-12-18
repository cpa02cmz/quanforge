import fs from 'fs';
const content = fs.readFileSync('services/securityManager.ts', 'utf8');

let open = 0;
let close = 0;

for (let i = 0; i < content.length; i++) {
    const c = content[i];
    
    if (c === '(') {
        open++;
    } else if (c === ')') {
        close++;
    }
}

console.log(`Open: ${open}, Close: ${close}, Difference: ${open - close}`);