import { useEffect, useId, useRef, useState } from "react";
import {
  EMAIL_CAPTURE_EMAIL_KEY,
  EMAIL_CAPTURE_SUBMITTED_KEY,
  EXIT_INTENT_DISABLED_KEY,
  EXIT_INTENT_SESSION_KEY,
  isValidEmail,
  normalizeEmail,
} from "../lib/emailCapture";
import { siteFounder } from "../data/site";

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

const founderProfiles = [
  { label: "About Justin", href: siteFounder.aboutHref },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/justinfranklin90" },
  { label: "Substack", href: "https://adhdfounder.substack.com" },
  { label: "X", href: "https://x.com/eyeamswift" },
];

function phCapture(event, props) {
  if (typeof window !== "undefined" && window.posthog) {
    window.posthog.capture(event, props);
  }
}

async function postEmailCapture({ email, source, keepalive = false }) {
  const response = await fetch("/api/email-capture", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, source }),
    keepalive,
  });

  if (!response.ok) {
    throw new Error("Something went wrong. Please try again.");
  }

  return response.json().catch(() => ({ ok: true }));
}

function getStoredSubmittedEmail() {
  if (typeof window === "undefined") return "";

  try {
    return window.localStorage.getItem(EMAIL_CAPTURE_EMAIL_KEY) || "";
  } catch {
    return "";
  }
}

function hasStoredSubmittedEmail() {
  if (typeof window === "undefined") return false;

  try {
    return Boolean(window.localStorage.getItem(EMAIL_CAPTURE_SUBMITTED_KEY));
  } catch {
    return false;
  }
}

function persistSubmittedEmailLocally(email) {
  if (typeof window === "undefined") return;

  const normalizedEmail = normalizeEmail(email);

  try {
    window.localStorage.setItem(EMAIL_CAPTURE_SUBMITTED_KEY, String(Date.now()));
    window.localStorage.setItem(EMAIL_CAPTURE_EMAIL_KEY, normalizedEmail);
  } catch {}
}

function buildCheckoutUrl(email) {
  const url = new URL(CHECKOUT_URL, window.location.origin);
  url.searchParams.delete("embed");
  url.searchParams.set("checkout[email]", normalizeEmail(email));
  return url.toString();
}

function isDesktopExitIntentCandidate() {
  if (typeof window === "undefined") return false;
  if (window.location.pathname !== "/") return false;
  if (window.innerWidth < 768) return false;

  return window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;
}

// Video component supporting an interactive hero mode and ambient in-view playback.
function FeatureVideo({ src, poster, ariaLabel, preload = "metadata", behavior = "ambient", scrollOnPlay = false }) {
  const wrapperRef = useRef(null);
  const videoRef = useRef(null);
  const [state, setState] = useState("idle"); // "idle" | "playing"
  const [hovered, setHovered] = useState(false);
  const isAmbient = behavior === "ambient";

  useEffect(() => {
    if (isAmbient) return;

    const video = videoRef.current;
    if (!video) return;
    const onEnded = () => {
      video.pause();
      video.load();
      setHovered(false);
      setState("idle");
    };
    video.addEventListener("ended", onEnded);
    return () => video.removeEventListener("ended", onEnded);
  }, [isAmbient]);

  useEffect(() => {
    if (!isAmbient) return;

    const video = videoRef.current;
    if (!video) return;

    const playVideo = () => {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          playVideo();
        } else {
          video.pause();
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(video);

    return () => {
      observer.disconnect();
      video.pause();
    };
  }, [isAmbient]);

  const handleClick = () => {
    if (isAmbient) return;

    const video = videoRef.current;
    if (!video) return;
    if (state === "playing") {
      video.pause();
      setState("idle");
    } else {
      if (scrollOnPlay && wrapperRef.current) {
        const prefersReducedMotion = typeof window !== "undefined"
          && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

        requestAnimationFrame(() => {
          wrapperRef.current?.scrollIntoView({
            behavior: prefersReducedMotion ? "auto" : "smooth",
            block: "center",
            inline: "nearest",
          });
        });
      }

      video.play();
      setState("playing");
    }
  };

  const isActive = state === "playing";

  return (
    <div
      ref={wrapperRef}
      onClick={isAmbient ? undefined : handleClick}
      onMouseEnter={isAmbient ? undefined : () => setHovered(true)}
      onMouseLeave={isAmbient ? undefined : () => setHovered(false)}
      style={{
        position: "relative",
        cursor: isAmbient ? "default" : "pointer",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 4px 20px rgba(92, 64, 51, 0.1)",
      }}
    >
      <video
        ref={videoRef}
        muted
        playsInline
        loop={isAmbient}
        poster={poster}
        aria-label={ariaLabel}
        preload={preload}
        src={src}
        disablePictureInPicture
        style={{
          width: "100%",
          display: "block",
          opacity: isAmbient ? 1 : isActive ? 1 : hovered ? 0.8 : 0.65,
          transition: isAmbient ? "none" : "opacity 0.25s ease",
        }}
      />
      {!isAmbient && !isActive && (
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
            {/* Play triangle */}
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ marginLeft: 3 }}>
              <path d="M8 5v14l11-7z" fill={COLORS.warmBrown} />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}

function FAQItem({ question, answer }) {
  const [open, setOpen] = useState(false);
  const id = useId();
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

function EmailCaptureForm({
  defaultEmail = "",
  source,
  trackingLocation = source,
  submitLabel = "Keep me posted",
  loadingLabel = "Saving...",
  successTitle = "You're on the list.",
  successBody = "Check your inbox.",
  onSubmitted,
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setEmail((currentEmail) => currentEmail || defaultEmail);
  }, [defaultEmail]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setStatus("error");
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      await postEmailCapture({ email: normalizedEmail, source });
      onSubmitted?.(normalizedEmail);
      setStatus("success");
      phCapture("newsletter_cta_submitted", { location: trackingLocation, source });
    } catch (error) {
      setStatus("error");
      setErrorMsg(error?.message || "Something went wrong. Please try again.");
    }
  };

  if (status === "success") {
    return (
      <div
        style={{
          background: "rgba(255,255,255,0.72)",
          borderRadius: "18px",
          border: `1px solid ${COLORS.beigeBorder}`,
          padding: "24px",
        }}
      >
        <p
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "22px",
            fontWeight: 700,
            color: COLORS.warmBrown,
            marginBottom: "8px",
          }}
        >
          {successTitle}
        </p>
        <p style={{ fontSize: "15px", lineHeight: 1.6, color: COLORS.coffeeBrown }}>
          {successBody}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: "rgba(255,255,255,0.72)",
        borderRadius: "18px",
        border: `1px solid ${COLORS.beigeBorder}`,
        padding: "24px",
      }}
    >
      <input
        type="email"
        placeholder="your@email.com"
        required
        value={email}
        onChange={(event) => {
          setEmail(event.target.value);
          if (status === "error") {
            setStatus("idle");
            setErrorMsg("");
          }
        }}
        className="form-input"
        style={{
          width: "100%",
          padding: "14px 16px",
          fontSize: "16px",
          border: `1.5px solid ${COLORS.beigeBorder}`,
          borderRadius: "10px",
          fontFamily: "'DM Sans', sans-serif",
          color: COLORS.warmBrown,
          marginBottom: "14px",
        }}
      />

      {errorMsg ? (
        <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "12px" }}>
          {errorMsg}
        </p>
      ) : null}

      <button
        type="submit"
        className="cta-btn"
        disabled={status === "loading"}
        style={{ width: "100%", justifyContent: "center" }}
      >
        {status === "loading" ? loadingLabel : submitLabel}
      </button>
    </form>
  );
}

function SaasHubBadge({ location = "pricing" }) {
  return (
    <a
      href="https://www.saashub.com/focana-app?utm_source=badge&utm_campaign=badge&utm_content=focana-app&badge_variant=neutral&badge_kind=approved"
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => phCapture("external_badge_clicked", { source: "saashub", location })}
      aria-label="View Focana on SaaSHub"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "16px",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
      }}
    >
      <img
        src="https://cdn-b.saashub.com/img/badges/approved-neutral.png?v=1"
        alt="Approved on SaaSHub"
        loading="lazy"
        decoding="async"
        style={{
          width: "150px",
          maxWidth: "100%",
          height: "auto",
          display: "block",
        }}
      />
    </a>
  );
}

function EmailCaptureModal({
  open,
  onClose,
  onSubmit,
  titleId,
  title,
  description,
  placeholder = "your@email.com",
  submitLabel,
  loadingLabel = "Saving...",
  footerNote,
  dismissLabel,
  defaultEmail = "",
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [status, setStatus] = useState("idle");
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

    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setEmail(defaultEmail || "");
      setStatus("idle");
      setErrorMsg("");
      return;
    }

    setEmail(defaultEmail || "");
    setStatus("idle");
    setErrorMsg("");

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (status !== "loading") onClose("escape");
      }

      if (event.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll(
          'button, input, [href], [tabindex]:not([tabindex="-1"])'
        );

        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [defaultEmail, onClose, open, status]);

  const requestClose = (reason) => {
    if (status === "loading") return;
    onClose(reason);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedEmail = normalizeEmail(email);

    if (!isValidEmail(normalizedEmail)) {
      setStatus("error");
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      await onSubmit(normalizedEmail);
    } catch (error) {
      setStatus("error");
      setErrorMsg(error?.message || "Something went wrong. Please try again.");
    }
  };

  if (!open) return null;

  return (
    <div
      onClick={() => requestClose("backdrop")}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        ref={modalRef}
        className="modal-inner"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "relative",
          background: "white",
          borderRadius: "20px",
          padding: "40px",
          maxWidth: "460px",
          width: "100%",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        <button
          type="button"
          aria-label="Close modal"
          onClick={() => requestClose("x")}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            width: "40px",
            height: "40px",
            borderRadius: "999px",
            border: `1px solid ${COLORS.beigeBorder}`,
            background: COLORS.warmVanilla,
            color: COLORS.warmBrown,
            cursor: "pointer",
            fontSize: "20px",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <h3
          id={titleId}
          style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "26px",
            fontWeight: 700,
            color: COLORS.warmBrown,
            marginBottom: description ? "10px" : "24px",
            paddingRight: "40px",
          }}
        >
          {title}
        </h3>

        {description ? (
          <p
            style={{
              fontSize: "15px",
              color: COLORS.coffeeBrown,
              marginBottom: "24px",
              lineHeight: 1.6,
            }}
          >
            {description}
          </p>
        ) : null}

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder={placeholder}
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="form-input"
            style={{
              width: "100%",
              padding: "14px 16px",
              fontSize: "16px",
              border: `1.5px solid ${COLORS.beigeBorder}`,
              borderRadius: "10px",
              fontFamily: "'DM Sans', sans-serif",
              color: COLORS.warmBrown,
              marginBottom: "16px",
            }}
          />

          {errorMsg ? (
            <p style={{ color: "#DC2626", fontSize: "14px", marginBottom: "12px" }}>
              {errorMsg}
            </p>
          ) : null}

          <button
            type="submit"
            className="cta-btn"
            disabled={status === "loading"}
            style={{ width: "100%", justifyContent: "center", padding: "14px", fontSize: "16px" }}
          >
            {status === "loading" ? loadingLabel : submitLabel}
          </button>
        </form>

        {footerNote ? (
          <p
            style={{
              marginTop: "14px",
              fontSize: "14px",
              lineHeight: 1.5,
              color: COLORS.coffeeBrown,
              textAlign: "center",
            }}
          >
            {footerNote}
          </p>
        ) : null}

        {dismissLabel ? (
          <button
            type="button"
            onClick={() => requestClose("dismiss-link")}
            style={{
              display: "block",
              margin: "16px auto 0",
              background: "none",
              border: "none",
              color: COLORS.coffeeBrown,
              fontSize: "14px",
              cursor: "pointer",
              padding: "4px",
              textDecoration: "underline",
            }}
          >
            {dismissLabel}
          </button>
        ) : null}
      </div>
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

const CHECKOUT_URL = import.meta.env.PUBLIC_LEMONSQUEEZY_CHECKOUT_URL || "https://focana.lemonsqueezy.com/checkout/buy/891e9985-1a19-4426-a99e-51544249139d";

export default function FocanaLanding() {
  const [scrollY, setScrollY] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  const [mobileProductMenuOpen, setMobileProductMenuOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [exitIntentOpen, setExitIntentOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutRedirecting, setCheckoutRedirecting] = useState(false);
  const [checkoutLocation, setCheckoutLocation] = useState("hero");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [hasSubmittedEmail, setHasSubmittedEmail] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const productMenuRef = useRef(null);
  const toastTimeoutRef = useRef(null);
  const exitIntentSubmittedRef = useRef(false);
  const checkoutSubmittedRef = useRef(false);
  const exitIntentMouseRef = useRef({ y: null, time: 0, velocity: 0 });
  const newsletterShownRef = useRef(false);

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

  useEffect(() => {
    const storedEmail = getStoredSubmittedEmail();
    setSubmittedEmail(storedEmail);
    setHasSubmittedEmail(hasStoredSubmittedEmail());
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handlePageShow = () => {
      setCheckoutRedirecting(false);
    };

    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
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
      "newsletter-cta": "Newsletter",
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

  useEffect(() => {
    const section = document.getElementById("newsletter-cta");
    if (!section || newsletterShownRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !newsletterShownRef.current) {
            newsletterShownRef.current = true;
            phCapture("newsletter_cta_shown");
            observer.disconnect();
          }
        }
      },
      { threshold: 0.35 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEsc = (e) => { if (e.key === "Escape") setMobileMenuOpen(false); };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMobileProductMenuOpen(false);
    }
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!productMenuOpen) return;

    const handlePointerDown = (event) => {
      if (productMenuRef.current && !productMenuRef.current.contains(event.target)) {
        setProductMenuOpen(false);
      }
    };

    const handleEsc = (event) => {
      if (event.key === "Escape") {
        setProductMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEsc);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [productMenuOpen]);

  useEffect(() => {
    if (!isDesktopExitIntentCandidate()) return;
    if (hasSubmittedEmail || exitIntentOpen || checkoutModalOpen) return;

    try {
      if (
        window.sessionStorage.getItem(EXIT_INTENT_SESSION_KEY) ||
        window.sessionStorage.getItem(EXIT_INTENT_DISABLED_KEY)
      ) {
        return;
      }
    } catch {}

    const handleMouseMove = (event) => {
      const now = Date.now();
      const previous = exitIntentMouseRef.current;

      if (typeof previous.y === "number") {
        const deltaY = event.clientY - previous.y;
        const deltaTime = Math.max(now - previous.time, 1);
        exitIntentMouseRef.current.velocity = deltaY / deltaTime;
      }

      exitIntentMouseRef.current.y = event.clientY;
      exitIntentMouseRef.current.time = now;
    };

    const handleMouseOut = (event) => {
      if (event.relatedTarget || event.toElement) return;
      if (hasStoredSubmittedEmail()) return;

      try {
        if (
          window.sessionStorage.getItem(EXIT_INTENT_SESSION_KEY) ||
          window.sessionStorage.getItem(EXIT_INTENT_DISABLED_KEY)
        ) {
          return;
        }
      } catch {}

      const snapshot = exitIntentMouseRef.current;
      const movedUpFast =
        typeof snapshot.y === "number" &&
        snapshot.y <= 72 &&
        snapshot.velocity < -0.25;

      if (event.clientY > 0 || !movedUpFast) return;

      try {
        window.sessionStorage.setItem(EXIT_INTENT_SESSION_KEY, String(Date.now()));
      } catch {}

      exitIntentSubmittedRef.current = false;
      setExitIntentOpen(true);
      phCapture("exit_intent_shown");
    };

    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("mouseout", handleMouseOut);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseout", handleMouseOut);
    };
  }, [checkoutModalOpen, exitIntentOpen, hasSubmittedEmail]);

  const navOpacity = Math.min(scrollY / 200, 1);

  const showToast = (message) => {
    if (toastTimeoutRef.current) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToastMessage(message);
    toastTimeoutRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimeoutRef.current = null;
    }, 5000);
  };

  const rememberSubmittedEmail = (email) => {
    persistSubmittedEmailLocally(email);
    const normalizedEmail = normalizeEmail(email);
    setSubmittedEmail(normalizedEmail);
    setHasSubmittedEmail(true);
  };

  const handleExitIntentClose = (reason) => {
    setExitIntentOpen(false);

    if (!exitIntentSubmittedRef.current) {
      phCapture("exit_intent_dismissed", { reason });
    }

    exitIntentSubmittedRef.current = false;
  };

  const handleCheckoutModalClose = (reason) => {
    setCheckoutModalOpen(false);

    if (!checkoutSubmittedRef.current) {
      phCapture("cta_modal_dismissed", { location: checkoutLocation, reason });
    }

    checkoutSubmittedRef.current = false;
  };

  const handleExitIntentSubmit = async (email) => {
    await postEmailCapture({ email, source: "exit-intent" });
    exitIntentSubmittedRef.current = true;
    rememberSubmittedEmail(email);
    phCapture("exit_intent_submitted");
    setExitIntentOpen(false);
    showToast("You're on the list. Check your inbox.");
  };

  const handleCheckoutSubmit = async (email) => {
    checkoutSubmittedRef.current = true;
    rememberSubmittedEmail(email);
    phCapture("cta_modal_submitted", { location: checkoutLocation });
    setCheckoutModalOpen(false);
    setCheckoutRedirecting(true);

    void postEmailCapture({
      email,
      source: "checkout-started",
      keepalive: true,
    }).catch((error) => {
      console.error("Checkout email capture failed:", error);
    });

    const redirectUrl = buildCheckoutUrl(email);

    await new Promise((resolve) => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 180);
      });
    });

    window.location.assign(redirectUrl);
  };

  const openCheckout = (location) => {
    phCapture("cta_clicked", { location });
    checkoutSubmittedRef.current = false;
    setCheckoutLocation(location);
    setCheckoutModalOpen(true);
    try {
      window.sessionStorage.setItem(EXIT_INTENT_DISABLED_KEY, String(Date.now()));
    } catch {}
    phCapture("cta_modal_shown", {
      location,
      prefilled_email: Boolean(submittedEmail),
    });
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
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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
        .newsletter-layout {
          display: flex;
          gap: 28px;
          align-items: center;
          flex-wrap: wrap;
        }
        .newsletter-copy {
          flex: 1 1 320px;
        }
        .newsletter-form-wrap {
          flex: 0 1 380px;
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
        .product-trigger:hover {
          color: ${COLORS.deepAmber} !important;
        }
        .product-menu-item:hover {
          background: ${COLORS.softCream};
          color: ${COLORS.deepAmber} !important;
        }
        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .hamburger-btn { display: flex !important; }
          .sticky-note { display: none !important; }
          .floating-chip { display: none !important; }
          .capture-toast {
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
          .hero-split {
            flex-direction: column !important;
          }
          .newsletter-layout {
            flex-direction: column !important;
            align-items: stretch !important;
          }
          .newsletter-form-wrap {
            width: 100% !important;
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

      {toastMessage ? (
        <div
          className="capture-toast"
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
          {toastMessage}
        </div>
      ) : null}

      {checkoutRedirecting ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 140,
            background: "rgba(31, 31, 31, 0.38)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "rgba(255, 254, 248, 0.98)",
              border: `1px solid ${COLORS.beigeBorder}`,
              borderRadius: "24px",
              padding: "28px",
              boxShadow: "0 20px 60px rgba(31, 31, 31, 0.18)",
              textAlign: "center",
            }}
          >
            <div
              aria-hidden="true"
              style={{
                width: "42px",
                height: "42px",
                margin: "0 auto 18px",
                borderRadius: "999px",
                border: `3px solid ${COLORS.beigeBorder}`,
                borderTopColor: COLORS.deepAmber,
                animation: "spin 0.9s linear infinite",
              }}
            />
            <p
              style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "24px",
                fontWeight: 700,
                color: COLORS.warmBrown,
                marginBottom: "10px",
              }}
            >
              Almost there...
            </p>
            <p style={{ fontSize: "15px", lineHeight: 1.6, color: COLORS.coffeeBrown }}>
              Taking you to Lemon Squeezy now.
            </p>
          </div>
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
            <div
              ref={productMenuRef}
              style={{ position: "relative", paddingBottom: "14px", marginBottom: "-14px" }}
              onMouseEnter={() => setProductMenuOpen(true)}
              onMouseLeave={() => setProductMenuOpen(false)}
            >
              <button
                type="button"
                className="product-trigger"
                aria-expanded={productMenuOpen}
                aria-haspopup="true"
                onClick={() => setProductMenuOpen((open) => !open)}
                style={{
                  background: "none",
                  border: "none",
                  color: COLORS.coffeeBrown,
                  fontSize: "15px",
                  fontWeight: 500,
                  transition: "color 0.2s ease",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Product
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  aria-hidden="true"
                  style={{
                    transform: productMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                >
                  <path d="M2.25 4.5 6 8.25 9.75 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>

              {productMenuOpen && (
                <div
                  aria-label="Product links"
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: "-12px",
                    minWidth: "220px",
                    padding: "10px",
                    borderRadius: "18px",
                    border: `1px solid ${COLORS.beigeBorder}`,
                    background: "rgba(255, 254, 248, 0.98)",
                    backdropFilter: "blur(18px)",
                    boxShadow: "0 22px 48px rgba(92, 64, 51, 0.16)",
                  }}
                >
                  <button
                    type="button"
                    className="product-menu-item"
                    onClick={() => {
                      setProductMenuOpen(false);
                      openCheckout("nav_product_dropdown");
                    }}
                    style={{
                      display: "block",
                      width: "100%",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      color: COLORS.warmBrown,
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      transition: "background 0.2s ease, color 0.2s ease",
                      textAlign: "left",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Download Focana
                  </button>
                  <a
                    href="/updates"
                    className="product-menu-item"
                    onClick={() => setProductMenuOpen(false)}
                    style={{
                      display: "block",
                      padding: "12px 14px",
                      borderRadius: "12px",
                      color: COLORS.warmBrown,
                      textDecoration: "none",
                      fontSize: "14px",
                      fontWeight: 600,
                      transition: "background 0.2s ease, color 0.2s ease",
                    }}
                  >
                    Updates
                  </a>
                </div>
              )}
            </div>
            <a href="#features" className="nav-link" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500, transition: "color 0.2s ease" }}>How it Works</a>
            <a href="#pricing" className="nav-link" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500, transition: "color 0.2s ease" }}>Pricing</a>
            <a href="/blog/" className="nav-link" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500, transition: "color 0.2s ease" }}>Resources</a>
            <a href="#faq" className="nav-link" style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500, transition: "color 0.2s ease" }}>FAQ</a>
            <button onClick={() => openCheckout("nav")} className="cta-btn" style={{ padding: "10px 24px", fontSize: "14px", animation: "none" }}>Get Focana</button>
          </div>
          <button
            className="hamburger-btn"
            onClick={() => {
              setProductMenuOpen(false);
              setMobileMenuOpen(!mobileMenuOpen);
            }}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <button
              type="button"
              onClick={() => setMobileProductMenuOpen((open) => !open)}
              aria-expanded={mobileProductMenuOpen}
              style={{
                background: "none",
                border: "none",
                color: COLORS.coffeeBrown,
                fontSize: "16px",
                fontWeight: 500,
                padding: "8px 0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span>Product</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
                style={{
                  transform: mobileProductMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.2s ease",
                }}
              >
                <path d="M2.25 4.5 6 8.25 9.75 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {mobileProductMenuOpen && (
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                marginLeft: "2px",
                paddingLeft: "14px",
                borderLeft: `2px solid ${COLORS.beigeBorder}`,
              }}>
                <button
                  type="button"
                  onClick={() => {
                    setMobileProductMenuOpen(false);
                    setMobileMenuOpen(false);
                    openCheckout("mobile_product_dropdown");
                  }}
                  style={{
                    color: COLORS.coffeeBrown,
                    textDecoration: "none",
                    fontSize: "15px",
                    fontWeight: 500,
                    padding: "2px 0",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    fontFamily: "inherit",
                  }}
                >
                  Download Focana
                </button>
                <a
                  href="/updates"
                  onClick={() => {
                    setMobileProductMenuOpen(false);
                    setMobileMenuOpen(false);
                  }}
                  style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "15px", fontWeight: 500, padding: "2px 0" }}
                >
                  Updates
                </a>
              </div>
            )}
          </div>
          <a href="#features" onClick={() => setMobileMenuOpen(false)} style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "16px", fontWeight: 500, padding: "8px 0" }}>How it Works</a>
          <a href="#pricing" onClick={() => setMobileMenuOpen(false)} style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "16px", fontWeight: 500, padding: "8px 0" }}>Pricing</a>
          <a href="/blog/" onClick={() => setMobileMenuOpen(false)} style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "16px", fontWeight: 500, padding: "8px 0" }}>Resources</a>
          <a href="#faq" onClick={() => setMobileMenuOpen(false)} style={{ color: COLORS.coffeeBrown, textDecoration: "none", fontSize: "16px", fontWeight: 500, padding: "8px 0" }}>FAQ</a>
          <button onClick={() => { setMobileMenuOpen(false); openCheckout("mobile_nav"); }} className="cta-btn" style={{ padding: "14px 24px", fontSize: "16px", animation: "none", justifyContent: "center" }}>Get Focana</button>
        </div>
      )}

      {/* HERO */}
      <section className="hero-section" style={{
        paddingTop: "140px", paddingBottom: 0, position: "relative", overflow: "hidden",
        background: COLORS.softCream,
      }}>
        <div style={{
          position: "absolute", inset: 0, opacity: 0.03,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }} />

        <div className="section" style={{ position: "relative", zIndex: 2 }}>
          {/* Headline - full width, centered */}
          <h1 style={{
            fontFamily: "'Outfit', sans-serif",
            fontSize: "clamp(32px, 4.5vw, 56px)",
            fontWeight: 800,
            lineHeight: 1.15,
            color: COLORS.warmBrown,
            marginBottom: "48px",
            textAlign: "center",
            animation: "fadeUp 0.6s ease 0.1s both",
          }}>
            Your ADHD doesn't need another productivity app.{" "}
            <span
              style={{
                background: `linear-gradient(135deg, ${COLORS.sunshineYellow}, ${COLORS.deepAmber})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                display: "inline-block",
              }}
            >It needs an attention anchor.</span>
          </h1>

          {/* Split: Subtitle + CTA left, Video right */}
          <div className="hero-split" style={{
            display: "flex",
            alignItems: "center",
            gap: "48px",
            maxWidth: "1100px",
            margin: "0 auto",
            animation: "fadeUp 0.6s ease 0.2s both",
          }}>
            <div style={{
              flex: "1 1 0",
              minWidth: "280px",
              alignSelf: "stretch",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}>
              <p style={{
                fontSize: "clamp(18px, 2vw, 22px)",
                fontWeight: 500,
                lineHeight: 1.6,
                color: COLORS.coffeeBrown,
                marginBottom: "18px",
              }}>
                Always visible, always anchoring you back to what matters.
              </p>

              <p style={{
                fontSize: "16px",
                lineHeight: 1.8,
                color: COLORS.coffeeBrown,
                marginBottom: "20px",
                maxWidth: "560px",
              }}>
                <strong style={{ color: COLORS.warmBrown }}>What is Focana?</strong> Focana is a native Mac focus app for ADHD and busy brains that keeps your task, timer, and session notes visible while you switch between apps. Instead of asking you to build a whole productivity system, it gives you one calm attention anchor you can keep in sight.
              </p>

              <p style={{
                fontSize: "15px",
                lineHeight: 1.7,
                color: COLORS.coffeeBrown,
                marginBottom: "28px",
                maxWidth: "560px",
              }}>
                <strong style={{ color: COLORS.warmBrown }}>Focana is the flagship product from NeurDi Labs</strong>, a
                {" "}HealthTech company building executive function tools for neurodivergent brains.
              </p>

              <div style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                width: "100%",
              }}>
                <button onClick={() => openCheckout("hero")} className="cta-btn" style={{ fontSize: "18px", padding: "18px 40px", justifyContent: "center" }}>
                  Get Focana <span style={{ fontSize: "22px" }}>→</span>
                </button>
                <p style={{
                  fontSize: "15px",
                  color: COLORS.coffeeBrown,
                  margin: 0,
                  textAlign: "center",
                }}>
                  $29 lifetime · No subscription · macOS
                </p>
              </div>
            </div>

            <div style={{
              flex: "1.2 1 0",
              minWidth: "300px",
              overflow: "hidden",
              borderRadius: "12px",
            }}>
              <video
                src="/videos/Hero-GIF.mp4"
                autoPlay
                loop
                muted
                playsInline
                style={{ width: "100%", display: "block", borderRadius: "12px" }}
              />
            </div>
          </div>

        </div>
      </section>

      {/* COMPETITOR COMPARISON */}
      <section style={{ padding: "72px 0 36px 0", background: "white" }}>
        <div className="section">
          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800, color: COLORS.warmBrown, lineHeight: 1.15,
            textAlign: "center", marginBottom: "24px",
          }}>
            Why don't most productivity apps work for ADHD brains?
          </h2>
          <p style={{
            fontSize: "19px",
            lineHeight: 1.7,
            color: COLORS.coffeeBrown,
            maxWidth: "760px",
            margin: "0 auto 48px",
            textAlign: "center",
          }}>
            Hustle culture sold you apps that track more, schedule more, and guilt you into doing more. You don't need more. You need a system that anchors your attention.
          </p>

          <div style={{
            display: "flex",
            gap: "24px",
            maxWidth: "960px",
            margin: "0 auto 48px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}>
            {[
              { title: "Distraction Blockers", body: "Block apps you actually need, and fights your brain instead of working with it." },
              { title: "Browser Extensions", body: <span>Disappear the moment you switch tabs.<br /><em>Out of sight, out of mind.</em></span> },
              { title: "Pomodoro Timers", body: "A countdown and nothing else. No check-ins, no thought capture, no context when you come back." },
            ].map((card) => (
              <div key={card.title} style={{
                flex: "1 1 280px",
                background: "white",
                borderRadius: "20px",
                border: `1px solid ${COLORS.beigeBorder}`,
                boxShadow: "0 8px 24px rgba(92, 64, 51, 0.06)",
                padding: "36px 28px",
              }}>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "20px",
                  fontWeight: 700,
                  color: COLORS.warmBrown,
                  marginBottom: "12px",
                }}>{card.title}</h3>
                <p style={{
                  fontSize: "16px",
                  lineHeight: 1.6,
                  color: COLORS.coffeeBrown,
                  margin: 0,
                }}>{card.body}</p>
              </div>
            ))}
          </div>

          <p style={{
            fontSize: "clamp(18px, 2vw, 22px)",
            fontWeight: 600,
            color: COLORS.warmBrown,
            textAlign: "center",
            marginBottom: "28px",
          }}>
            Focana replaces all three. 7 ADHD coping mechanisms. One calm system.
          </p>

          <div style={{ textAlign: "center" }}>
            <button onClick={() => openCheckout("comparison")} className="cta-btn" style={{ fontSize: "18px", padding: "18px 40px" }}>
              Get Focana <span style={{ fontSize: "22px" }}>→</span>
            </button>
            <p style={{
              fontSize: "15px",
              color: COLORS.coffeeBrown,
              marginTop: "14px",
            }}>
              $29 lifetime · No subscription · macOS
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ padding: "72px 0 100px 0", background: COLORS.softCream }}>
        <div className="section">
          <h2 style={{
            fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 4vw, 48px)",
            fontWeight: 800, color: COLORS.warmBrown, lineHeight: 1.15,
            textAlign: "center", marginBottom: "12px",
          }}>How does Focana help you stay focused when you switch apps?</h2>
          <p style={{
            fontSize: "13px", fontWeight: 700, color: COLORS.deepAmber,
            textAlign: "center", marginBottom: "48px",
            textTransform: "uppercase", letterSpacing: "2px",
          }}>How it works</p>

          {[
            {
              video: "/videos/get-started.mp4",
              headline: "Get started in 7 seconds.",
              body: <><strong>Simple to get started.</strong> Type one task. Pick your timer — or don't. Hit start. Focana shrinks to a small floating window and stays with you while you work. No account. No tutorial. No setup maze.</>,
            },
            {
              video: "/videos/check-in-landingpage.mp4",
              headline: "Gentle check-ins.",
              body: <><strong>Your attention buddy.</strong> Focana gently nudges you throughout your session — not to nag, just to keep you aware. And every so often, a simple check-in asks 'Still focused?' No guilt. No judgment. Just a quiet tap on the shoulder when you need it most.</>,
            },
            {
              video: "/videos/Parking-lot-demo.mp4",
              headline: "Catch stray thoughts.",
              body: <><strong>Parking lot.</strong> Catch every stray thought mid-session without breaking your flow. Jot it down, close the panel, keep working. Everything's waiting for you when you're done — nothing lost, nothing derailed.</>,
            },
            {
              video: "/videos/pick-up-where-you-left-off.mp4",
              headline: "Pick up where you left off.",
              body: <><strong>Session History.</strong> When your session ends, leave a quick note for future you. Where you stopped, what's next, what to pick up first. Your session history keeps every breadcrumb so you never lose momentum between work sessions.</>,
            },
            {
              video: "/videos/always-on-top.mp4",
              headline: "Always visible while you work.",
              body: <><strong>Always on top.</strong> We've all been there...working on a task, then one new tab, a Slack ping, a quick email reply — and just like that, you're in a ChatGPT rabbit hole thinking "what was I even doing?"<br /><br />Focana stays visible across the apps you work in, so your task and timer stay in view while you move between windows. If you can see it, you can do it.</>,
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

          <div style={{ maxWidth: "760px", margin: "80px auto 0", textAlign: "center" }}>
            <p style={{
              fontSize: "18px",
              lineHeight: 1.7,
              color: COLORS.coffeeBrown,
              margin: "0 0 20px",
            }}>
              Ready to try it for yourself?
            </p>
            <button onClick={() => openCheckout("mid_page")} className="cta-btn" style={{ fontSize: "18px", padding: "18px 40px" }}>
              Start My Focus
            </button>
          </div>
        </div>
      </section>

      {/* FOUNDER STORY */}
      <section id="founder-story" style={{ padding: "88px 0 100px", background: "white" }}>
        <div className="section">
          <div style={{ maxWidth: "980px", margin: "0 auto" }}>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "clamp(32px, 4vw, 48px)",
              fontWeight: 800,
              color: COLORS.warmBrown,
              lineHeight: 1.15,
              textAlign: "center",
              marginBottom: "12px",
            }}>Who built Focana, and why does it exist?</h2>
            <p style={{
              fontSize: "13px",
              fontWeight: 700,
              color: COLORS.deepAmber,
              textAlign: "center",
              marginBottom: "48px",
              textTransform: "uppercase",
              letterSpacing: "2px",
            }}>Founder Story</p>

            <div style={{
              background: COLORS.softCream,
              borderRadius: "24px",
              padding: "32px",
              border: `1px solid ${COLORS.beigeBorder}`,
              display: "flex",
              alignItems: "center",
              gap: "32px",
              flexWrap: "wrap",
            }}>
              <div style={{ flex: "0 0 180px", margin: "0 auto" }}>
                <img
                  src="/founder-story.jpeg"
                  alt="Justin, founder of Focana and NeurDi Labs"
                  width="180"
                  height="180"
                  style={{
                    display: "block",
                    width: "100%",
                    maxWidth: "180px",
                    aspectRatio: "1 / 1",
                    objectFit: "cover",
                    borderRadius: "24px",
                    boxShadow: "0 18px 36px rgba(92, 64, 51, 0.12)",
                  }}
                />
              </div>

              <div style={{ flex: "1 1 420px" }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "10px",
                    marginBottom: "18px",
                  }}
                >
                  {[
                    siteFounder.shortRole,
                    siteFounder.note,
                    "Built from first-hand ADHD experience",
                  ].map((chip) => (
                    <span
                      key={chip}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        padding: "8px 12px",
                        borderRadius: "999px",
                        background: "rgba(255,255,255,0.78)",
                        border: `1px solid ${COLORS.beigeBorder}`,
                        fontSize: "13px",
                        fontWeight: 600,
                        color: COLORS.coffeeBrown,
                      }}
                    >
                      {chip}
                    </span>
                  ))}
                </div>

                <p style={{ fontSize: "17px", lineHeight: 1.6, color: COLORS.coffeeBrown, margin: "0 0 16px" }}>
                  <strong style={{ color: COLORS.warmBrown }}>{siteFounder.name}</strong> is the founder of Focana and NeurDi Labs. He built Focana after years of trying productivity tools that created more setup, more guilt, and more room to lose the thread.
                </p>

                <p style={{ fontSize: "17px", lineHeight: 1.8, color: COLORS.warmBrown, margin: "0 0 16px" }}>
                  I was diagnosed with ADHD at 30 after college, grad school, and nearly a decade into my career. I showed flashes of what I was capable of, but mostly felt like a high-potential underperformer. That led me down a dark path of shame, guilt, and depression.
                </p>

                <p style={{ fontSize: "17px", lineHeight: 1.8, color: COLORS.warmBrown, margin: "0 0 16px" }}>
                  I tried every productivity tool I could find, but none of them stuck.
                </p>

                <p style={{ fontSize: "17px", lineHeight: 1.8, color: COLORS.warmBrown, margin: "0 0 18px" }}>
                  NeurDi Labs exists because I got tired of waiting for someone else to build what I needed and what we need. Focana is the flagship product from that mission: a calm desktop focus system designed specifically for neurodivergent brains.
                </p>

                <p style={{ fontSize: "17px", lineHeight: 1.6, color: COLORS.coffeeBrown, margin: 0 }}>
                  <strong>{siteFounder.name}</strong> {"\u2014"} Founder, Focana and NeurDi Labs
                </p>

                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "16px",
                    marginTop: "20px",
                  }}
                >
                  {founderProfiles.map((profile) => (
                    <a
                      key={profile.label}
                      href={profile.href}
                      target={profile.href.startsWith("http") ? "_blank" : undefined}
                      rel={profile.href.startsWith("http") ? "noopener noreferrer" : undefined}
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: COLORS.warmBrown,
                        textDecoration: "underline",
                        textDecorationColor: COLORS.deepAmber,
                        textUnderlineOffset: "4px",
                      }}
                    >
                      {profile.label}
                    </a>
                  ))}
                </div>
              </div>

              <div
                style={{
                  flex: "1 1 100%",
                  marginTop: "28px",
                  paddingTop: "28px",
                  borderTop: `1px solid ${COLORS.beigeBorder}`,
                }}
              >
                <div className="newsletter-layout" style={{ alignItems: "center" }}>
                  <div className="newsletter-copy">
                    <p
                      style={{
                        fontSize: "13px",
                        fontWeight: 700,
                        color: COLORS.deepAmber,
                        textTransform: "uppercase",
                        letterSpacing: "2px",
                        marginBottom: "12px",
                      }}
                    >
                      Build in public
                    </p>
                    <h3
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: "clamp(24px, 3vw, 34px)",
                        fontWeight: 800,
                        color: COLORS.warmBrown,
                        lineHeight: 1.15,
                        marginBottom: "12px",
                      }}
                    >
                      Follow the journey
                    </h3>
                    <p style={{ fontSize: "17px", lineHeight: 1.7, color: COLORS.coffeeBrown, margin: 0 }}>
                      Stay up to date on Focana and NeurDi Labs updates as we build in public.
                      Get weekly-ish notes on what we&apos;re shipping, what we&apos;re learning,
                      and where this mission is headed.
                    </p>
                  </div>

                  <div className="newsletter-form-wrap">
                    <EmailCaptureForm
                      defaultEmail={submittedEmail}
                      source="founder-story-cta"
                      trackingLocation="founder_story"
                      submitLabel="Follow the journey"
                      loadingLabel="Saving..."
                      successBody="You'll get the next update in your inbox."
                      onSubmitted={rememberSubmittedEmail}
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* DIFFERENCE */}
      <section id="difference" style={{
        padding: "100px 0",
        background: `linear-gradient(160deg, ${COLORS.warmBrown}, ${COLORS.softBlack})`,
      }}>
        <div className="section">
          <div style={{ textAlign: "center", maxWidth: "760px", margin: "0 auto 56px" }}>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "clamp(32px, 4vw, 44px)",
              fontWeight: 800,
              color: "#FEF3C7",
              lineHeight: 1.15,
              marginBottom: "18px",
            }}>
              What makes Focana different from a browser extension or timer?
            </h2>
            <p style={{ fontSize: "19px", lineHeight: 1.7, color: "#F6E7C7" }}>
              Most productivity tools ask you to build a system. Focana helps you protect the focus you already have.
            </p>
          </div>

          <div style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "24px",
            maxWidth: "1040px",
            margin: "0 auto",
            alignItems: "start",
          }}>
            {[
              {
                title: 'It never disappears.',
                body: "Browser extensions vanish when you switch tabs. Phone apps are on the wrong device. Focana floats above every window on your screen — browser, IDE, Slack, everything. If you can see it, you can do it.",
              },
              {
                title: "It doesn't try to manage your life.",
                body: <>No dashboards. No integrations. No project boards. <span style={{
                  background: "linear-gradient(180deg, transparent 0%, transparent 46%, rgba(252, 211, 77, 0.42) 46%, rgba(252, 211, 77, 0.42) 88%, transparent 88%)",
                  padding: "0 2px",
                  borderRadius: "4px",
                  boxDecorationBreak: "clone",
                  WebkitBoxDecorationBreak: "clone",
                }}>No 30-minute setup. Type a task, start a timer, get to work.</span> Focana does one thing and stays out of your way.</>,
              },
              {
                title: 'It catches the thoughts that derail you.',
                body: "Random idea mid-session? Dump it in the Parking Lot and get back to your task. Your stray thoughts are saved. Your focus isn't broken.",
              },
              {
                title: 'It celebrates you instead of judging you.',
                body: 'No \"session incomplete.\" No guilt. Focana tells you what you accomplished — even if it was just 8 minutes. Because showing up is the hardest part, and you did it.',
              },
              {
                title: 'It works without wifi, without an account, and without the cloud.',
                body: 'Focana is a desktop app that lives on your machine. No login. No sync. No server tracking your focus habits. Your data stays yours.',
              },
            ].map((item, index) => {
              const isHighlighted = index === 0 || index === 4;

              return (
                <div key={index} style={{
                  position: "relative",
                  overflow: "hidden",
                  flex: "0 1 310px",
                  background: isHighlighted
                    ? `linear-gradient(180deg, rgba(255, 254, 248, 0.98) 0%, rgba(255, 249, 230, 0.98) 100%)`
                    : "rgba(255, 254, 248, 0.96)",
                  border: isHighlighted
                    ? `1px solid ${COLORS.sunshineYellow}55`
                    : `1px solid ${COLORS.beigeBorder}44`,
                  borderRadius: "18px",
                  padding: "26px 24px",
                  boxShadow: isHighlighted
                    ? "0 22px 46px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(245, 158, 11, 0.05)"
                    : "0 18px 40px rgba(0, 0, 0, 0.18)",
                }}>
                  {isHighlighted ? (
                    <div
                      aria-hidden="true"
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "radial-gradient(circle at 82% 18%, rgba(252, 211, 77, 0.34) 0%, rgba(252, 211, 77, 0.12) 24%, rgba(252, 211, 77, 0.04) 40%, transparent 62%)",
                        pointerEvents: "none",
                      }}
                    />
                  ) : null}

                  <div style={{ position: "relative", zIndex: 1 }}>
                    <h3 style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "24px",
                      fontWeight: 700,
                      lineHeight: 1.25,
                      color: COLORS.warmBrown,
                      marginBottom: "14px",
                    }}>
                      {item.title}
                    </h3>
                    <p style={{
                      fontSize: "16px",
                      lineHeight: 1.7,
                      color: COLORS.coffeeBrown,
                      margin: 0,
                    }}>
                      {item.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* NEWSLETTER CTA */}
      <section id="newsletter-cta" style={{ padding: "88px 0", background: COLORS.warmVanilla }}>
        <div className="section" style={{ maxWidth: "980px" }}>
          <div
            style={{
              background: `linear-gradient(135deg, ${COLORS.softCream}, rgba(254, 243, 199, 0.36))`,
              border: `1px solid ${COLORS.beigeBorder}`,
              borderRadius: "24px",
              padding: "32px",
              boxShadow: "0 14px 36px rgba(92, 64, 51, 0.08)",
            }}
          >
            <div className="newsletter-layout">
              <div className="newsletter-copy">
                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: COLORS.deepAmber,
                    textTransform: "uppercase",
                    letterSpacing: "2px",
                    marginBottom: "14px",
                  }}
                >
                  Weekly-ish updates
                </p>
                <h2
                  style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: "clamp(28px, 4vw, 40px)",
                    fontWeight: 800,
                    color: COLORS.warmBrown,
                    lineHeight: 1.15,
                    marginBottom: "14px",
                  }}
                >
                  Still deciding?
                </h2>
                <p style={{ fontSize: "17px", lineHeight: 1.7, color: COLORS.coffeeBrown }}>
                  I&apos;m an ADHD founder building Focana in public. Drop your email for weekly-ish
                  updates on the work — honest, not pitchy.
                </p>
              </div>

              <div className="newsletter-form-wrap">
                <EmailCaptureForm
                  defaultEmail={submittedEmail}
                  source="newsletter-cta"
                  trackingLocation="newsletter"
                  onSubmitted={rememberSubmittedEmail}
                />
              </div>
            </div>
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
              Founder launch pricing
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
            }}>Founder Launch</span>
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
            <div style={{ marginBottom: "28px" }}>
              <SaasHubBadge location="pricing" />
            </div>
            <button onClick={() => openCheckout("pricing")} className="cta-btn" style={{ fontSize: "18px", padding: "18px 40px" }}>
              Start My Focus <span style={{ fontSize: "22px" }}>→</span>
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
              Why buy during the founder launch?
            </h3>
            <p style={{ fontSize: "16px", lineHeight: 1.7, color: COLORS.coffeeBrown }}>
              We want pricing to feel as calm as the product: simple, upfront, and easy to trust.
              If you buy at $29, that purchase stays lifetime access while Focana grows.
              No subscription math. No renewal anxiety. Just a tool that stays with you.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ padding: "100px 0", background: COLORS.softCream }}>
        <div className="section" style={{ maxWidth: "760px" }}>
          <div style={{ textAlign: "center", marginBottom: "50px" }}>
            <h2 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "clamp(28px, 3.5vw, 40px)",
              fontWeight: 800, color: COLORS.warmBrown,
            }}>
              Frequently asked questions
            </h2>
          </div>

          <FAQItem
            question="How is this different from a browser extension?"
            answer="Browser extensions live in your browser. Switch to Slack or your code editor and they're gone. Focana is a native Mac app, so your task and timer stay visible while you move between the apps you work in. That's the difference."
          />
          <FAQItem
            question="I have ADHD and I've tried dozens of productivity apps. Why would this one stick?"
            answer="Because Focana does exactly one thing and does it in under 10 seconds. No account. No onboarding flow. No setup maze. Type your task, start the timer, and it's right there while you work. The reason other apps don't stick is because they ask too much of you before you've gotten any value. Focana doesn't."
          />
          <FAQItem
            question='What does "always on top" actually mean?'
            answer="It means Focana stays visible over your other windows while you work, so you don't lose your task when you switch apps. On macOS, true fullscreen Spaces can still be inconsistent, but across normal app windows Focana stays in view."
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
            Get Focana <span style={{ fontSize: "22px" }}>→</span>
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
      <EmailCaptureModal
        open={exitIntentOpen}
        onClose={handleExitIntentClose}
        onSubmit={handleExitIntentSubmit}
        titleId="exit-intent-title"
        title="Stay in the loop"
        description="Weekly-ish notes from the ADHD founder building Focana — honest updates, not pitches."
        submitLabel="Keep me posted"
        loadingLabel="Saving..."
        dismissLabel="No thanks"
        defaultEmail={submittedEmail}
      />
      <EmailCaptureModal
        open={checkoutModalOpen}
        onClose={handleCheckoutModalClose}
        onSubmit={handleCheckoutSubmit}
        titleId="checkout-capture-title"
        title="Enter your email to get your Focana details"
        description="We'll use this to send your confirmation and access details."
        submitLabel="Continue to checkout →"
        loadingLabel="Continuing..."
        defaultEmail={submittedEmail}
      />

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
            <SaasHubBadge location="footer" />
            <a href="/about" style={{ fontSize: "13px", color: COLORS.warmGray, textDecoration: "none", transition: "color 0.2s ease" }}>About</a>
            <a href="/blog/" style={{ fontSize: "13px", color: COLORS.warmGray, textDecoration: "none", transition: "color 0.2s ease" }}>Resources</a>
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
