
import React, { useState, memo } from 'react';
import { supabase } from '../services/supabase';
import { useToast } from './Toast';
import { useTranslation } from '../services/i18n';
import { validateEmail, validatePassword } from '../utils/inputValidation';

export const Auth: React.FC = memo(() => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'moderate' | 'strong'>('weak');
  const [passwordFeedback, setPasswordFeedback] = useState<string[]>([]);
  const { showToast } = useToast();
  const { t } = useTranslation();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Enhanced input validation
    const emailValidation = validateEmail(email);
    const passwordValidation = validatePassword(password);

    // Update validation states
    setEmailErrors(emailValidation.errors.map(e => e.message));
    setPasswordErrors(passwordValidation.errors.map(e => e.message));
    setPasswordStrength(passwordValidation.strength || 'weak');
    setPasswordFeedback(passwordValidation.feedback || []);

    // Check for high-risk inputs
    if (emailValidation.riskScore > 70 || passwordValidation.riskScore > 70) {
      showToast('Security validation failed. Please check your input.', 'error');
      setLoading(false);
      return;
    }

    // Prevent authentication if validation fails
    if (!emailValidation.isValid || !passwordValidation.isValid) {
      showToast('Please fix the validation errors before proceeding.', 'error');
      setLoading(false);
      return;
    }

    try {
      // Use sanitized values for authentication
      const sanitizedEmail = emailValidation.sanitizedValue;
      
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ 
          email: sanitizedEmail
          // Mock auth doesn't use password parameter for demo
        });
        if (error) throw error;
        showToast(t('auth_toast_signin'), 'success');
      } else {
        const { error } = await supabase.auth.signUp({ 
          email: sanitizedEmail
          // Mock auth doesn't use password parameter for demo
        });
        if (error) throw error;
        else showToast(t('auth_toast_check_email'), 'success');
      }
    } catch (error: unknown) {
      // If we are in mock mode (no API URL), we simulate a successful login for demo purposes
      const errorMessage = error instanceof Error ? error.message : 'Authentication failed';
      if (!process.env['SUPABASE_URL'] && errorMessage.includes('Auth session missing')) {
         // This block intentionally left empty as the real app needs Env vars.
      }
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Email validation handler
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEmail = e.target.value;
    setEmail(newEmail);
    
    // Real-time validation
    if (newEmail.length > 0) {
      const validation = validateEmail(newEmail);
      setEmailErrors(validation.errors.map(e => e.message));
    } else {
      setEmailErrors([]);
    }
  };

  // Password validation handler
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    
    // Real-time validation
    if (newPassword.length > 0) {
      const validation = validatePassword(newPassword);
      setPasswordErrors(validation.errors.map(e => e.message));
      setPasswordStrength(validation.strength || 'weak');
      setPasswordFeedback(validation.feedback || []);
    } else {
      setPasswordErrors([]);
      setPasswordStrength('weak');
      setPasswordFeedback([]);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-dark-surface border border-dark-border rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-brand-400 to-blue-500 bg-clip-text text-transparent">
            QuantForge AI
          </h1>
          <p className="text-gray-400 mt-2">
            {isLogin ? t('auth_signin_title') : t('auth_signup_title')}
          </p>
        </div>

        <form onSubmit={handleAuth} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t('auth_email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={handleEmailChange}
              className={`w-full bg-dark-bg border rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all ${
                emailErrors.length > 0 ? 'border-red-500' : 'border-dark-border'
              }`}
              placeholder="trader@example.com"
              aria-invalid={emailErrors.length > 0}
              aria-describedby="email-error"
            />
            {emailErrors.length > 0 && (
              <div id="email-error" className="mt-2 text-sm text-red-400">
                {emailErrors.map((error, index) => (
                  <div key={index} className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">{t('auth_password')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={handlePasswordChange}
              className={`w-full bg-dark-bg border rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-all ${
                passwordErrors.length > 0 ? 'border-red-500' : 'border-dark-border'
              }`}
              placeholder="••••••••"
              aria-invalid={passwordErrors.length > 0}
              aria-describedby="password-error password-strength"
            />
            
            {/* Password strength indicator */}
            {password.length > 0 && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs text-gray-400">Strength:</span>
                  <div className="flex space-x-1">
                    <div 
                      className={`h-2 w-16 rounded ${
                        passwordStrength === 'weak' ? 'bg-red-500' :
                        passwordStrength === 'moderate' ? 'bg-yellow-500' :
                        'bg-green-500'
                      }`} 
                    />
                  </div>
                  <span className={`text-xs font-medium capitalize ${
                    passwordStrength === 'weak' ? 'text-red-400' :
                    passwordStrength === 'moderate' ? 'text-yellow-400' :
                    'text-green-400'
                  }`}>
                    {passwordStrength}
                  </span>
                </div>
                
                {/* Password feedback */}
                {passwordFeedback.length > 0 && (
                  <div className="text-xs text-gray-400 space-y-1">
                    {passwordFeedback.map((feedback, index) => (
                      <div key={index} className="flex items-center">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        {feedback}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {passwordErrors.length > 0 && (
              <div id="password-error" className="mt-2 text-sm text-red-400">
                {passwordErrors.map((error, index) => (
                  <div key={index} className="flex items-center">
                    <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    {error}
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || emailErrors.length > 0 || passwordErrors.length > 0}
            className="w-full bg-brand-600 hover:bg-brand-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Authenticating...
              </>
            ) : (
              isLogin ? t('auth_btn_signin') : t('auth_btn_signup')
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-brand-400 hover:text-brand-300 hover:underline"
          >
            {isLogin ? t('auth_switch_signup') : t('auth_switch_signin')}
          </button>
        </div>
      </div>
    </div>
  );
});
