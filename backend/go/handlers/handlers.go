package handlers

import (
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"video-transcoder/config"
	"video-transcoder/models"
	"video-transcoder/queue"
	"video-transcoder/store"
)

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type Handler struct {
	store  *store.Store
	queue  *queue.TaskQueue
	logger *zap.Logger
	config *config.Config
}

func NewHandler(s *store.Store, q *queue.TaskQueue, logger *zap.Logger, cfg *config.Config) *Handler {
	return &Handler{
		store:  s,
		queue:  q,
		logger: logger,
		config: cfg,
	}
}

func (h *Handler) Health(c *gin.Context) {
	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		},
	})
}

func (h *Handler) UploadFile(c *gin.Context) {
	form, err := c.MultipartForm()
	if err != nil {
		h.logger.Error("Failed to parse multipart form", zap.Error(err))
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid form data: " + err.Error(),
		})
		return
	}

	files := form.File["files"]
	if len(files) == 0 {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "No files provided",
		})
		return
	}

	templateID := c.PostForm("template_id")
	if templateID == "" {
		templates, _ := h.store.ListTemplates()
		for _, t := range templates {
			if t.IsDefault {
				templateID = t.ID
				break
			}
		}
	}

	template, err := h.store.GetTemplate(templateID)
	if err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid template ID",
		})
		return
	}

	tagsStr := c.PostForm("tags")
	var tags []string
	if tagsStr != "" {
		tags = strings.Split(tagsStr, ",")
		for i, tag := range tags {
			tags[i] = strings.TrimSpace(tag)
		}
	}

	var resources []*models.Resource
	var tasks []*models.Task

	for _, fileHeader := range files {
		resource, task, err := h.processUploadedFile(fileHeader, template, tags)
		if err != nil {
			h.logger.Error("Failed to process file", zap.String("filename", fileHeader.Filename), zap.Error(err))
			continue
		}
		resources = append(resources, resource)
		tasks = append(tasks, task)
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"resources": resources,
			"tasks":     tasks,
		},
	})
}

func (h *Handler) processUploadedFile(fileHeader *multipart.FileHeader, template *models.TranscodeTemplate, tags []string) (*models.Resource, *models.Task, error) {
	file, err := fileHeader.Open()
	if err != nil {
		return nil, nil, err
	}
	defer file.Close()

	resource := models.NewResource()
	resource.Name = fileHeader.Filename
	resource.OriginalName = fileHeader.Filename
	resource.Size = fileHeader.Size
	resource.MimeType = fileHeader.Header.Get("Content-Type")
	resource.Tags = tags

	ext := strings.ToLower(filepath.Ext(resource.Name))
	switch ext {
	case ".mp4", ".avi", ".mkv", ".mov", ".wmv", ".flv", ".webm", ".m4v":
		resource.FileType = "video"
	case ".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp":
		resource.FileType = "image"
	case ".mp3", ".wav", ".flac", ".aac", ".ogg":
		resource.FileType = "audio"
	default:
		resource.FileType = "other"
	}

	safeName := h.generateSafeFileName(resource.ID, resource.Name)
	resource.Path = filepath.Join(h.config.Storage.UploadDir, safeName)

	dst, err := os.Create(resource.Path)
	if err != nil {
		return nil, nil, err
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		return nil, nil, err
	}

	if err := h.store.CreateResource(resource); err != nil {
		return nil, nil, err
	}

	task := models.NewTask(resource.ID, resource.Name, template)
	if err := h.store.CreateTask(task); err != nil {
		return nil, nil, err
	}

	h.logger.Info("File uploaded and task created",
		zap.String("resource_id", resource.ID),
		zap.String("task_id", task.ID),
		zap.String("filename", resource.Name))

	return resource, task, nil
}

func (h *Handler) generateSafeFileName(id, originalName string) string {
	ext := filepath.Ext(originalName)
	return id + ext
}

func (h *Handler) ListResources(c *gin.Context) {
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	resources, total := h.store.ListResources(offset, limit)

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"items": resources,
			"total": total,
			"offset": offset,
			"limit":  limit,
		},
	})
}

func (h *Handler) GetResource(c *gin.Context) {
	id := c.Param("id")

	resource, err := h.store.GetResource(id)
	if err != nil {
		c.JSON(http.StatusNotFound, APIResponse{
			Success: false,
			Error:   "Resource not found",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    resource,
	})
}

func (h *Handler) DeleteResource(c *gin.Context) {
	id := c.Param("id")

	resource, err := h.store.GetResource(id)
	if err != nil {
		c.JSON(http.StatusNotFound, APIResponse{
			Success: false,
			Error:   "Resource not found",
		})
		return
	}

	if err := h.store.DeleteResource(id); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to delete resource",
		})
		return
	}

	if resource.Path != "" {
		os.Remove(resource.Path)
	}

	h.logger.Info("Resource deleted", zap.String("resource_id", id))

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    map[string]string{"id": id},
	})
}

func (h *Handler) ListTasks(c *gin.Context) {
	statusStr := c.Query("status")
	var status models.TaskStatus
	if statusStr != "" {
		status = models.TaskStatus(statusStr)
	}

	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	tasks, total := h.store.ListTasks(status, offset, limit)

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"items": tasks,
			"total": total,
			"offset": offset,
			"limit":  limit,
		},
	})
}

func (h *Handler) GetTask(c *gin.Context) {
	id := c.Param("id")

	task, err := h.store.GetTask(id)
	if err != nil {
		c.JSON(http.StatusNotFound, APIResponse{
			Success: false,
			Error:   "Task not found",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    task,
	})
}

func (h *Handler) RetryTask(c *gin.Context) {
	id := c.Param("id")

	if err := h.queue.RetryTask(id); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	task, _ := h.store.GetTask(id)

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    task,
	})
}

func (h *Handler) CancelTask(c *gin.Context) {
	id := c.Param("id")

	if err := h.queue.CancelTask(id); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	task, _ := h.store.GetTask(id)

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    task,
	})
}

func (h *Handler) GetQueueStats(c *gin.Context) {
	stats := h.queue.GetQueueStats()

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    stats,
	})
}

func (h *Handler) ListTemplates(c *gin.Context) {
	templates, err := h.store.ListTemplates()
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to list templates",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    templates,
	})
}

func (h *Handler) GetTemplate(c *gin.Context) {
	id := c.Param("id")

	template, err := h.store.GetTemplate(id)
	if err != nil {
		c.JSON(http.StatusNotFound, APIResponse{
			Success: false,
			Error:   "Template not found",
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    template,
	})
}

func (h *Handler) CreateTemplate(c *gin.Context) {
	var template models.TranscodeTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "Invalid request body: " + err.Error(),
		})
		return
	}

	newTemplate := models.NewTranscodeTemplate()
	newTemplate.Name = template.Name
	newTemplate.Description = template.Description
	newTemplate.Video = template.Video
	newTemplate.Audio = template.Audio
	newTemplate.Output = template.Output
	newTemplate.Metadata = template.Metadata

	if err := h.store.CreateTemplate(newTemplate); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   "Failed to create template",
		})
		return
	}

	h.logger.Info("Template created", zap.String("template_id", newTemplate.ID))

	c.JSON(http.StatusCreated, APIResponse{
		Success: true,
		Data:    newTemplate,
	})
}

func (h *Handler) ListLogs(c *gin.Context) {
	taskID := c.Query("task_id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	logs, total := h.store.GetLogs(taskID, offset, limit)

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: map[string]interface{}{
			"items": logs,
			"total": total,
			"offset": offset,
			"limit":  limit,
		},
	})
}

func (h *Handler) ServeStatic(c *gin.Context) {
	path := c.Param("path")
	
	fullPath := filepath.Join(h.config.Server.StaticDir, path)
	
	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		c.File(filepath.Join(h.config.Server.StaticDir, "index.html"))
		return
	}

	c.File(fullPath)
}

func (h *Handler) ServeThumbnail(c *gin.Context) {
	filename := c.Param("filename")
	path := filepath.Join(h.config.Storage.ThumbnailDir, filename)
	
	if _, err := os.Stat(path); err != nil {
		c.JSON(http.StatusNotFound, APIResponse{
			Success: false,
			Error:   "Thumbnail not found",
		})
		return
	}

	c.File(path)
}
