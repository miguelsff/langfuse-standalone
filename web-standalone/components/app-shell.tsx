import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Home,
  LayoutDashboard,
  Lightbulb,
  ListTree,
  Menu,
  Moon,
  Settings,
  SquarePercent,
  Sun,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useState, type PropsWithChildren } from "react";

const PROJECT_PATH = "/project/local";

const navigation = [
  {
    label: null,
    items: [
      { href: PROJECT_PATH, label: "Home", icon: Home, exact: true },
      {
        href: `${PROJECT_PATH}/dashboards`,
        label: "Dashboards",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    label: "Observability",
    items: [
      {
        href: `${PROJECT_PATH}/traces`,
        label: "Tracing",
        icon: ListTree,
        aliases: [`${PROJECT_PATH}/observations`],
      },
      {
        href: `${PROJECT_PATH}/sessions`,
        label: "Sessions",
        icon: Clock3,
      },
    ],
  },
  {
    label: "Evaluation",
    items: [
      {
        href: `${PROJECT_PATH}/scores`,
        label: "Scores",
        icon: SquarePercent,
      },
      {
        href: `${PROJECT_PATH}/evals`,
        label: "Evaluators",
        icon: Lightbulb,
      },
    ],
  },
] as const;

const secondaryNavigation = [
  {
    href: `${PROJECT_PATH}/settings/llm-connections`,
    label: "Settings",
    icon: Settings,
  },
] as const;

function isActivePath(
  path: string,
  item: { href: string; exact?: boolean; aliases?: readonly string[] },
) {
  if (item.exact) return path === item.href;
  return [item.href, ...(item.aliases ?? [])].some(
    (href) => path === href || path.startsWith(`${href}/`),
  );
}

function ThemeButton({ collapsed }: { collapsed: boolean }) {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <button
      aria-label={dark ? "Use light theme" : "Use dark theme"}
      className="sidebar-action"
      onClick={() => setTheme(dark ? "light" : "dark")}
      title={dark ? "Use light theme" : "Use dark theme"}
      type="button"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
      {!collapsed ? <span>Theme</span> : null}
    </button>
  );
}

export function AppShell({ children }: PropsWithChildren) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <Head>
        <title>Langfuse</title>
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <meta
          name="description"
          content="Local standalone trace analysis and evaluation"
        />
        <link href="/icon.svg" rel="icon" type="image/svg+xml" />
      </Head>

      <div
        className={`app-layout${collapsed ? " sidebar-collapsed" : ""}`}
      >
        <button
          aria-label="Open navigation"
          className="mobile-menu-trigger"
          onClick={() => setMobileOpen(true)}
          type="button"
        >
          <Menu size={18} />
          <Image
            alt="Langfuse"
            className="dark:hidden"
            height={20}
            priority
            src="/wordart-black.svg"
            width={88}
          />
          <Image
            alt="Langfuse"
            className="hidden dark:block"
            height={20}
            priority
            src="/wordart-white.svg"
            width={88}
          />
        </button>

        {mobileOpen ? (
          <button
            aria-label="Close navigation"
            className="sidebar-backdrop"
            onClick={() => setMobileOpen(false)}
            type="button"
          />
        ) : null}

        <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`}>
          <div className="sidebar-header">
            <Link
              aria-label="Langfuse home"
              className="brand"
              href={PROJECT_PATH}
              onClick={() => setMobileOpen(false)}
            >
              {collapsed ? (
                <Image alt="" height={24} src="/icon.svg" width={24} />
              ) : (
                <>
                  <Image
                    alt="Langfuse"
                    className="dark:hidden"
                    height={24}
                    priority
                    src="/wordart-black.svg"
                    width={106}
                  />
                  <Image
                    alt="Langfuse"
                    className="hidden dark:block"
                    height={24}
                    priority
                    src="/wordart-white.svg"
                    width={106}
                  />
                </>
              )}
            </Link>
            <button
              aria-label="Close navigation"
              className="mobile-close"
              onClick={() => setMobileOpen(false)}
              type="button"
            >
              <X size={18} />
            </button>
          </div>

          <div className="sidebar-project">
            <span className="project-avatar">L</span>
            {!collapsed ? (
              <span className="project-copy">
                <strong>Local project</strong>
                <small>Standalone</small>
              </span>
            ) : null}
          </div>

          <nav className="sidebar-content" aria-label="Project navigation">
            {navigation.map((group, groupIndex) => (
              <section className="nav-group" key={group.label ?? groupIndex}>
                {group.label && !collapsed ? (
                  <p className="nav-group-label">{group.label}</p>
                ) : null}
                <div className="nav-menu">
                  {group.items.map((item) => {
                    const active = isActivePath(router.asPath.split("?")[0]!, item);
                    const Icon = item.icon;
                    return (
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={`nav-link${active ? " active" : ""}`}
                        href={item.href}
                        key={item.href}
                        onClick={() => setMobileOpen(false)}
                        title={collapsed ? item.label : undefined}
                      >
                        <Icon aria-hidden="true" size={16} />
                        {!collapsed ? <span>{item.label}</span> : null}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="sidebar-secondary">
            {secondaryNavigation.map((item) => {
              const active = isActivePath(router.asPath.split("?")[0]!, item);
              const Icon = item.icon;
              return (
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`nav-link${active ? " active" : ""}`}
                  href={item.href}
                  key={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon aria-hidden="true" size={16} />
                  {!collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
            <ThemeButton collapsed={collapsed} />
            <div className="local-user">
              <span className="user-avatar">L</span>
              {!collapsed ? (
                <span className="project-copy">
                  <strong>Local user</strong>
                  <small>No authentication</small>
                </span>
              ) : null}
            </div>
          </div>

          <button
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="sidebar-rail"
            onClick={() => setCollapsed((value) => !value)}
            type="button"
          >
            {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
          </button>
        </aside>

        <main className="main-content">{children}</main>
      </div>
    </>
  );
}
