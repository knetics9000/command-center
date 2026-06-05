import "./globals.css";
import CommandBar from "./CommandBar";

export const metadata = {
  title: "Command Center",
  description: "Autonomous personal command center",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}<CommandBar /></body>
    </html>
  );
}
