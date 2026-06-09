import React from "react";
import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Card,
  CardHeader,
  Dropdown,
  Input,
  Option,
  Switch,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { InfoLabel } from "@fluentui/react-components/unstable";
import { observer } from "mobx-react";

import type { ImportMode, UpdateSourceSolutionVersion, VersionSchema } from "../services/solutionTransferService";
import { ViewModel } from "../model/viewModel";

const useStyles = makeStyles({
  cardBody: {
    display: "grid",
    gap: tokens.spacingVerticalM,
    paddingTop: tokens.spacingVerticalS,
    minHeight: 0,
    overflow: "auto",
  },
  panel: {
    display: "grid",
    gap: tokens.spacingVerticalS,
  },
  settingsGrid: {
    display: "grid",
    gap: tokens.spacingVerticalS,
  },
  fieldRow: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
  },
  importModeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: tokens.spacingHorizontalS,
  },
  importModeDropdown: {
    minWidth: "180px",
    maxWidth: "220px",
  },
  accordion: {
    display: "grid",
    gap: tokens.spacingVerticalXS,
    alignContent: "start",
    alignSelf: "start",
    height: "fit-content",
  },
});

type TransferSettingsPanelProps = {
  vm: ViewModel;
  className?: string;
};

type SettingRowProps = {
  label: string;
  hint: string;
  children: React.ReactNode;
};

function SettingRow({ label, hint, children }: SettingRowProps): React.JSX.Element {
  const styles = useStyles();

  return (
    <div className={styles.fieldRow}>
      <InfoLabel info={hint}>{label}</InfoLabel>
      {children}
    </div>
  );
}

export const TransferSettingsPanel = observer(({ vm, className }: TransferSettingsPanelProps): React.JSX.Element => {
  const styles = useStyles();

  return (
    <Card className={className}>
      <CardHeader header={<Text weight="semibold">Transfer settings</Text>} />
      <div className={styles.cardBody}>
        <Accordion className={styles.accordion} collapsible multiple defaultOpenItems={["general", "export", "import"]}>
          <AccordionItem value="general">
            <AccordionHeader>General</AccordionHeader>
            <AccordionPanel>
              <div className={styles.settingsGrid}>
                <SettingRow
                  label="Auto save exported solutions"
                  hint="Save every exported package to disk before the import starts."
                >
                  <Switch
                    checked={vm.settings.autoSaveSolutions}
                    onChange={(_, data) => vm.updateSetting("autoSaveSolutions", data.checked)}
                  />
                </SettingRow>
                <SettingRow
                  label="Show pre-import summary"
                  hint="Show a final review dialog with the selected options and solutions before transfer begins."
                >
                  <Switch
                    checked={vm.settings.showPreImportSummary}
                    onChange={(_, data) => vm.updateSetting("showPreImportSummary", data.checked)}
                  />
                </SettingRow>
                <SettingRow
                  label="Notify after each import"
                  hint="Show a success notification when each individual solution finishes importing."
                >
                  <Switch
                    checked={vm.settings.notifyOnImportSuccess}
                    onChange={(_, data) => vm.updateSetting("notifyOnImportSuccess", data.checked)}
                  />
                </SettingRow>
              </div>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="solutionVersion">
            <AccordionHeader>Solution version</AccordionHeader>
            <AccordionPanel>
              <div className={styles.settingsGrid}>
                <SettingRow
                  label="Update source solution version"
                  hint="Change the Dataverse solution version before exporting"
                >
                  <Dropdown
                    inlinePopup
                    selectedOptions={[vm.settings.updateSourceSolutionVersion]}
                    value={
                      vm.settings.updateSourceSolutionVersion === "yes"
                        ? "Yes"
                        : vm.settings.updateSourceSolutionVersion === "prompt"
                        ? "Prompt"
                        : "No"
                    }
                    onOptionSelect={(_, data) => {
                      const value = data.optionValue as UpdateSourceSolutionVersion | undefined;
                      if (value) {
                        vm.updateSourceSolutionVersion(value);
                      }
                    }}
                  >
                    <Option value="no">No</Option>
                    <Option value="yes">Yes</Option>
                    <Option value="prompt">Prompt</Option>
                  </Dropdown>
                </SettingRow>

                <SettingRow
                  label="Version schema"
                  hint="Choose how the version is incremented when the solution version is updated."
                >
                  {(() => {
                    const schemaLabels: Record<VersionSchema, string> = {
                      major: "Major (x.0.0.0)",
                      minor: "Minor (0.x.0.0)",
                      build: "Build (0.0.x.0)",
                      revision: "Revision (0.0.0.x)",
                      manual: "Manual",
                      date: "Date (yyyy.MM.dd.x)",
                    };

                    return (
                  <Dropdown
                    inlinePopup
                    selectedOptions={[vm.settings.versionSchema]}
                    value={schemaLabels[vm.settings.versionSchema]}
                    disabled={vm.settings.updateSourceSolutionVersion === "no"}
                    onOptionSelect={(_, data) => {
                      const value = data.optionValue as VersionSchema | undefined;
                      if (value) {
                        vm.updateVersionSchema(value);
                      }
                    }}
                  >
                    <Option value="major">{schemaLabels.major}</Option>
                    <Option value="minor">{schemaLabels.minor}</Option>
                    <Option value="build">{schemaLabels.build}</Option>
                    <Option value="revision">{schemaLabels.revision}</Option>
                    <Option value="manual">{schemaLabels.manual}</Option>
                    <Option value="date">{schemaLabels.date}</Option>
                  </Dropdown>
                    );
                  })()}
                </SettingRow>

                <SettingRow
                  label="Date version mask"
                  hint="Used only when the schema is Date. The x placeholder is replaced with an incrementing number."
                >
                  <Input
                    value={vm.settings.versionDateMask}
                    onChange={(_, data) => vm.updateVersionDateMask(data.value)}
                    placeholder="yyyy.MM.dd.x"
                    disabled={vm.settings.versionSchema !== "date"}
                  />
                </SettingRow>
              </div>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="export">
            <AccordionHeader>Export</AccordionHeader>
            <AccordionPanel>
              <div className={styles.settingsGrid}>
                <SettingRow label="Export as managed" hint="Export the solution package as managed instead of unmanaged.">
                  <Switch checked={vm.settings.managed} onChange={(_, data) => vm.updateSetting("managed", data.checked)} />
                </SettingRow>
                <SettingRow
                  label="Export auto-numbering settings"
                  hint="Include autonumbering definitions in the exported solution."
                >
                  <Switch
                    checked={vm.settings.exportAutoNumberingSettings}
                    onChange={(_, data) => vm.updateSetting("exportAutoNumberingSettings", data.checked)}
                  />
                </SettingRow>
                <SettingRow label="Export calendar settings" hint="Include calendar-related organization settings in the export.">
                  <Switch checked={vm.settings.exportCalendarSettings} onChange={(_, data) => vm.updateSetting("exportCalendarSettings", data.checked)} />
                </SettingRow>
                <SettingRow
                  label="Export customization settings"
                  hint="Include customization settings such as entities, forms, and other solution customizations."
                >
                  <Switch
                    checked={vm.settings.exportCustomizationSettings}
                    onChange={(_, data) => vm.updateSetting("exportCustomizationSettings", data.checked)}
                  />
                </SettingRow>
                <SettingRow
                  label="Export email tracking settings"
                  hint="Include email tracking configuration in the exported package."
                >
                  <Switch
                    checked={vm.settings.exportEmailTrackingSettings}
                    onChange={(_, data) => vm.updateSetting("exportEmailTrackingSettings", data.checked)}
                  />
                </SettingRow>
                <SettingRow
                  label="Export external applications"
                  hint="Include external application definitions when the target environment supports them."
                >
                  <Switch
                    checked={vm.settings.exportExternalApplications}
                    onChange={(_, data) => vm.updateSetting("exportExternalApplications", data.checked)}
                  />
                </SettingRow>
                <SettingRow label="Export general settings" hint="Include general solution settings in the export.">
                  <Switch checked={vm.settings.exportGeneralSettings} onChange={(_, data) => vm.updateSetting("exportGeneralSettings", data.checked)} />
                </SettingRow>
                <SettingRow label="Export ISV config" hint="Include ISV configuration data in the solution export.">
                  <Switch checked={vm.settings.exportIsvConfig} onChange={(_, data) => vm.updateSetting("exportIsvConfig", data.checked)} />
                </SettingRow>
                <SettingRow
                  label="Export marketing settings"
                  hint="Include marketing settings that belong to the source solution."
                >
                  <Switch
                    checked={vm.settings.exportMarketingSettings}
                    onChange={(_, data) => vm.updateSetting("exportMarketingSettings", data.checked)}
                  />
                </SettingRow>
                <SettingRow
                  label="Export Outlook synchronization settings"
                  hint="Include Outlook synchronization settings in the exported package."
                >
                  <Switch
                    checked={vm.settings.exportOutlookSynchronizationSettings}
                    onChange={(_, data) => vm.updateSetting("exportOutlookSynchronizationSettings", data.checked)}
                  />
                </SettingRow>
                <SettingRow
                  label="Export relationship roles"
                  hint="Include relationship role records that are part of the solution."
                >
                  <Switch
                    checked={vm.settings.exportRelationshipRoles}
                    onChange={(_, data) => vm.updateSetting("exportRelationshipRoles", data.checked)}
                  />
                </SettingRow>
                <SettingRow label="Export sales settings" hint="Include sales-related solution settings in the export.">
                  <Switch checked={vm.settings.exportSales} onChange={(_, data) => vm.updateSetting("exportSales", data.checked)} />
                </SettingRow>
              </div>
            </AccordionPanel>
          </AccordionItem>

          <AccordionItem value="import">
            <AccordionHeader>Import</AccordionHeader>
            <AccordionPanel>
              <div className={styles.settingsGrid}>
                <div className={styles.fieldRow}>
                  <InfoLabel info="Choose whether the import updates the existing solution or stages it for upgrade.">
                    Import mode
                  </InfoLabel>
                  <div className={styles.importModeRow}>
                    <Dropdown
                      className={styles.importModeDropdown}
                      value={
                        vm.settings.importMode === "update"
                          ? "Update"
                          : vm.settings.importMode === "stageForUpgrade"
                          ? "Stage for upgrade"
                          : "Upgrade"
                      }
                      inlinePopup
                      selectedOptions={[vm.settings.importMode]}
                      onOptionSelect={(_, data) => {
                        const mode = data.optionValue as ImportMode | undefined;
                        if (mode) {
                          vm.updateImportMode(mode);
                        }
                      }}
                    >
                      <Option value="update">Update</Option>
                      <Option value="stageForUpgrade">Stage for upgrade</Option>
                      <Option value="upgrade">Upgrade</Option>
                    </Dropdown>
                  </div>
                </div>
                <SettingRow
                  label="Check for missing dependencies"
                  hint="Inspect the target environment for missing solution dependencies before the import starts."
                >
                  <Switch
                    checked={vm.settings.checkForMissingDependencies}
                    onChange={(_, data) => vm.updateSetting("checkForMissingDependencies", data.checked)}
                  />
                </SettingRow>
                <SettingRow
                  label="Convert to managed"
                  hint="Convert matching unmanaged components to managed components during import when the import mode allows it."
                >
                  <Switch checked={vm.settings.convertToManaged} onChange={(_, data) => vm.updateSetting("convertToManaged", data.checked)} />
                </SettingRow>
                <SettingRow
                  label="Overwrite unmanaged customizations"
                  hint="Replace existing unmanaged customizations on managed components during import."
                >
                  <Switch
                    checked={vm.settings.overwriteUnmanagedCustomizations}
                    onChange={(_, data) => vm.updateSetting("overwriteUnmanagedCustomizations", data.checked)}
                  />
                </SettingRow>
                <SettingRow label="Publish workflows" hint="Activate workflows included in the solution after import completes.">
                  <Switch checked={vm.settings.publishWorkflows} onChange={(_, data) => vm.updateSetting("publishWorkflows", data.checked)} />
                </SettingRow>
                <SettingRow
                  label="Skip product update dependencies"
                  hint="Ignore dependencies that are related to product updates during import validation."
                >
                  <Switch
                    checked={vm.settings.skipProductUpdateDependencies}
                    onChange={(_, data) => vm.updateSetting("skipProductUpdateDependencies", data.checked)}
                  />
                </SettingRow>
                <SettingRow
                  label="Publish customizations after import"
                  hint="Publish all customizations on the target environment after the import finishes."
                >
                  <Switch
                    checked={vm.settings.publishAfterImport}
                    onChange={(_, data) => vm.updateSetting("publishAfterImport", data.checked)}
                  />
                </SettingRow>
              </div>
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </div>
    </Card>
  );
});
