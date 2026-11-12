export function AmbientWaves() {
  return (
    <div className="xv-wave-bg" aria-hidden="true">
      <svg
        className="xv-wave-svg"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        focusable="false"
      >
        <defs>
          <linearGradient id="xv-wave-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#29A9FF" />
            <stop offset="48%" stopColor="#526BFF" />
            <stop offset="100%" stopColor="#A54CFF" />
          </linearGradient>
          <linearGradient id="xv-wave-reverse" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#32C5FF" />
            <stop offset="52%" stopColor="#6572FF" />
            <stop offset="100%" stopColor="#B64DFF" />
          </linearGradient>
          <filter id="xv-wave-blur" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        <g className="xv-wave-ribbons">
          {/* Upper left: three close, flowing ribbons. */}
          <path className="xv-wave-halo" d="M-100 168 C105 148 184 35 365 28 S536 58 665 -24" />
          <path className="xv-wave-line" d="M-100 168 C105 148 184 35 365 28 S536 58 665 -24" />
          <path className="xv-wave-line xv-wave-line-soft" d="M-100 198 C115 178 198 66 374 59 S542 88 680 8" />
          <path className="xv-wave-glimmer" d="M-100 168 C105 148 184 35 365 28 S536 58 665 -24" />

          {/* Right side: gentle arcs stay away from the center of the chat. */}
          <path className="xv-wave-halo xv-wave-reverse" d="M1510 132 C1328 118 1288 255 1120 270 S927 202 826 282" />
          <path className="xv-wave-line xv-wave-reverse" d="M1510 132 C1328 118 1288 255 1120 270 S927 202 826 282" />
          <path className="xv-wave-line xv-wave-line-soft" d="M1510 164 C1342 150 1301 286 1134 302 S943 236 846 312" />
          <path className="xv-wave-glimmer xv-wave-reverse" d="M1510 132 C1328 118 1288 255 1120 270 S927 202 826 282" />

          <path className="xv-wave-halo xv-wave-reverse" d="M1515 520 C1330 470 1294 592 1125 624 S949 571 835 676" />
          <path className="xv-wave-line xv-wave-reverse" d="M1515 520 C1330 470 1294 592 1125 624 S949 571 835 676" />
          <path className="xv-wave-glimmer xv-wave-reverse" d="M1515 520 C1330 470 1294 592 1125 624 S949 571 835 676" />

          {/* Lower edge: a broad, quiet curve with a parallel highlight. */}
          <path className="xv-wave-halo" d="M-100 784 C82 646 234 690 384 793 S550 913 710 841" />
          <path className="xv-wave-line" d="M-100 784 C82 646 234 690 384 793 S550 913 710 841" />
          <path className="xv-wave-line xv-wave-line-soft" d="M-100 818 C87 682 242 724 397 824 S559 943 727 876" />
          <path className="xv-wave-glimmer" d="M-100 784 C82 646 234 690 384 793 S550 913 710 841" />

          <path className="xv-wave-halo xv-wave-reverse" d="M1515 820 C1345 748 1294 846 1123 882 S923 815 788 926" />
          <path className="xv-wave-line xv-wave-reverse" d="M1515 820 C1345 748 1294 846 1123 882 S923 815 788 926" />
          <path className="xv-wave-glimmer xv-wave-reverse" d="M1515 820 C1345 748 1294 846 1123 882 S923 815 788 926" />
        </g>
      </svg>
    </div>
  );
}
