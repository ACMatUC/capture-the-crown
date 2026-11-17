import type { ConnectionSnapshot } from "../networking.js";

const statusLabels = {
  disconnected: "Not connected",
  connecting: "Connecting...",
  connected: "Connected",
};

export function Header({
  status,
  onHelp,
}: {
  status: ConnectionSnapshot["status"];
  onHelp: () => void;
}) {
  return (
    <header className="topbar">
      <a
        className="brand"
        href="./index.html"
        aria-label="ACM@UC - Capture the Crown home"
      >
        <svg
          className="club-logo"
          viewBox="398 1967 3704 566"
          role="img"
          aria-label="ACM@UC logo"
        >
          <image href="assets/acm-uc-logo.png" width="4500" height="4500" />
        </svg>
        <span className="brand-caption">
          NETWORKING
          <br />
          WORKSHOP
        </span>
      </a>
      <nav className="top-nav" aria-label="Main navigation">
        <button className="nav-link" onClick={onHelp}>
          How to play <span aria-hidden="true">↗</span>
        </button>
      </nav>
      <div className="topbar-status" role="status">
        <span id="connectionDot" className={`status-dot status-${status}`} />
        <span id="connectionLabel">{statusLabels[status]}</span>
      </div>
    </header>
  );
}

export function Poster() {
  return (
    <section className="page-heading" aria-labelledby="pageTitle">
      <div className="poster-copy">
        <p className="eyebrow">A GAME FOR EVERYONE IN THE ROOM.</p>
        <h1 id="pageTitle">
          CAPTURE
          <br />
          <span className="title-second">
            THE CROWN<span className="title-dot">.</span>
          </span>
        </h1>
        <p className="page-description">
          Ten crowns. One point each. Highest score wins.
        </p>
      </div>
      <div className="poster-art" aria-hidden="true">
        <svg className="crown-diagram" viewBox="0 0 220 180">
          <g className="network-lines">
            <path d="m40 32 70-15 75 29 20 85-88 34-88-35L40 32Zm0 0 77 133L185 46 29 130l176 1L110 17l7 148M40 32l165 99" />
            {[
              [40, 32],
              [110, 17],
              [185, 46],
              [205, 131],
              [117, 165],
              [29, 130],
            ].map(([cx, cy], index) => (
              <circle key={index} cx={cx} cy={cy} r="5" />
            ))}
          </g>
          <circle className="crown-disc" cx="115" cy="89" r="43" />
          <path
            className="poster-crown"
            d="m86 71 15 12 14-23 14 23 15-12-9 39H95l-9-39Zm12 46h34"
          />
        </svg>
        <span className="party-stamp">
          LAN
          <br />
          PARTY<span>→</span>
        </span>
      </div>
    </section>
  );
}
