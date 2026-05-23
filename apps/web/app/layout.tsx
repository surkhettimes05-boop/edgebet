import "./globals.css";
import { AuthProvider } from "./context/AuthContext";
import AppShell from "./components/AppShell";

export const metadata = {
  title: "EdgeBet // Control Terminal",
  description: "Decision support and discipline auditing platform."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-[#080a0f]">
      <body className="h-full antialiased text-slate-200 terminal-grid">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
