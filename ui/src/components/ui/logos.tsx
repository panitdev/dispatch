import { cn } from "@/lib/utils"

type LogoName = "brand" | "dispatch" | "herald" | "naos" | "strophe"
type ServiceName = Exclude<LogoName, "brand">

type LogoProps = Omit<React.ComponentProps<"img">, "alt" | "height" | "src" | "width"> & {
  size?: number
}

const ASSET_BASE_URL = "https://ui.registry.panit.dev/assets"

type LogoSource = {
  alt: string
  name: string
}

function createLogoSource(name: string, alt: string): LogoSource {
  return {
    alt,
    name,
  }
}

const logoSources: Record<LogoName, LogoSource> = {
  brand: {
    ...createLogoSource("logo", "Panit"),
  },
  dispatch: createLogoSource("dispatch-logo", "Dispatch"),
  herald: createLogoSource("herald-logo", "Herald"),
  naos: createLogoSource("naos-logo", "Naos"),
  strophe: createLogoSource("strophe-logo", "Strophe"),
}

function Logo({
  className,
  name,
  size = 32,
  ...props
}: LogoProps & { name: LogoName }) {
  const logo = logoSources[name]
  const src = `${ASSET_BASE_URL}/${logo.name}-${size <= 28 ? 28 : 56}.png`
  const srcSet = [
    `${ASSET_BASE_URL}/${logo.name}-28.png 28w`,
    `${ASSET_BASE_URL}/${logo.name}-56.png 56w`,
    `${ASSET_BASE_URL}/${logo.name}-84.png 84w`,
  ].join(", ")

  return (
    <img
      alt={logo.alt}
      className={cn("shrink-0 object-contain", className)}
      height={size}
      sizes={`${size}px`}
      src={src}
      srcSet={srcSet}
      width={size}
      {...props}
    />
  )
}

export function BrandLogo(props: LogoProps) {
  return <Logo name="brand" {...props} />
}

export function DispatchLogo(props: LogoProps) {
  return <Logo name="dispatch" {...props} />
}

export function HeraldLogo(props: LogoProps) {
  return <Logo name="herald" {...props} />
}

export function NaosLogo(props: LogoProps) {
  return <Logo name="naos" {...props} />
}

export function StropheLogo(props: LogoProps) {
  return <Logo name="strophe" {...props} />
}

export function ServiceLogo({
  service,
  ...props
}: LogoProps & { service: ServiceName }) {
  return <Logo name={service} {...props} />
}
