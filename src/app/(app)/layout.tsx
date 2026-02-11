import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";

export default function CustomerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold text-slate-900">
            Fableworks
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Link
              href="/create/character"
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              <Sparkles className="size-4" /> Create
            </Link>
            <Link
              href="/books"
              className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-slate-600 hover:bg-slate-100"
            >
              <BookOpen className="size-4" /> My Books
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
