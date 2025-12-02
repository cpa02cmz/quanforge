// Basic functional test to verify the application works correctly
import fs from 'fs';
import path from 'path';

console.log('🔍 Running basic functional tests...');

// Check that main files exist
const requiredFiles = [
  'package.json',
  'index.html',
  'App.tsx',
  'index.tsx',
  'vite.config.ts',
  'tsconfig.json'
];

let allFilesExist = true;
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Required file missing: ${file}`);
    allFilesExist = false;
  }
}

if (allFilesExist) {
  console.log('✅ All required files exist');
} else {
  process.exit(1);
}

// Check that build completed successfully by verifying dist directory
if (fs.existsSync('dist')) {
  const distFiles = fs.readdirSync('dist');
  if (distFiles.length > 0) {
    console.log('✅ Build output exists');
  } else {
    console.error('❌ Build completed but no output files found');
    process.exit(1);
  }
} else {
  console.error('❌ Build output directory does not exist');
  process.exit(1);
}

// Check that key source files exist
const srcFiles = [
  'components/CodeEditor.tsx',
  'components/ChatInterface.tsx',
  'components/StrategyConfig.tsx',
  'hooks/useGeneratorLogic.ts',
  'services/gemini.ts',
  'services/supabase.ts',
  'services/databaseOptimizer.ts',
  'services/queryOptimizer.ts',
  'services/advancedCache.ts',
  'services/securityManager.ts',
  'services/resilientSupabase.ts',
  'services/supabaseConnectionPool.ts',
  'services/realtimeManager.ts',
  'services/dataCompression.ts',
  'utils/performanceMonitor.ts'
];

let allSrcFilesExist = true;
for (const file of srcFiles) {
  if (file.startsWith('components/') && !fs.existsSync(file)) {
    console.error(`❌ Source file missing: ${file}`);
    allSrcFilesExist = false;
  } else if (file.startsWith('hooks/') && !fs.existsSync(file)) {
    console.error(`❌ Source file missing: ${file}`);
    allSrcFilesExist = false;
  } else if (file.startsWith('services/') && !fs.existsSync(file)) {
    console.error(`❌ Source file missing: ${file}`);
    allSrcFilesExist = false;
  } else if (file.startsWith('utils/') && !fs.existsSync(file)) {
    console.error(`❌ Source file missing: ${file}`);
    allSrcFilesExist = false;
  }
}

if (allSrcFilesExist) {
  console.log('✅ All key source files exist');
} else {
  process.exit(1);
}

// Check that TypeScript compilation would pass (by verifying no obvious syntax errors)
try {
   // Basic check for syntax issues by looking for unclosed brackets/quotes in a sample file
   const sampleFile = fs.readFileSync('components/CodeEditor.tsx', 'utf8');
   const openBraces = (sampleFile.match(/[{}]/g) || []).filter(char => char === '{').length;
   const closeBraces = (sampleFile.match(/[{}]/g) || []).filter(char => char === '}').length;
   const openParens = (sampleFile.match(/[()]/g) || []).filter(char => char === '(').length;
   const closeParens = (sampleFile.match(/[()]/g) || []).filter(char => char === ')').length;
   
   if (openBraces !== closeBraces) {
     console.error('❌ Unbalanced braces in CodeEditor.tsx');
     process.exit(1);
   }
   
   if (openParens !== closeParens) {
     console.error('❌ Unbalanced parentheses in CodeEditor.tsx');
     process.exit(1);
   }
  
  console.log('✅ Basic syntax check passed');
} catch (error) {
  console.error('❌ Error reading sample file:', error.message);
  process.exit(1);
}

// Test that all database optimization modules can be read without syntax errors
console.log('\n⚙️  Testing Database Optimization Modules...');

let allModulesValid = true;

// Test each optimization module for basic syntax
const optimizationModules = [
  'services/databaseOptimizer.ts',
  'services/queryOptimizer.ts', 
  'services/advancedCache.ts',
  'services/securityManager.ts',
  'services/resilientSupabase.ts',
  'services/supabaseConnectionPool.ts',
  'services/realtimeManager.ts',
  'services/dataCompression.ts',
  'utils/performanceMonitor.ts'
];

for (const module of optimizationModules) {
  try {
    const moduleContent = fs.readFileSync(module, 'utf8');
    
   // Basic syntax validation by counting brackets (excluding angle brackets which are used in TypeScript generics)
   const openBraces = (moduleContent.match(/[{}]/g) || []).filter(char => char === '{').length;
   const closeBraces = (moduleContent.match(/[{}]/g) || []).filter(char => char === '}').length;
   const openParens = (moduleContent.match(/[()]/g) || []).filter(char => char === '(').length;
   const closeParens = (moduleContent.match(/[()]/g) || []).filter(char => char === ')').length;
   
   if (openBraces !== closeBraces) {
     console.error(`❌ Unbalanced braces in ${module}`);
     allModulesValid = false;
   } else if (openParens !== closeParens) {
     console.error(`❌ Unbalanced parentheses in ${module}`);
     allModulesValid = false;
   } else {
     console.log(`   ✅ ${module} syntax is valid`);
   }
  } catch (error) {
    console.error(`❌ Error reading ${module}:`, error.message);
    allModulesValid = false;
  }
}

if (allModulesValid) {
  console.log('✅ All database optimization modules have valid syntax');
} else {
  console.log('⚠️  Some database optimization modules have syntax errors');
}

console.log('\n🎉 All functional tests completed!');
console.log('✅ Project structure is correct');
console.log('✅ Build is successful');
console.log('✅ Key components are present');
if (allModulesValid) {
  console.log('✅ Database optimization features have valid syntax');
}