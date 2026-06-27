import ReactDOM from "react-dom/client";
import App from "./App";
import "@xterm/xterm/css/xterm.css";
import "./index.css";

// 刻意不用 React.StrictMode —— dev 下二次挂载 effect 会让 xterm 重复订阅/建连。
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(<App />);
