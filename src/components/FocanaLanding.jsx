import { useState, useEffect, useRef } from "react";

const COLORS = {
  sunshineYellow: "#F59E0B",
  deepAmber: "#D97706",
  warmBrown: "#5C4033",
  softCream: "#FFF9E6",
  warmVanilla: "#FFFEF8",
  coffeeBrown: "#8B6F47",
  softBlack: "#1F1F1F",
  goldenGlow: "#FCD34D",
  creamYellow: "#FEF3C7",
  beigeBorder: "#E5D4B1",
  warmGray: "#A08968",
};

// Animated counter component
function AnimatedNumber({ target, suffix = "", duration = 2000 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !started) setStarted(true); },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// FAQ Item
function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        borderBottom: `1px solid ${COLORS.beigeBorder}`,
        padding: "20px 0",
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          padding: 0,
          textAlign: "left",
        }}
      >
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 600, color: COLORS.warmBrown }}>
          {question}
        </span>
        <span style={{
          fontSize: "24px",
          color: COLORS.deepAmber,
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
          transition: "transform 0.3s ease",
          flexShrink: 0,
          marginLeft: "16px",
        }}>+</span>
      </button>
      <div style={{
        maxHeight: open ? "500px" : "0",
        overflow: "hidden",
        transition: "max-height 0.4s ease, opacity 0.3s ease",
        opacity: open ? 1 : 0,
      }}>
        <p style={{ marginTop: "12px", fontSize: "16px", lineHeight: 1.7, color: COLORS.coffeeBrown }}>
          {answer}
        </p>
      </div>
    </div>
  );
}

// Floating sticky note illustration
function StickyNote({ text, rotation = 0, delay = 0, top, left, size = 120 }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  return (
    <div style={{
      position: "absolute",
      top, left,
      width: `${size}px`,
      height: `${size}px`,
      background: COLORS.creamYellow,
      borderRadius: "4px",
      boxShadow: "0 4px 20px rgba(92, 64, 51, 0.15)",
      transform: `rotate(${rotation}deg) scale(${visible ? 1 : 0.5})`,
      opacity: visible ? 0.85 : 0,
      transition: "all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
      padding: "14px",
      fontFamily: "'Caveat', cursive",
      fontSize: "14px",
      color: COLORS.warmBrown,
      lineHeight: 1.3,
      pointerEvents: "none",
      zIndex: 1,
    }}>
      {text}
    </div>
  );
}

// Waitlist form component
function WaitlistForm({ variant = "dark" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/beta-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Please try again.");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div style={{
        background: "rgba(16, 185, 129, 0.15)",
        border: "1px solid #10B981",
        borderRadius: "16px",
        padding: "24px",
        maxWidth: "480px",
        margin: "0 auto",
      }}>
        <p style={{ fontSize: "18px", fontWeight: 600, color: "#10B981" }}>
          Check your email! Your download link is on its way.
        </p>
      </div>
    );
  }

  const isDark = variant === "dark";

  return (
    <div style={{ maxWidth: "480px", margin: "0 auto" }}>
      <form onSubmit={handleSubmit} style={{
        display: "flex", flexDirection: "column", gap: "12px",
      }}>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            required
            style={{
              flex: 1, minWidth: "200px",
              padding: "16px 20px",
              borderRadius: "12px",
              border: `2px solid ${isDark ? COLORS.coffeeBrown + "44" : COLORS.beigeBorder}`,
              background: isDark ? "rgba(255,255,255,0.08)" : "white",
              color: isDark ? "white" : COLORS.warmBrown,
              fontSize: "16px",
              fontFamily: "'DM Sans', sans-serif",
              outline: "none",
            }}
          />
          <button className="cta-btn" type="submit" disabled={status === "loading"} style={{ animation: "pulse 2.5s infinite" }}>
            {status === "loading" ? "Sending..." : "Download the Beta →"}
          </button>
        </div>
      </form>
      {status === "error" && (
        <p style={{ color: "#EF4444", fontSize: "14px", marginTop: "8px" }}>
          {errorMsg}
        </p>
      )}
    </div>
  );
}

export default function FocanaLanding() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handle = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handle, { passive: true });
    return () => window.removeEventListener("scroll", handle);
  }, []);

  const navOpacity = Math.min(scrollY / 200, 1);

  return (
    <div style={{ background: COLORS.warmVanilla, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: COLORS.warmBrown, overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 70% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .section { max-width: 1120px; margin: 0 auto; padding: 0 24px; }
        .cta-btn {
          background: ${COLORS.sunshineYellow};
          color: ${COLORS.warmBrown};
          border: none;
          padding: 16px 36px;
          font-size: 17px;
          font-weight: 700;
          font-family: 'Outfit', sans-serif;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          animation: pulse 2.5s infinite;
        }
        .cta-btn:hover {
          background: ${COLORS.deepAmber};
          color: white;
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(217, 119, 6, 0.35);
        }
        .cta-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .ghost-btn {
          background: transparent;
          color: ${COLORS.warmBrown};
          border: 2px solid ${COLORS.beigeBorder};
          padding: 14px 32px;
          font-size: 16px;
          font-weight: 600;
          font-family: 'Outfit', sans-serif;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .ghost-btn:hover {
          border-color: ${COLORS.deepAmber};
          background: ${COLORS.softCream};
        }
        .feature-card {
          background: white;
          border-radius: 20px;
          padding: 36px;
          border: 1px solid ${COLORS.beigeBorder};
          transition: all 0.3s ease;
        }
        .feature-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 40px rgba(92, 64, 51, 0.1);
          border-color: ${COLORS.sunshineYellow};
        }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: `rgba(255, 254, 248, ${navOpacity * 0.95})`,
        backdropFilter: navOpacity > 0.1 ? "blur(20px)" : "none",
        borderBottom: navOpacity > 0.3 ? `1px solid ${COLORS.beigeBorder}` : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div className="section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "72px" }}>
          <a href="#" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 375 150" preserveAspectRatio="xMidYMid meet">
              <defs><clipPath id="nav-f"><rect x="0" width="40" y="0" height="94"/></clipPath><clipPath id="nav-text"><rect x="0" width="202" y="0" height="94"/></clipPath></defs>
              <path strokeLinecap="round" transform="matrix(0.75, 0, 0, 0.75, 83.921775, 16.914411)" fill="none" strokeLinejoin="miter" d="M 3.500133 3.499536 L 101.536598 3.499536" stroke="#b94e10" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <path strokeLinecap="round" transform="matrix(0.75, 0, 0, 0.75, 44.567612, 16.914411)" fill="none" strokeLinejoin="miter" d="M 3.498393 3.499536 L 29.878603 3.499536" stroke="#b94e10" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <path strokeLinecap="round" transform="matrix(0, -0.75, 0.75, 0, 44.157332, 131.394882)" fill="none" strokeLinejoin="miter" d="M 3.500468 3.498558 L 149.141102 3.498558" stroke="#b94e10" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <path strokeLinecap="round" transform="matrix(0.75, 0, 0, 0.75, 44.567612, 126.205893)" fill="none" strokeLinejoin="miter" d="M 3.498393 3.501518 L 148.03486 3.501518" stroke="#b94e10" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <path strokeLinecap="round" transform="matrix(0, -0.75, 0.75, 0, 157.854047, 49.426432)" fill="none" strokeLinejoin="miter" d="M 3.500868 3.501896 L 39.855037 3.501896" stroke="#b94e10" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <g transform="matrix(1, 0, 0, 1, 84, 28)"><g clipPath="url(#nav-f)"><g fill="#4a3329" fillOpacity="1"><g transform="translate(0.0198762, 72.933964)"><path d="M 37.078125 -48.515625 L 37.078125 -40.484375 L 15.890625 -40.484375 L 15.890625 -27.640625 L 35.109375 -27.640625 L 35.109375 -19.71875 L 15.890625 -19.71875 L 15.890625 0 L 6.3125 0 L 6.3125 -48.515625 Z"/></g></g></g></g>
              <g transform="matrix(1, 0, 0, 1, 123, 28)"><g clipPath="url(#nav-text)"><g fill="#4a3329" fillOpacity="1"><g transform="translate(0.245694, 72.933964)"><path d="M 21.265625 0.703125 C 17.679688 0.703125 14.535156 -0.03125 11.828125 -1.5 C 9.117188 -2.976562 7.015625 -5.140625 5.515625 -7.984375 C 4.023438 -10.828125 3.28125 -14.257812 3.28125 -18.28125 C 3.28125 -22.3125 4.023438 -25.753906 5.515625 -28.609375 C 7.015625 -31.460938 9.117188 -33.625 11.828125 -35.09375 C 14.535156 -36.5625 17.679688 -37.296875 21.265625 -37.296875 C 24.859375 -37.296875 28.007812 -36.5625 30.71875 -35.09375 C 33.425781 -33.625 35.53125 -31.460938 37.03125 -28.609375 C 38.539062 -25.753906 39.296875 -22.3125 39.296875 -18.28125 C 39.296875 -14.257812 38.539062 -10.828125 37.03125 -7.984375 C 35.53125 -5.140625 33.425781 -2.976562 30.71875 -1.5 C 28.007812 -0.03125 24.859375 0.703125 21.265625 0.703125 Z M 21.265625 -7.109375 C 26.953125 -7.109375 29.796875 -10.832031 29.796875 -18.28125 C 29.796875 -22.15625 29.066406 -24.992188 27.609375 -26.796875 C 26.148438 -28.597656 24.035156 -29.5 21.265625 -29.5 C 15.585938 -29.5 12.75 -25.757812 12.75 -18.28125 C 12.75 -10.832031 15.585938 -7.109375 21.265625 -7.109375 Z"/></g><g transform="translate(42.790112, 72.933964)"><path d="M 21.34375 0.703125 C 17.800781 0.703125 14.664062 -0.03125 11.9375 -1.5 C 9.21875 -2.976562 7.09375 -5.144531 5.5625 -8 C 4.039062 -10.851562 3.28125 -14.28125 3.28125 -18.28125 C 3.28125 -22.3125 4.039062 -25.753906 5.5625 -28.609375 C 7.09375 -31.460938 9.207031 -33.625 11.90625 -35.09375 C 14.613281 -36.5625 17.703125 -37.296875 21.171875 -37.296875 C 28.890625 -37.296875 33.835938 -34.5 36.015625 -28.90625 L 29.703125 -24.390625 L 29 -24.390625 C 28.25 -26.117188 27.269531 -27.398438 26.0625 -28.234375 C 24.863281 -29.078125 23.234375 -29.5 21.171875 -29.5 C 18.515625 -29.5 16.445312 -28.582031 14.96875 -26.75 C 13.488281 -24.914062 12.75 -22.09375 12.75 -18.28125 C 12.75 -14.519531 13.5 -11.71875 15 -9.875 C 16.5 -8.03125 18.613281 -7.109375 21.34375 -7.109375 C 23.332031 -7.109375 25.015625 -7.644531 26.390625 -8.71875 C 27.773438 -9.789062 28.769531 -11.332031 29.375 -13.34375 L 30.0625 -13.40625 L 36.609375 -9.828125 C 35.679688 -6.722656 33.957031 -4.191406 31.4375 -2.234375 C 28.925781 -0.273438 25.5625 0.703125 21.34375 0.703125 Z"/></g><g transform="translate(80.522564, 72.933964)"><path d="M 14.265625 0.703125 C 11.921875 0.703125 9.882812 0.269531 8.15625 -0.59375 C 6.4375 -1.457031 5.109375 -2.722656 4.171875 -4.390625 C 3.242188 -6.066406 2.78125 -8.078125 2.78125 -10.421875 C 2.78125 -12.585938 3.242188 -14.40625 4.171875 -15.875 C 5.109375 -17.351562 6.550781 -18.5625 8.5 -19.5 C 10.445312 -20.4375 12.988281 -21.160156 16.125 -21.671875 C 18.320312 -22.023438 19.988281 -22.410156 21.125 -22.828125 C 22.257812 -23.253906 23.023438 -23.734375 23.421875 -24.265625 C 23.828125 -24.796875 24.03125 -25.46875 24.03125 -26.28125 C 24.03125 -27.457031 23.617188 -28.351562 22.796875 -28.96875 C 21.984375 -29.59375 20.625 -29.90625 18.71875 -29.90625 C 16.6875 -29.90625 14.75 -29.453125 12.90625 -28.546875 C 11.070312 -27.640625 9.476562 -26.441406 8.125 -24.953125 L 7.46875 -24.953125 L 3.625 -30.765625 C 5.476562 -32.828125 7.742188 -34.429688 10.421875 -35.578125 C 13.097656 -36.722656 16.019531 -37.296875 19.1875 -37.296875 C 24.03125 -37.296875 27.535156 -36.265625 29.703125 -34.203125 C 31.867188 -32.148438 32.953125 -29.234375 32.953125 -25.453125 L 32.953125 -9.5625 C 32.953125 -7.925781 33.671875 -7.109375 35.109375 -7.109375 C 35.660156 -7.109375 36.203125 -7.207031 36.734375 -7.40625 L 37.203125 -7.265625 L 37.875 -0.859375 C 37.363281 -0.523438 36.648438 -0.253906 35.734375 -0.046875 C 34.828125 0.160156 33.832031 0.265625 32.75 0.265625 C 30.5625 0.265625 28.851562 -0.148438 27.625 -0.984375 C 26.394531 -1.828125 25.515625 -3.144531 24.984375 -4.9375 L 24.296875 -5.015625 C 22.503906 -1.203125 19.160156 0.703125 14.265625 0.703125 Z M 17.1875 -6.171875 C 19.3125 -6.171875 21.007812 -6.882812 22.28125 -8.3125 C 23.550781 -9.738281 24.1875 -11.722656 24.1875 -14.265625 L 24.1875 -17.984375 L 23.5625 -18.125 C 23.007812 -17.675781 22.285156 -17.300781 21.390625 -17 C 20.492188 -16.707031 19.203125 -16.414062 17.515625 -16.125 C 15.523438 -15.789062 14.09375 -15.21875 13.21875 -14.40625 C 12.351562 -13.601562 11.921875 -12.460938 11.921875 -10.984375 C 11.921875 -9.410156 12.382812 -8.210938 13.3125 -7.390625 C 14.238281 -6.578125 15.53125 -6.171875 17.1875 -6.171875 Z"/></g><g transform="translate(119.11785, 72.933964)"><path d="M 5.28125 0 L 5.28125 -36.609375 L 14.109375 -36.609375 L 14.109375 -31.234375 L 14.796875 -31.0625 C 17.078125 -35.21875 20.773438 -37.296875 25.890625 -37.296875 C 30.109375 -37.296875 33.207031 -36.144531 35.1875 -33.84375 C 37.175781 -31.550781 38.171875 -28.203125 38.171875 -23.796875 L 38.171875 0 L 28.96875 0 L 28.96875 -22.671875 C 28.96875 -25.097656 28.476562 -26.847656 27.5 -27.921875 C 26.53125 -28.992188 24.972656 -29.53125 22.828125 -29.53125 C 20.203125 -29.53125 18.148438 -28.675781 16.671875 -26.96875 C 15.203125 -25.269531 14.46875 -22.597656 14.46875 -18.953125 L 14.46875 0 Z"/></g><g transform="translate(161.994128, 72.933964)"><path d="M 14.265625 0.703125 C 11.921875 0.703125 9.882812 0.269531 8.15625 -0.59375 C 6.4375 -1.457031 5.109375 -2.722656 4.171875 -4.390625 C 3.242188 -6.066406 2.78125 -8.078125 2.78125 -10.421875 C 2.78125 -12.585938 3.242188 -14.40625 4.171875 -15.875 C 5.109375 -17.351562 6.550781 -18.5625 8.5 -19.5 C 10.445312 -20.4375 12.988281 -21.160156 16.125 -21.671875 C 18.320312 -22.023438 19.988281 -22.410156 21.125 -22.828125 C 22.257812 -23.253906 23.023438 -23.734375 23.421875 -24.265625 C 23.828125 -24.796875 24.03125 -25.46875 24.03125 -26.28125 C 24.03125 -27.457031 23.617188 -28.351562 22.796875 -28.96875 C 21.984375 -29.59375 20.625 -29.90625 18.71875 -29.90625 C 16.6875 -29.90625 14.75 -29.453125 12.90625 -28.546875 C 11.070312 -27.640625 9.476562 -26.441406 8.125 -24.953125 L 7.46875 -24.953125 L 3.625 -30.765625 C 5.476562 -32.828125 7.742188 -34.429688 10.421875 -35.578125 C 13.097656 -36.722656 16.019531 -37.296875 19.1875 -37.296875 C 24.03125 -37.296875 27.535156 -36.265625 29.703125 -34.203125 C 31.867188 -32.148438 32.953125 -29.234375 32.953125 -25.453125 L 32.953125 -9.5625 C 32.953125 -7.925781 33.671875 -7.109375 35.109375 -7.109375 C 35.660156 -7.109375 36.203125 -7.207031 36.734375 -7.40625 L 37.203125 -7.265625 L 37.875 -0.859375 C 37.363281 -0.523438 36.648438 -0.253906 35.734375 -0.046875 C 34.828125 0.160156 33.832031 0.265625 32.75 0.265625 C 30.5625 0.265625 28.851562 -0.148438 27.625 -0.984375 C 26.394531 -1.828125 25.515625 -3.144531 24.984375 -4.9375 L 24.296875 -5.015625 C 22.503906 -1.203125 19.160156 0.703125 14.265625 0.703125 Z M 17.1875 -6.171875 C 19.3125 -6.171875 21.007812 -6.882812 22.28125 -8.3125 C 23.550781 -9.738281 24.1875 -11.722656 24.1875 -14.265625 L 24.1875 -17.984375 L 23.5625 -18.125 C 23.007812 -17.675781 22.285156 -17.300781 21.390625 -17 C 20.492188 -16.707031 19.203125 -16.414062 17.515625 -16.125 C 15.523438 -15.789062 14.09375 -15.21875 13.21875 -14.40625 C 12.351562 -13.601562 11.921875 -12.460938 11.921875 -10.984375 C 11.921875 -9.410156 12.382812 -8.210938 13.3125 -7.390625 C 14.238281 -6.578125 15.53125 -6.171875 17.1875 -6.171875 Z"/></g></g></g></g>
            </svg>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <a href="#how-it-works" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500 }}>How it Works</a>
            <a href="#features" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500 }}>Features</a>
            <a href="#faq" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500 }}>FAQ</a>
            <a href="#get-access" className="cta-btn" style={{ padding: "10px 24px", fontSize: "14px", animation: "none", textDecoration: "none" }}>Download the Beta</a>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        paddingTop: "140px", paddingBottom: "100px", position: "relative", overflow: "hidden",
        background: `linear-gradient(160deg, ${COLORS.warmVanilla} 0%, ${COLORS.softCream} 50%, ${COLORS.creamYellow}22 100%)`,
      }}>
        <StickyNote text="Finish the report" rotation={-6} delay={300} top="15%" left="3%" size={110} />
        <StickyNote text="Stay focused!" rotation={4} delay={600} top="25%" left="88%" size={100} />
        <StickyNote text="One thing at a time" rotation={-3} delay={900} top="65%" left="90%" size={115} />

        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />

        <div className="section" style={{ position: "relative", zIndex: 2 }}>
          <div style={{ maxWidth: "720px", margin: "0 auto", textAlign: "center" }}>
            <h1 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "clamp(40px, 5.5vw, 64px)",
              fontWeight: 800,
              lineHeight: 1.1,
              color: COLORS.warmBrown,
              marginBottom: "24px",
              animation: "fadeUp 0.6s ease 0.1s both",
            }}>
              The focus app for{" "}
              <span style={{
                background: `linear-gradient(135deg, ${COLORS.sunshineYellow}, ${COLORS.deepAmber})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>distracted minds</span>
            </h1>

            <p style={{
              fontSize: "clamp(18px, 2.2vw, 22px)",
              lineHeight: 1.6,
              color: COLORS.coffeeBrown,
              marginBottom: "40px",
              animation: "fadeUp 0.6s ease 0.2s both",
            }}>
              Focana is the desktop focus app for distracted minds — a floating timer that keeps your
              current task visible above every window. Built by a founder with ADHD, for anyone whose
              focus disappears the moment they switch tabs.
            </p>

            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", animation: "fadeUp 0.6s ease 0.3s both" }}>
              <a href="#get-access" className="cta-btn" style={{ fontSize: "18px", padding: "18px 40px", textDecoration: "none" }}>
                Download the Beta
                <span style={{ fontSize: "22px" }}>→</span>
              </a>
              <a href="#how-it-works" className="ghost-btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                See How It Works
              </a>
            </div>

            <p style={{
              marginTop: "16px", fontSize: "14px", color: COLORS.coffeeBrown,
              animation: "fadeUp 0.6s ease 0.35s both",
            }}>
              Available now for macOS. Windows coming soon.
            </p>

            <div style={{
              marginTop: "24px",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "16px",
              animation: "fadeUp 0.6s ease 0.4s both",
            }}>
              <div style={{ display: "flex" }}>
                {["🧠", "💛", "⭐", "🎯"].map((e, i) => (
                  <div key={i} style={{
                    width: "36px", height: "36px", borderRadius: "50%",
                    background: i % 2 === 0 ? COLORS.creamYellow : COLORS.softCream,
                    border: `2px solid white`,
                    marginLeft: i > 0 ? "-10px" : 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "16px", zIndex: 4 - i,
                  }}>{e}</div>
                ))}
              </div>
              <span style={{ fontSize: "14px", color: COLORS.coffeeBrown }}>
                Join <strong>50</strong> beta testers helping build the future of focus
              </span>
            </div>
          </div>

          {/* Video / Demo Placeholder */}
          <div style={{
            maxWidth: "880px", margin: "60px auto 0", borderRadius: "20px",
            background: `linear-gradient(135deg, ${COLORS.softCream}, ${COLORS.creamYellow}44)`,
            border: `2px solid ${COLORS.beigeBorder}`,
            aspectRatio: "16/9",
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            position: "relative", overflow: "hidden",
            boxShadow: "0 20px 60px rgba(92, 64, 51, 0.12)",
            animation: "fadeUp 0.8s ease 0.5s both",
          }}>
            <div style={{
              width: "80px", height: "80px", borderRadius: "50%",
              background: COLORS.sunshineYellow,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 8px 30px rgba(245, 158, 11, 0.3)",
              transition: "all 0.3s ease",
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill={COLORS.warmBrown}>
                <polygon points="8,5 19,12 8,19" />
              </svg>
            </div>
            <p style={{ marginTop: "16px", fontSize: "15px", color: COLORS.coffeeBrown, fontWeight: 500 }}>
              Watch Focana in action — 45 seconds
            </p>
            <div style={{
              position: "absolute", bottom: "20px", right: "20px",
              background: "white", borderRadius: "12px", padding: "12px 16px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
              display: "flex", alignItems: "center", gap: "10px",
              animation: "float 4s ease-in-out infinite",
            }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10B981" }} />
              <span style={{ fontFamily: "'Caveat', cursive", fontSize: "16px", color: COLORS.warmBrown }}>
                You focused for 23 minutes!
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* PROBLEM */}
      <section style={{ padding: "100px 0", background: "white" }}>
        <div className="section">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto" }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700,
              color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "2px",
            }}>The problem</span>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 800, marginTop: "16px", marginBottom: "20px", color: COLORS.warmBrown,
              lineHeight: 1.15,
            }}>
              Out of sight, out of mind.
            </h2>
            <p style={{ fontSize: "19px", lineHeight: 1.7, color: COLORS.coffeeBrown }}>
              You set a focus intention. Then you switch tabs. Open Slack. Check email.
              And just like that — your intention is buried. For distracted minds,
              if a task isn't visible, it doesn't exist.
            </p>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px", marginTop: "60px",
          }}>
            {[
              { icon: "🫥", title: "Browser extensions disappear", desc: "Switch to Slack or your IDE and your focus tool vanishes. Gone. Along with your intention." },
              { icon: "📱", title: "Mobile apps are on the wrong device", desc: "Your phone timer doesn't help when the distraction is on your computer screen." },
              { icon: "🤯", title: "Complex suites cause overload", desc: "47 features, 12 settings, 8 views. Your already-overwhelmed brain shuts down before you start." },
            ].map((item, i) => (
              <div key={i} style={{
                background: COLORS.softCream,
                borderRadius: "20px",
                padding: "36px",
                border: `1px solid ${COLORS.beigeBorder}`,
              }}>
                <span style={{ fontSize: "40px", display: "block", marginBottom: "16px" }}>{item.icon}</span>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: "10px", color: COLORS.warmBrown }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: "16px", lineHeight: 1.6, color: COLORS.coffeeBrown }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: "100px 0", background: COLORS.warmVanilla }}>
        <div className="section">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto" }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700,
              color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "2px",
            }}>The solution</span>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 800, marginTop: "16px", marginBottom: "20px", color: COLORS.warmBrown,
              lineHeight: 1.15,
            }}>
              Your intention, floating above everything
            </h2>
            <p style={{ fontSize: "19px", lineHeight: 1.7, color: COLORS.coffeeBrown }}>
              Focana is a desktop focus tool that stays visible above every app on your screen.
              Designed for ADHD brains and anyone drowning in digital chaos.
              One task. One timer. Always on top. Zero overwhelm.
            </p>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "32px", marginTop: "70px",
          }}>
            {[
              { step: "1", title: "Type your task", desc: "Write what you're focusing on. Just one thing. That's the whole point.", icon: "✏️" },
              { step: "2", title: "Start the timer", desc: "Freeflow or timeboxed — your choice. No rigid 25-minute rules here.", icon: "⏱️" },
              { step: "3", title: "It floats on top", desc: "Your focus intention stays visible above Slack, Chrome, VS Code — everything.", icon: "📌" },
              { step: "4", title: "Get celebrated", desc: "\"You focused for 23 minutes!\" Focana celebrates progress, not perfection.", icon: "🎉" },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: "center", position: "relative" }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "50%",
                  background: `linear-gradient(135deg, ${COLORS.sunshineYellow}33, ${COLORS.creamYellow})`,
                  border: `2px solid ${COLORS.sunshineYellow}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 20px", fontSize: "28px",
                }}>
                  {item.icon}
                </div>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: "12px", fontWeight: 700,
                  color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "2px",
                  marginBottom: "8px",
                }}>Step {item.step}</div>
                <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 700, marginBottom: "10px", color: COLORS.warmBrown }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: "15px", lineHeight: 1.6, color: COLORS.coffeeBrown }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "100px 0", background: "white" }}>
        <div className="section">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto", marginBottom: "60px" }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700,
              color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "2px",
            }}>Features</span>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 44px)",
              fontWeight: 800, marginTop: "16px", color: COLORS.warmBrown, lineHeight: 1.15,
            }}>
              Designed for how your brain actually works
            </h2>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            {[
              {
                icon: "📌",
                title: "Always-on-top visibility",
                desc: "Your focus intention floats above every application — browser, IDE, Slack, Zoom. It's the ADHD app that stays on screen when everything else gets buried.",
                tag: "Core feature",
              },
              {
                icon: "🕐",
                title: "Flexible focus timer",
                desc: "Freeflow mode when you're in the zone. Timebox mode when you need structure. No forced 25-minute intervals — your brain, your rules.",
                tag: "ADHD-friendly",
              },
              {
                icon: "🎉",
                title: "Celebratory, not punitive",
                desc: "\"You focused for 17 minutes!\" — not \"Session incomplete.\" Focana celebrates every minute of progress because distracted minds need the win, not another guilt trip.",
                tag: "Motivation",
              },
              {
                icon: "🧠",
                title: "Zero cognitive load",
                desc: "No accounts, no onboarding maze, no 47 settings to configure. Type your task. Start the timer. That's it. Made for brains that are already overwhelmed.",
                tag: "Simplicity",
              },
              {
                icon: "🔒",
                title: "Incognito mode",
                desc: "In a meeting? Focana minimizes to a subtle pill shape. Your focus stays with you, but nobody else needs to know you're using a focus tool.",
                tag: "Privacy",
              },
              {
                icon: "🖥️",
                title: "True desktop app",
                desc: "Not a browser extension. Not a web app. A native desktop application with OS-level always-on-top, keyboard shortcuts, and system tray access.",
                tag: "Desktop native",
              },
            ].map((item, i) => (
              <div key={i} className="feature-card">
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: "6px",
                  background: `${COLORS.sunshineYellow}18`,
                  borderRadius: "100px", padding: "4px 14px", marginBottom: "16px",
                }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "1px" }}>
                    {item.tag}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "16px" }}>
                  <span style={{ fontSize: "32px", flexShrink: 0, marginTop: "2px" }}>{item.icon}</span>
                  <div>
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "19px", fontWeight: 700, marginBottom: "8px", color: COLORS.warmBrown }}>
                      {item.title}
                    </h3>
                    <p style={{ fontSize: "15px", lineHeight: 1.65, color: COLORS.coffeeBrown }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{
        padding: "80px 0",
        background: `linear-gradient(135deg, ${COLORS.softBlack}, #2A2520)`,
        color: "white",
      }}>
        <div className="section">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "40px",
            textAlign: "center",
          }}>
            {[
              { number: 15500000, suffix: "+", label: "US adults diagnosed with ADHD — and millions more undiagnosed" },
              { number: 47, suffix: "+", label: "Avg. productivity apps tried before one finally sticks" },
              { number: 85, suffix: "%", label: "Of focus tools that fail because they disappear from sight" },
            ].map((item, i) => (
              <div key={i}>
                <div style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: "clamp(36px, 4vw, 52px)",
                  fontWeight: 800,
                  background: `linear-gradient(135deg, ${COLORS.sunshineYellow}, ${COLORS.goldenGlow})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}>
                  <AnimatedNumber target={item.number} suffix={item.suffix} />
                </div>
                <p style={{ fontSize: "15px", marginTop: "8px", color: COLORS.warmGray }}>
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section style={{ padding: "100px 0", background: COLORS.softCream }}>
        <div className="section">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto", marginBottom: "60px" }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700,
              color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "2px",
            }}>Who it's for</span>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 44px)",
              fontWeight: 800, marginTop: "16px", color: COLORS.warmBrown, lineHeight: 1.15,
            }}>
              If this sounds like you...
            </h2>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "20px",
          }}>
            {[
              "You open your laptop with one goal and end up down a Wikipedia rabbit hole",
              "You've tried Notion, Forest, Todoist — nothing sticks longer than a week",
              "You set a timer but forget what you were timing by the time it goes off",
              "You write your task on a sticky note that ends up buried under 14 tabs",
              "You have 47 open tabs and can't remember why you opened any of them",
              "You need external working memory because your brain's RAM is always full — ADHD or not",
            ].map((text, i) => (
              <div key={i} style={{
                background: "white",
                borderRadius: "16px",
                padding: "24px 28px",
                display: "flex",
                alignItems: "flex-start",
                gap: "14px",
                border: `1px solid ${COLORS.beigeBorder}`,
              }}>
                <span style={{
                  fontSize: "20px", flexShrink: 0,
                  background: `${COLORS.sunshineYellow}22`,
                  borderRadius: "8px",
                  width: "36px", height: "36px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✓</span>
                <p style={{ fontSize: "16px", lineHeight: 1.5, color: COLORS.warmBrown, fontWeight: 500 }}>
                  {text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: "100px 0", background: "white" }}>
        <div className="section" style={{ textAlign: "center" }}>
          <span style={{
            fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700,
            color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "2px",
          }}>What people are saying</span>
          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: "clamp(28px, 3.5vw, 40px)",
            fontWeight: 800, marginTop: "16px", marginBottom: "60px", color: COLORS.warmBrown,
          }}>
            From our early community
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "24px" }}>
            {[
              { quote: "Finally someone who understands ADHD brains. This is the only focus app I've used for more than a week.", name: "Early Beta User", role: "Software Developer" },
              { quote: "It's like having a gentle friend remind you what you're doing. Simple. Warm. Actually helpful.", name: "Beta Tester", role: "UX Designer with ADHD" },
              { quote: "The fact that it stays on top of everything is a game-changer for remote work. My productivity has skyrocketed.", name: "Beta Tester", role: "Freelance Writer" },
            ].map((t, i) => (
              <div key={i} style={{
                background: COLORS.softCream,
                borderRadius: "20px",
                padding: "36px",
                textAlign: "left",
                border: `1px solid ${COLORS.beigeBorder}`,
                position: "relative",
              }}>
                <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
                  {[1,2,3,4,5].map(s => <span key={s} style={{ color: COLORS.sunshineYellow, fontSize: "18px" }}>★</span>)}
                </div>
                <p style={{ fontSize: "16px", lineHeight: 1.7, color: COLORS.warmBrown, fontStyle: "italic", marginBottom: "20px" }}>
                  "{t.quote}"
                </p>
                <div>
                  <p style={{ fontWeight: 700, fontSize: "15px", color: COLORS.warmBrown }}>{t.name}</p>
                  <p style={{ fontSize: "13px", color: COLORS.coffeeBrown }}>{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "100px 0", background: COLORS.warmVanilla }}>
        <div className="section" style={{ maxWidth: "760px" }}>
          <div style={{ textAlign: "center", marginBottom: "50px" }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700,
              color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "2px",
            }}>FAQ</span>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(28px, 3.5vw, 40px)",
              fontWeight: 800, marginTop: "16px", color: COLORS.warmBrown,
            }}>
              Frequently asked questions
            </h2>
          </div>

          <FAQItem
            question="How is Focana different from a browser extension focus timer?"
            answer="Browser extensions disappear the moment you switch to another app — Slack, your IDE, Figma. Focana is a native desktop app that floats above every application on your screen. Your focus intention stays visible no matter what you're doing. It's the ADHD timer that never hides."
          />
          <FAQItem
            question="I have ADHD and I've tried dozens of productivity apps. Why would this one stick?"
            answer="Most productivity tools fail distracted minds because they rely on you remembering to check them. Focana flips that — it stays in your line of sight at all times, acting as external working memory. There's nothing to remember, no app to switch to. It's always right there. Plus, it celebrates your progress instead of punishing you for incomplete sessions. Whether you have ADHD or just a brain that's overwhelmed by modern digital chaos, the principle is the same: if you can see it, you can do it."
          />
          <FAQItem
            question="What does 'always on top' actually mean?"
            answer="Focana uses native OS integration to float a small, beautiful window above every other application on your computer — above Chrome, Slack, VS Code, Zoom, everything. It's like a digital sticky note that never gets buried. You can position it anywhere on your screen and it stays put."
          />
          <FAQItem
            question="Does Focana help with ADHD time blindness?"
            answer="Yes. Time blindness — the feeling that time moves differently than you expect — is a core ADHD challenge. Focana's visible timer gives you gentle, always-present time awareness without the anxiety of ticking clocks. You see time passing in real-time, which helps anchor you in the present moment."
          />
          <FAQItem
            question="Is Focana available for Mac and Windows?"
            answer="Focana is available now for macOS. Windows is in development — sign up to get notified the moment it's ready."
          />
          <FAQItem
            question="How much does Focana cost?"
            answer="Focana is free during the beta. We'll be offering an introductory lifetime deal for early supporters, plus an affordable monthly subscription when we officially launch."
          />
          <FAQItem
            question="Do I need to have ADHD to use Focana?"
            answer="Not at all. Focana was born from ADHD experience, but the core problem it solves — losing your focus intention when you switch contexts — is universal. Remote workers, developers, writers, students, anyone battling tab overload and digital distraction will feel the difference immediately. If you've ever switched tabs and forgotten what you were doing, Focana was built for you."
          />
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="get-access" style={{
        padding: "100px 0",
        background: `linear-gradient(160deg, ${COLORS.warmBrown}, ${COLORS.softBlack})`,
        position: "relative",
        overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", top: "-50%", left: "50%", transform: "translateX(-50%)",
          width: "600px", height: "600px", borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.sunshineYellow}15 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <div className="section" style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: "640px" }}>
          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800, marginBottom: "20px", color: "white", lineHeight: 1.15,
          }}>
            Stop losing your focus to{" "}
            <span style={{ color: COLORS.sunshineYellow }}>invisible tools</span>
          </h2>
          <p style={{ fontSize: "19px", lineHeight: 1.7, color: COLORS.warmGray, marginBottom: "40px" }}>
            Try the focus app that finally stays where you can see it. Free during beta — available now for macOS.
          </p>

          <WaitlistForm variant="dark" />

          <p style={{ fontSize: "13px", color: COLORS.warmGray, marginTop: "20px", opacity: 0.7 }}>
            No spam, ever. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "48px 0", background: COLORS.softBlack, borderTop: `1px solid ${COLORS.warmBrown}22` }}>
        <div className="section" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: "20px",
        }}>
          <a href="#" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 375 150" preserveAspectRatio="xMidYMid meet">
              <defs><clipPath id="footer-f"><rect x="0" width="40" y="0" height="94"/></clipPath><clipPath id="footer-text"><rect x="0" width="202" y="0" height="94"/></clipPath></defs>
              <path strokeLinecap="round" transform="matrix(0.75, 0, 0, 0.75, 83.921775, 16.914411)" fill="none" strokeLinejoin="miter" d="M 3.500133 3.499536 L 101.536598 3.499536" stroke="#d4a054" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <path strokeLinecap="round" transform="matrix(0.75, 0, 0, 0.75, 44.567612, 16.914411)" fill="none" strokeLinejoin="miter" d="M 3.498393 3.499536 L 29.878603 3.499536" stroke="#d4a054" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <path strokeLinecap="round" transform="matrix(0, -0.75, 0.75, 0, 44.157332, 131.394882)" fill="none" strokeLinejoin="miter" d="M 3.500468 3.498558 L 149.141102 3.498558" stroke="#d4a054" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <path strokeLinecap="round" transform="matrix(0.75, 0, 0, 0.75, 44.567612, 126.205893)" fill="none" strokeLinejoin="miter" d="M 3.498393 3.501518 L 148.03486 3.501518" stroke="#d4a054" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <path strokeLinecap="round" transform="matrix(0, -0.75, 0.75, 0, 157.854047, 49.426432)" fill="none" strokeLinejoin="miter" d="M 3.500868 3.501896 L 39.855037 3.501896" stroke="#d4a054" strokeWidth="7" strokeOpacity="1" strokeMiterlimit="4"/>
              <g transform="matrix(1, 0, 0, 1, 84, 28)"><g clipPath="url(#footer-f)"><g fill="#FEF3C7" fillOpacity="1"><g transform="translate(0.0198762, 72.933964)"><path d="M 37.078125 -48.515625 L 37.078125 -40.484375 L 15.890625 -40.484375 L 15.890625 -27.640625 L 35.109375 -27.640625 L 35.109375 -19.71875 L 15.890625 -19.71875 L 15.890625 0 L 6.3125 0 L 6.3125 -48.515625 Z"/></g></g></g></g>
              <g transform="matrix(1, 0, 0, 1, 123, 28)"><g clipPath="url(#footer-text)"><g fill="#FEF3C7" fillOpacity="1"><g transform="translate(0.245694, 72.933964)"><path d="M 21.265625 0.703125 C 17.679688 0.703125 14.535156 -0.03125 11.828125 -1.5 C 9.117188 -2.976562 7.015625 -5.140625 5.515625 -7.984375 C 4.023438 -10.828125 3.28125 -14.257812 3.28125 -18.28125 C 3.28125 -22.3125 4.023438 -25.753906 5.515625 -28.609375 C 7.015625 -31.460938 9.117188 -33.625 11.828125 -35.09375 C 14.535156 -36.5625 17.679688 -37.296875 21.265625 -37.296875 C 24.859375 -37.296875 28.007812 -36.5625 30.71875 -35.09375 C 33.425781 -33.625 35.53125 -31.460938 37.03125 -28.609375 C 38.539062 -25.753906 39.296875 -22.3125 39.296875 -18.28125 C 39.296875 -14.257812 38.539062 -10.828125 37.03125 -7.984375 C 35.53125 -5.140625 33.425781 -2.976562 30.71875 -1.5 C 28.007812 -0.03125 24.859375 0.703125 21.265625 0.703125 Z M 21.265625 -7.109375 C 26.953125 -7.109375 29.796875 -10.832031 29.796875 -18.28125 C 29.796875 -22.15625 29.066406 -24.992188 27.609375 -26.796875 C 26.148438 -28.597656 24.035156 -29.5 21.265625 -29.5 C 15.585938 -29.5 12.75 -25.757812 12.75 -18.28125 C 12.75 -10.832031 15.585938 -7.109375 21.265625 -7.109375 Z"/></g><g transform="translate(42.790112, 72.933964)"><path d="M 21.34375 0.703125 C 17.800781 0.703125 14.664062 -0.03125 11.9375 -1.5 C 9.21875 -2.976562 7.09375 -5.144531 5.5625 -8 C 4.039062 -10.851562 3.28125 -14.28125 3.28125 -18.28125 C 3.28125 -22.3125 4.039062 -25.753906 5.5625 -28.609375 C 7.09375 -31.460938 9.207031 -33.625 11.90625 -35.09375 C 14.613281 -36.5625 17.703125 -37.296875 21.171875 -37.296875 C 28.890625 -37.296875 33.835938 -34.5 36.015625 -28.90625 L 29.703125 -24.390625 L 29 -24.390625 C 28.25 -26.117188 27.269531 -27.398438 26.0625 -28.234375 C 24.863281 -29.078125 23.234375 -29.5 21.171875 -29.5 C 18.515625 -29.5 16.445312 -28.582031 14.96875 -26.75 C 13.488281 -24.914062 12.75 -22.09375 12.75 -18.28125 C 12.75 -14.519531 13.5 -11.71875 15 -9.875 C 16.5 -8.03125 18.613281 -7.109375 21.34375 -7.109375 C 23.332031 -7.109375 25.015625 -7.644531 26.390625 -8.71875 C 27.773438 -9.789062 28.769531 -11.332031 29.375 -13.34375 L 30.0625 -13.40625 L 36.609375 -9.828125 C 35.679688 -6.722656 33.957031 -4.191406 31.4375 -2.234375 C 28.925781 -0.273438 25.5625 0.703125 21.34375 0.703125 Z"/></g><g transform="translate(80.522564, 72.933964)"><path d="M 14.265625 0.703125 C 11.921875 0.703125 9.882812 0.269531 8.15625 -0.59375 C 6.4375 -1.457031 5.109375 -2.722656 4.171875 -4.390625 C 3.242188 -6.066406 2.78125 -8.078125 2.78125 -10.421875 C 2.78125 -12.585938 3.242188 -14.40625 4.171875 -15.875 C 5.109375 -17.351562 6.550781 -18.5625 8.5 -19.5 C 10.445312 -20.4375 12.988281 -21.160156 16.125 -21.671875 C 18.320312 -22.023438 19.988281 -22.410156 21.125 -22.828125 C 22.257812 -23.253906 23.023438 -23.734375 23.421875 -24.265625 C 23.828125 -24.796875 24.03125 -25.46875 24.03125 -26.28125 C 24.03125 -27.457031 23.617188 -28.351562 22.796875 -28.96875 C 21.984375 -29.59375 20.625 -29.90625 18.71875 -29.90625 C 16.6875 -29.90625 14.75 -29.453125 12.90625 -28.546875 C 11.070312 -27.640625 9.476562 -26.441406 8.125 -24.953125 L 7.46875 -24.953125 L 3.625 -30.765625 C 5.476562 -32.828125 7.742188 -34.429688 10.421875 -35.578125 C 13.097656 -36.722656 16.019531 -37.296875 19.1875 -37.296875 C 24.03125 -37.296875 27.535156 -36.265625 29.703125 -34.203125 C 31.867188 -32.148438 32.953125 -29.234375 32.953125 -25.453125 L 32.953125 -9.5625 C 32.953125 -7.925781 33.671875 -7.109375 35.109375 -7.109375 C 35.660156 -7.109375 36.203125 -7.207031 36.734375 -7.40625 L 37.203125 -7.265625 L 37.875 -0.859375 C 37.363281 -0.523438 36.648438 -0.253906 35.734375 -0.046875 C 34.828125 0.160156 33.832031 0.265625 32.75 0.265625 C 30.5625 0.265625 28.851562 -0.148438 27.625 -0.984375 C 26.394531 -1.828125 25.515625 -3.144531 24.984375 -4.9375 L 24.296875 -5.015625 C 22.503906 -1.203125 19.160156 0.703125 14.265625 0.703125 Z M 17.1875 -6.171875 C 19.3125 -6.171875 21.007812 -6.882812 22.28125 -8.3125 C 23.550781 -9.738281 24.1875 -11.722656 24.1875 -14.265625 L 24.1875 -17.984375 L 23.5625 -18.125 C 23.007812 -17.675781 22.285156 -17.300781 21.390625 -17 C 20.492188 -16.707031 19.203125 -16.414062 17.515625 -16.125 C 15.523438 -15.789062 14.09375 -15.21875 13.21875 -14.40625 C 12.351562 -13.601562 11.921875 -12.460938 11.921875 -10.984375 C 11.921875 -9.410156 12.382812 -8.210938 13.3125 -7.390625 C 14.238281 -6.578125 15.53125 -6.171875 17.1875 -6.171875 Z"/></g><g transform="translate(119.11785, 72.933964)"><path d="M 5.28125 0 L 5.28125 -36.609375 L 14.109375 -36.609375 L 14.109375 -31.234375 L 14.796875 -31.0625 C 17.078125 -35.21875 20.773438 -37.296875 25.890625 -37.296875 C 30.109375 -37.296875 33.207031 -36.144531 35.1875 -33.84375 C 37.175781 -31.550781 38.171875 -28.203125 38.171875 -23.796875 L 38.171875 0 L 28.96875 0 L 28.96875 -22.671875 C 28.96875 -25.097656 28.476562 -26.847656 27.5 -27.921875 C 26.53125 -28.992188 24.972656 -29.53125 22.828125 -29.53125 C 20.203125 -29.53125 18.148438 -28.675781 16.671875 -26.96875 C 15.203125 -25.269531 14.46875 -22.597656 14.46875 -18.953125 L 14.46875 0 Z"/></g><g transform="translate(161.994128, 72.933964)"><path d="M 14.265625 0.703125 C 11.921875 0.703125 9.882812 0.269531 8.15625 -0.59375 C 6.4375 -1.457031 5.109375 -2.722656 4.171875 -4.390625 C 3.242188 -6.066406 2.78125 -8.078125 2.78125 -10.421875 C 2.78125 -12.585938 3.242188 -14.40625 4.171875 -15.875 C 5.109375 -17.351562 6.550781 -18.5625 8.5 -19.5 C 10.445312 -20.4375 12.988281 -21.160156 16.125 -21.671875 C 18.320312 -22.023438 19.988281 -22.410156 21.125 -22.828125 C 22.257812 -23.253906 23.023438 -23.734375 23.421875 -24.265625 C 23.828125 -24.796875 24.03125 -25.46875 24.03125 -26.28125 C 24.03125 -27.457031 23.617188 -28.351562 22.796875 -28.96875 C 21.984375 -29.59375 20.625 -29.90625 18.71875 -29.90625 C 16.6875 -29.90625 14.75 -29.453125 12.90625 -28.546875 C 11.070312 -27.640625 9.476562 -26.441406 8.125 -24.953125 L 7.46875 -24.953125 L 3.625 -30.765625 C 5.476562 -32.828125 7.742188 -34.429688 10.421875 -35.578125 C 13.097656 -36.722656 16.019531 -37.296875 19.1875 -37.296875 C 24.03125 -37.296875 27.535156 -36.265625 29.703125 -34.203125 C 31.867188 -32.148438 32.953125 -29.234375 32.953125 -25.453125 L 32.953125 -9.5625 C 32.953125 -7.925781 33.671875 -7.109375 35.109375 -7.109375 C 35.660156 -7.109375 36.203125 -7.207031 36.734375 -7.40625 L 37.203125 -7.265625 L 37.875 -0.859375 C 37.363281 -0.523438 36.648438 -0.253906 35.734375 -0.046875 C 34.828125 0.160156 33.832031 0.265625 32.75 0.265625 C 30.5625 0.265625 28.851562 -0.148438 27.625 -0.984375 C 26.394531 -1.828125 25.515625 -3.144531 24.984375 -4.9375 L 24.296875 -5.015625 C 22.503906 -1.203125 19.160156 0.703125 14.265625 0.703125 Z M 17.1875 -6.171875 C 19.3125 -6.171875 21.007812 -6.882812 22.28125 -8.3125 C 23.550781 -9.738281 24.1875 -11.722656 24.1875 -14.265625 L 24.1875 -17.984375 L 23.5625 -18.125 C 23.007812 -17.675781 22.285156 -17.300781 21.390625 -17 C 20.492188 -16.707031 19.203125 -16.414062 17.515625 -16.125 C 15.523438 -15.789062 14.09375 -15.21875 13.21875 -14.40625 C 12.351562 -13.601562 11.921875 -12.460938 11.921875 -10.984375 C 11.921875 -9.410156 12.382812 -8.210938 13.3125 -7.390625 C 14.238281 -6.578125 15.53125 -6.171875 17.1875 -6.171875 Z"/></g></g></g></g>
            </svg>
          </a>
          <p style={{ fontSize: "13px", color: COLORS.warmGray }}>
            &copy; 2026 Focana.
          </p>
          <div style={{ display: "flex", gap: "20px" }}>
            <a href="#" style={{ fontSize: "13px", color: COLORS.warmGray, textDecoration: "none" }}>Privacy</a>
            <a href="#" style={{ fontSize: "13px", color: COLORS.warmGray, textDecoration: "none" }}>Terms</a>
            <a href="#" style={{ fontSize: "13px", color: COLORS.warmGray, textDecoration: "none" }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
