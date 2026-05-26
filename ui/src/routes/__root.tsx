import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { getAppConfig } from '../lib/config'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { ThemeProvider } from 'next-themes'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'

import { DispatchLayout } from '../components/dispatch/layout'
import { Toaster } from '../components/ui/sonner'

import appCss from '../styles.css?url'

import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  loader: () => getAppConfig(),

  head: ({ loaderData }) => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Dispatch',
      },
    ],
    links: [
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.css',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        href: '/favicon.ico?v=dispatch',
        sizes: 'any',
        type: 'image/x-icon',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
    scripts: [
      // Docker path: nginx entrypoint generates this at container start.
      // CF Workers path: stub is loaded first; inline script below overrides it.
      { tag: 'script', attrs: { src: '/env.js' } },
      // CF Workers path: SSR injects real config values per request.
      // Absent from the static pre-built HTML (loaderData is undefined at build time).
      ...(loaderData
        ? [
            {
              tag: 'script' as const,
              children: `window.__ENV__=${JSON.stringify(loaderData).replace(/<\//g, '<\\/')};`,
            },
          ]
        : []),
    ],
  }),
  component: RootApp,
  shellComponent: RootDocument,
})

function RootApp() {
  return (
    <DispatchLayout>
      <Outlet />
    </DispatchLayout>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <ThemeProvider
          attribute="data-theme"
          defaultTheme="dark"
          themes={['dark', 'light']}
        >
          {children}
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
              TanStackQueryDevtools,
            ]}
          />
          <Toaster />
          <Scripts />
        </ThemeProvider>
      </body>
    </html>
  )
}
