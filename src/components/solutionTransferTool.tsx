import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { AgGridReact } from "ag-grid-react";
import {
  CellStyleModule,
  ClientSideRowModelModule,
  ColDef,
  ModuleRegistry,
  RowApiModule,
  RowClassParams,
  RowSelectionModule,
  RowStyleModule,
  SelectionChangedEvent,
  themeQuartz,
  ValidationModule,
} from "ag-grid-community";
import { Allotment } from "allotment";
import "allotment/dist/style.css";

import { ArrowSync24Regular, ArrowUpload24Regular } from "@fluentui/react-icons";
import { observer } from "mobx-react";
import { ViewModel } from "../model/viewModel";
import { TransferConfirmationDialog } from "./transferConfirmationDialog";
import { SolutionVersionDialog } from "./solutionVersionDialog";
import { TransferSettingsPanel } from "./transferSettingsPanel";
import { TransferActivityPanel } from "./transferActivityPanel";

ModuleRegistry.registerModules([ClientSideRowModelModule, RowSelectionModule, RowApiModule, CellStyleModule]);

const useStyles = makeStyles({
  root: {
    display: "grid",
    gridTemplateRows: "auto 1fr",
    gap: tokens.spacingVerticalM,
    height: "100%",
    padding: tokens.spacingHorizontalL,
    overflow: "hidden",
  },
  splitHost: {
    minHeight: 0,
    height: "100%",
  },
  splitPane: {
    height: "100%",
  },
  leftPane: {
    height: "100%",
    minHeight: 0,
    paddingRight: tokens.spacingHorizontalS,
  },
  leftSplitPane: {
    height: "100%",
  },
  rightPane: {
    height: "100%",
    minHeight: 0,
    paddingLeft: tokens.spacingHorizontalS,
  },
  row: {
    display: "flex",
    gap: tokens.spacingHorizontalM,
    alignItems: "center",
    flexWrap: "wrap",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    marginLeft: "auto",
  },
  settingsCard: {
    height: "100%",
    minHeight: 0,
    display: "grid",
    gridTemplateRows: "auto 1fr",
    overflow: "hidden",
  },
  tableCard: {
    display: "grid",
    gridTemplateRows: "auto 1fr",
    height: "100%",
    minHeight: 0,
    overflow: "hidden",
  },
  gridHost: {
    position: "relative",
    minHeight: 0,
    height: "100%",
    paddingTop: tokens.spacingVerticalS,
  },
  gridTheme: {
    height: "100%",
    width: "100%",
  },
  loadingOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    zIndex: 1,
  },
});
export const agGridTheme = themeQuartz.withParams({
  headerHeight: 30,
});

function environmentBadgeColor(
  environment: ToolBoxAPI.DataverseConnection["environment"] | undefined
): "success" | "informative" | "warning" | "danger" | "subtle" {
  switch (environment) {
    case "Dev":
      return "success";
    case "Test":
      return "informative";
    case "UAT":
      return "warning";
    case "Production":
      return "danger";
    default:
      return "subtle";
  }
}

function hasVersionMismatch(data: { targetVersion?: string | null; version?: string } | undefined): boolean {
  const targetVersion = data?.targetVersion;
  return Boolean(targetVersion) && targetVersion !== data?.version;
}

export const SolutionTransferTool = observer(({ vm }: { vm: ViewModel }): React.JSX.Element => {
  const styles = useStyles();
  const gridRef = useRef<AgGridReact>(null);
  const columnDefs = useMemo<ColDef[]>(
    () => [
      { headerName: "Friendly name", field: "friendlyName", minWidth: 220, flex: 1.4 },
      { headerName: "Unique name", field: "uniqueName", minWidth: 220, flex: 1.2 },
      { headerName: "Source version", field: "version", minWidth: 140, flex: 0.8 },
      {
        headerName: "Target version",
        field: "targetVersion",
        valueFormatter: ({ value }) => (value ? String(value) : "-"),
        minWidth: 140,
        flex: 0.8,
        cellClassRules: {
          "ag-cell-version-match": ({ data }) => Boolean(data?.targetVersion) && data.targetVersion === data?.version,
          "ag-cell-version-mismatch": ({ data }) => Boolean(data?.targetVersion) && data.targetVersion !== data?.version,
        },
      },
      {
        headerName: "Type",
        field: "isManaged",
        valueGetter: ({ data }) => (data?.isManaged ? "Managed" : "Unmanaged"),
        minWidth: 120,
        flex: 0.7,
      },
    ],
    []
  );

  const syncGridSelection = useCallback(() => {
    const api = gridRef.current?.api;
    if (!api) {
      return;
    }

    api.forEachNode((node) => {
      const shouldSelect = Boolean(node.data?.selected);
      if (node.isSelected() !== shouldSelect) {
        node.setSelected(shouldSelect, false, "api");
      }
    });
  }, []);

  useEffect(() => {
    syncGridSelection();
  }, [vm.solutions, syncGridSelection]);

  const handleSelectionChanged = useCallback(
    (event: SelectionChangedEvent) => {
      const selectedIds = event.api.getSelectedNodes().map((node) => String(node.data.id));
      vm.setSelectedSolutions(selectedIds);
    },
    [vm]
  );

  return (
    <div className={styles.root}>
      <TransferConfirmationDialog
        prompt={vm.transferConfirmationPrompt}
        onCancel={() => vm.resolveTransferConfirmation(false)}
        onConfirm={() => vm.resolveTransferConfirmation(true)}
      />

      <SolutionVersionDialog
        prompt={vm.solutionVersionPrompt}
        onCancel={() => vm.resolveSolutionVersionUpdate(null)}
        onConfirm={(version) => vm.resolveSolutionVersionUpdate(version)}
      />

      <div className={styles.row}>
        <Badge appearance={vm.sourceConnection ? "filled" : "outline"} color={environmentBadgeColor(vm.sourceConnection?.environment)}>
          Source: {vm.sourceConnection?.name ?? "Not connected"}
        </Badge>
        <Badge appearance={vm.hasSecondaryConnection ? "filled" : "outline"} color={environmentBadgeColor(vm.targetConnection?.environment)}>
          Target: {vm.targetConnection?.name ?? "No secondary connection"}
        </Badge>
        <div className={styles.actions}>
          <Button icon={<ArrowSync24Regular />} appearance="secondary" onClick={() => void vm.refreshConnections().then(vm.loadSolutions)}>
            Refresh
          </Button>
          <Button
            icon={<ArrowUpload24Regular />}
            appearance="primary"
            disabled={!vm.canTransfer}
            onClick={() => void vm.transferSelectedSolutions()}
          >
            Transfer selected ({vm.selectedSolutions.length})
          </Button>
          {vm.isLoadingSolutions || vm.isTransferring ? <Spinner size="tiny" label={vm.isTransferring ? "Transferring..." : "Loading..."} /> : null}
        </div>
      </div>

      <div className={styles.splitHost}>
        <Allotment className={styles.splitPane} defaultSizes={[72, 28]}>
          <Allotment.Pane minSize={420}>
            <div className={styles.leftPane}>
              <Allotment vertical className={styles.leftSplitPane} defaultSizes={[62, 38]}>
                <Allotment.Pane minSize={220}>
                  <Card className={styles.tableCard}>
                    <CardHeader header={<Text weight="semibold">Source solutions</Text>} />
                    <div className={styles.gridHost}>
                      {vm.isLoadingSolutions ? <div className={styles.loadingOverlay}><Spinner size="large" label="Loading solutions..." /></div> : null}
                      <div className={`ag-theme-quartz ${styles.gridTheme}`}>
                        <AgGridReact
                         ref={gridRef}
                         theme={agGridTheme}
                         modules={[RowStyleModule, ValidationModule, ClientSideRowModelModule, RowSelectionModule, RowApiModule, CellStyleModule]}
                          rowData={vm.solutions}
                          columnDefs={columnDefs}
                          rowClassRules={{
                            "ag-row-version-mismatch": ({ data }: RowClassParams) => hasVersionMismatch(data),
                            "ag-row-zebra-even": ({ data, node }: RowClassParams) => !hasVersionMismatch(data) && ((node.rowIndex ?? 0) % 2 === 0),
                            "ag-row-zebra-odd": ({ data, node }: RowClassParams) => !hasVersionMismatch(data) && ((node.rowIndex ?? 0) % 2 === 1),
                          }}
                          rowSelection={{ mode: "multiRow", enableClickSelection: false }}
                          animateRows
                          getRowId={(params) => params.data.id}
                          onGridReady={() => syncGridSelection()}
                          onSelectionChanged={handleSelectionChanged}
                        />
                      </div>
                    </div>
                  </Card>
                </Allotment.Pane>

                <Allotment.Pane minSize={180}>
                  <TransferActivityPanel vm={vm} className={styles.tableCard} />
                </Allotment.Pane>
              </Allotment>
            </div>
          </Allotment.Pane>

          <Allotment.Pane minSize={280} preferredSize={360}>
            <div className={styles.rightPane}>
              <TransferSettingsPanel vm={vm} className={styles.settingsCard} />
            </div>
          </Allotment.Pane>
        </Allotment>
      </div>
    </div>
  );
});
