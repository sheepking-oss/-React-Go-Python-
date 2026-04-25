package store

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"video-transcoder/models"
)

var (
	ErrNotFound      = errors.New("record not found")
	ErrAlreadyExists = errors.New("record already exists")
)

type Store struct {
	baseDir string
	mu      sync.RWMutex

	resources    map[string]*models.Resource
	tasks        map[string]*models.Task
	templates    map[string]*models.TranscodeTemplate
	logs         map[string]*models.LogEntry

	resourcesFile string
	tasksFile     string
	templatesFile string
	logsFile      string
}

func NewStore(baseDir string) (*Store, error) {
	if err := os.MkdirAll(baseDir, 0755); err != nil {
		return nil, err
	}

	s := &Store{
		baseDir:       baseDir,
		resources:     make(map[string]*models.Resource),
		tasks:         make(map[string]*models.Task),
		templates:     make(map[string]*models.TranscodeTemplate),
		logs:          make(map[string]*models.LogEntry),
		resourcesFile: filepath.Join(baseDir, "resources.json"),
		tasksFile:     filepath.Join(baseDir, "tasks.json"),
		templatesFile: filepath.Join(baseDir, "templates.json"),
		logsFile:      filepath.Join(baseDir, "logs.json"),
	}

	if err := s.load(); err != nil {
		return nil, err
	}

	if len(s.templates) == 0 {
		s.createDefaultTemplates()
	}

	return s, nil
}

func (s *Store) load() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if data, err := os.ReadFile(s.resourcesFile); err == nil {
		var resources []*models.Resource
		if json.Unmarshal(data, &resources) == nil {
			for _, r := range resources {
				s.resources[r.ID] = r
			}
		}
	}

	if data, err := os.ReadFile(s.tasksFile); err == nil {
		var tasks []*models.Task
		if json.Unmarshal(data, &tasks) == nil {
			for _, t := range tasks {
				s.tasks[t.ID] = t
			}
		}
	}

	if data, err := os.ReadFile(s.templatesFile); err == nil {
		var templates []*models.TranscodeTemplate
		if json.Unmarshal(data, &templates) == nil {
			for _, t := range templates {
				s.templates[t.ID] = t
			}
		}
	}

	if data, err := os.ReadFile(s.logsFile); err == nil {
		var logs []*models.LogEntry
		if json.Unmarshal(data, &logs) == nil {
			for _, l := range logs {
				s.logs[l.ID] = l
			}
		}
	}

	return nil
}

func (s *Store) save() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	resources := make([]*models.Resource, 0, len(s.resources))
	for _, r := range s.resources {
		resources = append(resources, r)
	}
	if data, err := json.MarshalIndent(resources, "", "  "); err == nil {
		os.WriteFile(s.resourcesFile, data, 0644)
	}

	tasks := make([]*models.Task, 0, len(s.tasks))
	for _, t := range s.tasks {
		tasks = append(tasks, t)
	}
	if data, err := json.MarshalIndent(tasks, "", "  "); err == nil {
		os.WriteFile(s.tasksFile, data, 0644)
	}

	templates := make([]*models.TranscodeTemplate, 0, len(s.templates))
	for _, t := range s.templates {
		templates = append(templates, t)
	}
	if data, err := json.MarshalIndent(templates, "", "  "); err == nil {
		os.WriteFile(s.templatesFile, data, 0644)
	}

	logs := make([]*models.LogEntry, 0, len(s.logs))
	for _, l := range s.logs {
		logs = append(logs, l)
	}
	if data, err := json.MarshalIndent(logs, "", "  "); err == nil {
		os.WriteFile(s.logsFile, data, 0644)
	}

	return nil
}

func (s *Store) createDefaultTemplates() {
	defaultTemplates := []*models.TranscodeTemplate{
		{
			ID:          "default-1080p",
			Name:        "1080p 高质量",
			Description: "1080p 高画质输出，适合专业场景",
			IsDefault:   true,
			Video: models.VideoSettings{
				Codec:       "libx264",
				Width:       1920,
				Height:      1080,
				Bitrate:     8000,
				CRF:         23,
				FPS:         30,
				Preset:      "medium",
				Profile:     "high",
				Level:       "4.1",
				PixelFormat: "yuv420p",
			},
			Audio: models.AudioSettings{
				Codec:      "aac",
				Bitrate:    192,
				Channels:   2,
				SampleRate: 48000,
			},
			Output: models.OutputSettings{
				Format:            "mp4",
				Container:         "mp4",
				SegmentTime:       10,
				GenerateThumbnail: true,
				GenerateHLS:       false,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:          "default-720p",
			Name:        "720p 标准",
			Description: "720p 标准画质，平衡质量与体积",
			IsDefault:   false,
			Video: models.VideoSettings{
				Codec:       "libx264",
				Width:       1280,
				Height:      720,
				Bitrate:     4000,
				CRF:         25,
				FPS:         30,
				Preset:      "medium",
				Profile:     "main",
				Level:       "4.0",
				PixelFormat: "yuv420p",
			},
			Audio: models.AudioSettings{
				Codec:      "aac",
				Bitrate:    128,
				Channels:   2,
				SampleRate: 44100,
			},
			Output: models.OutputSettings{
				Format:            "mp4",
				Container:         "mp4",
				SegmentTime:       10,
				GenerateThumbnail: true,
				GenerateHLS:       false,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:          "default-480p",
			Name:        "480p 低码率",
			Description: "480p 低码率，适合网络传输",
			IsDefault:   false,
			Video: models.VideoSettings{
				Codec:       "libx264",
				Width:       854,
				Height:      480,
				Bitrate:     2000,
				CRF:         28,
				FPS:         25,
				Preset:      "fast",
				Profile:     "main",
				Level:       "3.1",
				PixelFormat: "yuv420p",
			},
			Audio: models.AudioSettings{
				Codec:      "aac",
				Bitrate:    96,
				Channels:   2,
				SampleRate: 44100,
			},
			Output: models.OutputSettings{
				Format:            "mp4",
				Container:         "mp4",
				SegmentTime:       10,
				GenerateThumbnail: true,
				GenerateHLS:       false,
			},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	for _, t := range defaultTemplates {
		s.templates[t.ID] = t
	}
	s.save()
}

func (s *Store) GetResource(id string) (*models.Resource, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if r, ok := s.resources[id]; ok {
		return r, nil
	}
	return nil, ErrNotFound
}

func (s *Store) ListResources(offset, limit int) ([]*models.Resource, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	resources := make([]*models.Resource, 0, len(s.resources))
	for _, r := range s.resources {
		resources = append(resources, r)
	}

	sort.Slice(resources, func(i, j int) bool {
		return resources[i].CreatedAt.After(resources[j].CreatedAt)
	})

	total := len(resources)
	if offset >= total {
		return []*models.Resource{}, total
	}

	end := offset + limit
	if end > total {
		end = total
	}

	return resources[offset:end], total
}

func (s *Store) CreateResource(r *models.Resource) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.resources[r.ID]; ok {
		return ErrAlreadyExists
	}

	r.UpdatedAt = time.Now()
	s.resources[r.ID] = r
	go s.save()
	return nil
}

func (s *Store) UpdateResource(r *models.Resource) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.resources[r.ID]; !ok {
		return ErrNotFound
	}

	r.UpdatedAt = time.Now()
	s.resources[r.ID] = r
	go s.save()
	return nil
}

func (s *Store) DeleteResource(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.resources[id]; !ok {
		return ErrNotFound
	}

	delete(s.resources, id)
	go s.save()
	return nil
}

func (s *Store) GetTask(id string) (*models.Task, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if t, ok := s.tasks[id]; ok {
		return t, nil
	}
	return nil, ErrNotFound
}

func (s *Store) ListTasks(status models.TaskStatus, offset, limit int) ([]*models.Task, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tasks := make([]*models.Task, 0, len(s.tasks))
	for _, t := range s.tasks {
		if status == "" || t.Status == status {
			tasks = append(tasks, t)
		}
	}

	sort.Slice(tasks, func(i, j int) bool {
		if tasks[i].Priority != tasks[j].Priority {
			return tasks[i].Priority > tasks[j].Priority
		}
		return tasks[i].CreatedAt.After(tasks[j].CreatedAt)
	})

	total := len(tasks)
	if offset >= total {
		return []*models.Task{}, total
	}

	end := offset + limit
	if end > total {
		end = total
	}

	return tasks[offset:end], total
}

func (s *Store) GetPendingTasks(limit int) []*models.Task {
	s.mu.RLock()
	defer s.mu.RUnlock()

	tasks := make([]*models.Task, 0)
	for _, t := range s.tasks {
		if t.Status == models.TaskStatusQueued || t.Status == models.TaskStatusPending {
			tasks = append(tasks, t)
		}
	}

	sort.Slice(tasks, func(i, j int) bool {
		if tasks[i].Priority != tasks[j].Priority {
			return tasks[i].Priority > tasks[j].Priority
		}
		return tasks[i].CreatedAt.Before(tasks[j].CreatedAt)
	})

	if limit > 0 && len(tasks) > limit {
		return tasks[:limit]
	}
	return tasks
}

func (s *Store) CreateTask(t *models.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.tasks[t.ID]; ok {
		return ErrAlreadyExists
	}

	t.UpdatedAt = time.Now()
	s.tasks[t.ID] = t
	go s.save()
	return nil
}

func (s *Store) UpdateTask(t *models.Task) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.tasks[t.ID]; !ok {
		return ErrNotFound
	}

	t.UpdatedAt = time.Now()
	s.tasks[t.ID] = t
	go s.save()
	return nil
}

func (s *Store) DeleteTask(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.tasks[id]; !ok {
		return ErrNotFound
	}

	delete(s.tasks, id)
	go s.save()
	return nil
}

func (s *Store) GetTemplate(id string) (*models.TranscodeTemplate, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if t, ok := s.templates[id]; ok {
		return t, nil
	}
	return nil, ErrNotFound
}

func (s *Store) ListTemplates() ([]*models.TranscodeTemplate, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	templates := make([]*models.TranscodeTemplate, 0, len(s.templates))
	for _, t := range s.templates {
		templates = append(templates, t)
	}

	sort.Slice(templates, func(i, j int) bool {
		if templates[i].IsDefault != templates[j].IsDefault {
			return templates[i].IsDefault
		}
		return templates[i].CreatedAt.Before(templates[j].CreatedAt)
	})

	return templates, nil
}

func (s *Store) CreateTemplate(t *models.TranscodeTemplate) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.templates[t.ID]; ok {
		return ErrAlreadyExists
	}

	t.UpdatedAt = time.Now()
	s.templates[t.ID] = t
	go s.save()
	return nil
}

func (s *Store) UpdateTemplate(t *models.TranscodeTemplate) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.templates[t.ID]; !ok {
		return ErrNotFound
	}

	t.UpdatedAt = time.Now()
	s.templates[t.ID] = t
	go s.save()
	return nil
}

func (s *Store) DeleteTemplate(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.templates[id]; !ok {
		return ErrNotFound
	}

	delete(s.templates, id)
	go s.save()
	return nil
}

func (s *Store) GetLogs(taskID string, offset, limit int) ([]*models.LogEntry, int) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	logs := make([]*models.LogEntry, 0)
	for _, l := range s.logs {
		if taskID == "" || l.TaskID == taskID {
			logs = append(logs, l)
		}
	}

	sort.Slice(logs, func(i, j int) bool {
		return logs[i].CreatedAt.After(logs[j].CreatedAt)
	})

	total := len(logs)
	if offset >= total {
		return []*models.LogEntry{}, total
	}

	end := offset + limit
	if end > total {
		end = total
	}

	return logs[offset:end], total
}

func (s *Store) CreateLog(l *models.LogEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.logs[l.ID] = l
	go s.save()
	return nil
}
