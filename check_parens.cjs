const fs = require('fs');
const content = fs.readFileSync('services/securityManager.ts', 'utf8');

let parenCount = 0;
let braceCount = 0;
let bracketCount = 0;

for (let i = 0; i < content.length; i++) {
  const char = content[i];
  switch (char) {
    case '(':
      parenCount++;
      break;
    case ')':
      parenCount--;
      break;
    case '{':
      braceCount++;
      break;
    case '}':
      braceCount--;
      break;
    case '[':
      bracketCount++;
      break;
    case ']':
      bracketCount--;
      break;
  }
  
  if (parenCount < 0 || braceCount < 0 || bracketCount < 0) {
    console.log(`Unbalanced at position ${i}: paren=${parenCount}, brace=${braceCount}, bracket=${bracketCount}`);
    console.log(`Around: ${content.substring(Math.max(0, i-50), i+50)}`);
    break;
  }
}

console.log(`Final counts: paren=${parenCount}, brace=${braceCount}, bracket=${bracketCount}`);
