import React from "react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Link,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { observer } from "mobx-react";

import { ViewModel } from "../model/viewModel";

const useStyles = makeStyles({
  logArea: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    paddingTop: tokens.spacingVerticalS,
    overflow: "auto",
    minHeight: 0,
  },
  logRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalM,
  },
});

function statusAppearance(status: "pending" | "running" | "success" | "error"): "outline" | "filled" | "tint" {
  switch (status) {
    case "running":
      return "tint";
    case "success":
      return "filled";
    case "error":
      return "filled";
    default:
      return "outline";
  }
}

type TransferActivityPanelProps = {
  vm: ViewModel;
  className?: string;
};

export const TransferActivityPanel = observer(({ vm, className }: TransferActivityPanelProps): React.JSX.Element => {
  const styles = useStyles();

  return (
    <Card className={className}>
      <CardHeader
        header={<Text weight="semibold">Transfer activity</Text>}
        action={<Button appearance="subtle" onClick={() => vm.clearLogs()}>Clear logs</Button>}
      />
      <div className={styles.logArea}>
        {vm.progressItems.length > 0 ? (
          <Table size="small" aria-label="Transfer progress">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Solution</TableHeaderCell>
                <TableHeaderCell>Source</TableHeaderCell>
                <TableHeaderCell>Target</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell>Message</TableHeaderCell>
                <TableHeaderCell>Export</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vm.progressItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.solutionName}</TableCell>
                  <TableCell>{item.sourceVersion}</TableCell>
                  <TableCell>{item.targetVersion}</TableCell>
                  <TableCell>
                    <Badge
                      appearance={statusAppearance(item.status)}
                      color={item.status === "error" ? "danger" : item.status === "success" ? "success" : "informative"}
                    >
                      {item.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{item.message}</TableCell>
                  <TableCell>
                    {item.exportedPackageBase64 ? (
                      <Link onClick={() => void vm.downloadExportedSolution(item.id)}>
                        Download {item.exportedPackageFileName ?? `${item.solutionName}.zip`}
                      </Link>
                    ) : (
                      <Text size={200}>Not available yet</Text>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <Text>No transfer has run yet.</Text>
        )}

        {vm.logs.map((log) => (
          <div key={log.id} className={styles.logRow}>
            <Text>{log.message}</Text>
            <Text size={200}>{log.timestamp.toLocaleTimeString()}</Text>
          </div>
        ))}
      </div>
    </Card>
  );
});
