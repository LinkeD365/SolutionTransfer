import React from "react";
import { Button, Card, Input, Text, makeStyles, tokens } from "@fluentui/react-components";

import type { SolutionVersionPrompt } from "../model/viewModel";

const useStyles = makeStyles({
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1001,
    display: "grid",
    placeItems: "center",
    padding: tokens.spacingHorizontalL,
    background: "linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.1)), rgba(15, 23, 42, 0.08)",
    backdropFilter: "blur(8px) saturate(125%)",
    WebkitBackdropFilter: "blur(8px) saturate(125%)",
  },
  surface: {
    width: "min(560px, calc(100vw - 32px))",
    maxHeight: "calc(100vh - 32px)",
    overflow: "auto",
    display: "grid",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalXL,
    boxShadow: tokens.shadow64,
    borderRadius: tokens.borderRadiusXLarge,
  },
  title: {
    fontSize: tokens.fontSizeHero700,
    lineHeight: tokens.lineHeightHero700,
    fontWeight: tokens.fontWeightSemibold,
  },
  content: {
    display: "grid",
    gap: tokens.spacingVerticalS,
  },
  inputArea: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
  },
  actions: {
    display: "flex",
    justifyContent: "end",
    gap: tokens.spacingHorizontalM,
  },
});

type SolutionVersionDialogProps = {
  prompt: SolutionVersionPrompt | null;
  onConfirm: (version: string) => void;
  onCancel: () => void;
};

export function SolutionVersionDialog({ prompt, onConfirm, onCancel }: SolutionVersionDialogProps): React.JSX.Element {
  const styles = useStyles();
  const [version, setVersion] = React.useState(prompt?.currentVersion ?? "");

  React.useEffect(() => {
    if (!prompt) {
      return;
    }

    setVersion(prompt.currentVersion);
  }, [prompt]);

  React.useEffect(() => {
    if (!prompt) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }

      if (event.key === "Enter") {
        event.preventDefault();
        onConfirm(version.trim());
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [prompt, onCancel, onConfirm, version]);

  if (!prompt) {
    return <></>;
  }

  return (
    <div aria-modal="true" className={styles.overlay} role="dialog">
      <Card className={styles.surface}>
        <Text className={styles.title}>{prompt.title}</Text>
        <div className={styles.content}>
          {prompt.messageLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
          <div className={styles.inputArea}>
            <Text>{prompt.solutionName}</Text>
            <Input value={version} onChange={(_, data) => setVersion(data.value)} autoFocus />
          </div>
        </div>
        <div className={styles.actions}>
          <Button appearance="secondary" onClick={onCancel}>
            {prompt.cancelLabel}
          </Button>
          <Button appearance="primary" onClick={() => onConfirm(version.trim())}>
            {prompt.confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}
