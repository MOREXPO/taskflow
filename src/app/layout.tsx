import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Personal Planner',
  description: 'Planificador personal y gestor de tareas',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const noFlashScript = `
    (function() {
      try {
        var theme = localStorage.getItem('taskflow_theme');
        var useDark = theme ? theme === 'dark' : true;
        if (useDark) {
          document.documentElement.classList.add('dark');
          document.body.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
          document.body.classList.remove('dark');
        }

        if (window.location.hostname === 'personal.iamoex.com') {
          document.title = 'Personal Planner';
        }
      } catch (e) {
        document.documentElement.classList.add('dark');
      }
    })();
  `;

  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="dark">
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
        {children}
      </body>
    </html>
  );
}
