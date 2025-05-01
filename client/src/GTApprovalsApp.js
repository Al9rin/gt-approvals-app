import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import licenses from "./licenses.json";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, Wand2, Sun, Moon, X, Loader2 } from "lucide-react";

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
  "Alabama","Alaska","Arizona","Arkansas","California","Colorado","Connecticut","Delaware","Florida","Georgia",
  "Hawaii","Idaho","Illinois","Indiana","Iowa","Kansas","Kentucky","Louisiana","Maine","Maryland",
  "Massachusetts","Michigan","Minnesota","Mississippi","Missouri","Montana","Nebraska","Nevada","New Hampshire",
  "New Jersey","New Mexico","New York","North Carolina","North Dakota","Ohio","Oklahoma","Oregon",
  "Pennsylvania","Rhode Island","South Carolina","South Dakota","Tennessee","Texas","Utah","Vermont",
  "Virginia","Washington","West Virginia","Wisconsin","Wyoming","District Columbia","Psypact",
];

const CANADA_PROVINCES = [
  "Alberta","British Columbia","Manitoba","New Brunswick","Newfoundland and Labrador","Northwest Territories",
  "Nova Scotia","Nunavut","Ontario","Prince Edward Island","Quebec","Saskatchewan","Yukon"
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
      const isUS  = US_STATES.includes(region);
      const isCA  = CANADA_PROVINCES.includes(region);
      const isIntl = !isUS && !isCA;

      return (
        (regionFilter.us   && isUS)  ||
        (regionFilter.ca   && isCA)  ||
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
      if (activeSet.has("us"))   selectLabel = "Select State";
      if (activeSet.has("ca"))   selectLabel = "Select Province";
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
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 10;
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * -10;
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
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20; // max 10° tilt
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20;
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
    <div className={`min-h-screen ${
      darkMode
        ? "bg-gray-900 text-gray-100"
        : "bg-gradient-to-tr from-green-50 to-white text-gray-800"
    } pt-24 py-6 px-4`}>
      {showProgress && (
        <div className="fixed top-0 left-0 w-full z-[60]">
          <div
            className="h-1 bg-green-500 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <header
    className={`fixed top-0 left-0 w-full z-50 ${
      darkMode
        ? "bg-gray-900"
        : "bg-gradient-to-tr from-green-50 to-white"
    }`}
      >
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
              src="/image.png"
              alt="GoodTherapy Approvals"
              className="w-40 select-none"
            />
          </div>

          {/* Dark‑mode toggle */}
          <div className="flex items-center space-x-2 select-none">
            <Sun className="w-4 h-4 text-yellow-400 dark:text-gray-400" />

            {/* animated toggle */}
            <motion.button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="cursor-pointer relative inline-block w-12 h-6 rounded-full focus:outline-none"
              initial={false}
              animate={{
                backgroundColor: darkMode ? "#16a34a" : "#d1d5db",
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

            <Moon className="w-4 h-4 text-gray-500 dark:text-yellow-300" />
          </div>
        </div>
      </header>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="max-w-4xl mx-auto space-y-10"
      >
        <div className="max-w-4xl mx-auto space-y-10">
          {/* Dropdown Section */}
          <motion.div
            variants={itemVariants}
            onMouseMove={makeTiltHandler(setCardTilt1)}
            onMouseLeave={resetCardTilt(setCardTilt1)}
            style={{ transform: `perspective(800px) rotateX(${cardTilt1.y}deg) rotateY(${cardTilt1.x}deg)` }}
            className="bg-white rounded-2xl shadow-lg dark:shadow-lg p-6 space-y-5 border border-green-100"
          >
            {/* Region filter buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: "us",  label: "United States" },
                { key: "ca",  label: "Canada" },
                { key: "intl",label: "International" }
              ].map(btn => (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  key={btn.key}
                  type="button"
                  onClick={() =>
                    setRegionFilter(prev => ({ ...prev, [btn.key]: !prev[btn.key] }))
                  }
                  className={`cursor-pointer px-3 py-1 rounded-full font-semibold border-2
                    ${regionFilter[btn.key]
                      ? "bg-green-600 text-white border-green-600"
                      : "bg-white text-green-700 border-green-600 hover:bg-green-50"}
                  `}
                >
                  {btn.label}
                </motion.button>
              ))}
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-gray-700">
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
                className="text-black cursor-pointer"
                styles={{
                  control: (base) => ({ ...base, cursor: 'pointer' }),
                  option:  (base) => ({ ...base, cursor: 'pointer' }),
                }}
              />
            </div>
            <div>
              <label className="block mb-1 text-sm font-semibold text-gray-700">
                Select License
              </label>
              <Select
                options={getFilteredLicenseOptions()}
                value={license}
                onChange={setLicense}
                placeholder="Start typing a license..."
                className="text-black cursor-pointer"
                styles={{
                  control: (base) => ({ ...base, cursor: 'pointer' }),
                  option:  (base) => ({ ...base, cursor: 'pointer' }),
                }}
                isDisabled={!state}
              />
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={search}
              className="cursor-pointer w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-semibold transition flex items-center justify-center gap-2"
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
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4 border p-4 rounded-xl border-green-400 bg-white/90 backdrop-blur-md text-green-900"
              >
                <p>
                  <strong>Requirements:</strong> {result.requirements}
                </p>
                <a
                  href={result.verificationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 underline mt-2 block"
                >
                  View Verification Site
                </a>
              </motion.div>
            )}
          </motion.div>
          {/* Gradient shimmer divider */}
          <motion.div
            className="w-full h-8 bg-gradient-to-r from-transparent via-green-400/30 to-transparent dark:via-teal-500/40"
            initial={{ backgroundPositionX: "0%" }}
            animate={{ backgroundPositionX: "200%" }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            style={{ backgroundSize: "200% 100%" }}
          />
          {/* Narrative Editor */}
          <motion.div
            variants={itemVariants}
            onMouseMove={makeTiltHandler(setCardTilt2)}
            onMouseLeave={resetCardTilt(setCardTilt2)}
            style={{ transform: `perspective(800px) rotateX(${cardTilt2.y}deg) rotateY(${cardTilt2.x}deg)` }}
            className="relative bg-white rounded-2xl shadow-lg dark:shadow-lg p-6 space-y-5 border border-green-100"
          >
            {showProgress && (
              <div className="absolute inset-0 bg-white bg-opacity-60 dark:bg-gray-900 dark:bg-opacity-60 flex items-center justify-center rounded-2xl z-20">
                <Loader2 className="w-6 h-6 animate-spin text-green-600" />
                <span className="ml-2 text-green-600 font-medium">Cleaning…</span>
              </div>
            )}
            <h2 className="text-2xl font-semibold text-green-800">Narrative Editor</h2>
            <textarea
              rows={5}
              className="w-full p-3 bg-white text-black border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
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
            <div className="flex items-center gap-4">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleNarrative}
                className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition flex items-center gap-2"
              >
                <Wand2 className="w-5 h-5" />
                Clean with AI
              </motion.button>
              {narrative && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setNarrative("")}
                  className="cursor-pointer bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition flex items-center gap-2"
                >
                  <X className="w-5 h-5" />
                  Clear
                </motion.button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 italic">
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
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>

              {editedNarrative && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 1 }}
                className="border border-green-300 rounded-xl p-4 pr-28 bg-white text-black whitespace-pre-wrap relative"
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
                  className="cursor-pointer absolute top-3 right-3 bg-green-600 hover:bg-green-700 text-white p-2 rounded-lg text-sm flex items-center gap-1 shadow-md"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2M16 8h2a2 2 0 012 2v8a2 2 0 01-2 2h-8a2 2 0 01-2-2v-2"
                    />
                  </svg>
                  {copied ? "Copied" : "Copy"}
                </motion.button>
                {editedNarrative}
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}