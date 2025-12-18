import fs from 'fs';

const content = fs.readFileSync('services/securityManager.ts', 'utf8');
const lines = content.split('\n');

let open = 0;
let close = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineOpens = (line.match(/\(/g) || []).length;
    const lineCloses = (line.match(/\)/g) || []).length;
    
    open += lineOpens;
    close += lineCloses;
    
    if (open !== close) {
        console.log(`Line ${i + 1}: +${lineOpens} open, +${lineCloses} close, total: open=${open}, close=${close}, diff=${open - close}`);
        console.log(`  Content: ${line.trim()}`);
    }
}