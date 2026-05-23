#!/usr/bin/env bash
set -euo pipefail

REGISTRY_URL="${REGISTRY_URL:-https://ui.registry.panit.dev/r/registry.json}"
REGISTRY_NAMESPACE="${REGISTRY_NAMESPACE:-@panit}"
CLI="${SHADCN_CLI:-bunx shadcn@latest}"

INSTALL_ALL=false
YES=false
OVERWRITE=false

usage() {
  cat <<EOF
Usage: ./install-registry.sh [options]

Options:
  --all          Install every item without selection prompt
  -y, --yes      Skip install confirmation
  --overwrite   Pass --overwrite to shadcn
  -h, --help     Show help

Environment:
  REGISTRY_URL         Default: https://ui.registry.panit.dev/r/registry.json
  REGISTRY_NAMESPACE   Default: @panit
  SHADCN_CLI           Default: bunx shadcn@latest

Examples:
  ./install-registry.sh
  ./install-registry.sh --all
  SHADCN_CLI="pnpm dlx shadcn@latest" ./install-registry.sh --all
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
  --all)
    INSTALL_ALL=true
    shift
    ;;
  -y | --yes)
    YES=true
    shift
    ;;
  --overwrite)
    OVERWRITE=true
    shift
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    echo "Unknown option: $1" >&2
    usage >&2
    exit 1
    ;;
  esac
done

need_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

need_cmd curl
need_cmd jq

registry_json="$(curl -fsSL "$REGISTRY_URL")"

mapfile -t items < <(
  jq -r '
    if has("items") then
      .items[]
      | if type == "string" then .
        else .name
        end
    else
      empty
    end
  ' <<<"$registry_json" | sort -u
)

if [[ ${#items[@]} -eq 0 ]]; then
  echo "No registry items found from: $REGISTRY_URL" >&2
  exit 1
fi

selected=()

if [[ "$INSTALL_ALL" == true ]]; then
  selected=("${items[@]}")
else
  echo "Registry: $REGISTRY_URL"
  echo

  for i in "${!items[@]}"; do
    printf "%3d) %s\n" "$((i + 1))" "${items[$i]}"
  done

  echo
  echo "Enter items to install."
  echo "Examples: 1 2 5, 1-4, button card, all"
  read -r -p "> " input

  if [[ -z "${input// /}" ]]; then
    echo "No items selected."
    exit 0
  fi

  if [[ "$input" == "all" ]]; then
    selected=("${items[@]}")
  else
    for token in $input; do
      if [[ "$token" =~ ^[0-9]+-[0-9]+$ ]]; then
        start="${token%-*}"
        end="${token#*-}"

        if ((start < 1 || end > ${#items[@]} || start > end)); then
          echo "Invalid range: $token" >&2
          exit 1
        fi

        for ((n = start; n <= end; n++)); do
          selected+=("${items[$((n - 1))]}")
        done
      elif [[ "$token" =~ ^[0-9]+$ ]]; then
        if ((token < 1 || token > ${#items[@]})); then
          echo "Invalid selection number: $token" >&2
          exit 1
        fi

        selected+=("${items[$((token - 1))]}")
      else
        found=false

        for item in "${items[@]}"; do
          if [[ "$item" == "$token" ]]; then
            selected+=("$item")
            found=true
            break
          fi
        done

        if [[ "$found" == false ]]; then
          echo "Unknown item: $token" >&2
          exit 1
        fi
      fi
    done
  fi
fi

mapfile -t selected < <(printf "%s\n" "${selected[@]}" | sort -u)

if [[ ${#selected[@]} -eq 0 ]]; then
  echo "No items selected."
  exit 0
fi

resources=()
for item in "${selected[@]}"; do
  resources+=("${REGISTRY_NAMESPACE}/${item}")
done

echo
echo "Selected:"
printf "  %s\n" "${resources[@]}"
echo

if [[ "$YES" != true && "$INSTALL_ALL" != true ]]; then
  read -r -p "Install selected items? [y/N] " confirm
  case "$confirm" in
  y | Y | yes | YES) ;;
  *)
    echo "Cancelled."
    exit 0
    ;;
  esac
fi

args=(add -y)

if [[ "$OVERWRITE" == true ]]; then
  args+=(--overwrite)
fi

args+=("${resources[@]}")

# Intentionally use eval here because SHADCN_CLI may contain spaces,
# e.g. "bunx shadcn@latest" or "pnpm dlx shadcn@latest".
printf -v quoted_args " %q" "${args[@]}"
eval "$CLI$quoted_args"
