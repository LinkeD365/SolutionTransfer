import { makeAutoObservable, runInAction } from "mobx";
import {
  SolutionTransferService,
  type ImportMode,
  type TransferSettings,
  type UpdateSourceSolutionVersion,
  type VersionSchema,
} from "../services/solutionTransferService";
import { TransferWorkflowService } from "../services/transferWorkflowService";

export type SolutionItem = {
  id: string;
  uniqueName: string;
  friendlyName: string;
  version: string;
  isManaged: boolean;
  selected: boolean;
  targetVersion: string | null;
};

export type ProgressStatus = "pending" | "running" | "success" | "error";

export type ProgressItem = {
  id: string;
  solutionName: string;
  sourceVersion: string;
  targetVersion: string;
  status: ProgressStatus;
  message: string;
  startedAt: Date;
  finishedAt?: Date;
  exportedPackageBase64?: string;
  exportedPackageFileName?: string;
};

export type LogItem = {
  id: string;
  message: string;
  level: "info" | "success" | "warning" | "error";
  timestamp: Date;
};

export type TransferConfirmationPrompt = {
  title: string;
  messageLines: string[];
  detailTitle?: string;
  detailLines?: string[];
  solutionTitle?: string;
  solutionNames: string[];
  confirmLabel: string;
  cancelLabel: string;
  cancelLogMessage: string;
};

export type SolutionVersionPrompt = {
  title: string;
  messageLines: string[];
  solutionName: string;
  currentVersion: string;
  confirmLabel: string;
  cancelLabel: string;
  cancelLogMessage: string;
};

export class ViewModel {
  private readonly service: SolutionTransferService;
  private readonly workflow: TransferWorkflowService;
  private transferConfirmationResolver: ((confirmed: boolean) => void) | null = null;
  private solutionVersionResolver: ((version: string | null) => void) | null = null;
  isLoadingSolutions = false;
  isTransferring = false;
  sourceConnection: ToolBoxAPI.DataverseConnection | null = null;
  targetConnection: ToolBoxAPI.DataverseConnection | null = null;
  solutions: SolutionItem[] = [];
  progressItems: ProgressItem[] = [];
  logs: LogItem[] = [];
  transferConfirmationPrompt: TransferConfirmationPrompt | null = null;
  solutionVersionPrompt: SolutionVersionPrompt | null = null;
  settings: TransferSettings;

  constructor(service = new SolutionTransferService(window.dataverseAPI)) {
    this.service = service;
    this.settings = this.service.createDefaultSettings();
    makeAutoObservable<ViewModel, "service" | "workflow" | "transferConfirmationResolver" | "solutionVersionResolver">(
      this,
      { service: false, workflow: false, transferConfirmationResolver: false, solutionVersionResolver: false },
      { autoBind: true }
    );
    this.workflow = new TransferWorkflowService(this.service, {
      getSettings: () => this.settings,
      getSelectedSolutions: () => this.selectedSolutions,
      getProgressItems: () => this.progressItems,
      addLog: this.addLog,
      setIsTransferring: (value) => {
        this.isTransferring = value;
      },
      setProgressItems: (items) => {
        this.progressItems = items;
      },
      updateProgress: this.updateProgress,
      updateSolutionVersion: this.updateSolutionVersion,
      loadSolutions: () => this.loadSolutions(),
      requestTransferConfirmation: (prompt) => this.requestTransferConfirmation(prompt),
      requestSolutionVersionUpdate: (prompt) => this.requestSolutionVersionUpdate(prompt),
    });
  }

  get selectedSolutions(): SolutionItem[] {
    return this.solutions.filter((x) => x.selected);
  }

  get hasSecondaryConnection(): boolean {
    return this.targetConnection !== null;
  }

  get canTransfer(): boolean {
    return this.selectedSolutions.length > 0 && !this.isTransferring && this.sourceConnection !== null && this.targetConnection !== null;
  }

  get allSelected(): boolean {
    return this.solutions.length > 0 && this.solutions.every((x) => x.selected);
  }

  addLog(message: string, level: LogItem["level"] = "info"): void {
    this.logs.unshift({
      id: crypto.randomUUID(),
      message,
      level,
      timestamp: new Date(),
    });
    if (this.logs.length > 100) {
      this.logs = this.logs.slice(0, 100);
    }
  }

  clearLogs(): void {
    this.logs = [];
  }

  async initialize(): Promise<void> {
    await this.refreshConnections();
    if (this.sourceConnection && this.targetConnection) {
      await this.loadSolutions();
    }
  }

  async refreshConnections(): Promise<void> {
    const [source, target] = await Promise.all([
      window.toolboxAPI.connections.getActiveConnection(),
      window.toolboxAPI.connections.getSecondaryConnection(),
    ]);

    runInAction(() => {
      this.sourceConnection = source;
      this.targetConnection = target;
    });

    if (!target) {
      this.addLog("No secondary connection is configured. Add a target environment to transfer solutions.", "warning");
    }
  }

  setAllSelected(checked: boolean): void {
    this.solutions = this.solutions.map((solution) => ({
      ...solution,
      selected: checked,
    }));
  }

  setSolutionSelected(id: string, checked: boolean): void {
    this.solutions = this.solutions.map((solution) => (solution.id === id ? { ...solution, selected: checked } : solution));
  }

  setSelectedSolutions(ids: string[]): void {
    const selectedIds = new Set(ids);
    this.solutions = this.solutions.map((solution) => ({
      ...solution,
      selected: selectedIds.has(solution.id),
    }));
  }

  updateImportMode(mode: ImportMode): void {
    this.settings = {
      ...this.settings,
      importMode: mode,
    };
  }

  updateSourceSolutionVersion(setting: UpdateSourceSolutionVersion): void {
    this.settings = {
      ...this.settings,
      updateSourceSolutionVersion: setting,
    };
  }

  updateVersionSchema(schema: VersionSchema): void {
    this.settings = {
      ...this.settings,
      versionSchema: schema,
    };
  }

  updateVersionDateMask(versionDateMask: string): void {
    this.settings = {
      ...this.settings,
      versionDateMask,
    };
  }

  updateSetting<K extends keyof TransferSettings>(setting: K, value: TransferSettings[K]): void {
    this.settings = {
      ...this.settings,
      [setting]: value,
    };
  }

  private requestTransferConfirmation(prompt: TransferConfirmationPrompt): Promise<boolean> {
    return new Promise((resolve) => {
      this.transferConfirmationPrompt = prompt;
      this.transferConfirmationResolver = resolve;
    });
  }

  resolveTransferConfirmation(confirmed: boolean): void {
    const prompt = this.transferConfirmationPrompt;
    const resolver = this.transferConfirmationResolver;

    this.transferConfirmationPrompt = null;
    this.transferConfirmationResolver = null;

    if (!confirmed && prompt) {
      this.addLog(prompt.cancelLogMessage, "warning");
    }

    resolver?.(confirmed);
  }

  private requestSolutionVersionUpdate(prompt: SolutionVersionPrompt): Promise<string | null> {
    return new Promise((resolve) => {
      this.solutionVersionPrompt = prompt;
      this.solutionVersionResolver = resolve;
    });
  }

  resolveSolutionVersionUpdate(version: string | null): void {
    const prompt = this.solutionVersionPrompt;
    const resolver = this.solutionVersionResolver;

    this.solutionVersionPrompt = null;
    this.solutionVersionResolver = null;

    if (!version && prompt) {
      this.addLog(prompt.cancelLogMessage, "warning");
    }

    resolver?.(version);
  }

  updateSolutionVersion(solutionId: string, version: string): void {
    this.solutions = this.solutions.map((solution) => (solution.id === solutionId ? { ...solution, version } : solution));
  }

  async loadSolutions(): Promise<void> {
    if (!this.sourceConnection) {
      this.addLog("Source connection is not available.", "error");
      return;
    }

    if (!this.targetConnection) {
      this.addLog("Target connection is not available.", "error");
      return;
    }

    runInAction(() => {
      this.isLoadingSolutions = true;
    });

    try {
      const sourceSolutions = await this.service.getSourceSolutions();
      const targetVersions = await this.service.getTargetVersions(sourceSolutions.map((x) => x.uniqueName));

      runInAction(() => {
        this.solutions = sourceSolutions.map((solution) => ({
          ...solution,
          selected: false,
          targetVersion: targetVersions.get(solution.uniqueName) ?? null,
        }));
      });

      this.addLog(`Loaded ${sourceSolutions.length} source solutions.`, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error while loading solutions.";
      this.addLog(message, "error");
    } finally {
      runInAction(() => {
        this.isLoadingSolutions = false;
      });
    }
  }

  private updateProgress(id: string, data: Partial<ProgressItem>): void {
    this.progressItems = this.progressItems.map((item) => (item.id === id ? { ...item, ...data } : item));
  }

  async downloadExportedSolution(solutionId: string): Promise<void> {
    await this.workflow.downloadExportedSolution(solutionId);
  }

  async transferSelectedSolutions(): Promise<void> {
    if (!this.canTransfer) {
      return;
    }

    await this.workflow.transferSelectedSolutions();
  }
}
