import { PageHead } from './page-head'

import { getDisplayErrorMessage, isAuthError } from '@/lib/api'

export function RouteErrorState({
  title,
  subtitle,
  error,
}: {
  title: string
  subtitle: string
  error: unknown
}) {
  const authError = isAuthError(error)
  const message = getDisplayErrorMessage(
    error,
    authError ? 'Authentication is required.' : 'Something went wrong.',
  )

  return (
    <>
      <PageHead title={title} subtitle={subtitle} />
      <section className="rounded-[var(--dispatch-r-xl)] border border-[var(--dispatch-amber-30)] bg-[var(--dispatch-amber-12)] p-5 shadow-[var(--dispatch-shadow-card)]">
        <h2 className="m-0 text-[15px] font-semibold text-[var(--dispatch-text-primary)]">
          {authError ? 'Sign-in required' : 'Unable to load this page'}
        </h2>
        <p className="m-0 mt-2 text-[13px] leading-[1.6] text-[var(--dispatch-text-secondary)]">
          {message}
        </p>
      </section>
    </>
  )
}
