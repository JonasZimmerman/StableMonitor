import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Stable Monitor - Encrypted Stablecoin Monitoring",
  description: "Encrypted stablecoin issuance and monitoring system using Zama FHEVM",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: 'white' }}>
        <main style={{ 
          maxWidth: '1200px', 
          margin: '0 auto', 
          padding: '0 20px 60px 20px',
          minHeight: '100vh'
        }}>
          <nav style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '40px 0',
            borderBottom: '3px solid #D4A574',
            marginBottom: '40px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <div style={{
                width: '48px',
                height: '48px',
                backgroundColor: '#8B4513',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '24px',
                fontWeight: '700'
              }}>
                S
              </div>
              <div>
                <h1 style={{
                  fontSize: '1.75rem',
                  fontWeight: '700',
                  color: '#8B4513',
                  margin: 0
                }}>
                  Stable Monitor
                </h1>
                <p style={{
                  fontSize: '0.85rem',
                  color: '#666',
                  margin: 0
                }}>
                  Encrypted Stablecoin Management System
                </p>
              </div>
            </div>
          </nav>
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}

