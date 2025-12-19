// Memory management test - verifies cleanup functions work properly
import { performanceMonitor } from '../../utils/performance';

// Test 1: Verify performance observer cleanup
console.log('Testing performance observer cleanup...');
performanceMonitor.cleanup();
const cleanedObservers = (performanceMonitor as any).observers?.length || 0;

if (cleanedObservers === 0) {
  console.log('✅ Performance observers cleaned up successfully');
} else {
  console.log('❌ Performance observers not properly cleaned');
}

// Test 2: Verify memory cleanup callbacks work
console.log('Testing memory cleanup callbacks...');
(async () => {
  const memoryCleanup = await performanceMonitor.monitorMemoryUsage(1000);
  setTimeout(() => {
    memoryCleanup();
    performanceMonitor.cleanup();
    const cleanedCallbacks = (performanceMonitor as any).memoryCleanupCallbacks?.length || 0;
    
    if (cleanedCallbacks === 0) {
      console.log('✅ Memory cleanup callbacks processed successfully');
    } else {
      console.log('❌ Memory cleanup callbacks not properly cleared');
    }
    
    console.log('Memory management test completed');
  }, 2000);
})();

export default null;