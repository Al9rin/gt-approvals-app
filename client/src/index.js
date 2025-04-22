import React from "react";
import ReactDOM from "react-dom/client";
import App from "./GTApprovalsApp";

// Import a global CSS or Tailwind, depending on your setup
import "./index.css";  // <-- Make sure this exists and includes styles

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);