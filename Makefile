VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
LDFLAGS  = -s -w -X github.com/lanesket/llm.log/internal/cli.Version=$(VERSION)

.PHONY: build test lint clean setup-hooks build-ui dev-ui


test:
	go test ./...

lint:
	go vet ./...

clean:
	rm -f llm-log

setup-hooks:
	git config core.hooksPath .githooks

build-web:
	cd web && npm ci && npm run build

build-server:
	go build -ldflags "$(LDFLAGS)" -o llm-log ./cmd/llm-log

build:
	make build-web
	make build-server

dev-ui:
	go run -ldflags "$(LDFLAGS)" ./cmd/llm-log ui --dev
