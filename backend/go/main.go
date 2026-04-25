package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"video-transcoder/config"
	"video-transcoder/handlers"
	"video-transcoder/logger"
	"video-transcoder/queue"
	"video-transcoder/store"
)

func main() {
	cfg, err := config.LoadConfig("config.json")
	if err != nil {
		panic("Failed to load config: " + err.Error())
	}

	log, err := logger.NewLogger(&cfg.Logging)
	if err != nil {
		panic("Failed to initialize logger: " + err.Error())
	}
	defer log.Sync()

	s, err := store.NewStore(cfg.Storage.DatabaseDir)
	if err != nil {
		log.Fatal("Failed to initialize store", zap.Error(err))
	}

	q := queue.NewTaskQueue(s, log, cfg)
	q.Start()
	defer q.Stop()

	h := handlers.NewHandler(s, q, log, cfg)

	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length", "Content-Type"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api/v1")
	{
		api.GET("/health", h.Health)

		api.POST("/upload", h.UploadFile)

		api.GET("/resources", h.ListResources)
		api.GET("/resources/:id", h.GetResource)
		api.DELETE("/resources/:id", h.DeleteResource)

		api.GET("/tasks", h.ListTasks)
		api.GET("/tasks/:id", h.GetTask)
		api.POST("/tasks/:id/retry", h.RetryTask)
		api.POST("/tasks/:id/cancel", h.CancelTask)

		api.GET("/queue/stats", h.GetQueueStats)

		api.GET("/templates", h.ListTemplates)
		api.GET("/templates/:id", h.GetTemplate)
		api.POST("/templates", h.CreateTemplate)

		api.GET("/logs", h.ListLogs)
	}

	r.GET("/thumbnails/:filename", h.ServeThumbnail)
	r.NoRoute(h.ServeStatic)

	server := &http.Server{
		Addr:    ":" + cfg.Server.Port,
		Handler: r,
	}

	go func() {
		log.Info("Starting server", zap.String("port", cfg.Server.Port))
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("Failed to start server", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown", zap.Error(err))
	}

	log.Info("Server exited properly")
}
