import "./globals.css";
import CommandBar from "./CommandBar";
import { ToastProvider } from "./Toast";

export const metadata = {
  title: "Command Center",
  description: "Autonomous personal command center",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          {children}
          <CommandBar />
        </ToastProvider>
      </body>
    </html>
  );
}
