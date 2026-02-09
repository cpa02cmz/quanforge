export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'assertive') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;

  document.body.appendChild(announcement);

  setTimeout(() => {
    announcement.remove();
  }, 1000);
};

export const announceFormValidation = (fieldName: string, error: string) => {
  announceToScreenReader(`Form field ${fieldName} has error: ${error}`, 'assertive');
};

export const announceFormSuccess = (formName: string) => {
  announceToScreenReader(`${formName} saved successfully`, 'polite');
};
