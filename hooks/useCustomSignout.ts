import { useRouter } from 'next/router';
import { signOut as nextAuthSignOut } from 'next-auth/react';

export function useCustomSignOut() {
  const router = useRouter();

  const signOut = async () => {
    try {
      // Primero, llamar a signOut de next-auth
      await nextAuthSignOut({ redirect: false });

      // Luego, llamar a nuestro endpoint personalizado
      const response = await fetch('/api/auth/custom-signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Signout failed');
      }

      // Limpiar el estado del cliente
      window.localStorage.clear();
      window.sessionStorage.clear();

      // Limpiar cookies manualmente desde el cliente también
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.split('=');
        document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:01 GMT; path=/; secure; samesite=lax`;
      });

      // Forzar una recarga completa para limpiar todo el estado
      window.location.href = '/auth/login';
    } catch (error) {
      console.error('Error during sign out:', error);
      // En caso de error, intentar redireccionar de todos modos
      window.location.href = '/auth/login';
    }
  };

  return signOut;
}
