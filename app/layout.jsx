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
  themeColor: "#4648d4",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {/* apply the saved theme before paint so there's no light flash */}
        <script dangerouslySetInnerHTML={{ __html: `try{if(localStorage.getItem('cc-theme')==='exec')document.documentElement.setAttribute('data-theme','exec')}catch(e){}` }} />
        <ToastProvider>
          {children}
          <CommandBar />
        </ToastProvider>
      </body>
    </html>
  );
}
