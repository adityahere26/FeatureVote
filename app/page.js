import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-4 px-4 py-16">
        <h1 className="max-w-xl text-4xl font-semibold tracking-tight">
          Collect customer feedback in one place.
        </h1>
        <p className="max-w-xl text-neutral-600 dark:text-neutral-400">
          Give your customers a board to request features, vote and comment, and
          show them what&apos;s planned on a public roadmap.
        </p>
        <div>
          <Link
            href="/workspaces"
            className="inline-block rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background"
          >
            Get started
          </Link>
        </div>
      </main>
    </>
  );
}
