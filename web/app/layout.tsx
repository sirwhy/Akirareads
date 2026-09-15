import type { Metadata } from 'next';
import { Sora, Bebas_Neue, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/components/Toast';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sora',
  display: 'swap',
});

const bebas = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas',
  display: 'swap',
});

const jbmono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jbmono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AKIRAREADS — Baca Manhwa, Manga, dan Manhua Gratis',
    template: '%s · AKIRAREADS',
  },
  description:
    'Platform baca manhwa, manga, dan manhua terbaik. Nikmati ribuan judul pilihan secara gratis.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${sora.variable} ${bebas.variable} ${jbmono.variable}`}>
      <body className="bg-dark-900 text-white antialiased">
        <AuthProvider>
          <ToastProvider>
            <div className="min-h-screen bg-dark-900 text-white flex flex-col">
              <Header />
              <main className="flex-1">{children}</main>
              <Footer />
            </div>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
