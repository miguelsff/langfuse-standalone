import type { AppProps } from "next/app";
import { ThemeProvider } from "next-themes";
import { AppShell } from "@/components/app-shell";
import { api } from "@/utils/api";
import "@/styles/globals.css";

function StandaloneApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppShell>
        <Component {...pageProps} />
      </AppShell>
    </ThemeProvider>
  );
}

export default api.withTRPC(StandaloneApp);
