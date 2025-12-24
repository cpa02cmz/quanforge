// Script to analyze parentheses balance like the test script does
import fs from 'fs';

const content = fs.readFileSync('services/securityManager.ts', 'utf8');

// Count all parentheses like the test script does
const openParens = (content.match(/\(/g) || []).length;
const closeParens = (content.match(/\)/g) || []).length;

console.log(`Open: ${openParens}, Close: ${closeParens}, Diff: ${openParens - closeParens}`);

// Let's also check for other bracket types that might be unbalanced
const openBraces = (content.match(/{/g) || []).length;
const closeBraces = (content.match(/}/g) || []).length;
console.log(`Open braces: ${openBraces}, Close braces: ${closeBraces}, Diff: ${openBraces - closeBraces}`);

const openBrackets = (content.match(/\[/g) || []).length;
const closeBrackets = (content.match(/\]/g) || []).length;
console.log(`Open brackets: ${openBrackets}, Close brackets: ${closeBrackets}, Diff: ${openBrackets - closeBrackets}`);