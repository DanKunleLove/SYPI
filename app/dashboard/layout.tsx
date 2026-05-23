export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-[var(--bg-base)]">
      {children}
    </div>
  );
}
