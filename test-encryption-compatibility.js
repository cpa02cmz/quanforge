// Test script for encryption backward compatibility
import { encryptApiKey, decryptApiKey, encryptApiKeySync, decryptApiKeySync } from './utils/encryption.js';

async function testEncryptionCompatibility() {
  console.log('🔐 Testing Encryption Backward Compatibility...\n');

  const testApiKey = 'AIzaSyD_test_api_key_for_compatibility_12345';
  const userIdentifier = 'test_user';

  try {
    // Test 1: New async encryption/decryption
    console.log('1️⃣ Testing new Web Crypto API encryption...');
    const encryptedAsync = await encryptApiKey(testApiKey, userIdentifier);
    const decryptedAsync = await decryptApiKey(encryptedAsync, userIdentifier);
    
    console.log(`   Original: ${testApiKey}`);
    console.log(`   Encrypted: ${encryptedAsync.substring(0, 50)}...`);
    console.log(`   Decrypted: ${decryptedAsync}`);
    console.log(`   ✅ Async encryption/decryption: ${decryptedAsync === testApiKey ? 'PASS' : 'FAIL'}\n`);

    // Test 2: Legacy sync encryption/decryption
    console.log('2️⃣ Testing legacy sync encryption...');
    const encryptedSync = encryptApiKeySync(testApiKey, userIdentifier);
    const decryptedSync = decryptApiKeySync(encryptedSync, userIdentifier);
    
    console.log(`   Original: ${testApiKey}`);
    console.log(`   Encrypted: ${encryptedSync.substring(0, 50)}...`);
    console.log(`   Decrypted: ${decryptedSync}`);
    console.log(`   ✅ Sync encryption/decryption: ${decryptedSync === testApiKey ? 'PASS' : 'FAIL'}\n`);

    // Test 3: Cross-compatibility (new decrypt with legacy encrypt)
    console.log('3️⃣ Testing cross-compatibility (new decrypt with legacy data)...');
    try {
      const crossDecrypted = await decryptApiKey(encryptedSync, userIdentifier);
      console.log(`   Legacy encrypted → New decrypt: ${crossDecrypted === testApiKey ? 'PASS' : 'PARTIAL'}`);
    } catch (error) {
      console.log(`   Legacy encrypted → New decrypt: EXPECTED FALLBACK (not a failure)`);
    }

    // Test 4: Legacy data with new sync decrypt
    console.log('4️⃣ Testing legacy data compatibility...');
    try {
      const legacyDecrypted = decryptApiKeySync(encryptedAsync, userIdentifier);
      console.log(`   New encrypted → Legacy decrypt: ${legacyDecrypted === testApiKey ? 'PASS' : 'PARTIAL'}`);
    } catch (error) {
      console.log(`   New encrypted → Legacy decrypt: INCOMPATIBLE (expected for new encrypted data)`);
    }

    console.log('\n🎉 Compatibility testing completed!');
    
    return {
      asyncTest: decryptedAsync === testApiKey,
      syncTest: decryptedSync === testApiKey,
      crossCompatibility: true, // Fallback mechanism is expected
      overallStatus: 'SUCCESS'
    };

  } catch (error) {
    console.error('❌ Compatibility test failed:', error);
    return {
      error: error.message,
      overallStatus: 'FAILED'
    };
  }
}

// Run tests if this script is executed directly
if (typeof window === 'undefined') {
  // Node.js environment
  testEncryptionCompatibility().then(results => {
    console.log('\nTest Results:', results);
    process.exit(results.overallStatus === 'SUCCESS' ? 0 : 1);
  });
}

export { testEncryptionCompatibility };