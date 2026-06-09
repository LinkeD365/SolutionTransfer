# Solution Transfer Tool

Solution Transfer Tool is a Power Platform ToolBox extension that copies Dataverse solutions from a source environment (primary connection) to a target environment (secondary connection).

The tool is designed for fast, repeatable promotion of solution updates across environments, with visibility into version differences and transfer progress.

## What The Tool Does

- Reads source solutions from the primary Dataverse connection.
- Reads matching solution versions from the secondary Dataverse connection.
- Shows source vs target version comparison in a grid.
- Exports selected source solutions and imports them into the target.
- Tracks transfer progress and logs in real time.

## Transfer Settings

- Import mode:
    - Update
    - Stage for upgrade
    - Upgrade
- Export as managed
- Convert to managed
- Overwrite unmanaged customizations
- Publish workflows
- Skip product update dependencies
- Publish customizations after import
- Checks for connection references
- Optionally saves the solutions

## Notes

- The tool requires both primary and secondary ToolBox Dataverse connections.
- Source list is filtered to visible, non-default, unmanaged solutions.
- Notifications are shown through ToolBox when key success or failure events occur.

## License

MIT
