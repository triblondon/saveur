import { mdiPotSteamOutline } from "@mdi/js";
import styles from "@/components/styles/hero-image-placeholder.module.css";

interface HeroImagePlaceholderProps {
  className?: string;
  iconClassName?: string;
}

export function HeroImagePlaceholder(props: HeroImagePlaceholderProps) {
  const { className, iconClassName } = props;

  return (
    <div className={`${styles.placeholder}${className ? ` ${className}` : ""}`} role="img" aria-label="No recipe image">
      <svg
        className={`${styles.icon}${iconClassName ? ` ${iconClassName}` : ""}`}
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path fill="currentColor" d={mdiPotSteamOutline} />
      </svg>
    </div>
  );
}
