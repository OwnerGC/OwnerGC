import { signIn, signInWithGoogle, signUp } from "./actions";

type Props = {
  searchParams: Promise<{ error?: string; message?: string; next?: string }>;
};

const input =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-stone-900 focus:border-amber-600 focus:outline-none";

export default async function LoginPage({ searchParams }: Props) {
  const { error, message, next } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-3xl font-semibold text-stone-900">OwnerBuilder</h1>

      {error && <p className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {message && <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{message}</p>}

      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <button className="w-full rounded-md border border-stone-300 bg-white px-4 py-2 font-medium text-stone-800 hover:bg-stone-50">
          Continue with Google
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-stone-800">Sign in with email</h2>
        <form action={signIn} className="space-y-3">
          <input type="hidden" name="next" value={next ?? ""} />
          <input className={input} name="email" type="email" placeholder="Email" required autoComplete="email" />
          <input className={input} name="password" type="password" placeholder="Password" required autoComplete="current-password" />
          <button className="w-full rounded-md bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700">
            Sign in
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-medium text-stone-800">New here? Create an account</h2>
        <form action={signUp} className="space-y-3">
          <input className={input} name="name" type="text" placeholder="Your name" autoComplete="name" />
          <input className={input} name="email" type="email" placeholder="Email" required autoComplete="email" />
          <input className={input} name="password" type="password" placeholder="Password (8+ characters)" required minLength={8} autoComplete="new-password" />
          <button className="w-full rounded-md bg-stone-800 px-4 py-2 font-medium text-white hover:bg-stone-900">
            Create account
          </button>
        </form>
      </section>
    </main>
  );
}
