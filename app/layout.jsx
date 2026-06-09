import "./globals.css";
import CommandBar from "./CommandBar";
import { ToastProvider } from "./Toast";

export const metadata = {
  title: "Command Center",
  description: "Autonomous personal command center",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Command Center", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/icon-180.png" },
};

export const viewport = {
  themeColor: "#0E0F12",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="exec">
      <body>
        {/* Executive Dark is the default; honor a saved Classic opt-out before paint */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('cc-theme')==='v1')document.documentElement.removeAttribute('data-theme')}catch(e){}` }} />
        <ToastProvider>
          {children}
          <CommandBar />
        </ToastProvider>
      </body>
    </html>
  );
}
