package main

import (
	"context"
	"encoding/json"
	"flag"
	"log"
	"net"
	"net/http"
	"office/backend/internal/server"
	"office/backend/internal/store"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	listen := flag.String("listen", "127.0.0.1:4317", "HTTP/WebSocket listen address (use :0 for an ephemeral port)")
	data := flag.String("data", ".office-data", "workspace directory")
	web := flag.String("web", "", "compiled web assets directory")
	origin := flag.String("allow-origin", "", "additional allowed UI origin for development")
	flag.Parse()
	s, e := store.Open(*data)
	if e != nil {
		log.Fatal(e)
	}
	svc := server.New(s, *web, *origin)
	ln, e := net.Listen("tcp", *listen)
	if e != nil {
		log.Fatal(e)
	}
	httpServer := &http.Server{Handler: svc.Handler(), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 90 * time.Second}
	_ = json.NewEncoder(os.Stdout).Encode(map[string]string{"event": "ready", "url": "http://" + ln.Addr().String()})
	done := make(chan os.Signal, 1)
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-done
		svc.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = httpServer.Shutdown(ctx)
	}()
	if e = httpServer.Serve(ln); e != nil && e != http.ErrServerClosed {
		log.Fatal(e)
	}
}
