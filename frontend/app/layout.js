import { Inter } from 'next/font/google';
import './globals.css';
import { SocketProvider } from "./context/SocketProvider";

const inter = Inter({ subsets: ['latin'] });

export const metadata = {
  title: 'Video Chat App',
  description: 'A real-time video chat application built with Next.js',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}