import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Fableworks</h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Personalized children&apos;s books where your child becomes the
          protagonist.
        </p>
      </div>
      <div className="flex gap-4">
        <Button asChild>
          <Link href="/create/character">Create a Book</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin">Admin Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
