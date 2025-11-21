import { useEffect } from 'react';
import { MessagingProvider } from '../../context/MessagingContext';
import Messaging from './Messaging';

/**
 * Messaging Wrapper Component
 * Ensures MessagingProvider is properly wrapped around the Messaging component
 * This prevents the "useMessaging must be used within a MessagingProvider" error
 */
export default function MessagingWrapper() {
  useEffect(() => {
    console.log('[MessagingWrapper] Component mounted with MessagingProvider');
    return () => {
      console.log('[MessagingWrapper] Component unmounted');
    };
  }, []);

  return (
    <MessagingProvider>
      <Messaging />
    </MessagingProvider>
  );
}