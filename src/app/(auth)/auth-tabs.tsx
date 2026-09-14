import Link from "next/link";

/**
 * Sign in / Create account, as tabs rather than a page and a footer link to its opposite.
 *
 * Each tab is a real navigation to its own route - /login and /signup stay separate pages
 * with their own server actions, this is only the visual frame around them - so switching
 * costs a page load rather than client state, which is the right trade for two forms this
 * small and this rarely switched between mid-flow.
 */
export function AuthTabs({ active }: { active: "signin" | "signup" }) {
  const tabs = [
    { key: "signin" as const, href: "/login", label: "Sign in" },
    { key: "signup" as const, href: "/signup", label: "Create account" },
  ];

  return (
    <nav aria-label="Sign in or create an account" className="mb-8 flex border-b border-navy-100">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex-1 pb-3.5 text-center text-sm font-medium
              transition-colors duration-200
              after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full
              after:origin-left after:transition-transform after:duration-300
              after:content-[''] after:ease-[cubic-bezier(0.22,1,0.36,1)]
              ${
                isActive
                  ? "text-ink after:scale-x-100 after:bg-navy-500"
                  : "text-ink-muted hover:text-ink after:scale-x-0 after:bg-navy-300 hover:after:scale-x-100"
              }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
