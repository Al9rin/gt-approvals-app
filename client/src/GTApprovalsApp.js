import { useState } from "react";
import Select from "react-select";
import licenses from "./licenses.json";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Search, Wand2 } from "lucide-react";

const stateOptions = Array.from(
  new Set(Object.keys(licenses).map((key) => key.split("_")[0]))
).map((s) => ({ value: s, label: s }));

export default function GTApprovalsApp() {
  const [state, setState] = useState(null);
  const [license, setLicense] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [narrative, setNarrative] = useState("");
  const [editedNarrative, setEditedNarrative] = useState("");

  const useAI = true;

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
      setLoading(false);
    }
  };

  const handleNarrative = () => {
    setEditedNarrative("");
    setLoading(true);
    cleanWithAI(narrative);
  };

  return (
    <div className="min-h-screen bg-gradient-to-tr from-green-50 to-white text-gray-800 py-10 px-4">
      <div className="max-w-4xl mx-auto space-y-10">
        <motion.div
  initial={{ opacity: 0, y: -10 }}
  animate={{ opacity: 1, y: 0 }}
  className="flex justify-center"
>
  <img
    src="/image.png"
    alt="GoodTherapy Approvals"
    className="mx-auto w-43 mb-2"
  />
</motion.div>

        {/* Dropdown Section */}
        <div className="bg-white rounded-2xl shadow p-6 space-y-5 border border-green-100">
          <div>
            <label className="block mb-1 text-sm font-semibold text-gray-700">
              Select State
            </label>
            <Select
              options={stateOptions}
              value={state}
              onChange={(selected) => {
                setState(selected);
                setLicense(null);
              }}
              placeholder="Start typing a state..."
              className="text-black"
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
              className="text-black"
              isDisabled={!state}
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={search}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-xl font-semibold transition flex items-center justify-center gap-2"
          >
            <Search className="w-5 h-5" />
            Search
          </motion.button>

          <AnimatePresence>
            {loading && (
              <motion.div
                key="search-loader"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center mt-4"
              >
                <div className="w-6 h-6 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
              </motion.div>
            )}
          </AnimatePresence>

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 border p-4 rounded-xl border-green-400 bg-green-50 text-green-900"
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
        </div>

        {/* Narrative Editor */}
        <div className="bg-white rounded-2xl shadow p-6 space-y-5 border border-green-100">
          <h2 className="text-2xl font-semibold text-green-800">Narrative Editor</h2>
          <textarea
            rows={5}
            className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-400"
            placeholder="Paste your narrative here..."
            value={narrative}
            onChange={(e) => setNarrative(e.target.value)}
          />
          <div className="flex items-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleNarrative}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-xl font-medium transition flex items-center gap-2"
            >
              <Wand2 className="w-5 h-5" />
              Clean Narrative
            </motion.button>
          </div>

          <AnimatePresence>
  {loading && (
    <motion.div
      key="search-loader"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex justify-center"
    >
      <div className="dot-loader mt-4">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </motion.div>
  )}
</AnimatePresence>

          {editedNarrative && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 1 }}
              className="border border-green-300 rounded-xl p-4 bg-green-50 whitespace-pre-wrap"
            >
              {editedNarrative}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}