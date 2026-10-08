import { useState, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  content: string;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

export function Tooltip({ content, children, side = "top", className = "" }: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLSpanElement | null>(null);

  const updatePosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();

    let top = 0;
    let left = 0;

    if (side === "top") {
      top = rect.top - 6;
      left = rect.left + rect.width / 2;
    } else if (side === "bottom") {
      top = rect.bottom + 6;
      left = rect.left + rect.width / 2;
    } else if (side === "left") {
      top = rect.top + rect.height / 2;
      left = rect.left - 6;
    } else if (side === "right") {
      top = rect.top + rect.height / 2;
      left = rect.right + 6;
    }

    setCoords({ top, left });
  };

  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen, side]);

  const transformStyle = {
    top: "translate(-50%, -100%)",
    bottom: "translate(-50%, 0)",
    left: "translate(-100%, -50%)",
    right: "translate(0, -50%)",
  }[side];

  return (
    <span
      ref={wrapperRef}
      className="inline-flex items-center"
      onMouseEnter={() => {
        updatePosition();
        setIsOpen(true);
      }}
      onMouseLeave={() => setIsOpen(false)}
      onFocusCapture={() => {
        updatePosition();
        setIsOpen(true);
      }}
      onBlurCapture={() => setIsOpen(false)}
    >
      {children}
      {isOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "fixed",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: transformStyle,
              zIndex: 999999,
            }}
            className={`pointer-events-none w-max max-w-[280px] rounded-md bg-[#0F172A] px-2.5 py-1 text-[11px] font-medium leading-normal text-white shadow-2xl drop-shadow-md transition-opacity duration-75 ${className}`}
          >
            {content}
          </div>,
          document.body
        )}
    </span>
  );
}
