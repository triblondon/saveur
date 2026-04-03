import styles from "@/components/styles/app-logo.module.css";

interface AppLogoProps {
  iconSize?: number;
  textClassName?: string;
  className?: string;
}

export function AppLogo({ iconSize = 26, textClassName, className }: AppLogoProps) {
  const rootClassName = [styles.logo, className].filter(Boolean).join(" ");
  const wordmarkClassName = [styles.wordmark, textClassName].filter(Boolean).join(" ");

  return (
    <span className={rootClassName}>
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 36 36"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M13 3c5 2 8 8 6 13s-7 8-10 11-4 7-2 10c-4-3-6-8-4-12 2-5 7-8 10-11 2-2 4-6 0-11Z"
          fill="currentColor"
        />
        <path
          d="M24 10c4 2 6 6 5 10-2 4-5 6-8 8-3 2-4 6-2 9-3-2-4-6-3-9 1-4 5-6 8-8 2-2 3-6 0-10Z"
          fill="currentColor"
        />
      </svg>
      <span className={wordmarkClassName}>Saveur</span>
    </span>
  );
}
