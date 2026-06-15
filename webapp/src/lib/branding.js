/**
 * DESKIMON — Branding Configuration
 * 
 * SINGLE SOURCE OF TRUTH for the product name and all brand constants.
 * If the product name changes, update it here — everything else will follow.
 * 
 * This mirrors the root branding.json but is optimized for JavaScript imports.
 */

const BRANDING = {
  // Product Identity
  name: "DESKIMON",
  nameLower: "deskimon",
  nameDisplay: "Deskimon",
  tagline: "Your Living Desk Companion",
  description: "A smart, expressive desk companion that reacts to your voice, touch, and motion — powered by AI.",
  wakeWord: "Hey Spark",
  domain: "deskimon.com",
  version: "1.0.0",

  // SEO
  seo: {
    title: "Deskimon — Your Living Desk Companion",
    description: "Meet Deskimon, a smart desk companion with expressive eyes that reacts to your voice, touch, and motion. Powered by AI, always listening, always alive.",
    keywords: "deskimon, desk companion, smart device, AI companion, voice assistant, ESP32, IoT",
  },

  // Navigation
  nav: {
    links: [
      { label: "Home", href: "/" },
      { label: "Shop", href: "/shop" },
      { label: "About", href: "/about" },
    ],
    authLinks: [
      { label: "Dashboard", href: "/dashboard" },
    ],
  },

  // Features (for landing page)
  features: [
    {
      icon: "🎤",
      title: "Voice Conversations",
      description: "Say 'Hey Spark' and have natural conversations. It listens, thinks, and replies with personality.",
    },
    {
      icon: "👁️",
      title: "18 Emotional Expressions",
      description: "From happy to angry, sleepy to surprised — Deskimon shows real emotions through animated eyes on a round display.",
    },
    {
      icon: "🤖",
      title: "AI-Powered Brain",
      description: "Powered by advanced AI, Deskimon understands context, remembers your preferences, and develops its own personality.",
    },
    {
      icon: "📱",
      title: "Web Dashboard",
      description: "Customize everything from your browser — personality, eye colors, volume, Wi-Fi, and firmware updates.",
    },
    {
      icon: "🔊",
      title: "Crystal Clear Audio",
      description: "High-quality speaker with PCM5101 DAC for natural voice replies and music playback from SD card.",
    },
    {
      icon: "🎮",
      title: "Touch & Motion",
      description: "Pet it, tap it, shake it, tilt it — Deskimon reacts to every interaction with unique animations and sounds.",
    },
  ],

  // Social (for footer and sharing)
  social: {
    twitter: "",
    instagram: "",
    github: "",
  },
};

export default BRANDING;
