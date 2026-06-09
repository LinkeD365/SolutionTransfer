export type ImportMode = "update" | "stageForUpgrade" | "upgrade";

export type UpdateSourceSolutionVersion = "no" | "yes" | "prompt";

export type VersionSchema = "major" | "minor" | "build" | "revision" | "manual" | "date";

export type TransferSettings = {
  managed: boolean;
  convertToManaged: boolean;
  overwriteUnmanagedCustomizations: boolean;
  publishWorkflows: boolean;
  skipProductUpdateDependencies: boolean;
  checkForMissingDependencies: boolean;
  publishAfterImport: boolean;
  autoSaveSolutions: boolean;
  notifyOnImportSuccess: boolean;
  showPreImportSummary: boolean;
  updateSourceSolutionVersion: UpdateSourceSolutionVersion;
  versionSchema: VersionSchema;
  versionDateMask: string;
  importMode: ImportMode;
  exportAutoNumberingSettings: boolean;
  exportCalendarSettings: boolean;
  exportCustomizationSettings: boolean;
  exportEmailTrackingSettings: boolean;
  exportExternalApplications: boolean;
  exportGeneralSettings: boolean;
  exportIsvConfig: boolean;
  exportMarketingSettings: boolean;
  exportOutlookSynchronizationSettings: boolean;
  exportRelationshipRoles: boolean;
  exportSales: boolean;
};

export type SolutionSummary = {
  id: string;
  uniqueName: string;
  friendlyName: string;
  version: string;
  isManaged: boolean;
};

export type SolutionConnectionReferenceCheck = {
  solutionId: string;
  hasConnectionReferences: boolean;
};

export type MissingDependencyDetail = {
  schemaName: string;
  parentSchemaName: string;
  requiredSolution: string;
  type: string;
};

export type MissingDependencyCheckResult = {
  missingComponentCount: number;
  missingComponents: MissingDependencyDetail[];
};

const SOURCE_COLUMNS = ["solutionid", "uniquename", "friendlyname", "version", "ismanaged", "isvisible"] as const;
const TARGET_COLUMNS = ["uniquename", "version"] as const;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function toBase64(content: unknown): string {
  if (!content) {
    throw new Error("The export response did not include solution content.");
  }

  if (typeof content === "string") {
    return content;
  }

  if (content instanceof Uint8Array) {
    return bytesToBase64(content);
  }

  if (content instanceof ArrayBuffer) {
    return bytesToBase64(new Uint8Array(content));
  }

  if (Array.isArray(content) && content.every((value) => typeof value === "number")) {
    return bytesToBase64(Uint8Array.from(content));
  }

  if (typeof content === "object" && content !== null) {
    const possibleBuffer = content as { type?: string; data?: unknown };
    if (possibleBuffer.type === "Buffer" && Array.isArray(possibleBuffer.data)) {
      return bytesToBase64(Uint8Array.from(possibleBuffer.data as number[]));
    }
  }

  throw new Error("Unsupported solution content format returned from Dataverse.");
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

export class SolutionTransferService {
  constructor(private readonly dvApi: DataverseAPI.API) {}

  async getSolutionsWithConnectionReferences(solutionIds: string[]): Promise<SolutionConnectionReferenceCheck[]> {
    const uniqueSolutionIds = [...new Set(solutionIds.filter(Boolean))];
    if (uniqueSolutionIds.length === 0) {
      return [];
    }

    return Promise.all(
      uniqueSolutionIds.map(async (solutionId) => {
        const directFetchXml = [
          "<fetch top='1'>",
          "  <entity name='connectionreference'>",
          "    <attribute name='connectionreferenceid' />",
          "    <filter>",
          `      <condition attribute='solutionid' operator='eq' value='${solutionId}' />`,
          "    </filter>",
          "  </entity>",
          "</fetch>",
        ].join("");

        const directResult = await this.dvApi.fetchXmlQuery(directFetchXml, "primary");
        if (directResult.value.length > 0) {
          return {
            solutionId,
            hasConnectionReferences: true,
          };
        }

        const fallbackFetchXml = [
          "<fetch top='1'>",
          "  <entity name='solutioncomponent'>",
          "    <attribute name='solutioncomponentid' />",
          "    <filter>",
          `      <condition attribute='solutionid' operator='eq' value='${solutionId}' />`,
          "    </filter>",
          "    <link-entity name='connectionreference' from='connectionreferenceid' to='objectid' link-type='inner' alias='cr'>",
          "      <attribute name='connectionreferenceid' />",
          "    </link-entity>",
          "  </entity>",
          "</fetch>",
        ].join("");

        const fallbackResult = await this.dvApi.fetchXmlQuery(fallbackFetchXml, "primary");
        return {
          solutionId,
          hasConnectionReferences: fallbackResult.value.length > 0,
        };
      })
    );
  }

  createDefaultSettings(): TransferSettings {
    return {
      managed: true,
      convertToManaged: false,
      overwriteUnmanagedCustomizations: true,
      publishWorkflows: true,
      skipProductUpdateDependencies: false,
      checkForMissingDependencies: false,
      publishAfterImport: false,
      autoSaveSolutions: false,
      notifyOnImportSuccess: false,
      showPreImportSummary: false,
      updateSourceSolutionVersion: "prompt",
      versionSchema: "revision",
      versionDateMask: "yyyy.MM.dd.x",
      importMode: "update",
      exportAutoNumberingSettings: false,
      exportCalendarSettings: false,
      exportCustomizationSettings: false,
      exportEmailTrackingSettings: false,
      exportExternalApplications: false,
      exportGeneralSettings: false,
      exportIsvConfig: false,
      exportMarketingSettings: false,
      exportOutlookSynchronizationSettings: false,
      exportRelationshipRoles: false,
      exportSales: false,
    };
  }

  async updateSolutionVersion(solutionId: string, version: string): Promise<void> {
    await this.dvApi.update("solution", solutionId, { version }, "primary");
  }

  async getSourceSolutions(): Promise<SolutionSummary[]> {
    const response = await this.dvApi.getSolutions([...SOURCE_COLUMNS], "primary");

    return response.value
      .map((row) => ({
        id: asString(row.solutionid),
        uniqueName: asString(row.uniquename),
        friendlyName: asString(row.friendlyname),
        version: asString(row.version),
        isManaged: asBoolean(row.ismanaged),
        isVisible: asBoolean(row.isvisible),
      }))
      .filter((row) => row.id && row.uniqueName && row.isVisible && row.uniqueName.toLowerCase() !== "default")
      .filter((row) => !row.isManaged)
      .sort((a, b) => a.friendlyName.localeCompare(b.friendlyName))
      .map((row) => ({
        id: row.id,
        uniqueName: row.uniqueName,
        friendlyName: row.friendlyName || row.uniqueName,
        version: row.version,
        isManaged: row.isManaged,
      }));
  }

  async getTargetVersions(uniqueNames: string[]): Promise<Map<string, string>> {
    const namesSet = new Set(uniqueNames.map((name) => name.toLowerCase()));
    if (namesSet.size === 0) {
      return new Map<string, string>();
    }

    const response = await this.dvApi.getSolutions([...TARGET_COLUMNS], "secondary");
    const versions = new Map<string, string>();

    for (const row of response.value) {
      const uniqueName = asString(row.uniquename);
      const version = asString(row.version);
      if (!uniqueName || !version || !namesSet.has(uniqueName.toLowerCase())) {
        continue;
      }
      versions.set(uniqueName, version);
    }

    return versions;
  }

  async exportSolution(solutionUniqueName: string, settings: TransferSettings): Promise<string> {
    const response = await this.dvApi.execute(
      {
        operationName: "ExportSolution",
        operationType: "action",
        parameters: {
          Managed: settings.managed,
          SolutionName: solutionUniqueName,
          ExportAutoNumberingSettings: settings.exportAutoNumberingSettings,
          ExportCalendarSettings: settings.exportCalendarSettings,
          ExportCustomizationSettings: settings.exportCustomizationSettings,
          ExportEmailTrackingSettings: settings.exportEmailTrackingSettings,
          ExportExternalApplications: settings.exportExternalApplications,
          ExportGeneralSettings: settings.exportGeneralSettings,
          ExportIsvConfig: settings.exportIsvConfig,
          ExportMarketingSettings: settings.exportMarketingSettings,
          ExportOutlookSynchronizationSettings: settings.exportOutlookSynchronizationSettings,
          ExportRelationshipRoles: settings.exportRelationshipRoles,
          ExportSales: settings.exportSales,
        },
      },
      "primary"
    );

    return toBase64(response.ExportSolutionFile);
  }

  async importSolution(customizationFile: string, settings: TransferSettings): Promise<void> {
    const actionName = settings.importMode === "upgrade" ? "StageAndUpgrade" : "ImportSolution";
    const params: Record<string, unknown> = {
      CustomizationFile: customizationFile,
      ConvertToManaged: settings.convertToManaged,
      OverwriteUnmanagedCustomizations: settings.overwriteUnmanagedCustomizations,
      PublishWorkflows: settings.publishWorkflows,
      SkipProductUpdateDependencies: settings.skipProductUpdateDependencies,
      ImportJobId: crypto.randomUUID(),
    };

    if (settings.importMode === "stageForUpgrade") {
      params.HoldingSolution = true;
    }

    await this.dvApi.execute(
      {
        operationName: actionName,
        operationType: "action",
        parameters: params,
      },
      "secondary"
    );
  }

  async checkForMissingDependencies(customizationFile: string): Promise<MissingDependencyCheckResult> {
    console.log("Checking for missing dependencies with customization file of length:", customizationFile);
    const response = await this.dvApi.execute(
      {
        operationName: "RetrieveMissingComponents",
        operationType: "function",
        parameters: {
          CustomizationFile: customizationFile,
        },
      },
      "secondary"
    );

    console.log("Raw missing components response:", response);
    const missingComponents = (response as { MissingComponents?: unknown[] }).MissingComponents ?? [];
    const details = missingComponents.map((item) => {
      const record = asRecord(item);

      return {
        schemaName: asString(record.schemaName) || asString(record.SchemaName) || "Unknown component",
        parentSchemaName: asString(record.parentSchemaName) || asString(record.ParentSchemaName),
        requiredSolution: asString(record.solution) || asString(record.requiredSolution) || asString(record.RequiredSolution),
        type: asString(record.typeLabel) || asString(record.type) || asString(record.TypeLabel),
      };
    });

    return {
      missingComponentCount: missingComponents.length,
      missingComponents: details,
    };
  }

  async publishCustomizations(): Promise<void> {
    await this.dvApi.execute(
      {
        operationName: "PublishAllXml",
        operationType: "action",
      },
      "secondary"
    );
  }
}
