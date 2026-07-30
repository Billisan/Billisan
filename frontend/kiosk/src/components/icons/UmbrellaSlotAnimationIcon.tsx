export type UmbrellaSlotIconProps = {
  direction?: "rental" | "return";
  speed?: number;
  autoplay?: boolean;
  slotColor?: "yellow" | "blue" | "coral";
  className?: string;
};

const PALETTES: Record<string, [string, string]> = {
  yellow: ["#FDCB24", "#AF6D25"],
  blue: ["#5AC8FA", "#2E7DA6"],
  coral: ["#FF8A65", "#B5502F"],
};

let injected = false;
function injectKeyframes() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = `
@keyframes umbrellaSlide {
  0%, 15% { transform: translateY(0); }
  50%, 65% { transform: translateY(-18px); }
  100% { transform: translateY(0); }
}`;
  document.head.appendChild(style);
}

export default function UmbrellaSlotAnimationIcon({
  direction = "rental",
  speed = 5,
  autoplay = true,
  slotColor = "yellow",
  className,
}: UmbrellaSlotIconProps) {
  injectKeyframes();
  const [main, dark] = PALETTES[slotColor] ?? PALETTES.yellow;
  const animDirection = direction === "return" ? "reverse" : "normal";

  return (
    <div className={className} style={{ position: "relative", width: 140, height: 180, background: "transparent" }}>
      <svg width="140" height="180" viewBox="0 0 140 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, zIndex: 0 }}>
        <path d="M116 2H24C11.8497 2 2 11.8497 2 24V156C2 168.15 11.8497 178 24 178H116C128.15 178 138 168.15 138 156V24C138 11.8497 128.15 2 116 2Z" fill="white" stroke="#DCDCDC" strokeWidth="4" />
        <g transform="translate(46 101) scale(1.1) translate(-46 -95)">
          <path d="M46 43V95" stroke="#4A4A4A" strokeWidth="4" strokeLinecap="round" />
          <path d="M46 43C46 41.4087 46.6321 39.8826 47.7574 38.7574C48.8826 37.6321 50.4087 37 52 37C53.5913 37 55.1174 37.6321 56.2426 38.7574C57.3679 39.8826 58 41.4087 58 43" stroke="#4A4A4A" strokeWidth="4" strokeLinecap="round" />
          <path d="M38 63.5C43.3333 58.1667 48.6667 58.1667 54 63.5L46 112L38 63.5Z" fill="#4A4A4A" />
        </g>
      </svg>

      <div
        style={{
          position: "absolute",
          left: 76,
          top: 29,
          width: 29,
          height: 90,
          zIndex: 1,
          transformOrigin: "50% 100%",
          animationName: "umbrellaSlide",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          animationDuration: `${speed}s`,
          animationDirection: animDirection,
          animationPlayState: autoplay ? "running" : "paused",
        }}
      >
        <svg width="29" height="90" viewBox="0 0 28 89" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ overflow: "visible" }}>
          <path d="M12 13V73" stroke="#4A4A4A" strokeWidth="4.56" strokeLinecap="round" />
          <path d="M12 13C12 11.4087 12.6321 9.88258 13.7574 8.75736C14.8826 7.63214 16.4087 7 18 7C19.5913 7 21.1174 7.63214 22.2426 8.75736C23.3679 9.88258 24 11.4087 24 13" stroke="#4A4A4A" strokeWidth="4.56" strokeLinecap="round" />
          <path d="M3 37.9C9 30.7 15 30.7 21 37.9L12 100L3 37.9Z" fill="#4A4A4A" />
        </svg>
      </div>

      <svg width="140" height="180" viewBox="0 0 140 180" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ position: "absolute", inset: 0, zIndex: 2 }}>
        <path d="M112 86H28C21.3726 86 16 91.3726 16 98V152C16 158.627 21.3726 164 28 164H112C118.627 164 124 158.627 124 152V98C124 91.3726 118.627 86 112 86Z" fill={main} />
        <path d="M119 86H21C18.2386 86 16 88.2386 16 91C16 93.7614 18.2386 96 21 96H119C121.761 96 124 93.7614 124 91C124 88.2386 121.761 86 119 86Z" fill={dark} />
      </svg>
    </div>
  );
}
