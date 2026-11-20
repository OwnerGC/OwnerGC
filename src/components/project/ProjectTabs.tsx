"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type Tab = { href: string; label: string; badge?: number };

export function ProjectTabs({ base, tabs }: { base: string; tabs: Tab[] }) {
  const path = usePathname();
  return (
    <nav className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b border-stone-200">
        {tabs.map((t) => {
          const href = `${base}${t.href}`;
          const active = t.href === "" ? path === base : path.startsWith(href);
          return (
            <li key={t.href}>
              <Link
                href={href}
                className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm whitespace-nowrap ${
                  active ? "border-amber-600 font-medium text-stone-900" : "border-transparent text-stone-600 hover:text-stone-900"
                }`}
              >
                {t.label}
                {!!t.badge && <span className="rounded-full bg-red-100 px-1.5 text-xs font-medium text-red-800">{t.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
