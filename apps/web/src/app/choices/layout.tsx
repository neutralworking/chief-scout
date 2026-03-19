export default function ChoicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Override root layout's padding — Gaffer needs full viewport
  return (
    <div className="!p-0 !pt-0 -m-4 -mt-16 lg:-m-8 lg:-mt-8">
      {children}
    </div>
  );
}
