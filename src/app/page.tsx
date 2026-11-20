import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-4">
      <h1 className="text-4xl font-semibold text-stone-900">OwnerBuilder</h1>
      <p className="text-lg text-stone-700">
        Run your own custom home build: budget, bids, spending, inspections, loan draws and every document in one place.
      </p>
      <div className="flex gap-3">
        <Link href="/login" className="rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700">
          Sign in or create an account
        </Link>
        <Link href="/dashboard" className="rounded-md border border-stone-300 px-4 py-2 font-medium text-stone-800">
          Go to your projects
        </Link>
      </div>
    </main>
  );
}
