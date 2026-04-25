/**
 * Toolbox Notification System
 * Listens for messages from the popup or background script to display toast notifications.
 */

(function() {
  // Prevent duplicate initialization
  if (window.__toolboxNotificationInitialized) return;
  window.__toolboxNotificationInitialized = true;

  // Inject CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = chrome.runtime.getURL('notifications.css');
  (document.head || document.documentElement).appendChild(link);

  // Create Container
  let container = document.getElementById('toolbox-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toolbox-toast-container';
    document.body.appendChild(container); // Append to body to ensure it sits on top effectively
  }

  /**
   * Show a toast notification
   * @param {string} message 
   * @param {string} type 'info' | 'success' | 'error'
   * @param {number} duration ms
   */
  function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toolbox-toast toast-${type}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✔';
    if (type === 'error') icon = '✖';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'toolbox-toast-icon';
    iconSpan.textContent = icon;
    
    const msgSpan = document.createElement('span');
    msgSpan.className = 'toolbox-toast-msg';
    msgSpan.textContent = message;

    toast.append(iconSpan, msgSpan);

    container.appendChild(toast);

    // Auto remove
    setTimeout(() => {
      toast.classList.add('hide');
      toast.addEventListener('animationend', () => {
        toast.remove();
      });
    }, duration);
  }

  function escapeHtml(text) {
    if (!text) return '';
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Message Listener
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'showToast') {
      showToast(request.message, request.type, request.duration);
    }
  });

})();
