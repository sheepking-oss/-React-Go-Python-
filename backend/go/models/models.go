package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

type TaskStatus string

const (
	TaskStatusPending      TaskStatus = "pending"
	TaskStatusQueued       TaskStatus = "queued"
	TaskStatusProcessing   TaskStatus = "processing"
	TaskStatusCompleted    TaskStatus = "completed"
	TaskStatusFailed       TaskStatus = "failed"
	TaskStatusRetrying     TaskStatus = "retrying"
	TaskStatusCancelled    TaskStatus = "cancelled"
	TaskStatusUploadFailed TaskStatus = "upload_failed"
)

type UploadErrorCode string

const (
	UploadErrorCodeInvalidType    UploadErrorCode = "invalid_type"
	UploadErrorCodeFileTooLarge   UploadErrorCode = "file_too_large"
	UploadErrorCodeFileTooSmall   UploadErrorCode = "file_too_small"
	UploadErrorCodeReadError      UploadErrorCode = "read_error"
	UploadErrorCodeSaveError      UploadErrorCode = "save_error"
	UploadErrorCodeInternalError  UploadErrorCode = "internal_error"
)

type FileUploadResult struct {
	FileName    string          `json:"file_name"`
	FileSize    int64           `json:"file_size"`
	Success     bool            `json:"success"`
	ResourceID  string          `json:"resource_id,omitempty"`
	TaskID      string          `json:"task_id,omitempty"`
	ErrorCode   UploadErrorCode `json:"error_code,omitempty"`
	ErrorMessage string         `json:"error_message,omitempty"`
}

type TaskPriority int

const (
	TaskPriorityLow    TaskPriority = 0
	TaskPriorityNormal TaskPriority = 50
	TaskPriorityHigh   TaskPriority = 100
)

type Resource struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	OriginalName string           `json:"original_name"`
	Path        string            `json:"path"`
	Size        int64             `json:"size"`
	MimeType    string            `json:"mime_type"`
	FileType    string            `json:"file_type"`
	Tags        []string          `json:"tags"`
	Duration    float64           `json:"duration"`
	Width       int               `json:"width"`
	Height      int               `json:"height"`
	Codec       string            `json:"codec"`
	Bitrate     int               `json:"bitrate"`
	FPS         float64           `json:"fps"`
	Thumbnail   string            `json:"thumbnail"`
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type Task struct {
	ID              string            `json:"id"`
	ResourceID      string            `json:"resource_id"`
	ResourceName    string            `json:"resource_name"`
	TemplateID      string            `json:"template_id"`
	TemplateName    string            `json:"template_name"`
	Status          TaskStatus        `json:"status"`
	Priority        TaskPriority      `json:"priority"`
	Progress        float64           `json:"progress"`
	ProgressMessage string            `json:"progress_message"`
	OutputPath      string            `json:"output_path"`
	OutputSize      int64             `json:"output_size"`
	RetryCount      int               `json:"retry_count"`
	MaxRetries      int               `json:"max_retries"`
	ErrorMessage    string            `json:"error_message"`
	ErrorDetails    string            `json:"error_details"`
	StartedAt       *time.Time        `json:"started_at"`
	CompletedAt     *time.Time        `json:"completed_at"`
	QueuedAt        *time.Time        `json:"queued_at"`
	DurationSeconds float64           `json:"duration_seconds"`
	Metadata        map[string]string `json:"metadata"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type TranscodeTemplate struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description string            `json:"description"`
	IsDefault   bool              `json:"is_default"`
	Video       VideoSettings     `json:"video"`
	Audio       AudioSettings     `json:"audio"`
	Output      OutputSettings    `json:"output"`
	Metadata    map[string]string `json:"metadata"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type VideoSettings struct {
	Codec       string  `json:"codec"`
	Width       int     `json:"width"`
	Height      int     `json:"height"`
	Bitrate     int     `json:"bitrate"`
	CRF         int     `json:"crf"`
	FPS         float64 `json:"fps"`
	Preset      string  `json:"preset"`
	Profile     string  `json:"profile"`
	Level       string  `json:"level"`
	PixelFormat string  `json:"pixel_format"`
}

type AudioSettings struct {
	Codec     string `json:"codec"`
	Bitrate   int    `json:"bitrate"`
	Channels  int    `json:"channels"`
	SampleRate int    `json:"sample_rate"`
}

type OutputSettings struct {
	Format       string `json:"format"`
	Container    string `json:"container"`
	SegmentTime  int    `json:"segment_time"`
	GenerateThumbnail bool `json:"generate_thumbnail"`
	GenerateHLS  bool   `json:"generate_hls"`
}

type LogEntry struct {
	ID        string            `json:"id"`
	TaskID    string            `json:"task_id"`
	ResourceID string           `json:"resource_id"`
	Level     string            `json:"level"`
	Message   string            `json:"message"`
	Details   map[string]string `json:"details"`
	CreatedAt time.Time         `json:"created_at"`
}

func NewResource() *Resource {
	return &Resource{
		ID:        uuid.New().String(),
		Tags:      []string{},
		Metadata:  make(map[string]string),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func NewTask(resourceID, resourceName string, template *TranscodeTemplate) *Task {
	return &Task{
		ID:           uuid.New().String(),
		ResourceID:   resourceID,
		ResourceName: resourceName,
		TemplateID:   template.ID,
		TemplateName: template.Name,
		Status:       TaskStatusPending,
		Priority:     TaskPriorityNormal,
		Progress:     0,
		RetryCount:   0,
		MaxRetries:   3,
		Metadata:     make(map[string]string),
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
}

func NewFailedUploadTask(
	fileName string,
	errorCode UploadErrorCode,
	errorMessage string,
	template *TranscodeTemplate,
) *Task {
	now := time.Now()
	return &Task{
		ID:              uuid.New().String(),
		ResourceID:      "",
		ResourceName:    fileName,
		TemplateID:      template.ID,
		TemplateName:    template.Name,
		Status:          TaskStatusUploadFailed,
		Priority:        TaskPriorityNormal,
		Progress:        0,
		ProgressMessage: "",
		RetryCount:      0,
		MaxRetries:      0,
		ErrorMessage:    errorMessage,
		ErrorDetails:    string(errorCode),
		StartedAt:       &now,
		CompletedAt:     &now,
		DurationSeconds: 0,
		Metadata: map[string]string{
			"error_code": string(errorCode),
			"file_name":  fileName,
		},
		CreatedAt: now,
		UpdatedAt: now,
	}
}

func NewTranscodeTemplate() *TranscodeTemplate {
	return &TranscodeTemplate{
		ID:        uuid.New().String(),
		Video: VideoSettings{
			Codec:       "libx264",
			Width:       1920,
			Height:      1080,
			Bitrate:     8000,
			CRF:         23,
			FPS:         30,
			Preset:      "medium",
			Profile:     "main",
			Level:       "4.0",
			PixelFormat: "yuv420p",
		},
		Audio: AudioSettings{
			Codec:     "aac",
			Bitrate:   128,
			Channels:  2,
			SampleRate: 44100,
		},
		Output: OutputSettings{
			Format:            "mp4",
			Container:         "mp4",
			SegmentTime:       10,
			GenerateThumbnail: true,
			GenerateHLS:       false,
		},
		Metadata:  make(map[string]string),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
}

func NewLogEntry(taskID, resourceID, level, message string, details map[string]string) *LogEntry {
	return &LogEntry{
		ID:         uuid.New().String(),
		TaskID:     taskID,
		ResourceID: resourceID,
		Level:      level,
		Message:    message,
		Details:    details,
		CreatedAt:  time.Now(),
	}
}

func (r *Resource) MarshalJSON() ([]byte, error) {
	type Alias Resource
	return json.Marshal(&struct {
		*Alias
		CreatedAt string `json:"created_at"`
		UpdatedAt string `json:"updated_at"`
	}{
		Alias:     (*Alias)(r),
		CreatedAt: r.CreatedAt.Format(time.RFC3339),
		UpdatedAt: r.UpdatedAt.Format(time.RFC3339),
	})
}

func (t *Task) MarshalJSON() ([]byte, error) {
	type Alias Task
	return json.Marshal(&struct {
		*Alias
		CreatedAt   string  `json:"created_at"`
		UpdatedAt   string  `json:"updated_at"`
		QueuedAt    *string `json:"queued_at,omitempty"`
		StartedAt   *string `json:"started_at,omitempty"`
		CompletedAt *string `json:"completed_at,omitempty"`
	}{
		Alias:     (*Alias)(t),
		CreatedAt: t.CreatedAt.Format(time.RFC3339),
		UpdatedAt: t.UpdatedAt.Format(time.RFC3339),
		QueuedAt:  formatTime(t.QueuedAt),
		StartedAt: formatTime(t.StartedAt),
		CompletedAt: formatTime(t.CompletedAt),
	})
}

func formatTime(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}
