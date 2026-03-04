import { useState, useEffect, useRef } from "react";
import Select from "react-select";
import CreatableSelect from "react-select/creatable";
import licenses from "./licenses.json";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, Wand2, Sun, Moon, X, Loader2, ExternalLink, ClipboardCopy, Check, MapPin, Leaf, Globe, FileText } from "lucide-react";
import { Analytics } from '@vercel/analytics/react';

const DEFAULT_PRODUCTION_API_BASE_URL = "https://gt-approvals-app.onrender.com";
const API_BASE_URL = (
  process.env.REACT_APP_API_BASE_URL
  || (process.env.NODE_ENV === "production" ? DEFAULT_PRODUCTION_API_BASE_URL : "")
).replace(/\/$/, "");

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

const CITY_OPTIONS = [
  // United States
  { value: "Anchorage, AK", label: "Anchorage, AK" },
  { value: "Birmingham, AL", label: "Birmingham, AL" },
  { value: "Huntsville, AL", label: "Huntsville, AL" },
  { value: "Montgomery, AL", label: "Montgomery, AL" },
  { value: "Fayetteville, AR", label: "Fayetteville, AR" },
  { value: "Little Rock, AR", label: "Little Rock, AR" },
  { value: "Chandler, AZ", label: "Chandler, AZ" },
  { value: "Mesa, AZ", label: "Mesa, AZ" },
  { value: "Phoenix, AZ", label: "Phoenix, AZ" },
  { value: "Scottsdale, AZ", label: "Scottsdale, AZ" },
  { value: "Tempe, AZ", label: "Tempe, AZ" },
  { value: "Tucson, AZ", label: "Tucson, AZ" },
  { value: "Anaheim, CA", label: "Anaheim, CA" },
  { value: "Berkeley, CA", label: "Berkeley, CA" },
  { value: "Fresno, CA", label: "Fresno, CA" },
  { value: "Irvine, CA", label: "Irvine, CA" },
  { value: "Long Beach, CA", label: "Long Beach, CA" },
  { value: "Los Angeles, CA", label: "Los Angeles, CA" },
  { value: "Oakland, CA", label: "Oakland, CA" },
  { value: "Pasadena, CA", label: "Pasadena, CA" },
  { value: "Riverside, CA", label: "Riverside, CA" },
  { value: "Sacramento, CA", label: "Sacramento, CA" },
  { value: "San Diego, CA", label: "San Diego, CA" },
  { value: "San Francisco, CA", label: "San Francisco, CA" },
  { value: "San Jose, CA", label: "San Jose, CA" },
  { value: "Santa Ana, CA", label: "Santa Ana, CA" },
  { value: "Santa Barbara, CA", label: "Santa Barbara, CA" },
  { value: "Aurora, CO", label: "Aurora, CO" },
  { value: "Boulder, CO", label: "Boulder, CO" },
  { value: "Colorado Springs, CO", label: "Colorado Springs, CO" },
  { value: "Denver, CO", label: "Denver, CO" },
  { value: "Fort Collins, CO", label: "Fort Collins, CO" },
  { value: "Bridgeport, CT", label: "Bridgeport, CT" },
  { value: "Hartford, CT", label: "Hartford, CT" },
  { value: "New Haven, CT", label: "New Haven, CT" },
  { value: "Stamford, CT", label: "Stamford, CT" },
  { value: "Washington, DC", label: "Washington, DC" },
  { value: "Wilmington, DE", label: "Wilmington, DE" },
  { value: "Boca Raton, FL", label: "Boca Raton, FL" },
  { value: "Fort Lauderdale, FL", label: "Fort Lauderdale, FL" },
  { value: "Gainesville, FL", label: "Gainesville, FL" },
  { value: "Jacksonville, FL", label: "Jacksonville, FL" },
  { value: "Miami, FL", label: "Miami, FL" },
  { value: "Naples, FL", label: "Naples, FL" },
  { value: "Orlando, FL", label: "Orlando, FL" },
  { value: "St. Petersburg, FL", label: "St. Petersburg, FL" },
  { value: "Tallahassee, FL", label: "Tallahassee, FL" },
  { value: "Tampa, FL", label: "Tampa, FL" },
  { value: "Atlanta, GA", label: "Atlanta, GA" },
  { value: "Augusta, GA", label: "Augusta, GA" },
  { value: "Savannah, GA", label: "Savannah, GA" },
  { value: "Honolulu, HI", label: "Honolulu, HI" },
  { value: "Boise, ID", label: "Boise, ID" },
  { value: "Aurora, IL", label: "Aurora, IL" },
  { value: "Chicago, IL", label: "Chicago, IL" },
  { value: "Evanston, IL", label: "Evanston, IL" },
  { value: "Naperville, IL", label: "Naperville, IL" },
  { value: "Rockford, IL", label: "Rockford, IL" },
  { value: "Springfield, IL", label: "Springfield, IL" },
  { value: "Bloomington, IN", label: "Bloomington, IN" },
  { value: "Fort Wayne, IN", label: "Fort Wayne, IN" },
  { value: "Indianapolis, IN", label: "Indianapolis, IN" },
  { value: "South Bend, IN", label: "South Bend, IN" },
  { value: "Cedar Rapids, IA", label: "Cedar Rapids, IA" },
  { value: "Des Moines, IA", label: "Des Moines, IA" },
  { value: "Overland Park, KS", label: "Overland Park, KS" },
  { value: "Wichita, KS", label: "Wichita, KS" },
  { value: "Lexington, KY", label: "Lexington, KY" },
  { value: "Louisville, KY", label: "Louisville, KY" },
  { value: "Baton Rouge, LA", label: "Baton Rouge, LA" },
  { value: "New Orleans, LA", label: "New Orleans, LA" },
  { value: "Shreveport, LA", label: "Shreveport, LA" },
  { value: "Portland, ME", label: "Portland, ME" },
  { value: "Annapolis, MD", label: "Annapolis, MD" },
  { value: "Baltimore, MD", label: "Baltimore, MD" },
  { value: "Boston, MA", label: "Boston, MA" },
  { value: "Cambridge, MA", label: "Cambridge, MA" },
  { value: "Lowell, MA", label: "Lowell, MA" },
  { value: "Springfield, MA", label: "Springfield, MA" },
  { value: "Worcester, MA", label: "Worcester, MA" },
  { value: "Ann Arbor, MI", label: "Ann Arbor, MI" },
  { value: "Detroit, MI", label: "Detroit, MI" },
  { value: "Grand Rapids, MI", label: "Grand Rapids, MI" },
  { value: "Lansing, MI", label: "Lansing, MI" },
  { value: "Bloomington, MN", label: "Bloomington, MN" },
  { value: "Duluth, MN", label: "Duluth, MN" },
  { value: "Minneapolis, MN", label: "Minneapolis, MN" },
  { value: "Saint Paul, MN", label: "Saint Paul, MN" },
  { value: "Jackson, MS", label: "Jackson, MS" },
  { value: "Kansas City, MO", label: "Kansas City, MO" },
  { value: "St. Louis, MO", label: "St. Louis, MO" },
  { value: "Springfield, MO", label: "Springfield, MO" },
  { value: "Billings, MT", label: "Billings, MT" },
  { value: "Missoula, MT", label: "Missoula, MT" },
  { value: "Lincoln, NE", label: "Lincoln, NE" },
  { value: "Omaha, NE", label: "Omaha, NE" },
  { value: "Henderson, NV", label: "Henderson, NV" },
  { value: "Las Vegas, NV", label: "Las Vegas, NV" },
  { value: "Reno, NV", label: "Reno, NV" },
  { value: "Concord, NH", label: "Concord, NH" },
  { value: "Manchester, NH", label: "Manchester, NH" },
  { value: "Hoboken, NJ", label: "Hoboken, NJ" },
  { value: "Jersey City, NJ", label: "Jersey City, NJ" },
  { value: "Newark, NJ", label: "Newark, NJ" },
  { value: "Trenton, NJ", label: "Trenton, NJ" },
  { value: "Albuquerque, NM", label: "Albuquerque, NM" },
  { value: "Santa Fe, NM", label: "Santa Fe, NM" },
  { value: "Albany, NY", label: "Albany, NY" },
  { value: "Buffalo, NY", label: "Buffalo, NY" },
  { value: "New York City, NY", label: "New York City, NY" },
  { value: "Rochester, NY", label: "Rochester, NY" },
  { value: "Syracuse, NY", label: "Syracuse, NY" },
  { value: "Asheville, NC", label: "Asheville, NC" },
  { value: "Charlotte, NC", label: "Charlotte, NC" },
  { value: "Durham, NC", label: "Durham, NC" },
  { value: "Greensboro, NC", label: "Greensboro, NC" },
  { value: "Raleigh, NC", label: "Raleigh, NC" },
  { value: "Winston-Salem, NC", label: "Winston-Salem, NC" },
  { value: "Bismarck, ND", label: "Bismarck, ND" },
  { value: "Fargo, ND", label: "Fargo, ND" },
  { value: "Akron, OH", label: "Akron, OH" },
  { value: "Cincinnati, OH", label: "Cincinnati, OH" },
  { value: "Cleveland, OH", label: "Cleveland, OH" },
  { value: "Columbus, OH", label: "Columbus, OH" },
  { value: "Dayton, OH", label: "Dayton, OH" },
  { value: "Toledo, OH", label: "Toledo, OH" },
  { value: "Oklahoma City, OK", label: "Oklahoma City, OK" },
  { value: "Tulsa, OK", label: "Tulsa, OK" },
  { value: "Bend, OR", label: "Bend, OR" },
  { value: "Eugene, OR", label: "Eugene, OR" },
  { value: "Portland, OR", label: "Portland, OR" },
  { value: "Salem, OR", label: "Salem, OR" },
  { value: "Allentown, PA", label: "Allentown, PA" },
  { value: "Erie, PA", label: "Erie, PA" },
  { value: "Harrisburg, PA", label: "Harrisburg, PA" },
  { value: "Philadelphia, PA", label: "Philadelphia, PA" },
  { value: "Pittsburgh, PA", label: "Pittsburgh, PA" },
  { value: "Providence, RI", label: "Providence, RI" },
  { value: "Charleston, SC", label: "Charleston, SC" },
  { value: "Columbia, SC", label: "Columbia, SC" },
  { value: "Greenville, SC", label: "Greenville, SC" },
  { value: "Sioux Falls, SD", label: "Sioux Falls, SD" },
  { value: "Chattanooga, TN", label: "Chattanooga, TN" },
  { value: "Knoxville, TN", label: "Knoxville, TN" },
  { value: "Memphis, TN", label: "Memphis, TN" },
  { value: "Nashville, TN", label: "Nashville, TN" },
  { value: "Arlington, TX", label: "Arlington, TX" },
  { value: "Austin, TX", label: "Austin, TX" },
  { value: "Corpus Christi, TX", label: "Corpus Christi, TX" },
  { value: "Dallas, TX", label: "Dallas, TX" },
  { value: "El Paso, TX", label: "El Paso, TX" },
  { value: "Fort Worth, TX", label: "Fort Worth, TX" },
  { value: "Houston, TX", label: "Houston, TX" },
  { value: "Plano, TX", label: "Plano, TX" },
  { value: "San Antonio, TX", label: "San Antonio, TX" },
  { value: "Ogden, UT", label: "Ogden, UT" },
  { value: "Provo, UT", label: "Provo, UT" },
  { value: "Salt Lake City, UT", label: "Salt Lake City, UT" },
  { value: "Burlington, VT", label: "Burlington, VT" },
  { value: "Alexandria, VA", label: "Alexandria, VA" },
  { value: "Arlington, VA", label: "Arlington, VA" },
  { value: "Charlottesville, VA", label: "Charlottesville, VA" },
  { value: "Norfolk, VA", label: "Norfolk, VA" },
  { value: "Richmond, VA", label: "Richmond, VA" },
  { value: "Virginia Beach, VA", label: "Virginia Beach, VA" },
  { value: "Bellevue, WA", label: "Bellevue, WA" },
  { value: "Kirkland, WA", label: "Kirkland, WA" },
  { value: "Olympia, WA", label: "Olympia, WA" },
  { value: "Redmond, WA", label: "Redmond, WA" },
  { value: "Seattle, WA", label: "Seattle, WA" },
  { value: "Spokane, WA", label: "Spokane, WA" },
  { value: "Tacoma, WA", label: "Tacoma, WA" },
  { value: "Charleston, WV", label: "Charleston, WV" },
  { value: "Morgantown, WV", label: "Morgantown, WV" },
  { value: "Green Bay, WI", label: "Green Bay, WI" },
  { value: "Madison, WI", label: "Madison, WI" },
  { value: "Milwaukee, WI", label: "Milwaukee, WI" },
  { value: "Cheyenne, WY", label: "Cheyenne, WY" },
  // Canada
  { value: "Calgary, AB", label: "Calgary, AB" },
  { value: "Edmonton, AB", label: "Edmonton, AB" },
  { value: "Lethbridge, AB", label: "Lethbridge, AB" },
  { value: "Red Deer, AB", label: "Red Deer, AB" },
  { value: "Abbotsford, BC", label: "Abbotsford, BC" },
  { value: "Burnaby, BC", label: "Burnaby, BC" },
  { value: "Kamloops, BC", label: "Kamloops, BC" },
  { value: "Kelowna, BC", label: "Kelowna, BC" },
  { value: "Richmond, BC", label: "Richmond, BC" },
  { value: "Surrey, BC", label: "Surrey, BC" },
  { value: "Vancouver, BC", label: "Vancouver, BC" },
  { value: "Victoria, BC", label: "Victoria, BC" },
  { value: "Brandon, MB", label: "Brandon, MB" },
  { value: "Winnipeg, MB", label: "Winnipeg, MB" },
  { value: "Fredericton, NB", label: "Fredericton, NB" },
  { value: "Moncton, NB", label: "Moncton, NB" },
  { value: "Saint John, NB", label: "Saint John, NB" },
  { value: "St. John's, NL", label: "St. John's, NL" },
  { value: "Halifax, NS", label: "Halifax, NS" },
  { value: "Barrie, ON", label: "Barrie, ON" },
  { value: "Brampton, ON", label: "Brampton, ON" },
  { value: "Hamilton, ON", label: "Hamilton, ON" },
  { value: "Kitchener, ON", label: "Kitchener, ON" },
  { value: "London, ON", label: "London, ON" },
  { value: "Markham, ON", label: "Markham, ON" },
  { value: "Mississauga, ON", label: "Mississauga, ON" },
  { value: "Ottawa, ON", label: "Ottawa, ON" },
  { value: "Sudbury, ON", label: "Sudbury, ON" },
  { value: "Thunder Bay, ON", label: "Thunder Bay, ON" },
  { value: "Toronto, ON", label: "Toronto, ON" },
  { value: "Vaughan, ON", label: "Vaughan, ON" },
  { value: "Waterloo, ON", label: "Waterloo, ON" },
  { value: "Windsor, ON", label: "Windsor, ON" },
  { value: "Charlottetown, PE", label: "Charlottetown, PE" },
  { value: "Gatineau, QC", label: "Gatineau, QC" },
  { value: "Laval, QC", label: "Laval, QC" },
  { value: "Montreal, QC", label: "Montreal, QC" },
  { value: "Quebec City, QC", label: "Quebec City, QC" },
  { value: "Sherbrooke, QC", label: "Sherbrooke, QC" },
  { value: "Regina, SK", label: "Regina, SK" },
  { value: "Saskatoon, SK", label: "Saskatoon, SK" },
  { value: "Whitehorse, YT", label: "Whitehorse, YT" },
];

/* ── react-select styles (match card surface in dark) ──────────────────── */
const selectStyles = (dark) => ({
  control: (base, s) => ({
    ...base,
    cursor: 'pointer',
    borderRadius: '0.75rem',
    borderColor: s.isFocused ? (dark ? '#E06D00' : '#A2AD1A') : dark ? 'rgba(255,255,255,0.1)' : '#e5e5e5',
    backgroundColor: dark ? '#26262a' : '#fff',
    boxShadow: s.isFocused ? (dark ? '0 0 0 2px rgba(224,109,0,0.3)' : '0 0 0 2px rgba(162,173,26,0.25)') : 'none',
    minHeight: 42,
    '&:hover': { borderColor: dark ? 'rgba(224,109,0,0.5)' : '#A2AD1A' },
    padding: '2px 8px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }),
  option: (base, s) => ({
    ...base,
    cursor: 'pointer',
    backgroundColor: s.isSelected
      ? (dark ? '#E06D00' : '#A2AD1A')
      : s.isFocused
        ? dark ? 'rgba(255,255,255,0.08)' : '#F7F8EC'
        : dark ? '#26262a' : '#fff',
    color: s.isSelected ? '#fff' : dark ? '#e4e4e7' : '#333',
    '&:active': { backgroundColor: s.isSelected ? (dark ? '#C05D00' : '#C5CE5C') : undefined },
  }),
  menu: (base) => ({
    ...base,
    borderRadius: '0.75rem',
    overflow: 'hidden',
    border: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(162,173,26,0.15)',
    boxShadow: dark ? '0 8px 32px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.08)',
    backgroundColor: dark ? '#26262a' : '#fff',
  }),
  menuList: (base) => ({
    ...base,
    padding: 4,
  }),
  singleValue: (base) => ({
    ...base,
    color: dark ? '#e4e4e7' : '#333',
  }),
  placeholder: (base) => ({
    ...base,
    color: dark ? '#71717a' : '#999',
  }),
  input: (base) => ({
    ...base,
    color: dark ? '#e4e4e7' : '#333',
  }),
  multiValue: (base) => ({
    ...base,
    backgroundColor: dark ? 'rgba(224,109,0,0.18)' : 'rgba(162,173,26,0.15)',
    borderRadius: '0.5rem',
  }),
  multiValueLabel: (base) => ({
    ...base,
    color: dark ? '#fbbf7c' : '#5a6400',
    fontWeight: 500,
    fontSize: '0.8125rem',
  }),
  multiValueRemove: (base) => ({
    ...base,
    color: dark ? '#fbbf7c' : '#5a6400',
    borderRadius: '0 0.5rem 0.5rem 0',
    '&:hover': {
      backgroundColor: dark ? 'rgba(224,109,0,0.35)' : 'rgba(162,173,26,0.3)',
      color: dark ? '#fff' : '#3a4200',
    },
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
  const [aiMode, setAiMode] = useState("editorial");
  const [editsSummary, setEditsSummary] = useState([]);
  const [city, setCity] = useState([]);
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [narrativeState, setNarrativeState] = useState(null);
  const [narrativeLicense, setNarrativeLicense] = useState(null);
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

  const getLicenseOptions = (stateValue) => {
    if (!stateValue) return [];
    const filteredKeys = Object.keys(licenses).filter((key) =>
      key.startsWith(`${stateValue}_`)
    );
    const licenseSet = new Set(filteredKeys.map((key) => key.split("_")[1]));
    return Array.from(licenseSet).map((l) => ({ value: l, label: l }));
  };

  const getFilteredLicenseOptions = () => getLicenseOptions(state?.value);

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

  const cleanWithAI = async (text, mode) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/clean-narrative`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          narrative: text,
          state: narrativeState?.value || "",
          license: narrativeLicense?.value || "",
          mode,
          city: city.map((c) => c.value).join(", "),
          websiteUrl: websiteUrl.trim(),
        }),
      });

      const raw = await res.text();
      let data = {};
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          data = {};
        }
      }
      if (!res.ok) {
        throw new Error(
          data.error
          || (mode === "geo" ? "Failed to generate AI-Ready version" : mode === "seo" ? "Failed to generate SEO version" : "Failed to clean narrative")
        );
      }

      const cleaned = data.cleaned || "";
      setEditedNarrative(cleaned.trim());
      if (mode === "seo" || mode === "geo") {
        setEditsSummary(Array.isArray(data.editsSummary) ? data.editsSummary : []);
      } else {
        setEditsSummary([]);
      }
      toast.success(
        mode === "geo" ? "AI-Ready version created"
        : mode === "seo" ? "SEO version created"
        : "Narrative cleaned with AI"
      );
    } catch (err) {
      console.error("AI Error:", err);
      toast.error(err.message || (mode === "geo" ? "Failed to generate AI-Ready version" : mode === "seo" ? "Failed to generate SEO version" : "Failed to clean with AI"));
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

  const handleNarrative = (mode = "editorial") => {
    const sourceText = (mode === "seo" || mode === "geo") && editedNarrative.trim()
      ? editedNarrative
      : narrative;

    if (!sourceText.trim()) {
      toast.error("Paste a narrative first.");
      return;
    }

    setAiMode(mode);
    setEditsSummary([]);
    setEditedNarrative("");
    setLoading(true);
    setProgress(0);
    setShowProgress(true);

    // simulate progress
    progressRef.current = setInterval(() => {
      setProgress((p) => (p < 90 ? p + 10 : p));
    }, 200);

    cleanWithAI(sourceText, mode);
  };

  return (
    <div className={`min-h-screen font-sans transition-colors duration-350 ${darkMode
        ? "bg-black text-gray-100"
        : "bg-gradient-to-br from-gt-green-50 via-white to-gt-green-50 text-gt-gray"
      } pt-24 py-6 px-4`}>
      {/* ── Progress bar ────────────────────────────────────────── */}
      {showProgress && (
        <div className="fixed top-0 left-0 w-full z-[60]">
          <div
            className={`h-1 transition-all duration-200 ease-out ${darkMode ? "bg-gt-orange" : "bg-gt-green"}`}
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

          {/* Dark mode toggle */}
          <div className="flex items-center gap-2 select-none">
            <Sun className={`w-4 h-4 transition-colors duration-250 ${darkMode ? "text-gray-500" : "text-amber-500"}`} />
            <motion.button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="cursor-pointer relative inline-block w-11 h-6 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-gt-green/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              initial={false}
              animate={{
                backgroundColor: darkMode ? "#A2AD1A" : "#d4d4d8",
              }}
              transition={{ duration: 0.25 }}
            >
              <motion.span
                className="absolute top-1 left-1 h-4 w-4 bg-white rounded-full shadow-sm"
                layout
                style={{ x: darkMode ? 22 : 0 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </motion.button>
            <Moon className={`w-4 h-4 transition-colors duration-250 ${darkMode ? "text-gt-green-light" : "text-gray-400"}`} />
          </div>
        </div>
      </header>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className={`max-w-4xl mx-auto space-y-8 ${darkMode ? "text-gray-100" : ""}`}
      >
        {/* ── Page Title ───────────────────────────────────────── */}
        <motion.div
          variants={itemVariants}
          className="text-center space-y-2"
          style={darkMode ? { color: "#ffffff" } : undefined}
        >
          <h1
            className="font-display text-3xl md:text-4xl font-semibold tracking-tight"
            style={darkMode ? { color: "#ffffff" } : undefined}
          >
            License Verification
          </h1>
          <p className={`text-sm md:text-base ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
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
            className="glass-card rounded-2xl p-6 space-y-5 transition-transform duration-250"
          >
            {/* Region filter buttons */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { key: "us", label: "United States", Icon: MapPin },
                { key: "ca", label: "Canada", Icon: Leaf },
                { key: "intl", label: "International", Icon: Globe }
              ].map(({ key, label, Icon }) => (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  key={key}
                  type="button"
                  onClick={() =>
                    setRegionFilter(prev => ({ ...prev, [key]: !prev[key] }))
                  }
                  className={`inline-flex cursor-pointer items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent
                    ${regionFilter[key]
                      ? darkMode
                        ? "bg-gt-orange text-white border-gt-orange shadow-sm focus-visible:ring-gt-orange/50"
                        : "bg-gt-green text-white border-gt-green shadow-sm focus-visible:ring-gt-green/40"
                      : darkMode
                        ? "bg-white/5 text-gray-300 border-white/10 hover:bg-white/10 hover:border-gt-orange/40 focus-visible:ring-gt-orange/40"
                        : "bg-white text-gt-gray border-gray-200/80 hover:border-gt-green/40 hover:bg-gt-green-50/50 focus-visible:ring-gt-green/40"
                    }
                  `}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
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
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={search}
              className={`cursor-pointer w-full text-white py-3 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-sm hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${darkMode
                ? "bg-gt-orange hover:bg-gt-orange-dark focus-visible:ring-gt-orange/50"
                : "bg-gt-green hover:bg-gt-green-dark focus-visible:ring-gt-green/50"
              }`}
            >
              <Search className="w-5 h-5 shrink-0" />
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
                className={`mt-4 rounded-xl overflow-hidden border ${darkMode
                    ? "bg-white/[0.04] border-white/10"
                    : "bg-gt-green-50 border-gt-green/20"
                  }`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 w-1 h-full min-h-[20px] rounded-full flex-shrink-0 ${darkMode ? "bg-gt-orange" : "bg-gt-green"}`} />
                    <div className="space-y-2">
                      <p className={`text-sm font-medium ${darkMode ? 'text-gray-200' : 'text-gt-gray'}`}>
                        <span className="font-bold">Requirements: </span>
                        {result.requirements}
                      </p>
                      <a
                        href={result.verificationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 rounded ${darkMode
                          ? "text-gt-orange hover:text-gt-orange-dark focus-visible:ring-gt-orange/40"
                          : "text-gt-green hover:text-gt-green-dark focus-visible:ring-gt-green/40"
                        }`}
                      >
                        <ExternalLink className="w-4 h-4 shrink-0" />
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
            <div className={`flex-1 h-px transition-colors duration-250 ${darkMode ? "bg-white/10" : "bg-gt-green/15"}`} />
            <span className={`text-xs font-medium uppercase tracking-widest ${darkMode ? "text-gray-500" : "text-gt-green/60"}`}>
              Tools
            </span>
            <div className={`flex-1 h-px transition-colors duration-250 ${darkMode ? "bg-white/10" : "bg-gt-green/15"}`} />
          </div>

          {/* ── Narrative Editor ───────────────────────────────── */}
          <motion.div
            variants={itemVariants}
            onMouseMove={makeTiltHandler(setCardTilt2)}
            onMouseLeave={resetCardTilt(setCardTilt2)}
            style={{ transform: `perspective(800px) rotateX(${cardTilt2.y}deg) rotateY(${cardTilt2.x}deg)` }}
            className="relative glass-card rounded-2xl p-6 space-y-5 transition-transform duration-250"
          >
            {showProgress && (
              <div className={`absolute inset-0 backdrop-blur-sm flex items-center justify-center rounded-2xl z-20 ${darkMode ? "bg-black/80" : "bg-white/80"}`}>
                <Loader2 className="w-6 h-6 animate-spin text-gt-green shrink-0" />
                <span className="ml-2 text-gt-green font-medium">
                  {aiMode === "seo" ? "Adding SEO..." : "Cleaning..."}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <FileText className={`w-6 h-6 shrink-0 ${darkMode ? "text-gt-green-light" : "text-gt-green-darker"}`} />
              <h2 className={`font-display text-2xl font-semibold ${darkMode ? "text-white" : "text-gt-gray"}`}>
                Narrative Editor
              </h2>
            </div>
            <p className={`text-sm -mt-1 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              Clean with AI for grammar and editorial polish, or Add SEO for keyword-aware optimization with AI-citation structure
            </p>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className={`block mb-1.5 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gt-gray'}`}>
                  Location context (optional)
                </label>
                <Select
                  options={stateOptions}
                  value={narrativeState}
                  onChange={(s) => { setNarrativeState(s); setNarrativeLicense(null); }}
                  placeholder="Select state..."
                  styles={selectStyles(darkMode)}
                  isClearable
                />
              </div>
              <div className="flex-1">
                <label className={`block mb-1.5 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gt-gray'}`}>
                  License (optional)
                </label>
                <Select
                  options={getLicenseOptions(narrativeState?.value)}
                  value={narrativeLicense}
                  onChange={setNarrativeLicense}
                  placeholder="Select license..."
                  styles={selectStyles(darkMode)}
                  isDisabled={!narrativeState}
                  isClearable
                />
              </div>
            </div>

            <textarea
              rows={5}
              className={`w-full p-4 rounded-xl border focus:outline-none focus:ring-2 focus:ring-gt-green/35 focus:border-gt-green transition-all duration-200 resize-none text-sm leading-relaxed placeholder:transition-colors ${darkMode
                  ? "bg-white/[0.04] text-gray-100 border-white/10 placeholder:text-gray-500"
                  : "bg-white text-gt-gray border-gray-200/90 placeholder:text-gray-400"
                }`}
              placeholder="Paste your narrative here..."
              value={narrative}
              onChange={(e) => {
                setNarrative(e.target.value);
                setEditsSummary([]);
              }}
              onKeyDown={(e) => {
                // ⌘/Ctrl + Enter to clean with AI
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleNarrative("editorial");
                }
                // Esc to clear narrative
                else if (e.key === "Escape") {
                  setNarrative("");
                }
              }}
            />

            <div>
              <label className={`block mb-1.5 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gt-gray'}`}>
                City (optional)
              </label>
              <CreatableSelect
                isMulti
                options={CITY_OPTIONS}
                value={city}
                onChange={setCity}
                placeholder="Add cities served..."
                styles={selectStyles(darkMode)}
                formatCreateLabel={(input) => `Add "${input}"`}
                noOptionsMessage={() => "Type a city name"}
              />
            </div>

            <div>
              <label className={`block mb-1.5 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gt-gray'}`}>
                Therapist website (optional)
              </label>
              <input
                type="url"
                className={`w-full p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-gt-green/35 focus:border-gt-green transition-all duration-200 text-sm placeholder:transition-colors ${darkMode
                    ? "bg-white/[0.04] text-gray-100 border-white/10 placeholder:text-gray-500"
                    : "bg-white text-gt-gray border-gray-200/90 placeholder:text-gray-400"
                  }`}
                placeholder="https://therapistwebsite.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <p className={`mt-1 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Page content will be used as additional context for AI editing.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleNarrative("editorial")}
                className={`cursor-pointer text-white px-5 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 shadow-sm hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${darkMode
                  ? "bg-gt-orange hover:bg-gt-orange-dark focus-visible:ring-gt-orange/50"
                  : "bg-gt-green hover:bg-gt-green-dark focus-visible:ring-gt-green/50"
                }`}
              >
                <Wand2 className="w-5 h-5 shrink-0" />
                Clean with AI
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleNarrative("seo")}
                className={`cursor-pointer px-5 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 border focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${darkMode
                    ? "bg-white/[0.06] hover:bg-gt-orange/10 text-gray-100 border-gt-orange/30 hover:border-gt-orange/50 focus-visible:ring-gt-orange/40"
                    : "bg-white hover:bg-gt-green-50/80 text-gt-gray border-gray-200/90 hover:border-gt-green/30 focus-visible:ring-gt-green/40"
                  }`}
              >
                <Search className="w-5 h-5 shrink-0" />
                Add SEO
              </motion.button>
              {narrative && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setNarrative("")}
                  className={`cursor-pointer px-4 py-2.5 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 border focus:outline-none focus-visible:ring-2 focus-visible:ring-gt-green/40 focus-visible:ring-offset-2 ${darkMode
                      ? "border-white/10 text-gray-400 hover:bg-white/5 hover:text-gray-200"
                      : "border-gray-200 text-gt-gray hover:bg-gray-50"
                    }`}
                >
                  <X className="w-4 h-4 shrink-0" />
                  Clear
                </motion.button>
              )}
            </div>

            <p className={`mt-1 text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              `Clean with AI` applies grammar and GoodTherapy editorial rules only. `Add SEO` weaves in keywords and structures the narrative for AI citation readiness.
            </p>

            <p className={`mt-1 text-xs italic ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              Avoid pasting client names, PHI, or sensitive case details. ⌘/Ctrl + Enter to clean · Esc to clear
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
                transition={{ duration: 0.3, ease: "easeOut" }}
                className={`relative rounded-xl p-4 pr-24 whitespace-pre-wrap text-sm leading-relaxed border ${darkMode
                    ? "bg-[#26262a] border-white/10 text-gray-100"
                    : "bg-[#f2f3ec] border-gt-green/25 text-gt-gray"
                  }`}
              >
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  onClick={() => {
                    navigator.clipboard.writeText(editedNarrative).then(() => {
                      setCopied(true);
                      toast.success("Copied to clipboard");
                      setTimeout(() => setCopied(false), 2000);
                    });
                  }}
                  className={`cursor-pointer absolute top-3 right-3 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 shadow-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${darkMode
                    ? "bg-gt-orange hover:bg-gt-orange-dark"
                    : "bg-gt-green hover:bg-gt-green-dark"
                  }`}
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

            {editedNarrative && (aiMode === "seo" || aiMode === "geo") && editsSummary.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`mt-4 rounded-xl p-4 border ${darkMode
                  ? "bg-white/[0.03] border-white/10 text-gray-300"
                  : "bg-gt-green-50/80 border-gt-green/20 text-gt-gray"
                }`}
              >
                <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${darkMode ? "text-gray-500" : "text-gray-500"}`}>
                  Edits applied
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {editsSummary.map((item, i) => (
                    <li
                      key={i}
                      className={item.startsWith("Keyword phrases used:") ? "font-semibold" : ""}
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </motion.div>
        </div>
      </motion.div>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className={`mt-16 pb-6 text-center text-xs transition-colors duration-250 ${darkMode ? "text-gray-500" : "text-gray-400"}`}>
        © {new Date().getFullYear()} GoodTherapy · Approvals Tool
      </footer>
    </div>
  );
}
