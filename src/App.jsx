import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import PoseFeedback from "./PoseFeedback";

function App() {
  const [count, setCount] = useState(0);

  return (
    <>
      <PoseFeedback />
    </>
  );
}

export default App;
