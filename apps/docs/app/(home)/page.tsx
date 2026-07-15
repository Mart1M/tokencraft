import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="flex flex-col justify-center text-center flex-1 px-6">
      <h1 className="text-4xl font-bold mb-4">TokenCraft</h1>
      <p className="text-fd-muted-foreground mb-8 max-w-lg mx-auto">
        A local-first design token editor. Visualize and edit your project&apos;s{' '}
        <code>*.tokens.json</code> files from the browser — no accounts, no cloud.
      </p>
      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href="/docs"
          className="inline-flex items-center rounded-lg bg-fd-primary px-4 py-2 text-sm font-medium text-fd-primary-foreground"
        >
          Read the docs
        </Link>
        <Link
          href="/docs/getting-started"
          className="inline-flex items-center rounded-lg border px-4 py-2 text-sm font-medium"
        >
          Get started
        </Link>
      </div>
    </div>
  );
}
