import React from "react";
import {
  Button,
  Card,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";

import type { TransferConfirmationPrompt } from "../model/viewModel";

const useStyles = makeStyles({
  overlay: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    display: "grid",
    placeItems: "center",
    padding: tokens.spacingHorizontalL,
    background: "linear-gradient(rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.1)), rgba(15, 23, 42, 0.08)",
    backdropFilter: "blur(8px) saturate(125%)",
    WebkitBackdropFilter: "blur(8px) saturate(125%)",
  },
  surface: {
    width: "min(640px, calc(100vw - 32px))",
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
  dialogContent: {
    display: "grid",
    gap: tokens.spacingVerticalS,
  },
  section: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  dialogList: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    marginLeft: tokens.spacingHorizontalM,
  },
  actions: {
    display: "flex",
    justifyContent: "end",
    gap: tokens.spacingHorizontalM,
  },
});

type TransferConfirmationDialogProps = {
  prompt: TransferConfirmationPrompt | null;
  onConfirm: () => void;
  onCancel: () => void;
};

export function TransferConfirmationDialog({ prompt, onConfirm, onCancel }: TransferConfirmationDialogProps): React.JSX.Element {
  const styles = useStyles();

  React.useEffect(() => {
    if (!prompt) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [prompt, onCancel]);

  if (!prompt) {
    return <></>;
  }

  const cancelLabel = prompt.cancelLabel ?? "Cancel";
  const confirmLabel = prompt.confirmLabel ?? "Continue";
  const showSingleCloseAction = cancelLabel.trim().toLowerCase() === confirmLabel.trim().toLowerCase();

  return (
    <div aria-modal="true" className={styles.overlay} role="alertdialog">
      <Card className={styles.surface}>
        <Text className={styles.title}>{prompt.title}</Text>
        <div className={styles.dialogContent}>
          {prompt.messageLines.map((line) => (
            <Text key={line}>{line}</Text>
          ))}
          {prompt.detailLines && prompt.detailLines.length > 0 ? (
            <div className={styles.section}>
              {prompt.detailTitle ? <Text className={styles.sectionTitle}>{prompt.detailTitle}</Text> : null}
              <div className={styles.dialogList}>
                {prompt.detailLines.map((line) => (
                  <Text key={line}>- {line}</Text>
                ))}
              </div>
            </div>
          ) : null}
          {prompt.solutionNames.length > 0 ? (
            <div className={styles.section}>
              {prompt.solutionTitle ? <Text className={styles.sectionTitle}>{prompt.solutionTitle}</Text> : null}
              <div className={styles.dialogList}>
                {prompt.solutionNames.map((solutionName) => (
                  <Text key={solutionName}>- {solutionName}</Text>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className={styles.actions}>
          <Button appearance={showSingleCloseAction ? "primary" : "secondary"} onClick={onCancel}>
            {cancelLabel}
          </Button>
          {!showSingleCloseAction ? (
            <Button appearance="primary" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          ) : null}
        </div>
      </Card>
    </div>
  );
}