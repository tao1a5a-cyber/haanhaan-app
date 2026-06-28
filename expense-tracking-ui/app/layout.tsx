import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Thai, Geist_Mono } from 'next/font/google'
import './globals.css'

const notoThai = Noto_Sans_Thai({
  variable: '--font-noto-thai',
  subsets: ['thai', 'latin'],
  weight: ['400', '500', '600', '700'],
})
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'หารหาร — แชร์ค่าใช้จ่ายง่ายๆ',
  description: 'หารหาร แอปจัดการค่าใช้จ่ายร่วมกัน บันทึก หาร เคลียร์ยอด ง่ายสุดๆ',
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', media: '(prefers-color-scheme: light)' },
      { url: '/icon-dark-32x32.png', media: '(prefers-color-scheme: dark)' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#f3ece0',
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="th"
      className={`light ${notoThai.variable} ${geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <head>
        {/* Apply the saved theme before paint to avoid a light→dark flash. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('haanhaan:theme')==='dark'){var e=document.documentElement;e.classList.remove('light');e.classList.add('dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  )
}
