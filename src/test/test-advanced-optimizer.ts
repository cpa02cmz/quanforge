/**
 * Test script for Advanced Backend Optimizer Service
 */

import { advancedBackendOptimizer } from '../../services/advancedBackendOptimizer';

async function runTests() {
  console.log('Testing Advanced Backend Optimizer...');

  // Test 1: Check singleton instance
  console.log('1. Testing singleton instance...');
  const instance1 = advancedBackendOptimizer;
  const instance2 = advancedBackendOptimizer;
  console.log('   Same instance:', instance1 === instance2 ? 'PASS' : 'FAIL');

  // Test 2: Test basic functionality
  console.log('\n2. Testing basic functionality...');
  try {
    // Test executeWithPredictiveCaching
    let callCount = 0;
    const testOperation = async () => {
      callCount++;
      return `result-${callCount}`;
    };
    
    const result1 = await advancedBackendOptimizer.executeWithPredictiveCaching('test-key', testOperation);
    const result2 = await advancedBackendOptimizer.executeWithPredictiveCaching('test-key', testOperation);
    
    console.log(`   Predictive caching - First call: ${result1}, Second call: ${result2}, Call count: ${callCount}`);
    console.log('   Predictive caching works:', callCount === 1 ? 'PASS' : 'FAIL');
  } catch (error) {
    console.log('   Predictive caching test failed:', error);
  }

  // Test 3: Test metrics
  console.log('\n3. Testing metrics...');
  try {
    const metrics = advancedBackendOptimizer.getMetrics();
    console.log('   Metrics keys present:', Object.keys(metrics).length > 0 ? 'PASS' : 'FAIL');
    console.log('   Metrics:', JSON.stringify(metrics, null, 2));
  } catch (error) {
    console.log('   Metrics test failed:', error);
  }

  // Test 4: Test configuration
  console.log('\n4. Testing configuration...');
  try {
    const config = advancedBackendOptimizer.getConfig();
    console.log('   Config present:', config ? 'PASS' : 'FAIL');
    console.log('   Config:', JSON.stringify(config, null, 2));
  } catch (error) {
    console.log('   Config test failed:', error);
  }

  // Test 5: Test recommendations
  console.log('\n5. Testing recommendations...');
  try {
    const recommendations = advancedBackendOptimizer.getOptimizationRecommendations();
    console.log('   Recommendations present:', Array.isArray(recommendations) ? 'PASS' : 'FAIL');
    console.log('   Recommendations count:', recommendations.length);
  } catch (error) {
    console.log('   Recommendations test failed:', error);
  }

  // Test 6: Test adaptive throttling
  console.log('\n6. Testing adaptive throttling...');
  try {
    const throttledResult = await advancedBackendOptimizer.executeWithAdaptiveThrottling(
      async () => 'throttled-success',
      'test-resource'
    );
    console.log('   Adaptive throttling result:', throttledResult);
    console.log('   Adaptive throttling works:', throttledResult === 'throttled-success' ? 'PASS' : 'FAIL');
  } catch (error) {
    console.log('   Adaptive throttling test failed:', error);
  }

  // Test 7: Test intelligent retry
  console.log('\n7. Testing intelligent retry...');
  try {
    let retryCallCount = 0;
    const retryOperation = async () => {
      retryCallCount++;
      if (retryCallCount < 2) {
        throw new Error('Simulated failure');
      }
      return 'retry-success';
    };
    
    const retryResult = await advancedBackendOptimizer.executeWithIntelligentRetry(retryOperation);
    console.log('   Intelligent retry result:', retryResult);
    console.log('   Retry call count:', retryCallCount);
    console.log('   Intelligent retry works:', retryResult === 'retry-success' && retryCallCount === 2 ? 'PASS' : 'FAIL');
  } catch (error) {
    console.log('   Intelligent retry test failed:', error);
  }

  console.log('\nAdvanced Backend Optimizer tests completed.');
}

// Run the tests
runTests().catch(console.error);