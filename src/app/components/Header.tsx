import Link from "next/link";
import { auth } from "@/auth";
import { ThemeToggle } from "./ThemeToggle";

export default async function Header() {
  const session = await auth();

  return (
    <header className="bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 transition-colors duration-300">
      <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
        <div className="flex lg:flex-1">
          <Link href="/" className="-m-1.5 p-1.5 flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900 dark:text-white">SEO Pulse</span>
          </Link>
        </div>
        <div className="flex lg:hidden">
          {/* Mobile menu button could go here if needed */}
        </div>
        <div className="hidden lg:flex lg:gap-x-12">
          <Link href="/" className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400">
            Home
          </Link>
          <Link href="/features" className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400">
            Features
          </Link>
          <Link href="/pricing" className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400">
            Pricing
          </Link>
        </div>
        <div className="flex lg:flex-1 lg:justify-end items-center gap-6">
          <ThemeToggle />
          {session ? (
            <Link href="/dashboard" className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              Go to Dashboard <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : (
            <Link href="/login" className="text-sm font-semibold leading-6 text-gray-900 dark:text-gray-100">
              Log in <span aria-hidden="true">&rarr;</span>
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
