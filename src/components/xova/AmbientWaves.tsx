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
            <stop offset="0%" stopColor="#315DEB" />
            <stop offset="48%" stopColor="#5B7FF0" />
            <stop offset="100%" stopColor="#8DA8FF" />
          </linearGradient>
          <linearGradient id="xv-wave-reverse" x1="100%" y1="0%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#4B74E8" />
            <stop offset="52%" stopColor="#6D8FFF" />
            <stop offset="100%" stopColor="#A8BAF7" />
          </linearGradient>
          <radialGradient id="xv-wave-orb-fill">
            <stop offset="0%" stopColor="#8DA8FF" stopOpacity="0.38" />
            <stop offset="68%" stopColor="#39B8FF" stopOpacity="0.17" />
            <stop offset="100%" stopColor="#39B8FF" stopOpacity="0" />
          </radialGradient>
          <filter id="xv-wave-blur" x="-30%" y="-80%" width="160%" height="260%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        <g className="xv-wave-geometry">
          <circle className="xv-wave-orb" cx="260" cy="175" r="150" fill="url(#xv-wave-orb-fill)" />
          <circle className="xv-wave-orbit" cx="260" cy="175" r="112" />
          <circle className="xv-wave-orbit xv-wave-orbit-dashed" cx="260" cy="175" r="145" />
          <circle className="xv-wave-orbit xv-wave-orbit-fine" cx="260" cy="175" r="78" />
          <circle className="xv-wave-orbit-dot" cx="362" cy="112" r="4" />

          <circle className="xv-wave-orb" cx="1230" cy="695" r="200" fill="url(#xv-wave-orb-fill)" />
          <circle className="xv-wave-orbit" cx="1230" cy="695" r="142" />
          <circle className="xv-wave-orbit xv-wave-orbit-dashed" cx="1230" cy="695" r="178" />
          <circle className="xv-wave-orbit xv-wave-orbit-fine" cx="1230" cy="695" r="104" />
          <circle className="xv-wave-orbit-dot" cx="1108" cy="602" r="4" />

          <path className="xv-wave-geometry-line" d="M0 350 C180 290 280 360 420 300" />
          <path className="xv-wave-geometry-line xv-wave-geometry-line-soft" d="M1010 110 C1150 50 1280 90 1440 32" />
          <path className="xv-wave-geometry-line" d="M0 740 C140 690 210 730 330 680" />
          <circle className="xv-wave-geometry-dot" cx="486" cy="225" r="2.5" />
          <circle className="xv-wave-geometry-dot" cx="1030" cy="330" r="2.5" />
          <circle className="xv-wave-geometry-dot" cx="960" cy="760" r="2.5" />
        </g>

        <g className="xv-wave-ribbons">
          <path className="xv-wave-halo" d="M-100 168 C105 148 184 35 365 28 S536 58 665 -24" />
          <path className="xv-wave-line" d="M-100 168 C105 148 184 35 365 28 S536 58 665 -24" />
          <path className="xv-wave-line xv-wave-line-soft" d="M-100 198 C115 178 198 66 374 59 S542 88 680 8" />

          <path className="xv-wave-halo xv-wave-reverse" d="M1510 132 C1328 118 1288 255 1120 270 S927 202 826 282" />
          <path className="xv-wave-line xv-wave-reverse" d="M1510 132 C1328 118 1288 255 1120 270 S927 202 826 282" />
          <path className="xv-wave-line xv-wave-line-soft" d="M1510 164 C1342 150 1301 286 1134 302 S943 236 846 312" />

          <path className="xv-wave-halo xv-wave-reverse" d="M1515 520 C1330 470 1294 592 1125 624 S949 571 835 676" />
          <path className="xv-wave-line xv-wave-reverse" d="M1515 520 C1330 470 1294 592 1125 624 S949 571 835 676" />

          <path className="xv-wave-halo" d="M-100 784 C82 646 234 690 384 793 S550 913 710 841" />
          <path className="xv-wave-line" d="M-100 784 C82 646 234 690 384 793 S550 913 710 841" />
          <path className="xv-wave-line xv-wave-line-soft" d="M-100 818 C87 682 242 724 397 824 S559 943 727 876" />

          <path className="xv-wave-halo xv-wave-reverse" d="M1515 820 C1345 748 1294 846 1123 882 S923 815 788 926" />
          <path className="xv-wave-line xv-wave-reverse" d="M1515 820 C1345 748 1294 846 1123 882 S923 815 788 926" />

          <path className="xv-wave-line xv-wave-ribbon-extra" d="M-60 470 C150 395 260 435 430 375 S650 325 790 370" />
          <path className="xv-wave-line xv-wave-line-soft xv-wave-ribbon-extra" d="M1500 420 C1330 365 1200 400 1080 455 S900 530 790 495" />
        </g>
      </svg>
    </div>
  );
}
