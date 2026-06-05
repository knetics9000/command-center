import "./globals.css";

export const metadata = {
  title: "Command Center",
  description: "Autonomous personal command center",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
