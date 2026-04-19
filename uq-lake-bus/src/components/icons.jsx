export function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M5.5 7.5 10 12l4.5-4.5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpinnerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3.2a6.8 6.8 0 1 1-4.808 1.992"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function SwitchIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M4 6.5h9.5M10.75 3.75 13.5 6.5l-2.75 2.75M16 13.5H6.5M9.25 10.75 6.5 13.5l2.75 2.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m5.5 10.2 2.8 2.8 6.2-6.2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FavoriteIcon({ filled = false }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m10 3.2 2.1 4.258 4.7.682-3.4 3.315.802 4.684L10 13.93l-4.202 2.209.802-4.684-3.4-3.315 4.7-.682L10 3.2Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DestinationIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 16.2s4.8-4.8 4.8-8.3A4.8 4.8 0 1 0 5.2 7.9c0 3.5 4.8 8.3 4.8 8.3Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="10" cy="7.9" r="1.7" fill="currentColor" />
    </svg>
  );
}

export function BusIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect
        x="4.25"
        y="3.5"
        width="11.5"
        height="11"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M4.75 8.25h10.5M7 14.5v1.75M13 14.5v1.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M7 6.25h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="7.25" cy="11.25" r="0.9" fill="currentColor" />
      <circle cx="12.75" cy="11.25" r="0.9" fill="currentColor" />
    </svg>
  );
}

export function MetroIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6 3.75h8a2 2 0 0 1 2 2v6.5a2.25 2.25 0 0 1-2.25 2.25h-7.5A2.25 2.25 0 0 1 4 12.25v-6.5a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M7.25 6.5h5.5M7.25 9.25v2.25M12.75 9.25v2.25M7 15.75l1.3-1.25M13 15.75l-1.3-1.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M6 6 14 14M14 6 6 14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}
