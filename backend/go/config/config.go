package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

type Config struct {
	Server      ServerConfig      `json:"server"`
	Storage     StorageConfig     `json:"storage"`
	Queue       QueueConfig       `json:"queue"`
	Transcoder  TranscoderConfig  `json:"transcoder"`
	Logging     LoggingConfig     `json:"logging"`
}

type ServerConfig struct {
	Port         string `json:"port"`
	StaticDir    string `json:"static_dir"`
	MaxUploadMB  int64  `json:"max_upload_mb"`
}

type StorageConfig struct {
	UploadDir   string `json:"upload_dir"`
	OutputDir   string `json:"output_dir"`
	ThumbnailDir string `json:"thumbnail_dir"`
	DatabaseDir string `json:"database_dir"`
}

type QueueConfig struct {
	MaxWorkers   int `json:"max_workers"`
	RetryLimit   int `json:"retry_limit"`
	RetryDelay   int `json:"retry_delay_seconds"`
	PollInterval int `json:"poll_interval_seconds"`
}

type TranscoderConfig struct {
	PythonScriptPath string `json:"python_script_path"`
	PythonEnv        string `json:"python_env"`
	TempDir          string `json:"temp_dir"`
}

type LoggingConfig struct {
	Level      string `json:"level"`
	OutputDir  string `json:"output_dir"`
	MaxSizeMB  int    `json:"max_size_mb"`
	MaxBackups int    `json:"max_backups"`
	MaxAgeDays int    `json:"max_age_days"`
}

var AppConfig *Config

func LoadConfig(configPath string) (*Config, error) {
	if configPath == "" {
		configPath = "config.json"
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			defaultConfig := getDefaultConfig()
			saveDefaultConfig(configPath, defaultConfig)
			AppConfig = defaultConfig
			return defaultConfig, nil
		}
		return nil, err
	}

	var config Config
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	AppConfig = &config
	initDirectories(&config)
	return &config, nil
}

func getDefaultConfig() *Config {
	baseDir, _ := os.Getwd()
	
	return &Config{
		Server: ServerConfig{
			Port:        "8080",
			StaticDir:   filepath.Join(baseDir, "static"),
			MaxUploadMB: 2048,
		},
		Storage: StorageConfig{
			UploadDir:    filepath.Join(baseDir, "storage", "uploads"),
			OutputDir:    filepath.Join(baseDir, "storage", "outputs"),
			ThumbnailDir: filepath.Join(baseDir, "storage", "thumbnails"),
			DatabaseDir:  filepath.Join(baseDir, "storage", "db"),
		},
		Queue: QueueConfig{
			MaxWorkers:   2,
			RetryLimit:   3,
			RetryDelay:   30,
			PollInterval: 5,
		},
		Transcoder: TranscoderConfig{
			PythonScriptPath: filepath.Join(baseDir, "..", "python", "main.py"),
			PythonEnv:        "python",
			TempDir:          filepath.Join(baseDir, "temp"),
		},
		Logging: LoggingConfig{
			Level:      "info",
			OutputDir:  filepath.Join(baseDir, "logs"),
			MaxSizeMB:  100,
			MaxBackups: 10,
			MaxAgeDays: 30,
		},
	}
}

func saveDefaultConfig(path string, config *Config) error {
	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}
	
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	
	return os.WriteFile(path, data, 0644)
}

func initDirectories(config *Config) {
	dirs := []string{
		config.Server.StaticDir,
		config.Storage.UploadDir,
		config.Storage.OutputDir,
		config.Storage.ThumbnailDir,
		config.Storage.DatabaseDir,
		config.Transcoder.TempDir,
		config.Logging.OutputDir,
	}

	for _, dir := range dirs {
		os.MkdirAll(dir, 0755)
	}
}
