import React, { useCallback, useEffect, useState } from "react";
import { FluentProvider, webLightTheme, webDarkTheme, makeStyles, tokens } from "@fluentui/react-components";

import { useToolboxEvents } from "./hooks/useToolboxAPI";
import { ViewModel } from "./model/viewModel";
import { SolutionTransferTool } from "./components/solutionTransferTool";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: tokens.colorNeutralBackground1,
    overflow: "hidden",
  },
  content: {
    flex: 1,
    overflow: "auto",
    padding: tokens.spacingVerticalM,
  },
});

function App() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  const styles = useStyles();
  const [vm] = useState(() => new ViewModel());

  const handleEvent = useCallback(
    (event: string, data: any) => {
      switch (event) {
        case "connection:updated":
        case "connection:created":
        case "connection:deleted":
          void vm.refreshConnections().then(() => vm.loadSolutions());
          break;
        case "settings:updated":
          if (data && data.theme) {
            document.body.setAttribute("data-theme", data.theme);
            document.body.setAttribute("data-ag-theme-mode", data.theme);
            setTheme(data.theme === "dark" ? "dark" : "light");
          }
          break;
        default:
          break;
      }
    },
    [vm]
  );

  useEffect(() => {
    void (async () => {
      try {
        const currentTheme = await window.toolboxAPI.utils.getCurrentTheme();
        document.body.setAttribute("data-theme", currentTheme);
        document.body.setAttribute("data-ag-theme-mode", currentTheme);
        setTheme(currentTheme === "dark" ? "dark" : "light");
      } catch (error) {
        vm.addLog(`Failed to read current theme: ${error instanceof Error ? error.message : "Unknown error"}`, "warning");
      }

      await vm.initialize();
    })();
  }, [vm]);

  useToolboxEvents(handleEvent);

  return (
    <FluentProvider theme={theme === "dark" ? webDarkTheme : webLightTheme} className={styles.root}>
      <div className={styles.content}>
        <SolutionTransferTool vm={vm} />
      </div>
    </FluentProvider>
  );
}

export default App;
