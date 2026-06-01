package cli

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/lanesket/llm.log/internal/config"
	"github.com/spf13/cobra"
)

func init() {
	rootCmd.AddCommand(rawlogCmd)
}

var rawlogCmd = &cobra.Command{
	Use:   "rawlog [enable|disable|status]",
	Short: "Manage full raw request/response logging",
	Long: `Control whether the proxy saves complete HTTP transcripts
(request headers, request body, response body) to per-request log files.

Files are written to ~/.llm.log/logs/MM-DD/YYYYMMDDTHHMMSS_<id>.log
with REQ|/RES|/END|/ERR| line prefixes.

Enable by editing ~/.llm.log/config.yaml:

  raw_log: true`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir := DataDir()
		configPath := filepath.Join(dir, "config.yaml")

		switch args[0] {
		case "enable":
			return writeRawLogConfig(configPath, true)
		case "disable":
			return writeRawLogConfig(configPath, false)
		case "status":
			cfg, _ := config.Load(dir)
			if cfg.RawLog {
				fmt.Println("● Raw logging: enabled")
				fmt.Println("  Log directory:", filepath.Join(dir, "logs"))
			} else {
				fmt.Println("○ Raw logging: disabled")
			}
			return nil
		default:
			return fmt.Errorf("unknown argument %q (use enable, disable, or status)", args[0])
		}
	},
}

// writeRawLogConfig writes or updates config.yaml with the raw_log setting.
// Preserves any existing lines it doesn't understand.
func writeRawLogConfig(path string, enabled bool) error {
	value := "true"
	if !enabled {
		value = "false"
	}

	data, _ := os.ReadFile(path)
	newContent := setYAMLField(string(data), "raw_log", value)

	if err := os.WriteFile(path, []byte(newContent), 0644); err != nil {
		return fmt.Errorf("write config: %w", err)
	}

	if enabled {
		fmt.Println("✓ Raw logging enabled — restart daemon to apply (llm-log restart)")
	} else {
		fmt.Println("✓ Raw logging disabled — restart daemon to apply (llm-log restart)")
	}
	return nil
}

// setYAMLField sets a top-level key in a simple YAML document.
// Only handles key: value on a single line — good enough for our small config.
func setYAMLField(content, key, value string) string {
	lines := strings.Split(content, "\n")
	found := false
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			continue
		}
		if k, _, ok := strings.Cut(trimmed, ":"); ok && strings.TrimSpace(k) == key {
			lines[i] = key + ": " + value
			found = true
			break
		}
	}
	if !found {
		// Append; ensure trailing newline
		if content != "" && !strings.HasSuffix(content, "\n") {
			content += "\n"
		}
		content += key + ": " + value + "\n"
		return content
	}
	return strings.Join(lines, "\n")
}
