# Obsidian Codepin

An Obsidian plugin that implements the Codepin specification for creating and rendering Codepin blocks directly within Obsidian.

Codepin is a specification for preserving source code references alongside the referenced snippet within Markdown documents. It helps retain both the code and its source context, making technical documents easier to revisit and understand over time. While it can be used with any source, it is best suited for references whose content is unlikely to change frequently. For many use cases, permalinks to established open source codebases on GitHub or GitLab provide a practical way to reference content that is unlikely to change frequently. Regardless of the source, the referenced snippet is preserved directly in the document. For the complete specification, format definition, and design rationale, see the [Codepin specification](https://gitlab.com/santhanuv/polylore/-/tree/main/specs/codepin).

## Usage

1. Copy a supported GitHub or GitLab permalink. Refer to the platform documentation if you are unsure how to obtain one.
2. Open the command palette.
3. Run `Codepin: Insert Spec`.
4. The plugin opens an input dialog. If a URL is available in the clipboard, it is used to prefill the input.
5. Press Enter to create the Codepin block.

For GitHub and GitLab permalinks, the plugin automatically retrieves the source content, extracts the required metadata, and generates a complete Codepin block.

Other sources can also be used, provided the URL returns the **raw source content** directly. In this case, the URL is used as both `sourceURL` and `sourceContentURL`, and you may need to manually adjust the generated metadata. Generated Codepin blocks are rendered within Obsidian. The filename is displayed at the top of the block and links to the configured `sourceURL`.

Codepin blocks are snapshots of the referenced source. This plugin does not automatically synchronize snippets when the source changes. If the stored snippet is modified locally, a warning is displayed.

## Example Block

````Markdown
```codepin
specVersion: 1.0.0
sourceURL: https://github.com/etcd-io/raft/blob/67d129e88b8ff1acbfe8957fad48a127096a47f9/raft.go#L766-L770
sourceContentURL: https://raw.githubusercontent.com/etcd-io/raft/67d129e88b8ff1acbfe8957fad48a127096a47f9/raft.go
filename: raft.go
startLine: 766
endLine: 770
lang: go
snippetHash: 910ccb03932b0cb166cb9a1de6e7f2f440e5f1647ff5e47afe958a6200159bec
sourceContentHash: d3d8fa573e1488e3aa35b9b997ba943454f3f357740a550d4bcc44d81975f07f
---
func (r *raft) appliedSnap(snap *pb.Snapshot) {
 index := snap.GetMetadata().GetIndex()
 r.raftLog.stableSnapTo(index)
 r.appliedTo(index, 0 /* size */)
}
```
````

## commands

| Command                      | Description                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `Codepin: Insert Block`      | Create a Codepin block from a source URL                                                                                |
| `Codepin: Toggle Debug Mode` | Enable or disable debug mode. Debug mode exposes additional developer-focused commands                                  |
| `Codepin: Print Metrics`     | Available only when debug mode is enabled. Prints Codepin telemetry and diagnostic information to assist with debugging |
| `Codepin: Clear Cache`       | Clears the source content cache used when creating Codepin blocks                                                       |

### Cache Behavior

When creating Codepin blocks, source content is cached for the duration of the Obsidian session. If multiple Codepin blocks reference different line ranges from the same source file, the cached content is reused instead of fetching it again.

The cache is automatically cleared when Obsidian is closed. It can also be cleared manually using the `Codepin: Clear Cache` command.

## Installation

This plugin is not yet available through the Obsidian Community Plugins directory.

### Install from a release

1. Download the latest release assets:

- main.js
- manifest.json
- styles.css

1. Create a plugin directory inside your vault:

```bash
mkdir /path/to/vault/.obsidian/plugins/obsidian-codepin-plugin
```

1. Copy the downloaded files into that directory.

2. Open Obsidian and enable the plugin from:

```text
Settings -> Community Plugins
```

### Install from source

1. Clone the repository:

   ```bash
   git clone https://gitlab.com/santhanuv/obsidian-codepin-plugin.git
   ```

2. Build the plugin:

   ```bash
   npm install
   npm run build
   ```

3. Create a symbolic link from the plugin repository to your vault's plugins directory:

   ```bash
   ln -s /path/to/obsidian-codepin-plugin /path/to/vault/.obsidian/plugins/obsidian-codepin-plugin
   ```

4. Open Obsidian and enable the plugin from:

   ```text
   Settings -> Community Plugins
   ```

5. Reload Obsidian after rebuilding the plugin to pick up changes.

## Notes and Limitations

- GitHub and GitLab permalinks are supported for automatic Codepin creation.
- Other sources can be used if they provide raw content URLs, but may require manual adjustment of metadata fields.

## Contributing

This plugin was created primarily for my own workflow and note-taking needs.

Bug reports, usability improvements, documentation updates, and support for additional source providers are welcome. If you have an idea that would genuinely improve the workflow without breaking compatibility with existing Codepin blocks, feel free to open an issue or merge request for discussion.

## Repository Mirrors

GitLab is the canonical repository for this project. GitHub is maintained as a read-only mirror.
