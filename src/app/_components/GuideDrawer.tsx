"use client";
import Drawer from "./Drawer";
import styles from "./guideDrawer.module.css";

export type Guide = {
  title: string;
  blurb?: string;
  imageUrl?: string;
  linkUrl?: string;
  tips?: string[];
};

export default function GuideDrawer({
  open,
  onClose,
  guide,
  panelId = "cut-guide-drawer",
}: {
  open: boolean;
  onClose: () => void;
  guide: Guide | null;
  panelId?: string;
}) {
  return (
    <Drawer open={open} onClose={onClose} ariaLabel="Cooking ideas">
      <section id={panelId} role="document"></section>
      {guide ? (
        <div className={styles.wrap}>
          <header className={styles.header}>
            <h3 className={styles.title}>{guide.title}</h3>
            <button
              onClick={onClose}
              className={styles.close}
              aria-label="Close"
            >
              ×
            </button>
          </header>

          {guide.imageUrl && (
            <img className={styles.hero} src={guide.imageUrl} alt="" />
          )}

          {guide.blurb && <p className={styles.blurb}>{guide.blurb}</p>}

          {!!guide.tips?.length && (
            <ul className={styles.tips}>
              {guide.tips.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          )}

          {guide.linkUrl && (
            <a
              className="my_button"
              href={guide.linkUrl}
              target="_blank"
              rel="noreferrer"
            >
              View recipes
            </a>
          )}
        </div>
      ) : (
        <div className={styles.wrap}>
          <header className={styles.header}>
            <h3 className={styles.title}>Cooking ideas</h3>
            <button
              onClick={onClose}
              className={styles.close}
              aria-label="Close"
            >
              ×
            </button>
          </header>
          <p className={styles.blurb}>No guide available yet for this cut.</p>
        </div>
      )}
    </Drawer>
  );
}
