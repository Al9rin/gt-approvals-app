import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import licenses from "./licenses.json";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, Wand2, Sun, Moon, X, Loader2, ExternalLink, ClipboardCopy, Check } from "lucide-react";
import { Analytics } from '@vercel/analytics/react';

// motion variants
const containerVariants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.12, ease: "easeOut" },
  },
};
const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia",
  "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland",
  "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
  "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District Columbia", "Psypact",
];

const CANADA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador", "Northwest Territories",
  "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island", "Quebec", "Saskatchewan", "Yukon"
];

// US states and Canada provinces abbreviation lookup
const STATE_ABBR = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', Florida: 'FL', Georgia: 'GA',
  Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA',
  Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA', Maine: 'ME', Maryland: 'MD',
  Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS',
  Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH',
  'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY', 'North Carolina': 'NC',
  'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA',
  'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN',
  Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA', Washington: 'WA',
  'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY', 'District Columbia': 'DC',
};

const PROVINCE_ABBR = {
  Alberta: 'AB', 'British Columbia': 'BC', Manitoba: 'MB', 'New Brunswick': 'NB',
  'Newfoundland and Labrador': 'NL', 'Northwest Territories': 'NT',
  'Nova Scotia': 'NS', Nunavut: 'NU', Ontario: 'ON', 'Prince Edward Island': 'PE',
  Quebec: 'QC', Saskatchewan: 'SK', Yukon: 'YT'
};

/* ── react‑select brand styles ────────────────────────────────────────── */
const selectStyles = (dark) => ({
  control: (base, s) => ({
    ...base,
    cursor: 'pointer',
    borderRadius: '0.75rem',
    borderColor: s.isFocused ? '#A2AD1A' : dark ? '#444' : '#ddd',
    backgroundColor: dark ? '#1e1e1e' : '#fff',
    boxShadow: s.isFocused ? '0 0 0 2px rgba(162,173,26,0.3)' : 'none',
    '&:hover': { borderColor: '#A2AD1A' },
    padding: '2px 4px',
    transition: 'all 0.2s',
  }),
  option: (base, s) => ({
    ...base,
    cursor: 'pointer',
    backgroundColor: s.isSelected
      ? '#A2AD1A'
      : s.isFocused
        ? dark ? '#2a2a2a' : '#F7F8EC'
        : dark ? '#1e1e1e' : '#fff',
    color: s.isSelected ? '#fff' : dark ? '#e5e5e5' : '#333',
    '&:active': { backgroundColor: '#C5CE5C' },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.75rem',
    overflow: 'hidden',
    border: '1px solid rgba(162,173,26,0.2)',
    boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
    backgroundColor: dark ? '#1e1e1e' : '#fff',
  }),
  menuList: (base) => ({
    ...base,
    padding: 0,
  }),
  singleValue: (base) => ({
    ...base,
    color: dark ? '#e5e5e5' : '#333',
  }),
  placeholder: (base) => ({
    ...base,
    color: dark ? '#888' : '#999',
  }),
  input: (base) => ({
    ...base,
    color: dark ? '#e5e5e5' : '#333',
  }),
});

export default function GTApprovalsApp() {
  const [state, setState] = useState(null);
  const [license, setLicense] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [editedNarrative, setEditedNarrative] = useState("");
  const [copied, setCopied] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [cardTilt1, setCardTilt1] = useState({ x: 0, y: 0 });
  const [cardTilt2, setCardTilt2] = useState({ x: 0, y: 0 });
  const [progress, setProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const progressRef = useRef(null);

  const [regionFilter, setRegionFilter] = useState({
    us: true,        // United States is selected by default
    ca: false,       // Canada
    intl: false      // International
  });

  const allRegions = useRef(
    Array.from(new Set(Object.keys(licenses).map(key => key.split("_")[0])))
  ).current;

  const stateOptions = allRegions
    .filter(region => {
      const isUS = US_STATES.includes(region);
      const isCA = CANADA_PROVINCES.includes(region);
      const isIntl = !isUS && !isCA;

      return (
        (regionFilter.us && isUS) ||
        (regionFilter.ca && isCA) ||
        (regionFilter.intl && isIntl)
      );
    })
    .map(r => {
      const abbr = STATE_ABBR[r] || PROVINCE_ABBR[r];
      const label = abbr ? `${r} (${abbr})` : r;
      return { value: r, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  // Determine dynamic label/placeholder based on active region filters
  const activeRegions = Object.entries(regionFilter)
    .filter(([_, v]) => v)
    .map(([k]) => k);

  const activeSet = new Set(activeRegions);
  let selectLabel = "Select";

  switch (activeRegions.length) {
    case 0:
      selectLabel = "Select";
      break;
    case 1:
      if (activeSet.has("us")) selectLabel = "Select State";
      if (activeSet.has("ca")) selectLabel = "Select Province";
      if (activeSet.has("intl")) selectLabel = "Select Country";
      break;
    case 2:
      if (activeSet.has("us") && activeSet.has("ca"))
        selectLabel = "Select State/Province";
      else if (activeSet.has("us") && activeSet.has("intl"))
        selectLabel = "Select State/Country";
      else if (activeSet.has("ca") && activeSet.has("intl"))
        selectLabel = "Select Province/Country";
      break;
    default:
      // All three selected
      selectLabel = "Select State/Province/Country";
  }

  useEffect(() => {
    if (state && !stateOptions.find(opt => opt.value === state.value)) {
      setState(null);
    }
  }, [regionFilter]);

  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  // debounce util
  const debounce = (fn, ms = 16) => {
    let frame;
    return (...args) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => fn(...args));
    };
  };

  const makeTiltHandler = (setter) =>
    debounce((e) => {
      if (isMobile || !e.currentTarget) return;
      const rect = e.currentTarget.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
      setter({ x, y });
    });

  const resetCardTilt = (setter) => () => setter({ x: 0, y: 0 });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // enable smooth scrolling for the whole document
  useEffect(() => {
    document.documentElement.classList.add("scroll-smooth");
  }, []);

  const useAI = true;

  const handleTilt = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 16;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -16;
    setTilt({ x, y });
  };

  const resetTilt = () => setTilt({ x: 0, y: 0 });

  const getFilteredLicenseOptions = () => {
    if (!state) return [];
    const filteredKeys = Object.keys(licenses).filter((key) =>
      key.startsWith(`${state.value}_`)
    );
    const licenseSet = new Set(filteredKeys.map((key) => key.split("_")[1]));
    return Array.from(licenseSet).map((l) => ({ value: l, label: l }));
  };

  const search = () => {
    if (!state || !license) {
      toast.error("Please select both a state and license type.");
      return;
    }

    setLoading(true);
    const key = `${state.value}_${license.value}`;
    const data = licenses[key];
    setTimeout(() => {
      setResult(data || null);
      setLoading(false);
      if (!data) toast.error("No data found for that combination.");
    }, 500);
  };

  const cleanWithAI = async (text) => {
    try {
      const res = await fetch("https://gt-approvals-app.onrender.com/api/clean-narrative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ narrative: text }),
      });

      const data = await res.json();
      const cleaned = data.cleaned || "";
      setEditedNarrative(cleaned.trim());
      toast.success("Narrative cleaned using AI");
    } catch (err) {
      console.error("AI Error:", err);
      toast.error("Failed to clean with AI");
    } finally {
      if (progressRef.current) {
        clearInterval(progressRef.current);
        progressRef.current = null;
      }
      setProgress(100);
      setTimeout(() => setShowProgress(false), 400);
      setLoading(false);
    }
  };

  const handleNarrative = () => {
    setEditedNarrative("");
    setLoading(true);
    setProgress(0);
    setShowProgress(true);

    // simulate progress
    progressRef.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 10 : p));
    }, 200);

    cleanWithAI(narrative);
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${darkMode
        ? "bg-[#111111] text-gray-100"
        : "bg-gradient-to-br from-gt-green-50 via-white to-gt-green-50 text-gt-gray"
      } pt-24 py-6 px-4`}>
      {/* ── Progress bar ────────────────────────────────────────── */}
      {showProgress && (
        <div className="fixed top-0 left-0 w-full z-[60]">
          <div
            className="h-1 bg-gt-green transition-all duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="glass-header fixed top-0 left-0 w-full z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          {/* Logo with 3‑D tilt */}
          <div
            onMouseMove={handleTilt}
            onMouseLeave={resetTilt}
            onClick={() => window.open('https://www.goodtherapy.org/', '_blank', 'noopener,noreferrer')}
            style={{ transform: `perspective(600px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg)` }}
            className="transition-transform duration-200 ease-out cursor-pointer"
          >
            <img
              src="/gt-logo.png"
              alt="GoodTherapy"
              className="h-8 select-none"
            />
          </div>

          {/* Dark‑mode toggle */}
          <div className="flex items-center space-x-2 select-none">
            <Sun className="w-4 h-4 text-yellow-500" />

            {/* animated toggle */}
            <motion.button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="cursor-pointer relative inline-block w-12 h-6 rounded-full focus:outline-none"
              initial={false}
              animate={{
                backgroundColor: darkMode ? "#A2AD1A" : "#d1d5db",
              }}
              transition={{ duration: 0.25 }}
            >
              <motion.span
                className="absolute top-1 left-1 h-4 w-4 bg-white rounded-full shadow-md"
                layout
                style={{ x: darkMode ? 24 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </motion.button>

            <Moon className="w-4 h-4 text-gray-400 dark:text-yellow-300" />
          </div>
        </div>
      </header>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-8"
      >
        {/* ── Page Title ───────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="text-center space-y-2">
          <h1 className={`text-3xl md:text-4xl font-bold tracking-tight ${darkMode ? 'text-white' : 'text-gt-gray'}`}>
            License Verification
          </h1>
          <p className={`text-sm md:text-base ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
            Search and verify therapist credentials across all 50 states
          </p>
        </motion.div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* ── Dropdown Section (License Search) ─────────────── */}
          <motion.div
            variants={itemVariants}
            onMouseMove={makeTiltHandler(setCardTilt1)}
            onMouseLeave={resetCardTilt(setCardTilt1)}
            style={{ transform: `perspective(800px) rotateX(${cardTilt1.y}deg) rotateY(${cardTilt1.x}deg)` }}
            className={`glass-card rounded-2xl shadow-xl p-6 space-y-5 transition-transform duration-200 ${darkMode ? 'shadow-gt-green/5' : ''
              }`}
          >
            {/* Region filter buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: "us", label: "🇺🇸 United States" },
                { key: "ca", label: "🇨🇦 Canada" },
                { key: "intl", label: "🌐 International" }
              ].map(btn => (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  key={btn.key}
                  type="button"
                  onClick={() =>
                    setRegionFilter(prev => ({ ...prev, [btn.key]: !prev[btn.key] }))
                  }
                  className={`cursor-pointer px-4 py-1.5 rounded-full text-sm font-semibold border-2 transition-all duration-200
                    ${regionFilter[btn.key]
                      ? "bg-gt-green text-white border-gt-green shadow-sm"
                      : darkMode
                        ? "bg-transparent text-gt-green-light border-gt-green/40 hover:bg-gt-green/10"
                        : "bg-white text-gt-green-darker border-gt-green/30 hover:bg-gt-green-50"
                    }
                  `}
                >
                  {btn.label}
                </motion.button>
              ))}
            </div>

            <div>
              <label className={`block mb-1.5 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gt-gray'}`}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={selectLabel}
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    transition={{ duration: 0.2 }}
                  >
                    {selectLabel}
                  </motion.span>
                </AnimatePresence>
              </label>
              <Select
                options={stateOptions}
                value={state}
                onChange={(selected) => {
                  setState(selected);
                  setLicense(null);
                }}
                placeholder={selectLabel}
                styles={selectStyles(darkMode)}
              />
            </div>

            <div>
              <label className={`block mb-1.5 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gt-gray'}`}>
                Select License
              </label>
              <Select
                options={getFilteredLicenseOptions()}
                value={license}
                onChange={setLicense}
                placeholder="Start typing a license..."
                styles={selectStyles(darkMode)}
                isDisabled={!state}
              />
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={search}
              className="cursor-pointer w-full bg-gt-green hover:bg-gt-green-dark text-white py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md shadow-gt-green/20"
            >
              <Search className="w-5 h-5" />
              Search
            </motion.button>

            <AnimatePresence>
              {loading && (
                <motion.div
                  key="search-loader-alt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 space-y-2"
                >
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`mt-4 rounded-xl overflow-hidden ${darkMode
                    ? 'bg-gt-green/10 border border-gt-green/20'
                    : 'bg-gt-green-50 border border-gt-green/20'
                  }`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-1 h-full min-h-[20px] bg-gt-green rounded-full flex-shrink-0" />
                    <div className="space-y-2">
                      <p className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gt-gray'}`}>
                        <span className="font-bold">Requirements: </span>
                        {result.requirements}
                      </p>
                      <a
                        href={result.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-gt-green hover:text-gt-green-dark transition-colors"
                      >
                        <ExternalLink className="w-4 h-4" />
                        View Verification Site
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </motion.div>

          {/* ── Divider ────────────────────────────────────────── */}
          <div className="flex items-center gap-4 px-4">
            <div className={`flex-1 h-px ${darkMode ? 'bg-gray-700' : 'bg-gt-green/15'}`} />
            <span className={`text-xs font-medium uppercase tracking-widest ${darkMode ? 'text-gray-500' : 'text-gt-green/60'}`}>
              Tools
            </span>
            <div className={`flex-1 h-px ${darkMode ? 'bg-gray-700' : 'bg-gt-green/15'}`} />
          </div>

          {/* ── Narrative Editor ───────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            onMouseMove={makeTiltHandler(setCardTilt2)}
            onMouseLeave={resetCardTilt(setCardTilt2)}
            style={{ transform: `perspective(800px) rotateX(${cardTilt2.y}deg) rotateY(${cardTilt2.x}deg)` }}
            className={`relative glass-card rounded-2xl shadow-xl p-6 space-y-5 transition-transform duration-200 ${darkMode ? 'shadow-gt-green/5' : ''
              }`}
          >
            {showProgress && (
              <div className="absolute inset-0 bg-white/60 dark:bg-[#111]/60 backdrop-blur-sm flex items-center justify-center rounded-2xl z-20">
                <Loader2 className="w-6 h-6 animate-spin text-gt-green" />
                <span className="ml-2 text-gt-green font-medium">Cleaning…</span>
              </div>
            )}

            <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gt-gray'}`}>
              ✨ Narrative Editor
            </h2>
            <p className={`text-sm -mt-3 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              Paste your narrative and let AI clean it up for you
            </p>

            <textarea
              rows={5}
              className={`w-full p-4 rounded-xl border-2 focus:outline-none focus:ring-2 focus:ring-gt-green/40 focus:border-gt-green transition-all duration-200 resize-none text-sm leading-relaxed ${darkMode
                  ? 'bg-[#1e1e1e] text-gray-100 border-gray-700 placeholder:text-gray-500'
                  : 'bg-white text-gt-gray border-gray-200 placeholder:text-gray-400'
                }`}
              placeholder="Paste your narrative here..."
              value={narrative}
              onChange={(e) => setNarrative(e.target.value)}
              onKeyDown={(e) => {
                // ⌘/Ctrl + Enter to clean with AI
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleNarrative();
                }
                // Esc to clear narrative
                else if (e.key === "Escape") {
                  setNarrative("");
                }
              }}
            />

            <div className="flex items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNarrative}
                className="cursor-pointer bg-gt-green hover:bg-gt-green-dark text-white px-5 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 shadow-md shadow-gt-green/20"
              >
                <Wand2 className="w-5 h-5" />
                Clean with AI
              </motion.button>
              {narrative && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setNarrative("")}
                  className={`cursor-pointer px-4 py-2.5 rounded-xl font-semibold transition-all duration-200 flex items-center gap-2 border-2 ${darkMode
                      ? 'border-gray-600 text-gray-300 hover:bg-gray-800'
                      : 'border-gray-300 text-gt-gray hover:bg-gray-50'
                    }`}
                >
                  <X className="w-4 h-4" />
                  Clear
                </motion.button>
              )}
            </div>

            <p className={`mt-1 text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              ⌘/Ctrl + Enter to Clean · Esc to Clear
            </p>

            <AnimatePresence>
              {loading && (
                <motion.div
                  key="narrative-loader"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 space-y-2"
                >
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                  <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>

            {editedNarrative && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`relative rounded-xl p-4 pr-24 whitespace-pre-wrap text-sm leading-relaxed ${darkMode
                    ? 'bg-gt-green/10 border border-gt-green/20 text-gray-100'
                    : 'bg-gt-green-50 border border-gt-green/20 text-gt-gray'
                  }`}
              >
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  onClick={() => {
                    navigator.clipboard.writeText(editedNarrative).then(() => {
                      setCopied(true);
                      toast.success("Copied to clipboard");
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  className="cursor-pointer absolute top-3 right-3 bg-gt-green hover:bg-gt-green-dark text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-md transition-all duration-200"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </motion.button>
                {editedNarrative}
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className={`mt-16 pb-6 text-center text-xs ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
        © {new Date().getFullYear()} GoodTherapy · Approvals Tool
      </footer>
    </div>
  );
}