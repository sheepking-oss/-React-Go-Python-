package queue

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"go.uber.org/zap"

	"video-transcoder/config"
	"video-transcoder/models"
	"video-transcoder/store"
)

type TaskQueue struct {
	store      *store.Store
	logger     *zap.Logger
	config     *config.Config

	mu          sync.Mutex
	workers     int
	maxWorkers  int
	runningTasks map[string]context.CancelFunc

	stopCh chan struct{}
	wg     sync.WaitGroup
}

func NewTaskQueue(s *store.Store, logger *zap.Logger, cfg *config.Config) *TaskQueue {
	return &TaskQueue{
		store:         s,
		logger:        logger,
		config:        cfg,
		maxWorkers:    cfg.Queue.MaxWorkers,
		runningTasks:  make(map[string]context.CancelFunc),
		stopCh:        make(chan struct{}),
	}
}

func (q *TaskQueue) Start() {
	q.logger.Info("Starting task queue", zap.Int("max_workers", q.maxWorkers))
	
	q.wg.Add(1)
	go q.pollLoop()
}

func (q *TaskQueue) Stop() {
	q.logger.Info("Stopping task queue")
	
	close(q.stopCh)
	
	q.mu.Lock()
	for taskID, cancel := range q.runningTasks {
		q.logger.Info("Cancelling running task", zap.String("task_id", taskID))
		cancel()
	}
	q.mu.Unlock()
	
	q.wg.Wait()
	q.logger.Info("Task queue stopped")
}

func (q *TaskQueue) pollLoop() {
	defer q.wg.Done()

	ticker := time.NewTicker(time.Duration(q.config.Queue.PollInterval) * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-q.stopCh:
			return
		case <-ticker.C:
			q.processPendingTasks()
		}
	}
}

func (q *TaskQueue) processPendingTasks() {
	q.mu.Lock()
	availableWorkers := q.maxWorkers - q.workers
	q.mu.Unlock()

	if availableWorkers <= 0 {
		return
	}

	tasks := q.store.GetPendingTasks(availableWorkers)
	
	for _, task := range tasks {
		q.mu.Lock()
		if q.workers >= q.maxWorkers {
			q.mu.Unlock()
			break
		}
		
		if _, exists := q.runningTasks[task.ID]; exists {
			q.mu.Unlock()
			continue
		}
		
		q.workers++
		q.mu.Unlock()

		task.Status = models.TaskStatusQueued
		now := time.Now()
		task.QueuedAt = &now
		q.store.UpdateTask(task)
		q.logTask(task, "info", "Task queued for processing", nil)

		go q.executeTask(task)
	}
}

func (q *TaskQueue) executeTask(task *models.Task) {
	ctx, cancel := context.WithCancel(context.Background())
	
	q.mu.Lock()
	q.runningTasks[task.ID] = cancel
	q.mu.Unlock()

	defer func() {
		q.mu.Lock()
		delete(q.runningTasks, task.ID)
		q.workers--
		q.mu.Unlock()
		cancel()
	}()

	task.Status = models.TaskStatusProcessing
	task.Progress = 0
	now := time.Now()
	task.StartedAt = &now
	q.store.UpdateTask(task)
	q.logTask(task, "info", "Task started processing", nil)

	if err := q.runTranscode(ctx, task); err != nil {
		q.logger.Error("Task failed", zap.String("task_id", task.ID), zap.Error(err))
		q.handleTaskFailure(task, err.Error())
		return
	}

	task.Status = models.TaskStatusCompleted
	task.Progress = 100
	completedAt := time.Now()
	task.CompletedAt = &completedAt
	
	if task.StartedAt != nil {
		task.DurationSeconds = completedAt.Sub(*task.StartedAt).Seconds()
	}

	q.store.UpdateTask(task)
	q.logTask(task, "info", "Task completed successfully", map[string]string{
		"duration_seconds": string(rune(task.DurationSeconds)),
	})
	q.logger.Info("Task completed", zap.String("task_id", task.ID))
}

func (q *TaskQueue) runTranscode(ctx context.Context, task *models.Task) error {
	resource, err := q.store.GetResource(task.ResourceID)
	if err != nil {
		return err
	}

	template, err := q.store.GetTemplate(task.TemplateID)
	if err != nil {
		return err
	}

	inputPath := resource.Path
	outputDir := q.config.Storage.OutputDir
	taskOutputDir := filepath.Join(outputDir, task.ID)
	outputFileName := resource.Name
	if ext := filepath.Ext(outputFileName); ext != "" {
		outputFileName = outputFileName[:len(outputFileName)-len(ext)]
	}
	outputFileName += "." + template.Output.Format
	outputPath := filepath.Join(taskOutputDir, outputFileName)

	if task.RetryCount > 0 {
		q.logTask(task, "info", "Retrying task, cleaning up previous files", map[string]string{
			"retry_count": string(rune(task.RetryCount)),
			"task_output_dir": taskOutputDir,
		})
		if err := q.cleanupTaskFiles(task, taskOutputDir, outputFileName, template); err != nil {
			q.logTask(task, "warning", "Failed to cleanup previous files, continuing anyway", map[string]string{
				"error": err.Error(),
			})
		} else {
			q.logTask(task, "info", "Successfully cleaned up previous task files", nil)
		}
	}

	os.MkdirAll(taskOutputDir, 0755)

	payload := map[string]interface{}{
		"task_id":     task.ID,
		"input_path":  inputPath,
		"output_path": outputPath,
		"template":    template,
		"resource":    resource,
	}

	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	tempPayloadPath := filepath.Join(q.config.Transcoder.TempDir, task.ID+".json")
	if err := os.WriteFile(tempPayloadPath, payloadJSON, 0644); err != nil {
		return err
	}
	defer os.Remove(tempPayloadPath)

	q.logTask(task, "info", "Starting video processing", map[string]string{
		"input_path":  inputPath,
		"output_path": outputPath,
		"template":    template.Name,
	})

	cmd := exec.CommandContext(ctx, q.config.Transcoder.PythonEnv, q.config.Transcoder.PythonScriptPath, tempPayloadPath)
	cmd.Dir = filepath.Dir(q.config.Transcoder.PythonScriptPath)

	output, err := cmd.CombinedOutput()
	if err != nil {
		q.logTask(task, "error", "Transcode command failed", map[string]string{
			"error": err.Error(),
			"output": string(output),
		})
		return err
	}

	var result map[string]interface{}
	if err := json.Unmarshal(output, &result); err != nil {
		q.logTask(task, "warning", "Failed to parse Python output", map[string]string{
			"output": string(output),
		})
	} else {
		if success, ok := result["success"].(bool); ok && !success {
			if errMsg, ok := result["error"].(string); ok {
				return &TranscodeError{Message: errMsg}
			}
			return &TranscodeError{Message: "Transcode failed"}
		}

		if outputPath, ok := result["output_path"].(string); ok {
			task.OutputPath = outputPath
		}

		if thumbnail, ok := result["thumbnail"].(string); ok {
			resource.Thumbnail = thumbnail
			q.store.UpdateResource(resource)
		}

		if duration, ok := result["duration"].(float64); ok {
			resource.Duration = duration
			q.store.UpdateResource(resource)
		}

		if width, ok := result["width"].(float64); ok {
			resource.Width = int(width)
		}
		if height, ok := result["height"].(float64); ok {
			resource.Height = int(height)
		}
	}

	task.Progress = 100
	task.ProgressMessage = "Processing completed"
	q.store.UpdateTask(task)

	return nil
}

func (q *TaskQueue) handleTaskFailure(task *models.Task, errorMessage string) {
	task.Status = models.TaskStatusFailed
	task.ErrorMessage = errorMessage
	task.RetryCount++

	if task.RetryCount < task.MaxRetries {
		q.logTask(task, "warning", "Task failed, scheduling retry", map[string]string{
			"retry_count": string(rune(task.RetryCount)),
			"max_retries": string(rune(task.MaxRetries)),
		})
		
		go func() {
			delay := time.Duration(q.config.Queue.RetryDelay) * time.Second
			select {
			case <-q.stopCh:
				return
			case <-time.After(delay):
				task.Status = models.TaskStatusRetrying
				task.Progress = 0
				task.ErrorMessage = ""
				q.store.UpdateTask(task)
				q.logTask(task, "info", "Task retry initiated", nil)
			}
		}()
	} else {
		q.logTask(task, "error", "Task failed permanently", map[string]string{
			"retry_count": string(rune(task.RetryCount)),
			"error": errorMessage,
		})
	}

	completedAt := time.Now()
	task.CompletedAt = &completedAt
	if task.StartedAt != nil {
		task.DurationSeconds = completedAt.Sub(*task.StartedAt).Seconds()
	}
	
	q.store.UpdateTask(task)
}

func (q *TaskQueue) RetryTask(taskID string) error {
	task, err := q.store.GetTask(taskID)
	if err != nil {
		return err
	}

	if task.Status != models.TaskStatusFailed {
		return &InvalidStatusError{
			Expected: string(models.TaskStatusFailed),
			Actual:   string(task.Status),
		}
	}

	if err := q.forceCleanupTask(taskID); err != nil {
		q.logTask(task, "warning", "Failed to cleanup task files during manual retry", map[string]string{
			"error": err.Error(),
		})
	} else {
		q.logTask(task, "info", "Cleaned up previous files for manual retry", nil)
	}

	task.Status = models.TaskStatusPending
	task.Progress = 0
	task.ErrorMessage = ""
	task.ErrorDetails = ""
	task.RetryCount = 0
	task.StartedAt = nil
	task.CompletedAt = nil
	task.QueuedAt = nil
	task.DurationSeconds = 0

	q.store.UpdateTask(task)
	q.logTask(task, "info", "Task retry requested by user", nil)

	return nil
}

func (q *TaskQueue) CancelTask(taskID string) error {
	q.mu.Lock()
	if cancel, exists := q.runningTasks[taskID]; exists {
		cancel()
		delete(q.runningTasks, taskID)
	}
	q.mu.Unlock()

	task, err := q.store.GetTask(taskID)
	if err != nil {
		return err
	}

	task.Status = models.TaskStatusCancelled
	q.store.UpdateTask(task)
	q.logTask(task, "info", "Task cancelled by user", nil)

	return nil
}

func (q *TaskQueue) logTask(task *models.Task, level, message string, details map[string]string) {
	logEntry := models.NewLogEntry(task.ID, task.ResourceID, level, message, details)
	q.store.CreateLog(logEntry)

	switch level {
	case "error":
		q.logger.Error(message, zap.String("task_id", task.ID), zap.Any("details", details))
	case "warning":
		q.logger.Warn(message, zap.String("task_id", task.ID), zap.Any("details", details))
	default:
		q.logger.Info(message, zap.String("task_id", task.ID), zap.Any("details", details))
	}
}

func (q *TaskQueue) GetQueueStats() map[string]interface{} {
	queuedTasks, _ := q.store.ListTasks(models.TaskStatusQueued, 0, 1000)
	processingTasks, _ := q.store.ListTasks(models.TaskStatusProcessing, 0, 1000)
	failedTasks, _ := q.store.ListTasks(models.TaskStatusFailed, 0, 1000)
	completedTasks, _ := q.store.ListTasks(models.TaskStatusCompleted, 0, 1000)

	q.mu.Lock()
	runningCount := len(q.runningTasks)
	activeWorkers := q.workers
	q.mu.Unlock()

	return map[string]interface{}{
		"max_workers":     q.maxWorkers,
		"active_workers":  activeWorkers,
		"running_tasks":   runningCount,
		"queued":          len(queuedTasks),
		"processing":      len(processingTasks),
		"failed":          len(failedTasks),
		"completed":       len(completedTasks),
	}
}

type TranscodeError struct {
	Message string
}

func (e *TranscodeError) Error() string {
	return e.Message
}

type InvalidStatusError struct {
	Expected string
	Actual   string
}

func (e *InvalidStatusError) Error() string {
	return "invalid task status: expected " + e.Expected + ", got " + e.Actual
}

func (q *TaskQueue) cleanupTaskFiles(
	task *models.Task,
	taskOutputDir string,
	outputFileName string,
	template *models.TranscodeTemplate,
) error {
	if _, err := os.Stat(taskOutputDir); os.IsNotExist(err) {
		return nil
	}

	baseName := outputFileName
	if ext := filepath.Ext(baseName); ext != "" {
		baseName = baseName[:len(baseName)-len(ext)]
	}

	var filesToClean []string

	mainOutputPath := filepath.Join(taskOutputDir, outputFileName)
	filesToClean = append(filesToClean, mainOutputPath)

	if template.Output.Format == "hls" || template.Output.GenerateHLS {
		m3u8Path := filepath.Join(taskOutputDir, baseName+".m3u8")
		filesToClean = append(filesToClean, m3u8Path)

		tsFiles, _ := filepath.Glob(filepath.Join(taskOutputDir, baseName+"_*.ts"))
		filesToClean = append(filesToClean, tsFiles...)
	}

	thumbnailPath := filepath.Join(taskOutputDir, baseName+"_thumb.jpg")
	filesToClean = append(filesToClean, thumbnailPath)

	partialFiles, _ := filepath.Glob(filepath.Join(taskOutputDir, "*.tmp"))
	filesToClean = append(filesToClean, partialFiles...)
	partialFiles2, _ := filepath.Glob(filepath.Join(taskOutputDir, "*.part"))
	filesToClean = append(filesToClean, partialFiles2...)

	tempPayloadPath := filepath.Join(q.config.Transcoder.TempDir, task.ID+".json")
	filesToClean = append(filesToClean, tempPayloadPath)

	cleanedCount := 0
	for _, filePath := range filesToClean {
		if filePath == "" {
			continue
		}
		if _, err := os.Stat(filePath); err == nil {
			if err := os.Remove(filePath); err == nil {
				cleanedCount++
				q.logger.Debug("Cleaned up file", zap.String("task_id", task.ID), zap.String("file", filePath))
			} else {
				q.logger.Warn("Failed to cleanup file", zap.String("task_id", task.ID), zap.String("file", filePath), zap.Error(err))
			}
		}
	}

	if cleanedCount > 0 {
		q.logger.Info("Cleaned up task files", zap.String("task_id", task.ID), zap.Int("files_cleaned", cleanedCount))
	}

	return nil
}

func (q *TaskQueue) forceCleanupTask(taskID string) error {
	task, err := q.store.GetTask(taskID)
	if err != nil {
		return err
	}

	outputDir := q.config.Storage.OutputDir
	taskOutputDir := filepath.Join(outputDir, taskID)

	if template, err := q.store.GetTemplate(task.TemplateID); err == nil {
		outputFileName := task.ResourceName
		if ext := filepath.Ext(outputFileName); ext != "" {
			outputFileName = outputFileName[:len(outputFileName)-len(ext)]
		}
		outputFileName += "." + template.Output.Format

		return q.cleanupTaskFiles(task, taskOutputDir, outputFileName, template)
	}

	return nil
}
