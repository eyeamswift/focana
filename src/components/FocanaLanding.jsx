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
  warmGray: "#7A6548",
};

function phCapture(event, props) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture(event, props);
  }
}

// Feature Video with click-to-play overlay
function FeatureVideo({ src }) {
  const videoRef = useRef(null);
  const [state, setState] = useState("idle"); // "idle" | "playing" | "ended"
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => setState("ended");
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, []);

  const handleClick = () => {
    const video = videoRef.current;
    if (!video) return;
    if (state === "playing") {
      video.pause();
      setState("idle");
    } else {
      if (state === "ended") video.currentTime = 0;
      video.play();
      setState("playing");
    }
  };

  const isActive = state === "playing";
  const isEnded = state === "ended";

  return (
    <div
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        cursor: "pointer",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(92, 64, 51, 0.1)",
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        src={src}
        style={{
          width: "100%",
          display: "block",
          opacity: isActive ? 1 : hovered ? 0.8 : 0.65,
          transition: "opacity 0.25s ease",
        }}
      />
      {!isActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "transform 0.2s ease",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.85)",
              boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: hovered ? "scale(1.1)" : "scale(1)",
              transition: "transform 0.2s ease",
            }}
          >
            {isEnded ? (
              /* Replay arrow */
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 1 }}>
                <path d="M12 5V1L7 6l5 5V7a6 6 0 110 10 5.97 5.97 0 01-4.24-1.76l-1.42 1.42A8 8 0 1012 5z" fill={COLORS.warmBrown} />
              </svg>
            ) : (
              /* Play triangle */
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 3 }}>
                <path d="M8 5v14l11-7z" fill={COLORS.warmBrown} />
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// FAQ Item
let faqCounter = 0;
function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  const [id] = useState(() => `faq-${++faqCounter}`);
  return (
    <div
      style={{
        borderBottom: `1px solid ${COLORS.beigeBorder}`,
        padding: "20px 0",
      }}
    >
      <button
        onClick={() => {
          if (!open) phCapture("faq_clicked", { question });
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls={`${id}-panel`}
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
        <span aria-hidden="true" style={{
          fontSize: "24px",
          color: COLORS.deepAmber,
          transform: open ? "rotate(45deg)" : "rotate(0deg)",
          transition: "transform 0.3s ease",
          flexShrink: 0,
          marginLeft: "16px",
        }}>+</span>
      </button>
      <div id={`${id}-panel`} role="region" style={{
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
    <div className="sticky-note" style={{
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

// Windows waitlist modal
function WaitlistModal({ open, onClose }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const modalRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        const input = modalRef.current?.querySelector("input");
        if (input) input.focus();
      }, 0);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPhone("");
      setStatus("idle");
      setErrorMsg("");
      return;
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/windows-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone: phone || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        ref={modalRef}
        className="modal-inner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="waitlist-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px", padding: "40px",
          maxWidth: "440px", width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {status === "success" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
            <h3 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "22px",
              fontWeight: 700, color: COLORS.warmBrown, marginBottom: "12px",
            }}>You're on the list!</h3>
            <p style={{ fontSize: "16px", color: COLORS.coffeeBrown, marginBottom: "24px", lineHeight: 1.6 }}>
              We'll let you know the moment Focana for Windows is ready.
            </p>
            <button onClick={onClose} className="cta-btn" style={{ padding: "12px 32px", fontSize: "15px" }}>
              Got it
            </button>
          </div>
        ) : (
          <>
            <h3 id="waitlist-modal-title" style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "22px",
              fontWeight: 700, color: COLORS.warmBrown, marginBottom: "8px",
            }}>
              Get notified when Focana hits Windows
            </h3>
            <p style={{ fontSize: "15px", color: COLORS.coffeeBrown, marginBottom: "24px", lineHeight: 1.5 }}>
              Drop your email and we'll let you know the moment it's ready.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="your@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{
                  width: "100%", padding: "14px 16px", fontSize: "16px",
                  border: `1.5px solid ${COLORS.beigeBorder}`, borderRadius: "10px",
                  fontFamily: "'DM Sans', sans-serif", color: COLORS.warmBrown,
                  marginBottom: "12px",
                }}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                style={{
                  width: "100%", padding: "14px 16px", fontSize: "16px",
                  border: `1.5px solid ${COLORS.beigeBorder}`, borderRadius: "10px",
                  fontFamily: "'DM Sans', sans-serif", color: COLORS.warmBrown,
                  marginBottom: "20px",
                }}
              />
              {status === "error" && (
                <p style={{ color: COLORS.error || "#DC2626", fontSize: "14px", marginBottom: "12px" }}>
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                className="cta-btn"
                disabled={status === "loading"}
                style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: "16px" }}
              >
                {status === "loading" ? "Joining..." : "Join the Waitlist"}
              </button>
            </form>
            <button
              onClick={onClose}
              style={{
                display: "block", margin: "16px auto 0", background: "none",
                border: "none", color: COLORS.coffeeBrown, fontSize: "14px",
                cursor: "pointer", padding: "4px",
              }}
            >
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function WaitlistSignupModal({ open, onClose, location }) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const modalRef = useRef(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setTimeout(() => {
        const input = modalRef.current?.querySelector("input");
        if (input) input.focus();
      }, 0);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEmail("");
      setPhone("");
      setStatus("idle");
      setErrorMsg("");
      return;
    }
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll('button, input, [href], [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res = await fetch("/api/beta-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone: phone || undefined }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setStatus("success");
        return;
      }
      if (!res.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      setStatus("success");
      phCapture("waitlist_signup", { location });
    } catch (err) {
      setStatus("error");
      setErrorMsg(err.message || "Something went wrong. Please try again.");
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        ref={modalRef}
        className="modal-inner"
        role="dialog"
        aria-modal="true"
        aria-labelledby="signup-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "20px", padding: "40px",
          maxWidth: "440px", width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {status === "success" ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🎉</div>
            <h3 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "22px",
              fontWeight: 700, color: COLORS.warmBrown, marginBottom: "12px",
            }}>You're on the list!</h3>
            <p style={{ fontSize: "16px", color: COLORS.coffeeBrown, marginBottom: "24px", lineHeight: 1.6 }}>
              We'll notify you when we launch.
            </p>
            <button onClick={onClose} className="cta-btn" style={{ padding: "12px 32px", fontSize: "15px" }}>
              Got it
            </button>
          </div>
        ) : (
          <>
            <h3 id="signup-modal-title" style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "22px",
              fontWeight: 700, color: COLORS.warmBrown, marginBottom: "8px",
            }}>
              Join the Waitlist
            </h3>
            <p style={{ fontSize: "15px", color: COLORS.coffeeBrown, marginBottom: "24px", lineHeight: 1.5 }}>
              Drop your email and we'll let you know the moment Focana is ready.
            </p>
            <form onSubmit={handleSubmit}>
              <input
                type="email"
                placeholder="your@email.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                style={{
                  width: "100%", padding: "14px 16px", fontSize: "16px",
                  border: `1.5px solid ${COLORS.beigeBorder}`, borderRadius: "10px",
                  fontFamily: "'DM Sans', sans-serif", color: COLORS.warmBrown,
                  marginBottom: "12px",
                }}
              />
              <input
                type="tel"
                placeholder="Phone (optional)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
                style={{
                  width: "100%", padding: "14px 16px", fontSize: "16px",
                  border: `1.5px solid ${COLORS.beigeBorder}`, borderRadius: "10px",
                  fontFamily: "'DM Sans', sans-serif", color: COLORS.warmBrown,
                  marginBottom: "20px",
                }}
              />
              {status === "error" && (
                <p style={{ color: COLORS.error || "#DC2626", fontSize: "14px", marginBottom: "12px" }}>
                  {errorMsg}
                </p>
              )}
              <button
                type="submit"
                className="cta-btn"
                disabled={status === "loading"}
                style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: "16px" }}
              >
                {status === "loading" ? "Joining..." : "Join the Waitlist"}
              </button>
            </form>
            <button
              onClick={onClose}
              style={{
                display: "block", margin: "16px auto 0", background: "none",
                border: "none", color: COLORS.coffeeBrown, fontSize: "14px",
                cursor: "pointer", padding: "4px",
              }}
            >
              Maybe later
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function getIsAppleSilicon() {
  try {
    if (!/Mac/.test(navigator.userAgent)) return null;
    if (/ARM/.test(navigator.userAgent)) return true;
    if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    if (gl) {
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      if (dbg) {
        const renderer = gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL);
        if (/Apple/.test(renderer) && !/Intel/.test(renderer)) return true;
        if (/Intel/.test(renderer)) return false;
      }
    }
  } catch {}
  return null;
}

const CHECKOUT_URL = import.meta.env.PUBLIC_LEMONSQUEEZY_CHECKOUT_URL || "https://focana.lemonsqueezy.com/checkout/buy/d4f23c8d-b002-48c9-8ed6-a5ea6220ac59?embed=1";

export default function FocanaLanding() {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [signupModalOpen, setSignupModalOpen] = useState(false);
  const [signupLocation, setSignupLocation] = useState("hero");
  const [headlineIndex, setHeadlineIndex] = useState(0);
  const [checkoutError, setCheckoutError] = useState("");
  const checkoutReadyPromiseRef = useRef(null);
  const checkoutErrorTimeoutRef = useRef(null);
  const headlines = ["What was it?", "It didn't get done.", "You did 3 other things.", "Where did the time go?"];

  useEffect(() => {
    let rafId = 0;
    const handle = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        setScrollY(window.scrollY);
        rafId = 0;
      });
    };
    window.addEventListener("scroll", handle, { passive: true });
    return () => {
      window.removeEventListener("scroll", handle);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Rotating headline
  useEffect(() => {
    const timer = setInterval(() => {
      setHeadlineIndex((prev) => (prev + 1) % 4);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (checkoutErrorTimeoutRef.current) {
        window.clearTimeout(checkoutErrorTimeoutRef.current);
      }
    };
  }, []);

  // Lemon Squeezy checkout success → redirect to download page
  useEffect(() => {
    const getCheckoutSuccessContext = (event) => {
      const payload = event?.data || {};
      const nestedOrder = payload.order || {};
      const attributes = payload.attributes || nestedOrder.attributes || {};

      const email =
        payload.user_email ||
        attributes.user_email ||
        nestedOrder.user_email ||
        "";

      const orderId =
        payload.id ||
        payload.order_id ||
        nestedOrder.id ||
        nestedOrder.order_id ||
        "";

      return {
        email: email ? String(email).trim() : "",
        orderId: orderId ? String(orderId).trim() : "",
      };
    };

    const setupLS = () => {
      if (window.LemonSqueezy) {
        window.LemonSqueezy.Setup({
          eventHandler: (event) => {
            if (event.event === "Checkout.Success") {
              const { email, orderId } = getCheckoutSuccessContext(event);
              phCapture("purchase_completed", { email, order_id: orderId });
              try {
                window.sessionStorage.setItem(
                  "focana_purchase_context",
                  JSON.stringify({ email, orderId })
                );
              } catch {}
              const params = new URLSearchParams();
              if (email) params.set("email", email);
              if (orderId) params.set("order_id", orderId);
              const qs = params.toString();
              window.location.href = "/download" + (qs ? "?" + qs : "");
            }
            if (event.event === "Checkout.Open") {
              phCapture("checkout_opened");
            }
          },
        });
      }
    };
    // LemonJS may already be loaded or may load later
    if (window.LemonSqueezy) {
      setupLS();
    } else {
      window.addEventListener("lemon:ready", setupLS);
      // Fallback: poll briefly in case the ready event already fired
      const t = setTimeout(setupLS, 2000);
      return () => {
        window.removeEventListener("lemon:ready", setupLS);
        clearTimeout(t);
      };
    }
  }, []);

  // Scroll depth tracking (25%, 50%, 75%, 100%)
  useEffect(() => {
    const thresholds = [25, 50, 75, 100];
    const fired = new Set();
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight <= 0) return;
      const pct = Math.round((scrollTop / docHeight) * 100);
      for (const t of thresholds) {
        if (pct >= t && !fired.has(t)) {
          fired.add(t);
          phCapture("page_scrolled", { depth: t });
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Section viewed tracking via IntersectionObserver
  useEffect(() => {
    const sections = {
      features: "Features",
      pricing: "Pricing",
      faq: "FAQ",
      "who-its-for": "Who It's For",
    };
    const fired = new Set();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !fired.has(entry.target.id)) {
            fired.add(entry.target.id);
            phCapture("section_viewed", { section: sections[entry.target.id] });
          }
        }
      },
      { threshold: 0.3 }
    );
    for (const id of Object.keys(sections)) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEsc = (e) => { if (e.key === "Escape") setMobileMenuOpen(false); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [mobileMenuOpen]);

  const navOpacity = Math.min(scrollY / 200, 1);

  const showCheckoutError = (message) => {
    if (checkoutErrorTimeoutRef.current) {
      window.clearTimeout(checkoutErrorTimeoutRef.current);
    }

    setCheckoutError(message);
    checkoutErrorTimeoutRef.current = window.setTimeout(() => {
      setCheckoutError("");
      checkoutErrorTimeoutRef.current = null;
    }, 5000);
  };

  const waitForCheckoutOverlay = () => {
    if (window.LemonSqueezy?.Url?.Open) {
      return Promise.resolve(window.LemonSqueezy);
    }

    if (checkoutReadyPromiseRef.current) {
      return checkoutReadyPromiseRef.current;
    }

    checkoutReadyPromiseRef.current = new Promise((resolve, reject) => {
      let pollId = null;
      let timeoutId = null;

      const cleanup = () => {
        window.removeEventListener("lemon:ready", handleReady);
        if (pollId) window.clearInterval(pollId);
        if (timeoutId) window.clearTimeout(timeoutId);
        checkoutReadyPromiseRef.current = null;
      };

      const finish = (callback) => {
        cleanup();
        callback();
      };

      const tryResolve = () => {
        if (!window.LemonSqueezy?.Url?.Open) return false;
        finish(() => resolve(window.LemonSqueezy));
        return true;
      };

      const handleReady = () => {
        tryResolve();
      };

      window.addEventListener("lemon:ready", handleReady);
      pollId = window.setInterval(() => {
        tryResolve();
      }, 100);
      timeoutId = window.setTimeout(() => {
        finish(() => reject(new Error("Lemon checkout overlay did not become available in time.")));
      }, 4000);

      tryResolve();
    });

    return checkoutReadyPromiseRef.current;
  };

  const openCheckout = async (location) => {
    phCapture("cta_clicked", { location });
    setCheckoutError("");

    try {
      const lemon = await waitForCheckoutOverlay();
      lemon.Url.Open(CHECKOUT_URL);
    } catch (error) {
      console.error("Failed to open Lemon overlay:", error);
      phCapture("checkout_open_failed", { location });
      showCheckoutError("Checkout is still loading. Please try again.");
    }
  };

  return (
    <div style={{ background: COLORS.warmVanilla, minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: COLORS.warmBrown, overflowX: "hidden" }}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); } 70% { box-shadow: 0 0 0 12px rgba(245, 158, 11, 0); } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        @keyframes headlineFade { 0% { opacity: 0; transform: translateY(8px); } 15% { opacity: 1; transform: translateY(0); } 85% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-8px); } }
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
          /* animation removed for accessibility */
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
        .form-input {
          outline: none;
        }
        .form-input:focus-visible {
          outline: 3px solid ${COLORS.deepAmber};
          outline-offset: 1px;
          border-color: ${COLORS.deepAmber};
        }
        .cta-btn:focus-visible {
          outline: 3px solid ${COLORS.warmBrown};
          outline-offset: 2px;
        }
        .ghost-btn:focus-visible {
          outline: 3px solid ${COLORS.deepAmber};
          outline-offset: 2px;
        }
        .feature-card:focus-visible {
          outline: 3px solid ${COLORS.deepAmber};
          outline-offset: 2px;
        }
        button:focus-visible {
          outline: 3px solid ${COLORS.deepAmber};
          outline-offset: 2px;
        }
        a:focus-visible {
          outline: 3px solid ${COLORS.deepAmber};
          outline-offset: 2px;
          border-radius: 4px;
        }
        .nav-link:hover {
          color: ${COLORS.deepAmber} !important;
        }
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .hamburger-btn { display: flex !important; }
          .sticky-note { display: none !important; }
          .floating-chip { display: none !important; }
          .download-toast {
            left: 16px !important;
            right: 16px !important;
            bottom: 16px !important;
            max-width: none !important;
            width: auto !important;
          }
          .hero-section {
            padding-top: 100px !important;
            padding-bottom: 60px !important;
          }
          .cta-btn {
            padding: 14px 24px !important;
            font-size: 15px !important;
          }
          section {
            padding-top: 60px !important;
            padding-bottom: 60px !important;
          }
          .zigzag-row {
            flex-direction: column !important;
          }
        }
        @media (max-width: 480px) {
          .modal-inner {
            padding: 24px !important;
          }
          .pricing-card {
            padding: 24px !important;
          }
          .cta-btn {
            font-size: 14px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
          html { scroll-behavior: auto; }
        }
      `}</style>

      {checkoutError ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: "88px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 120,
            maxWidth: "min(90vw, 420px)",
            background: COLORS.warmBrown,
            color: "#FFFFFF",
            padding: "12px 16px",
            borderRadius: "12px",
            boxShadow: "0 16px 40px rgba(31, 31, 31, 0.18)",
            textAlign: "center",
            fontSize: "14px",
            lineHeight: 1.5,
          }}
        >
          {checkoutError}
        </div>
      ) : null}

      {/* NAV */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: `rgba(255, 254, 248, ${navOpacity * 0.95})`,
        backdropFilter: navOpacity > 0.1 ? "blur(20px)" : "none",
        borderBottom: navOpacity > 0.3 ? `1px solid ${COLORS.beigeBorder}` : "1px solid transparent",
        transition: "all 0.3s ease",
      }}>
        <div className="section" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: "72px" }}>
          <a href="#" aria-label="Focana - Home" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 375 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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
          <div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "24px" }}>
            <a href="#how-it-works" className="nav-link" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500, transition: "color 0.2s ease" }}>How it Works</a>
            <a href="#features" className="nav-link" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500, transition: "color 0.2s ease" }}>Features</a>
            <a href="#faq" className="nav-link" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500, transition: "color 0.2s ease" }}>FAQ</a>
            <button onClick={() => openCheckout("nav")} className="cta-btn" style={{ padding: "10px 24px", fontSize: "14px", animation: "none" }}>Buy Focana</button>
          </div>
          <button
            className="hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            style={{
              display: "none", background: "none", border: "none",
              cursor: "pointer", padding: "8px",
              width: "44px", height: "44px",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={COLORS.warmBrown} strokeWidth="2" strokeLinecap="round">
              {mobileMenuOpen ? (
                <>
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </>
              ) : (
                <>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* MOBILE MENU */}
      {mobileMenuOpen && (
        <div className="mobile-menu" style={{
          position: "fixed", top: "72px", left: 0, right: 0, zIndex: 99,
          background: COLORS.warmVanilla,
          borderBottom: `1px solid ${COLORS.beigeBorder}`,
          padding: "16px 24px",
          display: "flex", flexDirection: "column", gap: "16px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
        }}>
          <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "16px", fontWeight: 500, padding: "8px 0" }}>How it Works</a>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "16px", fontWeight: 500, padding: "8px 0" }}>Features</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)} style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "16px", fontWeight: 500, padding: "8px 0" }}>FAQ</a>
          <button onClick={() => { setMobileMenuOpen(false); openCheckout("mobile_nav"); }} className="cta-btn" style={{ padding: "14px 24px", fontSize: "16px", animation: "none", justifyContent: "center" }}>Buy Focana</button>
        </div>
      )}

      {/* HERO */}
      <section className="hero-section" style={{
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
              You opened your laptop to do one thing.
              <br />
              <span
                key={headlineIndex}
                style={{
                  background: `linear-gradient(135deg, ${COLORS.sunshineYellow}, ${COLORS.deepAmber})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                  display: "inline-block",
                  animation: "headlineFade 2.5s ease both",
                }}
              >{headlines[headlineIndex]}</span>
            </h1>

            <p style={{
              fontSize: "clamp(16px, 1.8vw, 19px)",
              lineHeight: 1.6,
              fontStyle: "italic",
              color: COLORS.warmBrown,
              opacity: 0.7,
              marginTop: "24px",
              marginBottom: "24px",
              animation: "fadeUp 0.6s ease 0.15s both",
            }}>
              Sound familiar?
            </p>
            <p style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "clamp(20px, 2.5vw, 28px)",
              fontWeight: 700,
              lineHeight: 1.4,
              color: COLORS.warmBrown,
              marginBottom: "40px",
              animation: "fadeUp 0.6s ease 0.2s both",
            }}>
              Meet Focana - the desktop focus buddy for busy brains.
            </p>

            <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", animation: "fadeUp 0.6s ease 0.3s both" }}>
              <button onClick={() => openCheckout("hero")} className="cta-btn" style={{ fontSize: "18px", padding: "18px 40px" }}>
                Buy Focana <span style={{ fontSize: "22px" }}>→</span>
              </button>
              <a href="#features" className="ghost-btn" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center" }}>
                See How It Works
              </a>
            </div>

            <p style={{
              marginTop: "16px", fontSize: "14px", color: COLORS.coffeeBrown,
              animation: "fadeUp 0.6s ease 0.35s both",
            }}>
              Try it risk-free for 7 days. If it doesn't stick, we'll refund you — no questions asked.
            </p>
            <p style={{
              marginTop: "8px", fontSize: "14px", color: COLORS.coffeeBrown,
              opacity: 0.7, animation: "fadeUp 0.6s ease 0.4s both",
            }}>
              Windows coming soon -{" "}
              <button
                onClick={() => setWaitlistOpen(true)}
                style={{
                  background: "none", border: "none", padding: 0,
                  color: COLORS.deepAmber, fontSize: "inherit", fontFamily: "inherit",
                  cursor: "pointer", textDecoration: "underline",
                }}
              >join the waitlist</button>
            </p>

          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "60px 0 100px 0", background: "white" }}>
        <div className="section">
          <p style={{
            fontSize: "13px", fontWeight: 700, color: COLORS.deepAmber,
            textAlign: "center", marginBottom: "12px",
            textTransform: "uppercase", letterSpacing: "2px",
          }}>Key Features</p>
          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800, color: COLORS.warmBrown, lineHeight: 1.15,
            textAlign: "center", marginBottom: "80px",
          }}>Everything you need. Nothing you don't.</h2>

          {[
            {
              video: "/videos/always-on-top.mp4",
              headline: "Out of sight, out of mind.",
              body: <><strong>Always on top.</strong> We've all been there...working on a task, then one new tab, a Slack ping, a quick email reply — and just like that, you're in a ChatGPT rabbit hole thinking "what was I even doing?"<br /><br />Focana floats above every app, every tab, every window. Your task and timer stay visible no matter where your work takes you. If you can see it, you can do it.</>,
            },
            {
              video: "/videos/nudge-checkin.mp4",
              headline: "You got distracted 10 minutes ago and didn't even notice.",
              body: <><strong>Your attention buddy.</strong> Focana gently nudges you throughout your session — not to nag, just to keep you aware. And every so often, a simple check-in asks 'Still focused?' No guilt. No judgment. Just a quiet tap on the shoulder when you need it most.</>,
            },
            {
              video: "/videos/parking-lot.mp4",
              headline: "Every random thought feels urgent and you have to deal with it right now or you'll forget.",
              body: <><strong>Parking lot.</strong> Catch every stray thought mid-session without breaking your flow. Jot it down, close the panel, keep working. Everything's waiting for you when you're done — nothing lost, nothing derailed.</>,
            },
            {
              video: "/videos/pick-up-where-you-left-off.mp4",
              headline: "You finally made progress but tomorrow you'll open your laptop and have no idea where you left off.",
              body: <><strong>Pickup where you left off.</strong> When your session ends, leave a quick note for future you. Where you stopped, what's next, what to pick up first. Your session history keeps every breadcrumb so you never lose momentum between work sessions.</>,
            },
            {
              video: "/videos/get-started.mp4",
              headline: "It takes just a few seconds to get started.",
              body: <><strong>Simple to get started.</strong> Type one task. Pick your timer — or don't. Hit start. Focana shrinks to a small floating window and stays with you while you work. No account. No tutorial. No learning curve.</>,
            },
          ].map((row, i) => {
            const isOdd = i % 2 === 0; // 0-indexed: rows 0,2,4 = video left; rows 1,3 = video right
            const videoEl = (
              <div key="video" style={{ flex: "1 1 50%", minWidth: 0 }}>
                <FeatureVideo src={row.video} />
              </div>
            );
            const copyEl = (
              <div key="copy" style={{
                flex: "1 1 50%", minWidth: 0,
                display: "flex", alignItems: "center",
              }}>
                <p style={{
                  fontSize: "clamp(16px, 2vw, 19px)", lineHeight: 1.7,
                  color: COLORS.coffeeBrown,
                }}>
                  {row.body}
                </p>
              </div>
            );
            return (
              <div key={i} style={{ marginBottom: i < 4 ? "80px" : 0 }}>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "clamp(22px, 3vw, 30px)",
                  fontWeight: 700,
                  color: COLORS.warmBrown,
                  lineHeight: 1.3,
                  marginBottom: "32px",
                }}>
                  {row.headline}
                </h3>
                <div className="zigzag-row" style={{
                  display: "flex",
                  gap: "40px",
                  flexDirection: isOdd ? "row" : "row-reverse",
                }}>
                  {videoEl}
                  {copyEl}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* WHO IT'S FOR */}
      <section id="who-its-for" style={{ padding: "100px 0", background: COLORS.softCream }}>
        <div className="section">
          <div style={{ textAlign: "center", maxWidth: "700px", margin: "0 auto", marginBottom: "60px" }}>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 44px)",
              fontWeight: 800, color: COLORS.warmBrown, lineHeight: 1.15,
            }}>
              Built for You
            </h2>
            <p style={{ fontSize: "20px", lineHeight: 1.7, color: COLORS.deepAmber, fontWeight: 500, marginTop: "12px" }}>
              If any of these sound like you, you're in the right place.
            </p>
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "28px 24px",
            maxWidth: "960px",
            margin: "0 auto",
          }}>
            {[
              { text: "People say 'just focus' like that's not the thing you're trying to do every single day.", rotate: "-2deg", color: "#FFF9E6" },
              { text: "You've tried Notion, Todoist, Forest, a paper planner. Each one worked for exactly three days.", rotate: "1.5deg", color: "#E8F5E9" },
              { text: "You can spend three hours going down a rabbit hole you never planned to enter. But give five minutes to the thing that actually matters? Impossible.", rotate: "-1deg", color: "#FFF3E0" },
              { text: "Every random thought feels like an emergency. You chase it, lose your place, and can't get back.", rotate: "2deg", color: "#FFF9E6" },
              { text: "You got distracted. Again. Then got mad at yourself for getting distracted. Again. Now there are two problems and you still haven't finished.", rotate: "-1.5deg", color: "#E8F5E9" },
              { text: "Other people seem to just... sit down and work. For you, getting started is its own full-time job. And nobody sees that part.", rotate: "1deg", color: "#FFF3E0" },
            ].map((item, i) => (
              <div key={i} style={{
                background: item.color,
                borderRadius: "4px",
                padding: "24px 22px",
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
                transform: `rotate(${item.rotate})`,
                boxShadow: "2px 3px 12px rgba(0,0,0,0.1), 1px 1px 3px rgba(0,0,0,0.06)",
                border: "none",
                minHeight: "140px",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "rotate(0deg) scale(1.03)"}
              onMouseLeave={e => e.currentTarget.style.transform = `rotate(${item.rotate})`}
              >
                <span style={{
                  flexShrink: 0,
                  width: "28px", height: "28px",
                  borderRadius: "50%",
                  background: "#4CAF50",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  marginTop: "2px",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <p style={{ fontSize: "15px", lineHeight: 1.55, color: COLORS.warmBrown, fontWeight: 500, margin: 0 }}>
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ padding: "100px 0", background: "white" }}>
        <div className="section" style={{ maxWidth: "720px" }}>
          <div style={{ textAlign: "center", marginBottom: "48px" }}>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 800, color: COLORS.warmBrown, lineHeight: 1.15, marginBottom: "20px",
            }}>
              One payment. Lifetime access.
            </h2>
            <p style={{ fontSize: "19px", lineHeight: 1.7, color: COLORS.coffeeBrown }}>
              Buy Focana once, download it instantly,<br />
              and keep every update we ship next.
            </p>
          </div>

          <div className="pricing-card" style={{
            background: `linear-gradient(135deg, ${COLORS.softCream}, ${COLORS.creamYellow}44)`,
            border: `2px solid ${COLORS.sunshineYellow}`,
            borderRadius: "20px",
            padding: "40px",
            textAlign: "center",
            marginBottom: "32px",
          }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 700,
              color: COLORS.deepAmber, textTransform: "uppercase", letterSpacing: "2px",
            }}>Lifetime Access</span>
            <div style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(40px, 5vw, 56px)",
              fontWeight: 800, color: COLORS.warmBrown, margin: "12px 0",
            }}>
              $29 <span style={{ fontSize: "20px", fontWeight: 500, color: COLORS.coffeeBrown }}>lifetime</span>
            </div>
            <p style={{ fontSize: "17px", lineHeight: 1.7, color: COLORS.coffeeBrown, marginBottom: "24px" }}>
              Full access. No subscription. No renewals.<br />
              Every feature, now and everything we ship next.
            </p>
            <p style={{ fontSize: "15px", color: COLORS.coffeeBrown, marginBottom: "28px", opacity: 0.8 }}>
              7-day money-back guarantee.<br />
              If it doesn't stick, we'll refund you.
            </p>
            <button onClick={() => openCheckout("pricing")} className="cta-btn" style={{ fontSize: "18px", padding: "18px 40px" }}>
              Buy Focana
            </button>
            <p style={{ fontSize: "13px", color: COLORS.coffeeBrown, marginTop: "16px", opacity: 0.7 }}>
              One-time payment. macOS. Instant download.<br />
              No subscription. Ever.
            </p>
          </div>

          <div style={{
            background: COLORS.warmVanilla, borderRadius: "16px", padding: "28px 32px",
            border: `1px solid ${COLORS.beigeBorder}`,
          }}>
            <h3 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 700,
              color: COLORS.warmBrown, marginBottom: "12px",
            }}>
              Why lifetime access?
            </h3>
            <p style={{ fontSize: "16px", lineHeight: 1.7, color: COLORS.coffeeBrown }}>
              We want pricing to feel as calm as the product: simple, upfront, and easy to trust.
              Buy it once, keep it, and get the updates we ship as Focana grows.
              No subscription math. No renewal anxiety. Just a tool that stays with you.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "100px 0", background: COLORS.softCream }}>
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
            question="How is this different from a browser extension?"
            answer="Browser extensions live in your browser. Switch to Slack or your code editor and they're gone. Focana is a native Mac app — it uses OS-level permissions to float above every application on your screen. It can't disappear. That's the difference."
          />
          <FAQItem
            question="I have ADHD and I've tried dozens of productivity apps. Why would this one stick?"
            answer="Because Focana does exactly one thing and does it in under 10 seconds. No account. No onboarding flow. No settings. Type your task, start the timer, and it's floating on your screen. The reason other apps don't stick is because they ask too much of you before you've gotten any value. Focana doesn't."
          />
          <FAQItem
            question='What does "always on top" actually mean?'
            answer="It means Focana uses a macOS system-level feature to stay above every other window on your screen. Open Chrome, Slack, VS Code, Zoom — Focana stays visible. You can't accidentally bury it."
          />
          <FAQItem
            question="Does Focana help with ADHD time blindness?"
            answer="Yes. The always-visible timer gives you a constant anchor for how long you've been working. Focus check-ins nudge you before you lose track of time completely. It's not a cure — it's a guardrail."
          />
          <FAQItem
            question="Do I need to have ADHD to use it?"
            answer="No. Focana was built from ADHD experience but the problem it solves happens to anyone who works across multiple apps. If you've ever switched tabs and forgotten why, it's for you."
          />
          <FAQItem
            question="Is Windows coming?"
            answer="macOS is live now. Windows is in development — drop your email and you'll be the first to know when it's ready."
          />
          <FAQItem
            question="What does it cost?"
            answer="$29 one-time. That's lifetime access — no subscription, no renewals. You also get a 7-day money-back guarantee: if it doesn't stick, we'll refund you, no questions asked."
          />
          <FAQItem
            question="Will the $29 price go up?"
            answer="Pricing may change later. If you buy at $29, that purchase stays lifetime access with no subscription or renewals."
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
          width: "min(600px, 150vw)", height: "600px", borderRadius: "50%",
          background: `radial-gradient(circle, ${COLORS.sunshineYellow}15 0%, transparent 70%)`,
          pointerEvents: "none",
        }} />

        <div className="section" style={{ position: "relative", zIndex: 2, textAlign: "center", maxWidth: "640px" }}>
          <p style={{ fontSize: "19px", lineHeight: 1.7, color: "#FEF3C7", marginBottom: "32px" }}>
            Takes 10 seconds to start your first session.<br />
            $29 once. Yours forever. 7-day guarantee.
          </p>

          <button onClick={() => openCheckout("final_cta")} className="cta-btn" style={{ fontSize: "18px", padding: "18px 40px" }}>
            Buy Focana <span style={{ fontSize: "22px" }}>→</span>
          </button>

          <p style={{ fontSize: "16px", fontStyle: "italic", color: "#FEF3C7", marginTop: "32px" }}>
            Focana — the desktop focus buddy for busy brains.
          </p>
          <p style={{ fontSize: "14px", color: "#FEF3C7", marginTop: "12px", opacity: 0.8 }}>
            Windows coming soon —{" "}
            <button
              onClick={() => setWaitlistOpen(true)}
              style={{
                background: "none", border: "none", padding: 0,
                color: COLORS.goldenGlow, fontSize: "inherit", fontFamily: "inherit",
                cursor: "pointer", textDecoration: "underline",
              }}
            >join the waitlist</button>
          </p>
        </div>
      </section>

      <WaitlistModal open={waitlistOpen} onClose={() => setWaitlistOpen(false)} />
      <WaitlistSignupModal open={signupModalOpen} onClose={() => setSignupModalOpen(false)} location={signupLocation} />

      {/* FOOTER */}
      <footer style={{ padding: "48px 0", background: COLORS.softBlack, borderTop: `1px solid ${COLORS.warmBrown}22` }}>
        <div className="section" style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: "20px",
        }}>
          <a href="#" aria-label="Focana - Home" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="150" height="40" viewBox="0 0 375 150" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
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
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
            <a href="mailto:hello@focana.app" style={{ fontSize: "13px", color: COLORS.warmGray, textDecoration: "none", transition: "color 0.2s ease" }}>Contact</a>
            <a href="/privacy" style={{ fontSize: "13px", color: COLORS.warmGray, textDecoration: "none", transition: "color 0.2s ease" }}>Privacy Policy</a>
            <p style={{ fontSize: "13px", color: COLORS.warmGray }}>
              &copy; 2026 Focana.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
