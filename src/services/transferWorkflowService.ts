import type { LogItem, ProgressItem, SolutionItem, TransferConfirmationPrompt } from "../model/viewModel";
import { SolutionTransferService, type TransferSettings } from "./solutionTransferService";

export type TransferWorkflowContext = {
  getSettings(): TransferSettings;
  getSelectedSolutions(): SolutionItem[];
  getProgressItems(): ProgressItem[];
  addLog(message: string, level?: LogItem["level"]): void;
  setIsTransferring(value: boolean): void;
  setProgressItems(items: ProgressItem[]): void;
  updateProgress(id: string, data: Partial<ProgressItem>): void;
  updateSolutionVersion(solutionId: string, version: string): void;
  loadSolutions(): Promise<void>;
  requestTransferConfirmation(prompt: TransferConfirmationPrompt): Promise<boolean>;
  requestSolutionVersionUpdate(prompt: {
    title: string;
    messageLines: string[];
    solutionName: string;
    currentVersion: string;
    confirmLabel: string;
    cancelLabel: string;
    cancelLogMessage: string;
  }): Promise<string | null>;
};

export class TransferWorkflowService {
  constructor(
    private readonly solutionTransferService: SolutionTransferService,
    private readonly context: TransferWorkflowContext
  ) {}

  private get settings(): TransferSettings {
    return this.context.getSettings();
  }

  private sanitizeFileName(value: string): string {
    return value.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
  }

  private compareVersions(left: string, right: string): number {
    const leftParts = left.split(".").map((part) => Number.parseInt(part, 10));
    const rightParts = right.split(".").map((part) => Number.parseInt(part, 10));
    const partCount = Math.max(leftParts.length, rightParts.length);

    for (let index = 0; index < partCount; index += 1) {
      const leftPart = Number.isFinite(leftParts[index]) ? leftParts[index] : 0;
      const rightPart = Number.isFinite(rightParts[index]) ? rightParts[index] : 0;

      if (leftPart > rightPart) {
        return 1;
      }

      if (leftPart < rightPart) {
        return -1;
      }
    }

    return 0;
  }

  private formatDateVersion(mask: string, increment: number): string {
    const now = new Date();
    const year = String(now.getFullYear());
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return mask
      .replace(/yyyy/g, year)
      .replace(/MM/g, month)
      .replace(/dd/g, day)
      .replace(/x/g, String(increment));
  }

  private getUpdatedSolutionVersion(currentVersion: string): string {
    const schema = this.settings.versionSchema;

    if (schema === "date") {
      let increment = 0;
      let nextVersion = this.formatDateVersion(this.settings.versionDateMask || "yyyy.MM.dd.x", increment);

      while (this.compareVersions(nextVersion, currentVersion) <= 0) {
        increment += 1;
        nextVersion = this.formatDateVersion(this.settings.versionDateMask || "yyyy.MM.dd.x", increment);
      }

      return nextVersion;
    }

    const versionParts = currentVersion.split(".");
    const nextParts = [...versionParts];

    switch (schema) {
      case "major":
        if (nextParts.length < 1) {
          return currentVersion;
        }
        nextParts[0] = String((Number.parseInt(nextParts[0], 10) || 0) + 1);
        break;
      case "minor":
        if (nextParts.length < 2) {
          return currentVersion;
        }
        nextParts[1] = String((Number.parseInt(nextParts[1], 10) || 0) + 1);
        break;
      case "build":
        if (nextParts.length < 3) {
          return currentVersion;
        }
        nextParts[2] = String((Number.parseInt(nextParts[2], 10) || 0) + 1);
        break;
      case "revision":
        if (nextParts.length < 4) {
          return currentVersion;
        }
        nextParts[3] = String((Number.parseInt(nextParts[3], 10) || 0) + 1);
        break;
      default:
        return currentVersion;
    }

    return nextParts.join(".");
  }

  private base64ToBytes(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  }

  private async notify(message: string, type: ToolBoxAPI.NotificationOptions["type"]): Promise<void> {
    try {
      await window.toolboxAPI.utils.showNotification({
        title: "Solution Transfer Tool",
        body: message,
        type,
      });
    } catch {
      // Notification failures should not block the tool flow.
    }
  }

  private async autoSaveExportedSolution(solution: SolutionItem, exportedBase64: string): Promise<void> {
    const defaultPath = this.sanitizeFileName(`${solution.uniqueName}_${solution.version}.zip`);
    const content = this.base64ToBytes(exportedBase64);

    const savedPath = await window.toolboxAPI.fileSystem.saveFile(defaultPath, content, [{ name: "Zip archive", extensions: ["zip"] }]);
    if (savedPath) {
      this.context.addLog(`Saved ${solution.friendlyName} to ${savedPath}.`, "success");
      return;
    }

    this.context.addLog(`Skipped saving ${solution.friendlyName} (save canceled).`, "warning");
  }

  async downloadExportedSolution(solutionId: string): Promise<void> {
    const progressItem = this.context.getProgressItems().find((item) => item.id === solutionId);
    if (!progressItem?.exportedPackageBase64) {
      this.context.addLog(`No exported package is available for ${progressItem?.solutionName ?? "the selected solution"}.`, "warning");
      return;
    }

    const fileName = progressItem.exportedPackageFileName ?? this.sanitizeFileName(`${progressItem.solutionName}.zip`);
    const content = this.base64ToBytes(progressItem.exportedPackageBase64);
    const savedPath = await window.toolboxAPI.fileSystem.saveFile(fileName, content, [{ name: "Zip archive", extensions: ["zip"] }]);

    if (savedPath) {
      this.context.addLog(`Saved ${progressItem.solutionName} to ${savedPath}.`, "success");
      return;
    }

    this.context.addLog(`Skipped saving ${progressItem.solutionName} (save canceled).`, "warning");
  }

  private formatImportMode(mode: TransferSettings["importMode"]): string {
    switch (mode) {
      case "stageForUpgrade":
        return "Stage for upgrade";
      case "upgrade":
        return "Upgrade";
      default:
        return "Update";
    }
  }

  private buildPreImportSummaryLines(): string[] {
    const settings = this.settings;
    const lines = [
      `Import mode: ${this.formatImportMode(settings.importMode)}`,
      `Export package type: ${settings.managed ? "Managed" : "Unmanaged"}`,
    ];

    const enabledOptions = [
      settings.convertToManaged ? "Convert to managed on import" : null,
      settings.overwriteUnmanagedCustomizations ? "Overwrite unmanaged customizations" : null,
      settings.publishWorkflows ? "Publish workflows" : null,
      settings.skipProductUpdateDependencies ? "Skip product update dependencies" : null,
      settings.checkForMissingDependencies ? "Check for missing dependencies" : null,
      settings.publishAfterImport ? "Publish customizations after import" : null,
      settings.autoSaveSolutions ? "Auto save exported solutions" : null,
      settings.notifyOnImportSuccess ? "Show notification after each import" : null,
      settings.exportAutoNumberingSettings ? "Export auto-numbering settings" : null,
      settings.exportCalendarSettings ? "Export calendar settings" : null,
      settings.exportCustomizationSettings ? "Export customization settings" : null,
      settings.exportEmailTrackingSettings ? "Export email tracking settings" : null,
      settings.exportExternalApplications ? "Export external applications" : null,
      settings.exportGeneralSettings ? "Export general settings" : null,
      settings.exportIsvConfig ? "Export ISV config" : null,
      settings.exportMarketingSettings ? "Export marketing settings" : null,
      settings.exportOutlookSynchronizationSettings ? "Export Outlook synchronization settings" : null,
      settings.exportRelationshipRoles ? "Export relationship roles" : null,
      settings.exportSales ? "Export sales settings" : null,
    ].filter((value): value is string => Boolean(value));

    if (enabledOptions.length > 0) {
      lines.push(...enabledOptions);
    } else {
      lines.push("No additional import or export options are enabled.");
    }

    return lines;
  }

  private async confirmPreImportSummary(selected: SolutionItem[]): Promise<boolean> {
    if (!this.settings.showPreImportSummary) {
      return true;
    }

    return this.context.requestTransferConfirmation({
      title: "Pre-Import Summary",
      messageLines: ["Review the selected transfer options and solutions before import starts."],
      detailTitle: "Selected options",
      detailLines: this.buildPreImportSummaryLines(),
      solutionTitle: "Solutions to import",
      solutionNames: selected.map((solution) => solution.friendlyName),
      confirmLabel: "Start transfer",
      cancelLabel: "Cancel",
      cancelLogMessage: "Transfer canceled from the pre-import summary.",
    });
  }

  private async confirmMissingDependencies(solution: SolutionItem, exportedBase64: string): Promise<boolean> {
    if (!this.settings.checkForMissingDependencies) {
      return true;
    }

    try {
      const result = await this.solutionTransferService.checkForMissingDependencies(exportedBase64);
      if (result.missingComponentCount === 0) {
        return true;
      }

      return this.context.requestTransferConfirmation({
        title: "Missing Dependencies Detected",
        messageLines: [
          `The solution ${solution.friendlyName} has missing dependencies in the target environment.`,
          "Review the missing components before continuing the import.",
          "Do you want to continue with the transfer?",
        ],
        detailTitle: "Check result",
        detailLines: [`${result.missingComponentCount} missing component(s) detected.`],
        solutionNames: [solution.friendlyName],
        confirmLabel: "Continue transfer",
        cancelLabel: "Cancel",
        cancelLogMessage: "Transfer canceled after missing dependencies were detected.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while checking for missing dependencies.";
      this.context.addLog(`Unable to verify missing dependencies before import: ${message}`, "warning");

      return this.context.requestTransferConfirmation({
        title: "Unable To Verify Missing Dependencies",
        messageLines: [
          `The tool could not verify missing dependencies for ${solution.friendlyName}.`,
          "Do you want to continue with the transfer anyway?",
        ],
        solutionNames: [solution.friendlyName],
        confirmLabel: "Continue transfer",
        cancelLabel: "Cancel",
        cancelLogMessage: "Transfer canceled because missing dependency verification could not be completed.",
      });
    }
  }

  private isDependencyRelatedImportError(message: string): boolean {
    return /dependenc|missing component|required component|cannot be installed/i.test(message);
  }

  private extractMissingDependenciesXml(message: string): string | null {
    const startIndex = message.indexOf("<MissingDependencies");
    if (startIndex < 0) {
      return null;
    }

    const endTag = "</MissingDependencies>";
    const endIndex = message.indexOf(endTag, startIndex);
    if (endIndex < 0) {
      return null;
    }

    return message.slice(startIndex, endIndex + endTag.length);
  }

  private formatDependencyParticipant(element: Element | null, fallbackLabel: string): string {
    if (!element) {
      return fallbackLabel;
    }

    const type = element.getAttribute("type") ?? "unknown";
    const displayName = element.getAttribute("displayName") ?? element.getAttribute("schemaName") ?? fallbackLabel;
    const schemaName = element.getAttribute("schemaName");
    const solution = element.getAttribute("solution");
    const id = element.getAttribute("id");

    const details = [`type ${type}`];
    if (schemaName && schemaName !== displayName) {
      details.push(`schema ${schemaName}`);
    }
    if (solution) {
      details.push(`solution ${solution}`);
    }
    if (id) {
      details.push(`id ${id}`);
    }

    return `${displayName} (${details.join(", ")})`;
  }

  private buildDependencyDetailLines(importErrorMessage: string): string[] {
    const xml = this.extractMissingDependenciesXml(importErrorMessage);
    if (xml) {
      const document = new DOMParser().parseFromString(xml, "application/xml");
      const parserError = document.querySelector("parsererror");

      if (!parserError) {
        const dependencies = Array.from(document.getElementsByTagName("MissingDependency"));
        const parsedLines = dependencies.map((dependency, index) => {
          const required = this.formatDependencyParticipant(dependency.querySelector("Required"), "Required component");
          const dependent = this.formatDependencyParticipant(dependency.querySelector("Dependent"), "Dependent component");
          return `${index + 1}. Required: ${required}. Dependent: ${dependent}.`;
        });

        if (parsedLines.length > 0) {
          return parsedLines;
        }
      }

      const withoutXml = importErrorMessage.replace(xml, " ").replace(/\s+/g, " ").trim();
      return withoutXml.length > 0
        ? [withoutXml, "Dependency details were returned in XML but could not be parsed."]
        : ["Dependency details were returned in XML but could not be parsed."];
    }

    const textLines = importErrorMessage
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.includes("<") && !line.includes(">"));

    return textLines.length > 0 ? textLines : ["Missing dependency details were not available in a readable format."];
  }

  private async showMissingDependenciesFromImportError(solution: SolutionItem, importErrorMessage: string): Promise<void> {
    if (!this.isDependencyRelatedImportError(importErrorMessage)) {
      return;
    }

    const detailLines = this.buildDependencyDetailLines(importErrorMessage);

    await this.context.requestTransferConfirmation({
      title: "Import Failed: Missing Dependencies",
      messageLines: [
        `Import failed for ${solution.friendlyName} because dependencies are missing in the target environment.`,
        "Review the import error details below.",
      ],
      detailTitle: "Import error details",
      detailLines: detailLines.length > 0 ? detailLines : [importErrorMessage],
      solutionTitle: "Failed solution",
      solutionNames: [solution.friendlyName],
      confirmLabel: "Close",
      cancelLabel: "Close",
      cancelLogMessage: "Closed missing dependency details.",
    });
  }

  private async confirmTransferForConnectionReferences(selected: SolutionItem[]): Promise<boolean> {
    try {
      const checks = await this.solutionTransferService.getSolutionsWithConnectionReferences(selected.map((solution) => solution.id));
      const matchedIds = new Set(checks.filter((check) => check.hasConnectionReferences).map((check) => check.solutionId));
      const affectedSolutions = selected.filter((solution) => matchedIds.has(solution.id));

      if (affectedSolutions.length === 0) {
        return true;
      }

      return this.context.requestTransferConfirmation({
        title: "Connection References Detected",
        messageLines: [
          "One or more selected solutions contain connection references.",
          "Connection references often require environment-specific review after import.",
          "Do you want to continue with the transfer?",
        ],
        solutionTitle: "Solutions requiring review",
        solutionNames: affectedSolutions.map((solution) => solution.friendlyName),
        confirmLabel: "Continue transfer",
        cancelLabel: "Cancel",
        cancelLogMessage: "Transfer canceled after connection reference warning.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while checking for connection references.";
      this.context.addLog(`Unable to verify connection references before transfer: ${message}`, "warning");

      return this.context.requestTransferConfirmation({
        title: "Unable To Verify Connection References",
        messageLines: [
          "The tool could not verify whether the selected solutions contain connection references.",
          "Do you want to continue with the transfer anyway?",
        ],
        solutionNames: [],
        confirmLabel: "Continue transfer",
        cancelLabel: "Cancel",
        cancelLogMessage: "Transfer canceled because connection reference verification could not be completed.",
      });
    }
  }

  private async maybeUpdateSolutionVersion(solution: SolutionItem): Promise<string | null> {
    const settings = this.settings;
    if (settings.updateSourceSolutionVersion === "no") {
      return solution.version;
    }

    if (settings.versionSchema === "manual") {
      const manualVersion = await this.context.requestSolutionVersionUpdate({
        title: `Update version for ${solution.friendlyName}`,
        messageLines: [
          "Enter the new solution version before export.",
          `Current version: ${solution.version}`,
        ],
        solutionName: solution.friendlyName,
        currentVersion: solution.version,
        confirmLabel: "Update version",
        cancelLabel: "Cancel",
        cancelLogMessage: `Version update canceled for ${solution.friendlyName}.`,
      });

      if (!manualVersion || manualVersion.trim().length === 0) {
        return null;
      }

      return manualVersion.trim();
    }

    const nextVersion = this.getUpdatedSolutionVersion(solution.version);
    if (settings.updateSourceSolutionVersion === "prompt") {
      const confirmed = await this.context.requestTransferConfirmation({
        title: `Update version for ${solution.friendlyName}`,
        messageLines: [
          `Current version: ${solution.version}`,
          `New version: ${nextVersion}`,
          "Do you want to update the source solution before export?",
        ],
        solutionNames: [solution.friendlyName],
        confirmLabel: "Update version",
        cancelLabel: "Skip Update",
        cancelLogMessage: `Skipped updating the version for ${solution.friendlyName}.`,
      });

      if (!confirmed) {
        return solution.version;
      }
    }

    return nextVersion;
  }

  async transferSelectedSolutions(): Promise<void> {
    const selected = this.context.getSelectedSolutions();
    if (selected.length === 0) {
      return;
    }

    const confirmed = await this.confirmTransferForConnectionReferences(selected);
    if (!confirmed) {
      return;
    }

    const summaryConfirmed = await this.confirmPreImportSummary(selected);
    if (!summaryConfirmed) {
      return;
    }

    this.context.setIsTransferring(true);
    this.context.setProgressItems(
      selected.map((solution) => ({
        id: solution.id,
        solutionName: solution.friendlyName,
        sourceVersion: solution.version,
        targetVersion: solution.targetVersion ?? "-",
        status: "pending",
        message: "Waiting",
        startedAt: new Date(),
      }))
    );

    this.context.addLog(`Starting transfer of ${selected.length} solution(s).`);

    try {
      for (const solution of selected) {
        const updatedVersion = await this.maybeUpdateSolutionVersion(solution);
        if (updatedVersion === null) {
          this.context.updateProgress(solution.id, {
            status: "error",
            message: "Version update canceled",
            finishedAt: new Date(),
          });
          return;
        }

        if (updatedVersion !== solution.version) {
          try {
            await this.solutionTransferService.updateSolutionVersion(solution.id, updatedVersion);
            this.context.updateSolutionVersion(solution.id, updatedVersion);
            solution.version = updatedVersion;
            this.context.addLog(`Updated ${solution.friendlyName} to version ${updatedVersion}.`, "success");
          } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error while updating the source solution version.";
            this.context.updateProgress(solution.id, { status: "error", message, finishedAt: new Date() });
            this.context.addLog(`Failed to update ${solution.friendlyName}: ${message}`, "error");
            throw error;
          }
        }

        this.context.updateProgress(solution.id, { status: "running", message: "Exporting from source", startedAt: new Date() });
        this.context.addLog(`Exporting ${solution.friendlyName} (${solution.version}) from source.`);

        const exportedBase64 = await this.solutionTransferService.exportSolution(solution.uniqueName, this.settings);
        this.context.updateProgress(solution.id, {
          exportedPackageBase64: exportedBase64,
          exportedPackageFileName: this.sanitizeFileName(`${solution.uniqueName}_${solution.version}.zip`),
          sourceVersion: solution.version,
        });

        if (this.settings.autoSaveSolutions) {
          try {
            await this.autoSaveExportedSolution(solution, exportedBase64);
          } catch (saveError) {
            const saveErrorMessage = saveError instanceof Error ? saveError.message : "Unknown error while saving exported solution.";
            this.context.addLog(`Failed to save ${solution.friendlyName}: ${saveErrorMessage}`, "warning");
          }
        }

        const missingDependenciesConfirmed = await this.confirmMissingDependencies(solution, exportedBase64);
        if (!missingDependenciesConfirmed) {
          this.context.updateProgress(solution.id, {
            status: "error",
            message: "Transfer canceled before import",
            finishedAt: new Date(),
          });
          return;
        }

        this.context.updateProgress(solution.id, { status: "running", message: "Importing into target" });
        this.context.addLog(`Importing ${solution.friendlyName} into target.`);

        try {
          await this.solutionTransferService.importSolution(exportedBase64, this.settings);
        } catch (importError) {
          console.log("Import error", importError);
          const importErrorMessage = importError instanceof Error ? importError.message : "Unknown import error.";
          await this.showMissingDependenciesFromImportError(solution, importErrorMessage);
          this.context.updateProgress(solution.id, { status: "error", message: importErrorMessage, finishedAt: new Date() });
          this.context.addLog(`Failed to import ${solution.friendlyName}: ${importErrorMessage}`, "error");
          await this.notify(`Failed to import ${solution.friendlyName}: ${importErrorMessage}`, "error");
          throw importError;
        }

        this.context.updateProgress(solution.id, {
          status: "success",
          message: "Imported",
          finishedAt: new Date(),
          targetVersion: solution.version,
        });
        this.context.addLog(`Imported ${solution.friendlyName} successfully.`, "success");
        if (this.settings.notifyOnImportSuccess) {
          await this.notify(`Imported ${solution.friendlyName} successfully.`, "success");
        }
      }

      if (this.settings.publishAfterImport && !this.settings.managed) {
        this.context.addLog("Publishing customizations on target environment.");
        await this.solutionTransferService.publishCustomizations();
        this.context.addLog("Published customizations.", "success");
      }

      await this.context.loadSolutions();
      await this.notify("Solution transfer completed successfully.", "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown transfer error.";
      const active = [...this.context.getProgressItems()].reverse().find((item) => item.status === "running");
      if (active) {
        this.context.updateProgress(active.id, { status: "error", message, finishedAt: new Date() });
      }
      this.context.addLog(message, "error");
    } finally {
      this.context.setIsTransferring(false);
    }
  }
}
